import { App, Notice, SuggestModal } from 'obsidian';
import type { FazioneConfig } from '../types';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { patchFazioneTipo } from '../vault/CampaignWriter';
import { activeFazioni } from '../utils/factionUtils';

class FazionePickerModal extends SuggestModal<FazioneConfig> {
  private chosen: FazioneConfig | null = null;

  constructor(
    app: App,
    private fazioni: FazioneConfig[],
    private resolve: (f: FazioneConfig | null) => void,
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
    this.chosen = fazione;
  }

  onClose(): void {
    setTimeout(() => this.resolve(this.chosen), 0);
  }
}

function pickFazioneTipo(app: App, fazioni: FazioneConfig[]): Promise<FazioneConfig | null> {
  return new Promise(resolve => new FazionePickerModal(app, fazioni, resolve).open());
}

export async function cmdConvertiAIA(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  const candidati = activeFazioni(campagna.fazioni).filter(f => f.tipo !== 'ia');
  if (candidati.length === 0) {
    new Notice('Nessuna fazione umana attiva da convertire.');
    return;
  }

  const fazione = await pickFazioneTipo(app, candidati);
  if (!fazione) return;

  const { slug } = campagna.meta;
  try {
    await patchFazioneTipo(app, slug, fazione.id, 'ia');
    new Notice(`"${fazione.nome}" ora è a controllo IA. Le azioni saranno auto-generate al prossimo Dichiara azione.`);
  } catch (e) {
    new Notice(`Errore: ${(e as Error).message}`);
  }
}

export async function cmdConvertiAUmano(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  const candidati = activeFazioni(campagna.fazioni).filter(f => f.tipo === 'ia');
  if (candidati.length === 0) {
    new Notice('Nessuna fazione IA attiva da convertire.');
    return;
  }

  const fazione = await pickFazioneTipo(app, candidati);
  if (!fazione) return;

  const { slug } = campagna.meta;
  try {
    await patchFazioneTipo(app, slug, fazione.id, 'normale');
    new Notice(`"${fazione.nome}" ora è a controllo umano.`);
  } catch (e) {
    new Notice(`Errore: ${(e as Error).message}`);
  }
}
