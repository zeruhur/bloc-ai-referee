import { App, Notice, SuggestModal } from 'obsidian';
import type { FazioneConfig } from '../types';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { patchFazioneTipo } from '../vault/CampaignWriter';
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
    const tipo = fazione.tipo === 'ia' ? ' [IA]' : ' [umana]';
    el.createEl('div', { text: fazione.nome + tipo });
  }

  onChooseSuggestion(fazione: FazioneConfig): void {
    this.resolve(fazione);
  }
}

export async function cmdConvertiAIA(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  const candidati = activeFazioni(campagna.fazioni).filter(f => f.tipo !== 'ia');
  if (candidati.length === 0) {
    new Notice('Nessuna fazione umana attiva da convertire.');
    return;
  }

  const fazione = await new Promise<FazioneConfig | null>((resolve) => {
    const modal = new FazionePickerModal(app, candidati, resolve);
    modal.onClose = () => resolve(null);
    modal.open();
  });

  if (!fazione) return;

  const { slug } = campagna.meta;
  await patchFazioneTipo(app, slug, fazione.id, 'ia');
  new Notice(`"${fazione.nome}" ora è a controllo IA. Le azioni saranno auto-generate al prossimo Dichiara azione.`);
}

export async function cmdConvertiAUmano(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  const candidati = activeFazioni(campagna.fazioni).filter(f => f.tipo === 'ia');
  if (candidati.length === 0) {
    new Notice('Nessuna fazione IA attiva da convertire.');
    return;
  }

  const fazione = await new Promise<FazioneConfig | null>((resolve) => {
    const modal = new FazionePickerModal(app, candidati, resolve);
    modal.onClose = () => resolve(null);
    modal.open();
  });

  if (!fazione) return;

  const { slug } = campagna.meta;
  await patchFazioneTipo(app, slug, fazione.id, 'normale');
  new Notice(`"${fazione.nome}" ora è a controllo umano.`);
}
