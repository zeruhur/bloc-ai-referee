import { App, Modal, Notice, Setting } from 'obsidian';
import type { AzioneDeclaration, Campagna, CategoriaAzione, FazioneConfig, TipoAzione } from '../../types';
import { writeActionFile } from '../../vault/VaultManager';
import { leaderAvailability } from '../../dice/DiceEngine';
import { appendToRollsFile } from '../../vault/VaultManager';

export class DichiaraAzioneModal extends Modal {
  private declaration: Partial<AzioneDeclaration> & { categoria_azione: CategoriaAzione } = {
    argomenti_contro: [],
    tipo_azione: 'principale',
    categoria_azione: 'standard',
  };
  private selectedFazione: FazioneConfig | null = null;

  constructor(
    app: App,
    private campagna: Campagna,
    private onComplete: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.renderForm();
  }

  private renderForm(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: `Dichiara azione — Turno ${this.campagna.meta.turno_corrente}` });

    const fazionUmane = this.campagna.fazioni.filter(f => f.tipo !== 'ia');

    new Setting(contentEl)
      .setName('Fazione')
      .addDropdown(d => {
        fazionUmane.forEach(f => d.addOption(f.id, f.nome));
        d.onChange(v => {
          this.selectedFazione = this.campagna.fazioni.find(f => f.id === v) ?? null;
          this.declaration.fazione = v;
        });
        const firstId = fazionUmane[0]?.id;
        if (firstId) {
          d.setValue(firstId);
          this.selectedFazione = fazionUmane[0];
          this.declaration.fazione = firstId;
        }
      });

    new Setting(contentEl)
      .setName('Giocatore')
      .addText(t => t.onChange(v => { this.declaration.giocatore = v; }));

    new Setting(contentEl)
      .setName('Tipo azione')
      .addDropdown(d => d
        .addOption('principale', 'Principale')
        .addOption('leader', 'Leader')
        .setValue(this.declaration.tipo_azione ?? 'principale')
        .onChange(v => { this.declaration.tipo_azione = v as TipoAzione; }));

    new Setting(contentEl)
      .setName('Categoria azione')
      .addDropdown(d => d
        .addOption('standard', 'Standard')
        .addOption('latente', 'Latente')
        .addOption('difesa', 'Difesa')
        .addOption('aiuto', 'Aiuto')
        .addOption('segreta', 'Segreta')
        .setValue(this.declaration.categoria_azione)
        .onChange(v => {
          this.declaration.categoria_azione = v as CategoriaAzione;
          this.renderForm();
        }));

    // Conditional section for 'aiuto'
    if (this.declaration.categoria_azione === 'aiuto') {
      const altreFazioni = this.campagna.fazioni.filter(f => f.id !== this.declaration.fazione);
      new Setting(contentEl)
        .setName('Fazione aiutata')
        .addDropdown(d => {
          altreFazioni.forEach(f => d.addOption(f.id, f.nome));
          if (altreFazioni[0]) {
            d.setValue(this.declaration.fazione_aiutata ?? altreFazioni[0].id);
            this.declaration.fazione_aiutata = this.declaration.fazione_aiutata ?? altreFazioni[0].id;
          }
          d.onChange(v => { this.declaration.fazione_aiutata = v; });
        });
    }

    // Conditional note for 'segreta' and 'latente'
    if (this.declaration.categoria_azione === 'segreta' || this.declaration.categoria_azione === 'latente') {
      contentEl.createEl('p', {
        text: this.declaration.categoria_azione === 'segreta'
          ? 'Azione segreta: salvata fuori dal pipeline del turno corrente (come latente). Attivazione futura con "Attiva azione latente".'
          : 'Azione latente: salvata fuori dal turno corrente. Attivare in futuro con "Attiva azione latente".',
        cls: 'setting-item-description',
      });
    }

    new Setting(contentEl)
      .setName('Azione (max 80 car.)')
      .addText(t => t.onChange(v => { this.declaration.azione = v.slice(0, 80); }));

    new Setting(contentEl)
      .setName('Metodo (max 200 car.)')
      .addTextArea(t => t.onChange(v => { this.declaration.metodo = v.slice(0, 200); }));

    new Setting(contentEl)
      .setName('Argomento di vantaggio')
      .setDesc('Perché questa fazione ha le capacità e le condizioni per riuscire in questa azione specifica.')
      .addTextArea(t => t.onChange(v => { this.declaration.argomento_vantaggio = v; }));

    new Setting(contentEl)
      .setName('Dettaglio narrativo (opzionale)')
      .setDesc('Solo layer umano, non inviato all\'LLM')
      .addTextArea(t => t.onChange(v => { this.declaration.dettaglio_narrativo = v; }));

    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });
    btnRow.createEl('button', { text: 'Annulla' }).addEventListener('click', () => this.close());
    btnRow.createEl('button', { text: 'Dichiara', cls: 'mod-cta' })
      .addEventListener('click', () => this.submit());
  }

  private async submit(): Promise<void> {
    const { campagna, declaration } = this;

    if (!declaration.fazione || !declaration.azione || !declaration.metodo || !declaration.argomento_vantaggio) {
      new Notice('Compila tutti i campi obbligatori.');
      return;
    }

    if (declaration.categoria_azione === 'aiuto' && !declaration.fazione_aiutata) {
      new Notice('Seleziona la fazione aiutata.');
      return;
    }

    // Leader availability check
    if (declaration.tipo_azione === 'leader') {
      const fazione = campagna.fazioni.find(f => f.id === declaration.fazione);
      const available = leaderAvailability(fazione?.mc ?? 0);
      if (!available) {
        await appendToRollsFile(
          this.app,
          campagna.meta.slug,
          campagna.meta.turno_corrente,
          `## Leader ${declaration.fazione} — Turno ${campagna.meta.turno_corrente}\nLeader NON disponibile questo turno.\n`,
        );
        new Notice(`Il leader di ${declaration.fazione} non è disponibile questo turno.`);
        this.close();
        return;
      }
    }

    const fullDeclaration: AzioneDeclaration = {
      fazione: declaration.fazione!,
      giocatore: declaration.giocatore ?? 'Arbitro',
      turno: campagna.meta.turno_corrente,
      tipo_azione: declaration.tipo_azione ?? 'principale',
      categoria_azione: declaration.categoria_azione,
      azione: declaration.azione!,
      metodo: declaration.metodo!,
      argomento_vantaggio: declaration.argomento_vantaggio!,
      argomenti_contro: [],
      fazione_aiutata: declaration.fazione_aiutata,
      dettaglio_narrativo: declaration.dettaglio_narrativo,
    };

    await writeActionFile(this.app, campagna.meta.slug, campagna.meta.turno_corrente, fullDeclaration);
    new Notice(`Azione dichiarata per ${declaration.fazione}.`);
    this.onComplete();
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
