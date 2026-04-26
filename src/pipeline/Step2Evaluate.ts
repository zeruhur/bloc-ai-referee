import type { App } from 'obsidian';
import type {
  AzioneDeclaration,
  Campagna,
  DirectConflict,
  EvaluationOutput,
  LLMAdapter,
  MatrixOutput,
} from '../types';
import { loadActionsForTurn, actionFilePath } from '../vault/ActionLoader';
import { parseFrontmatter } from '../utils/yaml';
import { patchActionFrontmatter } from '../vault/VaultManager';
import { matrixFilePath } from '../vault/VaultManager';
import { patchCampagnaStato } from '../vault/CampaignWriter';
import { buildEvaluatePrompt } from './prompts/evaluatePrompt';
import { evaluateOutputSchema, EvaluateOutputZod } from './schemas/evaluateSchema';
import { LLMValidationError } from '../llm/LLMAdapter';
import { getCompressedDeltas } from '../utils/contextWindow';
import { Notice } from 'obsidian';

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

  const deltas = getCompressedDeltas(campagna.game_state_delta, campagna.llm.provider);
  const evaluations: EvaluationOutput[] = [];

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    onProgress?.(i + 1, actions.length);

    const { system, user } = buildEvaluatePrompt(campagna, matrice, action, deltas);

    const response = await adapter.complete({
      system,
      user,
      output_schema: evaluateOutputSchema,
      temperature: campagna.llm.temperature_mechanical,
    });

    const validation = EvaluateOutputZod.safeParse(response.parsed);
    if (!validation.success) {
      throw new LLMValidationError(
        `Output valutazione non valido per ${action.fazione}: ${validation.error.message}`,
        response.content,
      );
    }

    const evaluation = validation.data;
    evaluations.push(evaluation);

    const filePath = actionFilePath(slug, turno_corrente, action.fazione);
    await patchActionFrontmatter<AzioneDeclaration>(app, filePath, {
      valutazione: evaluation,
      svantaggi_propri_attivati: evaluation.svantaggi_attivati.map(s => s.id),
    } as any);
  }

  await patchCampagnaStato(app, slug, 'valutazione');

  return evaluations;
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
