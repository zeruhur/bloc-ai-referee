import type { App } from 'obsidian';
import type {
  AzioneDeclaration,
  Campagna,
  DirectConflict,
  EvaluationOutput,
  LeaderCheckResult,
  LLMAdapter,
  MatrixEntry,
  MatrixOutput,
} from '../types';
import { loadActionsForTurn, actionFilePath } from '../vault/ActionLoader';
import { parseFrontmatter } from '../utils/yaml';
import { patchActionFrontmatter, matrixFilePath, appendToRollsFile, leaderActionFilePath, turnPath } from '../vault/VaultManager';
import { readMatrixEntries, mergeMatrixEntries, writeMatrixFiles } from '../vault/MatrixWriter';
import { patchCampagnaStato } from '../vault/CampaignWriter';
import { markStepStarted, markStepCompleted, markRunFailed } from '../vault/RunStateManager';
import { buildEvaluatePrompt } from './prompts/evaluatePrompt';
import { evaluateOutputSchema, EvaluateOutputZod } from './schemas/evaluateSchema';
import { LLMValidationError } from '../llm/LLMAdapter';
import { getCompressedDeltas, getHistorySummary } from '../utils/contextWindow';
import { Notice } from 'obsidian';
import { refereeEventBus } from '../ui/RefereeEventBus';
import { LEADER_CHECK_FILE } from '../constants';

async function loadLeaderChecks(app: App, slug: string, turno: number): Promise<LeaderCheckResult[]> {
  const path = `${turnPath(slug, turno)}/${LEADER_CHECK_FILE}`;
  const exists = await app.vault.adapter.exists(path);
  if (!exists) return [];
  const content = await app.vault.adapter.read(path);
  const data = parseFrontmatter<{ leader_checks: LeaderCheckResult[] }>(content);
  return data?.leader_checks ?? [];
}

const STEP_NAME = 'Step2Evaluate';

