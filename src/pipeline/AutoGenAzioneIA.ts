import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import type { Campagna, FazioneConfig, LLMAdapter } from '../types';
import { actionFilePath, fileExists, writeActionFile } from '../vault/VaultManager';
import { getCompressedDeltas, getHistorySummary } from '../utils/contextWindow';
import { buildActionDeclPrompt } from './prompts/actionDeclPrompt';
import { actionDeclOutputSchema, ActionDeclOutputZod } from './schemas/actionDeclSchema';
import { LLMValidationError } from '../llm/LLMAdapter';
import { rollTipoAzioneIA } from '../dice/DiceEngine';

export async function autoGenAzioneIA(
  app: App,
  campagna: Campagna,
  fazione: FazioneConfig,
  adapter: LLMAdapter,
): Promise<void> {
  const { slug, turno_corrente } = campagna.meta;
  const filePath = actionFilePath(slug, turno_corrente, fazione.id);

  if (await fileExists(app, filePath)) {
    return; // already declared — idempotent
  }

  const tipoRoll = rollTipoAzioneIA(Date.now() + campagna.fazioni.indexOf(fazione));

  const deltas = getCompressedDeltas(campagna.game_state_delta, campagna.llm.provider);
  const historySummary = getHistorySummary(campagna.game_state_delta, campagna.llm.provider);
  const { system, user } = buildActionDeclPrompt(campagna, fazione, deltas, historySummary, tipoRoll.tipo);

  const response = await adapter.complete({
    system,
    user,
    output_schema: actionDeclOutputSchema,
    temperature: campagna.llm.temperature_mechanical,
  });

  const raw = response.parsed as Record<string, unknown>;

  const validation = ActionDeclOutputZod.safeParse(raw);
  if (!validation.success) {
    throw new LLMValidationError(
      `Output auto-gen IA non valido per ${fazione.nome}: ${validation.error.message}`,
      response.content,
    );
  }

  const { risultato, azione, argomento_favorevole } = validation.data;

  await writeActionFile(app, slug, turno_corrente, {
    fazione: fazione.id,
    giocatore: 'IA',
    turno: turno_corrente,
    tipo_azione: 'principale',
    categoria_azione: 'standard',
    risultato,
    azione,
    argomento_favorevole,
    argomenti_contro: [],
  });

  new Notice(`Azione IA generata per ${fazione.nome}.`);
}
