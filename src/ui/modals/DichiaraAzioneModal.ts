import { App, Modal, Notice, Setting } from 'obsidian';
import type { AzioneDeclaration, Campagna, FazioneConfig, TipoAzione } from '../../types';
import { writeActionFile } from '../../vault/VaultManager';
import { leaderAvailability } from '../../dice/DiceEngine';
import { appendToRollsFile } from '../../vault/VaultManager';

export class DichiaraAzioneModal extends Modal {
  private declaration: Partial<AzioneDeclaration> = {
    vantaggi_usati: [],
    svantaggi_opposti: [],
    svantaggi_propri_attivati: [],
    aiuti_alleati: [],
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
    const { contentEl } = this;
    contentEl.createEl('h2', { text: `Dichiara azione — Turno ${this.campagna.meta.turno_corrente}` });

    // Faction selector
    new Setting(contentEl)
      .setName('Fazione')
      .addDropdown(d => {
        this.campagna.fazioni.forEach(f => d.addOption(f.id, f.nome));
        d.onChange(v => {
          this.selectedFazione = this.campagna.fazioni.find(f => f.id === v) ?? null;
          this.declaration.fazione = v;
          this.renderVantaggi(contentEl);
        });
        // Init
        const firstId = this.campagna.fazioni[0]?.id;
        if (firstId) {
          d.setValue(firstId);
          this.selectedFazione = this.campagna.fazioni[0];
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
        .addOption('latente', 'Latente')
        .addOption('difesa', 'Difesa')
        .onChange(v => { this.declaration.tipo_azione = v as TipoAzione; }));

    new Setting(contentEl)
      .setName('Azione (max 80 car.)')
      .addText(t => t.onChange(v => { this.declaration.azione = v.slice(0, 80); }));

    new Setting(contentEl)
      .setName('Metodo (max 200 car.)')
      .addTextArea(t => t.onChange(v => { this.declaration.metodo = v.slice(0, 200); }));

    const vantaggiContainer = contentEl.createDiv({ cls: 'bloc-vantaggi' });
    this.renderVantaggi(vantaggiContainer);

    new Setting(contentEl)
      .setName('Dettaglio narrativo (opzionale)')
      .setDesc('Solo layer umano, non inviato all\'LLM')
      .addTextArea(t => t.onChange(v => { this.declaration.dettaglio_narrativo = v; }));

    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });
    btnRow.createEl('button', { text: 'Annulla' }).addEventListener('click', () => this.close());
    btnRow.createEl('button', { text: 'Dichiara', cls: 'mod-cta' })
      .addEventListener('click', () => this.submit());
  }

  private renderVantaggi(container: Element): void {
    const existing = container.querySelector('.bloc-vantaggi-list');
    if (existing) existing.remove();

    const list = container.createDiv({ cls: 'bloc-vantaggi-list' });
    if (!this.selectedFazione) return;

    list.createEl('p', { text: 'Vantaggi da usare:' });
    for (const v of this.selectedFazione.vantaggi) {
      const label = list.createEl('label', { cls: 'bloc-checkbox-label' });
      const checkbox = label.createEl('input', { type: 'checkbox' } as any);
      (checkbox as HTMLInputElement).addEventListener('change', (e) => {
        const checked = (e.target as HTMLInputElement).checked;
        if (checked) {
          this.declaration.vantaggi_usati = [...(this.declaration.vantaggi_usati ?? []), v.id];
        } else {
          this.declaration.vantaggi_usati = (this.declaration.vantaggi_usati ?? []).filter(id => id !== v.id);
        }
      });
      label.createEl('span', { text: ` ${v.label}` });
    }
  }

  private async submit(): Promise<void> {
    const { campagna, declaration } = this;

    if (!declaration.fazione || !declaration.azione || !declaration.metodo) {
      new Notice('Compila tutti i campi obbligatori.');
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
      azione: declaration.azione!,
      metodo: declaration.metodo!,
      vantaggi_usati: declaration.vantaggi_usati ?? [],
      svantaggi_opposti: [],
      svantaggi_propri_attivati: [],
      aiuti_alleati: [],
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
