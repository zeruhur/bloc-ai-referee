import { App, Modal, Notice, Setting } from 'obsidian';
import type { Accordo, FazioneConfig, TipoAccordo } from '../../types';

export class RegistraAccordoModal extends Modal {
  private fazioniSelezionate: Set<string> = new Set();
  private termini = '';
  private turno_scadenza: number | undefined = undefined;
  private tipo: TipoAccordo = 'non_aggressione';

  constructor(
    app: App,
    private fazioni: FazioneConfig[],
    private turnoCorrente: number,
    private onSubmit: (accordo: Accordo) => void,
    private titleText = 'Registra accordo privato',
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: this.titleText });

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
      .setName('Tipo accordo')
      .addDropdown(d => d
        .addOption('non_aggressione', 'Non aggressione')
        .addOption('militare', 'Militare')
        .addOption('scambio', 'Scambio')
        .addOption('supporto', 'Supporto')
        .setValue(this.tipo)
        .onChange(v => { this.tipo = v as TipoAccordo; }));

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
    const accordo: Accordo = {
      id: `accordo-${Date.now()}`,
      fazioni: Array.from(this.fazioniSelezionate),
      tipo: this.tipo,
      termini: this.termini.trim(),
      turno_stipula: this.turnoCorrente,
      turno_scadenza: this.turno_scadenza,
      stato: 'attivo',
      violazioni: [],
    };
    this.onSubmit(accordo);
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
