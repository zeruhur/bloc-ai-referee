import { App, Notice, SuggestModal } from 'obsidian';
import type { FazioneConfig } from '../types';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { patchFazioneEliminata } from '../vault/CampaignWriter';
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
    el.createEl('div', { text: fazione.nome });
  }

  onChooseSuggestion(fazione: FazioneConfig): void {
    this.resolve(fazione);
  }
}

export async function cmdEliminaFazione(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  const candidati = activeFazioni(campagna.fazioni);
  if (candidati.length === 0) {
    new Notice('Nessuna fazione attiva da eliminare.');
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
    await patchFazioneEliminata(app, slug, fazione.id, true);
    new Notice(`Fazione "${fazione.nome}" eliminata. Usa "Ripristina fazione" per annullare.`);
  } catch (e) {
    new Notice(`Errore: ${(e as Error).message}`);
  }
}

export async function cmdRipristinaFazione(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  const candidati = campagna.fazioni.filter(f => f.eliminata);
  if (candidati.length === 0) {
    new Notice('Nessuna fazione eliminata da ripristinare.');
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
    await patchFazioneEliminata(app, slug, fazione.id, false);
    new Notice(`Fazione "${fazione.nome}" ripristinata.`);
  } catch (e) {
    new Notice(`Errore: ${(e as Error).message}`);
  }
}
