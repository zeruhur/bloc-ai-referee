import { App, Notice, SuggestModal } from 'obsidian';
import type { FazioneConfig } from '../types';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { createAdapter } from '../llm/LLMAdapter';
import { LLMValidationError } from '../llm/LLMAdapter';
import { buildGeneraLeaderPrompt } from '../pipeline/prompts/generaLeaderPrompt';
import { generaLeaderOutputSchema, GeneraLeaderOutputZod } from '../pipeline/schemas/generaLeaderSchema';
import { patchFazioneLeaderData } from '../vault/CampaignWriter';
import { writeFactionFile } from '../vault/VaultManager';

class FazionePickerModal extends SuggestModal<FazioneConfig> {
  constructor(
    app: App,
    private fazioni: FazioneConfig[],
    private resolve: (f: FazioneConfig) => void,
  ) {
    super(app);
  }

  getSuggestions(query: string): FazioneConfig[] {
    return this.fazioni.filter(f => f.nome.toLowerCase().includes(query.toLowerCase()));
  }

  renderSuggestion(fazione: FazioneConfig, el: HTMLElement): void {
    const leaderInfo = fazione.leader?.nome ? ` (leader: ${fazione.leader.nome})` : '';
    el.createEl('div', { text: `${fazione.nome}${leaderInfo}` });
  }

  onChooseSuggestion(fazione: FazioneConfig): void {
    this.resolve(fazione);
  }
}

export async function cmdGeneraLeader(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  const fazione = await new Promise<FazioneConfig | null>((resolve) => {
    const modal = new FazionePickerModal(app, campagna.fazioni, resolve);
    modal.onClose = () => resolve(null);
    modal.open();
  });

  if (!fazione) return;

  const notice = new Notice(`Generazione leader per ${fazione.nome}…`, 0);

  try {
    const adapter = await createAdapter(campagna.llm, app);
    const { system, user } = buildGeneraLeaderPrompt(campagna, fazione);

    const response = await adapter.complete({
      system,
      user,
      output_schema: generaLeaderOutputSchema,
      temperature: campagna.llm.temperature_narrative,
    });

    const validation = GeneraLeaderOutputZod.safeParse(response.parsed);
    if (!validation.success) {
      throw new LLMValidationError(
        `Output genera-leader non valido per ${fazione.nome}: ${validation.error.message}`,
        response.content,
      );
    }

    const { nome, descrizione } = validation.data;
    const { slug } = campagna.meta;

    await patchFazioneLeaderData(app, slug, fazione.id, { nome, presente: true });
    await writeFactionFile(app, slug, fazione.id, { ...fazione, leader: { nome, presente: true } }, descrizione);

    notice.hide();
    new Notice(`Leader generato per ${fazione.nome}: ${nome}`);
  } catch (e) {
    notice.hide();
    new Notice(`Errore generazione leader: ${(e as Error).message}`);
  }
}
