import { App, Modal, Notice, Setting } from 'obsidian';
import type { AccordoPrivato, FazioneConfig } from '../../types';

export class RegistraAccordoModal extends Modal {
  private fazioniSelezionate: Set<string> = new Set();
  private termini = '';
  private turno_scadenza: number | undefined = undefined;

  constructor(
    app: App,
    private fazioni: FazioneConfig[],
    private onSubmit: (accordo: AccordoPrivato) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Registra accordo privato' });

    contentEl.createEl('p', { text: 'Fazioni coinvolte (minimo 2):' });
    for (const f of this.fazioni) {
      new Setting(contentEl)
        .setName(f.nome)
        .addToggle(t => t.setValue(false).onChange(v => {
          if (v) this.fazioniSelezionate.add(f.id);
          else this.fazioniSelezionate.delete(f.id);
        }));
    }

    new Setting(contentEl)
      .setName('Termini dell\'accordo')
      .addTextArea(t => t.onChange(v => { this.termini = v; }));

    new Setting(contentEl)
      .setName('Turno di scadenza (opzionale)')
      .addText(t => t
        .setPlaceholder('es. 5')
        .onChange(v => {
          const n = parseInt(v);
          this.turno_scadenza = isNaN(n) ? undefined : n;
        }));

    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });
    btnRow.createEl('button', { text: 'Annulla' }).addEventListener('click', () => this.close());
    btnRow.createEl('button', { text: 'Registra', cls: 'mod-cta' })
      .addEventListener('click', () => this.submit());
  }

  private submit(): void {
    if (this.fazioniSelezionate.size < 2) {
      new Notice('Seleziona almeno 2 fazioni.');
      return;
    }
    if (!this.termini.trim()) {
      new Notice('Inserisci i termini dell\'accordo.');
      return;
    }
    const accordo: AccordoPrivato = {
      fazioni: Array.from(this.fazioniSelezionate),
      termini: this.termini.trim(),
      turno_scadenza: this.turno_scadenza,
    };
    this.onSubmit(accordo);
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
