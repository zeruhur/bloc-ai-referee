import { App, Modal, Notice, Setting, SuggestModal } from 'obsidian';
import type { FazioneConfig } from '../types';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { patchFazioneVantaggi } from '../vault/CampaignWriter';
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

class ModificaVantaggiModal extends Modal {
  private vantaggi: string;
  private svantaggi: string;

  constructor(
    app: App,
    private fazione: FazioneConfig,
    private onConfirm: (vantaggi: string[], svantaggi: string[]) => void,
  ) {
    super(app);
    this.vantaggi = fazione.vantaggi.join('\n');
    this.svantaggi = fazione.svantaggi.join('\n');
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: `Modifica vantaggi — ${this.fazione.nome}` });
    contentEl.createEl('p', {
      text: 'Un vantaggio/svantaggio per riga.',
      cls: 'setting-item-description',
    });

    new Setting(contentEl).setName('Vantaggi').addTextArea(t => {
      t.setValue(this.vantaggi).onChange(v => { this.vantaggi = v; });
      t.inputEl.rows = 4;
    });

    new Setting(contentEl).setName('Svantaggi').addTextArea(t => {
      t.setValue(this.svantaggi).onChange(v => { this.svantaggi = v; });
      t.inputEl.rows = 3;
    });

    new Setting(contentEl).addButton(btn => btn
      .setButtonText('Salva')
      .setCta()
      .onClick(() => {
        const vantaggi = this.vantaggi.split('\n').map(s => s.trim()).filter(Boolean);
        const svantaggi = this.svantaggi.split('\n').map(s => s.trim()).filter(Boolean);
        this.onConfirm(vantaggi, svantaggi);
        this.close();
      }));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export async function cmdModificaVantaggi(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  const candidati = activeFazioni(campagna.fazioni);
  if (candidati.length === 0) {
    new Notice('Nessuna fazione attiva.');
    return;
  }

  const fazione = await new Promise<FazioneConfig | null>((resolve) => {
    const modal = new FazionePickerModal(app, candidati, resolve);
    modal.onClose = () => resolve(null);
    modal.open();
  });

  if (!fazione) return;

  await new Promise<void>((resolve) => {
    const modal = new ModificaVantaggiModal(app, fazione, async (vantaggi, svantaggi) => {
      try {
        await patchFazioneVantaggi(app, campagna.meta.slug, fazione.id, vantaggi, svantaggi);
        new Notice(`Vantaggi di "${fazione.nome}" aggiornati.`);
      } catch (e) {
        new Notice(`Errore: ${(e as Error).message}`);
      }
      resolve();
    });
    modal.onClose = () => resolve();
    modal.open();
  });
}
