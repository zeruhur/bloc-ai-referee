import { App, SuggestModal } from 'obsidian';
import type { FazioneConfig } from '../types';

class FazionePickerModal extends SuggestModal<FazioneConfig> {
  private chosen: FazioneConfig | null = null;

  constructor(
    app: App,
    private fazioni: FazioneConfig[],
    private resolve: (f: FazioneConfig | null) => void,
    placeholder = '',
  ) {
    super(app);
    if (placeholder) this.setPlaceholder(placeholder);
  }

  getSuggestions(query: string): FazioneConfig[] {
    return this.fazioni.filter(f => f.nome.toLowerCase().includes(query.toLowerCase()));
  }

  renderSuggestion(fazione: FazioneConfig, el: HTMLElement): void {
    el.createEl('div', { text: fazione.nome });
  }

  onChooseSuggestion(fazione: FazioneConfig): void {
    this.chosen = fazione;
  }

  onClose(): void {
    // Obsidian fires onClose before onChooseSuggestion — defer so onChooseSuggestion runs first
    setTimeout(() => this.resolve(this.chosen), 0);
  }
}

export function pickFazione(
  app: App,
  fazioni: FazioneConfig[],
  placeholder = '',
): Promise<FazioneConfig | null> {
  return new Promise(resolve => {
    new FazionePickerModal(app, fazioni, resolve, placeholder).open();
  });
}
