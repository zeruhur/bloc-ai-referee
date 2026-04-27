import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import type { Campagna, FazioneConfig, LLMAdapter } from '../types';
import { actionFilePath, fileExists, writeActionFile } from '../vault/VaultManager';
import { getCompressedDeltas, getHistorySummary } from '../utils/contextWindow';
import { buildActionDeclPrompt } from './prompts/actionDeclPrompt';
import { actionDeclOutputSchema, ActionDeclOutputZod } from './schemas/actionDeclSchema';
import { LLMValidationError } from '../llm/LLMAdapter';
import { leaderAvailability, rollTipoAzioneIA } from '../dice/DiceEngine';
import { patchFazioneLeader } from '../vault/CampaignWriter';

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

  let leaderAvail = false;
  if (fazione.leader) {
    leaderAvail = leaderAvailability(fazione.mc, Date.now() + campagna.fazioni.indexOf(fazione) + 1000);
    if (!leaderAvail) {
      await patchFazioneLeader(app, slug, fazione.id, false);
    }
  }

  const deltas = getCompressedDeltas(campagna.game_state_delta, campagna.llm.provider);
  const historySummary = getHistorySummary(campagna.game_state_delta, campagna.llm.provider);
  const { system, user } = buildActionDeclPrompt(campagna, fazione, deltas, historySummary, tipoRoll.tipo);

  const response = await adapter.complete({
    system,
    user,
    output_schema: actionDeclOutputSchema,
    temperature: campagna.llm.temperature_mechanical,
  });

  const validation = ActionDeclOutputZod.safeParse(response.parsed);
  if (!validation.success) {
    throw new LLMValidationError(
      `Output auto-gen IA non valido per ${fazione.nome}: ${validation.error.message}`,
      response.content,
    );
  }

  const { azione, metodo, argomento_vantaggio } = validation.data;

  await writeActionFile(app, slug, turno_corrente, {
    fazione: fazione.id,
    giocatore: 'IA',
    turno: turno_corrente,
    tipo_azione: 'principale',
    categoria_azione: 'standard',
    azione,
    metodo,
    argomento_vantaggio,
    argomenti_contro: [],
    azione_extra: fazione.leader ? leaderAvail : undefined,
  });

  new Notice(`Azione IA generata per ${fazione.nome}.`);
}
