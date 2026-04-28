import type { App } from 'obsidian';
import type { AzioneDeclaration, Campagna, LLMAdapter, MatrixEntry, MatrixOutput } from '../types';
import { loadActionsForTurn } from '../vault/ActionLoader';
import { matrixFilePath, actionFilePath, patchActionFrontmatter, appendToRollsFile } from '../vault/VaultManager';
import { readMatrixEntries, mergeMatrixEntries, writeMatrixFiles } from '../vault/MatrixWriter';
import { patchCampagnaStato } from '../vault/CampaignWriter';
import { markStepStarted, markStepCompleted, markRunFailed } from '../vault/RunStateManager';
import { buildCounterArgPrompt } from './prompts/counterArgPrompt';
import { counterArgOutputSchema, CounterArgOutputZod } from './schemas/counterArgSchema';
import { LLMValidationError } from '../llm/LLMAdapter';
import { getCompressedDeltas, getHistorySummary } from '../utils/contextWindow';
import { parseYaml } from '../utils/yaml';
import { refereeEventBus } from '../ui/RefereeEventBus';

const STEP_NAME = 'StepCounterArg';

export async function runStepCounterArg(
  app: App,
  campagna: Campagna,
  adapter: LLMAdapter,
): Promise<void> {
  const { slug, turno_corrente } = campagna.meta;

  const actions = await loadActionsForTurn(app, slug, turno_corrente);
  if (actions.length === 0) {
    throw new Error('Nessuna dichiarazione azione trovata per questo turno.');
  }

  const matrixPath = matrixFilePath(slug, turno_corrente);
  const matrixContent = await app.vault.adapter.read(matrixPath);
  const matrixFrontmatter = matrixContent.split('---')[1] ?? '';
  const matrix = parseYaml<MatrixOutput>(matrixFrontmatter);

  await markStepStarted(app, slug, turno_corrente, STEP_NAME);
  refereeEventBus.emit({ type: 'step-start', step: STEP_NAME, message: 'Generazione contro-argomentazioni…', timestamp: new Date() });

  try {
    const deltas = getCompressedDeltas(campagna.game_state_delta, campagna.llm.provider);
    const historySummary = getHistorySummary(campagna.game_state_delta, campagna.llm.provider);
    const { system, user } = buildCounterArgPrompt(campagna, actions, matrix, deltas, historySummary);

    const response = await adapter.complete({
      system,
      user,
      output_schema: counterArgOutputSchema,
      temperature: campagna.llm.temperature_mechanical,
    });

    if (response.tokens_used) {
      await appendToRollsFile(app, slug, turno_corrente,
        `\n> 🔢 StepCounterArg — modello: ${response.model}, token usati: ${response.tokens_used}\n`);
    }

    const validation = CounterArgOutputZod.safeParse(response.parsed);
    if (!validation.success) {
      throw new LLMValidationError(
        `Output contro-argomentazione non valido: ${validation.error.message}`,
        response.content,
      );
    }

    for (const entry of validation.data.contro_argomentazioni) {
      const filePath = actionFilePath(slug, turno_corrente, entry.fazione_target);
      const exists = await app.vault.adapter.exists(filePath);
      if (!exists) continue;

      const argomenti = entry.argomenti.filter(
        a => a.argomento.trim() !== '' && a.fazione !== entry.fazione_target,
      );

      await patchActionFrontmatter<AzioneDeclaration>(app, filePath, {
        argomenti_contro: argomenti,
      } as any);
    }

    // ---- Update matrix with contro_argomentazione ----
    const { publicEntries, allEntries } = await readMatrixEntries(app, slug, turno_corrente);
    const updates: Partial<MatrixEntry>[] = validation.data.contro_argomentazioni.map(ca => {
      const argomenti = ca.argomenti.filter(
        a => a.argomento.trim() !== '' && a.fazione !== ca.fazione_target,
      );
      const contro_argomentazione = argomenti.length > 0
        ? argomenti.map(a => `[${a.fazione}]: ${a.argomento}`).join(' | ')
        : undefined;
      return { fazione: ca.fazione_target, contro_argomentazione };
    });

    const updatedPublic = mergeMatrixEntries(publicEntries, updates);
    const updatedAll = mergeMatrixEntries(allEntries, updates);
    await writeMatrixFiles(app, slug, turno_corrente, updatedPublic, updatedAll, campagna.fazioni);

    await patchCampagnaStato(app, slug, 'contro_args');
    await markStepCompleted(app, slug, turno_corrente, STEP_NAME, [matrixPath]);
    refereeEventBus.emit({
      type: 'step-done', step: STEP_NAME,
      message: `Contro-argomentazioni generate. Token: ${response.tokens_used ?? '—'}`,
      timestamp: new Date(),
    });
  } catch (err) {
    refereeEventBus.emit({ type: 'error', step: STEP_NAME, message: `Errore: ${(err as Error).message}`, timestamp: new Date() });
    await markRunFailed(app, slug, turno_corrente, STEP_NAME, (err as Error).message);
    throw err;
  }
}
