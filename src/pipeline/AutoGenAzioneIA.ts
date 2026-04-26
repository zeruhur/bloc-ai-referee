import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import type { Campagna, FazioneConfig, LLMAdapter } from '../types';
import { actionFilePath, fileExists, writeActionFile } from '../vault/VaultManager';
import { getCompressedDeltas } from '../utils/contextWindow';
import { buildActionDeclPrompt } from './prompts/actionDeclPrompt';
import { actionDeclOutputSchema, ActionDeclOutputZod } from './schemas/actionDeclSchema';
import { LLMValidationError } from '../llm/LLMAdapter';

export async function autoGenAzioneIA(
  app: App,
  campagna: Campagna,
  fazione: FazioneConfig,
  adapter: LLMAdapter,
): Promise<void> {
  const { slug, turno_corrente } = campagna.meta;
  const filePath = actionFilePath(slug, turno_corrente, fazione.id);

  if (await fileExists(app, filePath)) {
    return; // già dichiarata — idempotente
  }

  const deltas = getCompressedDeltas(campagna.game_state_delta, campagna.llm.provider);
  const { system, user } = buildActionDeclPrompt(campagna, fazione, deltas);

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

  const { azione, metodo, vantaggi_usati } = validation.data;
  const validVantaggi = fazione.vantaggi.map(v => v.id);
  const filteredVantaggi = vantaggi_usati.filter(id => validVantaggi.includes(id));

  await writeActionFile(app, slug, turno_corrente, {
    fazione: fazione.id,
    giocatore: 'IA',
    turno: turno_corrente,
    tipo_azione: 'principale',
    azione,
    metodo,
    vantaggi_usati: filteredVantaggi,
    svantaggi_opposti: [],
    svantaggi_propri_attivati: [],
    aiuti_alleati: [],
  });

  new Notice(`Azione IA generata per ${fazione.nome}.`);
}
