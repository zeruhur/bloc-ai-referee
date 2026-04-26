import { App, Modal, Notice, Setting } from 'obsidian';

export class OracleModal extends Modal {
  private domanda = '';
  private modificatore: -1 | 0 | 1 = 0;

  constructor(
    app: App,
    private onSubmit: (domanda: string, modificatore: -1 | 0 | 1) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Interroga oracolo' });

    new Setting(contentEl)
      .setName('Domanda')
      .addText(t => t.onChange(v => { this.domanda = v; }));

    new Setting(contentEl)
      .setName('Probabilità')
      .addDropdown(d => d
        .addOption('-1', 'Improbabile (-1)')
        .addOption('0', 'Neutro (0)')
        .addOption('1', 'Probabile (+1)')
        .setValue('0')
        .onChange(v => { this.modificatore = parseInt(v) as -1 | 0 | 1; }));

    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });
    btnRow.createEl('button', { text: 'Annulla' }).addEventListener('click', () => this.close());
    btnRow.createEl('button', { text: 'Tira', cls: 'mod-cta' })
      .addEventListener('click', () => this.submit());
  }

  private submit(): void {
    if (!this.domanda.trim()) {
      new Notice('Inserisci una domanda.');
      return;
    }
    this.onSubmit(this.domanda.trim(), this.modificatore);
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
