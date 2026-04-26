import type { App } from 'obsidian';
import type { AzioneDeclaration, Campagna, LLMAdapter, MatrixOutput } from '../types';
import { loadActionsForTurn } from '../vault/ActionLoader';
import { matrixFilePath, actionFilePath, patchActionFrontmatter } from '../vault/VaultManager';
import { patchCampagnaStato } from '../vault/CampaignWriter';
import { buildCounterArgPrompt } from './prompts/counterArgPrompt';
import { counterArgOutputSchema, CounterArgOutputZod } from './schemas/counterArgSchema';
import { LLMValidationError } from '../llm/LLMAdapter';
import { getCompressedDeltas, getHistorySummary } from '../utils/contextWindow';
import { parseYaml } from '../utils/yaml';

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

  const deltas = getCompressedDeltas(campagna.game_state_delta, campagna.llm.provider);
  const historySummary = getHistorySummary(campagna.game_state_delta, campagna.llm.provider);
  const { system, user } = buildCounterArgPrompt(campagna, actions, matrix, deltas, historySummary);

  const response = await adapter.complete({
    system,
    user,
    output_schema: counterArgOutputSchema,
    temperature: campagna.llm.temperature_mechanical,
  });

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

    // Filter out empty arguments and self-references
    const argomenti = entry.argomenti.filter(
      a => a.argomento.trim() !== '' && a.fazione !== entry.fazione_target,
    );

    await patchActionFrontmatter<AzioneDeclaration>(app, filePath, {
      argomenti_contro: argomenti,
    } as any);
  }

  await patchCampagnaStato(app, slug, 'contro_args');
}
