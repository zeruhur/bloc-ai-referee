import { App, Modal, Notice, Setting } from 'obsidian';
import type { FazioneConfig } from '../types';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { patchFazioneProfilo } from '../vault/CampaignWriter';
import { activeFazioni } from '../utils/factionUtils';
import { pickFazione } from '../ui/FazionePickerModal';

class ModificaProfiloModal extends Modal {
  private patch: { nome: string; obiettivo: string; concetto: string };

  constructor(
    app: App,
    private fazione: FazioneConfig,
    private onConfirm: (patch: { nome: string; obiettivo: string; concetto: string }) => void,
  ) {
    super(app);
    this.patch = {
      nome: fazione.nome,
      obiettivo: fazione.obiettivo,
      concetto: fazione.concetto,
    };
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: `Modifica profilo — ${this.fazione.nome}` });
    contentEl.createEl('p', { text: `ID invariato: ${this.fazione.id}`, cls: 'setting-item-description' });

    new Setting(contentEl).setName('Nome').addText(t => t
      .setValue(this.patch.nome)
      .onChange(v => { this.patch.nome = v; }));

    new Setting(contentEl).setName('Obiettivo').addText(t => t
      .setValue(this.patch.obiettivo)
      .onChange(v => { this.patch.obiettivo = v; }));

    new Setting(contentEl).setName('Concetto').addTextArea(t => t
      .setValue(this.patch.concetto)
      .onChange(v => { this.patch.concetto = v; }));

    new Setting(contentEl).addButton(btn => btn
      .setButtonText('Salva')
      .setCta()
      .onClick(() => {
        this.onConfirm(this.patch);
        this.close();
      }));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export async function cmdModificaFazione(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  const candidati = activeFazioni(campagna.fazioni);
  if (candidati.length === 0) {
    new Notice('Nessuna fazione attiva.');
    return;
  }

  const fazione = await pickFazione(app, candidati, 'Seleziona fazione da modificare…');
  if (!fazione) return;

  await new Promise<void>((resolve) => {
    const modal = new ModificaProfiloModal(app, fazione, async (patch) => {
      try {
        await patchFazioneProfilo(app, campagna.meta.slug, fazione.id, patch);
        new Notice(`Profilo di "${fazione.nome}" aggiornato.`);
      } catch (e) {
        new Notice(`Errore: ${(e as Error).message}`);
      }
      resolve();
    });
    modal.onClose = () => resolve();
    modal.open();
  });
}