export async function runStep2Evaluate(
  app: App,
  campagna: Campagna,
  adapter: LLMAdapter,
  onProgress?: (current: number, total: number) => void,
): Promise<EvaluationOutput[]> {
  const { slug, turno_corrente } = campagna.meta;

  const matrixPath = matrixFilePath(slug, turno_corrente);
  const matrixContent = await app.vault.adapter.read(matrixPath);
  const matrice = parseFrontmatter<MatrixOutput>(matrixContent);
  if (!matrice) {
    throw new Error('Impossibile leggere la matrice. Esegui prima "Genera matrice".');
  }

  const actions = await loadActionsForTurn(app, slug, turno_corrente);
  if (actions.length === 0) {
    throw new Error('Nessuna dichiarazione azione trovata per questo turno.');
  }

  await markStepStarted(app, slug, turno_corrente, STEP_NAME);
  refereeEventBus.emit({ type: 'step-start', step: STEP_NAME, message: `Avvio valutazione azioni (0/${actions.length})…`, timestamp: new Date() });

  try {
    const deltas = getCompressedDeltas(campagna.game_state_delta, campagna.llm.provider);
    const historySummary = getHistorySummary(campagna.game_state_delta, campagna.llm.provider);
    const leaderChecks = await loadLeaderChecks(app, slug, turno_corrente);
    const evaluations: EvaluationOutput[] = [];

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      onProgress?.(i + 1, actions.length);
      refereeEventBus.emit({ type: 'progress', step: STEP_NAME, message: `Valutando: ${action.fazione} (${i + 1}/${actions.length})`, timestamp: new Date() });

      const { system, user } = buildEvaluatePrompt(campagna, matrice, action, deltas, historySummary);

      const response = await adapter.complete({
        system,
        user,
        output_schema: evaluateOutputSchema,
        temperature: campagna.llm.temperature_mechanical,
      });

      if (response.tokens_used) {
        await appendToRollsFile(app, slug, turno_corrente,
          `\n> 🔢 Step2Evaluate (${action.fazione}) — modello: ${response.model}, token usati: ${response.tokens_used}\n`);
      }

      const validation = EvaluateOutputZod.safeParse(response.parsed);
      if (!validation.success) {
        throw new LLMValidationError(
          `Output valutazione non valido per ${action.fazione}: ${validation.error.message}`,
          response.content,
        );
      }

      const evaluation = validation.data;

      // Presenza di Comando: +1 dado positivo se il leader è disponibile
      if (action.leader_mode === 'presenza_comando') {
        const lc = leaderChecks.find(r => r.fazione === action.fazione);
        if (lc?.disponibile) {
          evaluation.pool.positivi += 1;
          evaluation.pool.netto = evaluation.pool.positivi - evaluation.pool.negativi;
          evaluation.pool.modalita = evaluation.pool.netto > 0 ? 'alto' : evaluation.pool.netto < 0 ? 'basso' : 'neutro';
          evaluation.valutazione_vantaggio.motivazione +=
            ' + 1 dado positivo (Presenza di Comando del leader)';
        }
      }

      // Interventi reattivi di tipo 'aiuto': +1 dado positivo per ogni aiuto ricevuto
      if (action.argomenti_aiuto && action.argomenti_aiuto.length > 0) {
        evaluation.pool.positivi += action.argomenti_aiuto.length;
        evaluation.pool.netto = evaluation.pool.positivi - evaluation.pool.negativi;
        evaluation.pool.modalita = evaluation.pool.netto > 0 ? 'alto' : evaluation.pool.netto < 0 ? 'basso' : 'neutro';
        const aiutoFazioni = action.argomenti_aiuto.map(a => a.fazione).join(', ');
        evaluation.valutazione_vantaggio.motivazione +=
          ` + ${action.argomenti_aiuto.length} dado/i positivo/i (Aiuto da: ${aiutoFazioni})`;
      }

      evaluations.push(evaluation);

      const filePath = action.leader_mode === 'azione_leadership'
        ? leaderActionFilePath(slug, turno_corrente, action.fazione)
        : actionFilePath(slug, turno_corrente, action.fazione);
      await patchActionFrontmatter<AzioneDeclaration>(app, filePath, {
        valutazione: evaluation,
      } as any);
    }

    // ---- Update matrix with valutazione ----
    const { publicEntries, allEntries } = await readMatrixEntries(app, slug, turno_corrente);
    const updates: Partial<MatrixEntry>[] = evaluations.map(ev => ({
      fazione: ev.fazione,
      valutazione: {
        pool: ev.pool,
        motivazione: ev.valutazione_vantaggio.motivazione,
      },
    }));
    const updatedPublic = mergeMatrixEntries(publicEntries, updates);
    const updatedAll = mergeMatrixEntries(allEntries, updates);
    await writeMatrixFiles(app, slug, turno_corrente, updatedPublic, updatedAll, campagna.fazioni);

    await patchCampagnaStato(app, slug, 'valutazione');
    await markStepCompleted(app, slug, turno_corrente, STEP_NAME, [matrixPath]);
    refereeEventBus.emit({
      type: 'step-done', step: STEP_NAME,
      message: `Valutazione completata: ${evaluations.length} azioni.`,
      timestamp: new Date(),
    });

    return evaluations;
  } catch (err) {
    refereeEventBus.emit({ type: 'error', step: STEP_NAME, message: `Errore: ${(err as Error).message}`, timestamp: new Date() });
    await markRunFailed(app, slug, turno_corrente, STEP_NAME, (err as Error).message);
    throw err;
  }
}

export function detectDirectConflicts(matrix: MatrixOutput): DirectConflict[] {
  const conflicts: DirectConflict[] = [];
  const azioni = matrix.azioni;

  for (let i = 0; i < azioni.length; i++) {
    for (let j = i + 1; j < azioni.length; j++) {
      const a = azioni[i];
      const b = azioni[j];
      if (a.conflitti_con.includes(b.fazione) && b.conflitti_con.includes(a.fazione)) {
        conflicts.push({ fazione_a: a.fazione, fazione_b: b.fazione });
      }
    }
  }

  return conflicts;
}
