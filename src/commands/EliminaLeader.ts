import { App, Notice, SuggestModal } from 'obsidian';
import type { FazioneConfig } from '../types';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { patchFazioneLeader, patchFazioneMC } from '../vault/CampaignWriter';
import { activeFazioni } from '../utils/factionUtils';

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
    el.createEl('div', { text: `${fazione.nome} (leader: ${fazione.leader?.nome ?? 'senza nome'})` });
  }

  onChooseSuggestion(fazione: FazioneConfig): void {
    this.resolve(fazione);
  }
}

export async function cmdEliminaLeader(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  const candidati = activeFazioni(campagna.fazioni).filter(f => f.leader?.presente === true);
  if (candidati.length === 0) {
    new Notice('Nessun leader attualmente presente.');
    return;
  }

  const fazione = await new Promise<FazioneConfig | null>((resolve) => {
    const modal = new FazionePickerModal(app, candidati, resolve);
    modal.onClose = () => resolve(null);
    modal.open();
  });

  if (!fazione) return;

  const { slug } = campagna.meta;
  try {
    await patchFazioneLeader(app, slug, fazione.id, false);
    await patchFazioneMC(app, slug, fazione.id, -1);
    new Notice(`Leader eliminato. MC -1 per ${fazione.nome}.`);
  } catch (e) {
    new Notice(`Errore: ${(e as Error).message}`);
  }
}
