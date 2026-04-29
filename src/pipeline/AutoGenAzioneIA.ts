import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import type { Campagna, FazioneConfig, LLMAdapter } from '../types';
import { actionFilePath, fileExists, leaderActionFilePath, writeActionFile } from '../vault/VaultManager';
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

  const leaderAvail = fazione.leader?.presente === true;

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
  if (typeof raw?.metodo === 'string' && raw.metodo.length > 200) {
    console.warn(
      `[autoGenAzioneIA] metodo troncato per ${fazione.nome}: ${raw.metodo.length} → 200 caratteri`,
    );
    raw.metodo = raw.metodo.slice(0, 200);
  }

  const validation = ActionDeclOutputZod.safeParse(raw);
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

  if (leaderAvail) {
    const leaderFilePath = leaderActionFilePath(slug, turno_corrente, fazione.id);
    if (!(await fileExists(app, leaderFilePath))) {
      const { system: ls, user: lu } = buildActionDeclPrompt(
        campagna, fazione, deltas, historySummary, tipoRoll.tipo, true, fazione.leader?.nome,
      );
      const lr = await adapter.complete({
        system: ls,
        user: lu,
        output_schema: actionDeclOutputSchema,
        temperature: campagna.llm.temperature_mechanical,
      });
      const lRaw = lr.parsed as Record<string, unknown>;
      if (typeof lRaw?.metodo === 'string' && lRaw.metodo.length > 200) {
        lRaw.metodo = lRaw.metodo.slice(0, 200);
      }
      const lVal = ActionDeclOutputZod.safeParse(lRaw);
      if (lVal.success) {
        await writeActionFile(app, slug, turno_corrente, {
          fazione: fazione.id,
          giocatore: 'IA',
          turno: turno_corrente,
          tipo_azione: 'leader',
          categoria_azione: 'standard',
          azione: lVal.data.azione,
          metodo: lVal.data.metodo,
          argomento_vantaggio: lVal.data.argomento_vantaggio,
          argomenti_contro: [],
        });
        new Notice(`Azione leader IA generata per ${fazione.nome}.`);
      }
    }
  }
}
