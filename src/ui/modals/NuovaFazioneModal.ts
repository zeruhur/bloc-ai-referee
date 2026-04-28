import { App, Modal, Setting } from 'obsidian';
import type { FazioneConfig, MC } from '../../types';
import { rollFudge } from '../../dice/DiceEngine';
import { slugify } from '../../utils/slugify';

interface FazioneFormState {
  id: string;
  nome: string;
  tipo: 'normale' | 'ia';
  mc: MC;
  obiettivo: string;
  concetto: string;
  vantaggio1: string;
  vantaggio2: string;
  svantaggio1: string;
  nomeLeader?: string;
}

export interface NuovaFazioneOptions {
  /** Titolo della modal. */
  title?: string;
  /** Valori iniziali per precompilare il form (es. scissione). */
  defaults?: Partial<FazioneFormState>;
  /** Se true, aggiunge una sezione checkbox "Trasferisci vantaggi da sorgente". */
  vantaggiSorgente?: string[];
  svantaggiSorgente?: string[];
}

export class NuovaFazioneModal extends Modal {
  private state: FazioneFormState;
  /** Vantaggi della sorgente selezionati per il trasferimento. */
  private vantaggiTrasferiti: Set<string> = new Set();
  private svantaggiTrasferiti: Set<string> = new Set();

  constructor(
    app: App,
    private opts: NuovaFazioneOptions,
    private onConfirm: (fazione: FazioneConfig, vantaggiTrasferiti: string[], svantaggiTrasferiti: string[]) => void,
  ) {
    super(app);
    this.state = {
      id: '',
      nome: opts.defaults?.nome ?? '',
      tipo: opts.defaults?.tipo ?? 'normale',
      mc: opts.defaults?.mc ?? 0,
      obiettivo: opts.defaults?.obiettivo ?? '',
      concetto: opts.defaults?.concetto ?? '',
      vantaggio1: opts.defaults?.vantaggio1 ?? '',
      vantaggio2: opts.defaults?.vantaggio2 ?? '',
      svantaggio1: opts.defaults?.svantaggio1 ?? '',
      nomeLeader: opts.defaults?.nomeLeader,
    };
    this.state.id = slugify(this.state.nome);
  }

  onOpen(): void {
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: this.opts.title ?? 'Nuova fazione' });

    const s = this.state;

    new Setting(contentEl).setName('Nome').addText(t => t
      .setValue(s.nome)
      .onChange(v => { s.nome = v; s.id = slugify(v); idDesc.setDesc(`ID: ${s.id}`); }));

    const idDesc = new Setting(contentEl)
      .setName('')
      .setDesc(`ID: ${s.id}`)
      .setHeading();
    idDesc.settingEl.style.paddingTop = '0';

    new Setting(contentEl).setName('Obiettivo').addText(t => t
      .setValue(s.obiettivo)
      .onChange(v => { s.obiettivo = v; }));

    new Setting(contentEl).setName('Concetto')
      .setDesc('Descrizione sintetica dell\'identità e natura della fazione.')
      .addTextArea(t => t
        .setValue(s.concetto)
        .onChange(v => { s.concetto = v; }));

    new Setting(contentEl).setName('Vantaggio 1').addText(t => t
      .setPlaceholder('es. Flotta navale superiore')
      .setValue(s.vantaggio1)
      .onChange(v => { s.vantaggio1 = v; }));

    new Setting(contentEl).setName('Vantaggio 2').addText(t => t
      .setPlaceholder('es. Rete di spionaggio capillare')
      .setValue(s.vantaggio2)
      .onChange(v => { s.vantaggio2 = v; }));

    new Setting(contentEl).setName('Svantaggio').addText(t => t
      .setPlaceholder('es. Isolamento diplomatico')
      .setValue(s.svantaggio1)
      .onChange(v => { s.svantaggio1 = v; }));

    const mcSetting = new Setting(contentEl)
      .setName('Modificatore di Coesione (MC)')
      .setDesc(`Valore attuale: ${s.mc}`);
    mcSetting.addButton(btn => btn
      .setButtonText('Tira MC')
      .onClick(() => {
        const roll = rollFudge();
        s.mc = roll.risultato;
        mcSetting.setDesc(`Valore attuale: ${s.mc > 0 ? '+' : ''}${s.mc}`);
      }));

    new Setting(contentEl)
      .setName('Fazione IA')
      .setDesc('Le azioni vengono auto-generate dall\'IA.')
      .addToggle(t => t
        .setValue(s.tipo === 'ia')
        .onChange(v => { s.tipo = v ? 'ia' : 'normale'; }));

    new Setting(contentEl)
      .setName('Nome leader (opzionale)')
      .addText(t => t
        .setPlaceholder('es. Generale Rossi')
        .setValue(s.nomeLeader ?? '')
        .onChange(v => { s.nomeLeader = v.trim() || undefined; }));

    // Sezione trasferimento vantaggi (solo per scissione)
    if (this.opts.vantaggiSorgente?.length || this.opts.svantaggiSorgente?.length) {
      contentEl.createEl('h3', { text: 'Trasferisci vantaggi dalla fazione sorgente' });
      contentEl.createEl('p', {
        text: 'I vantaggi spuntati passeranno alla nuova fazione e saranno rimossi dalla sorgente.',
        cls: 'setting-item-description',
      });

      for (const v of this.opts.vantaggiSorgente ?? []) {
        new Setting(contentEl).setName(v).addToggle(t => t
          .setValue(false)
          .onChange(checked => {
            if (checked) this.vantaggiTrasferiti.add(v);
            else this.vantaggiTrasferiti.delete(v);
          }));
      }

      if (this.opts.svantaggiSorgente?.length) {
        contentEl.createEl('h4', { text: 'Svantaggi' });
        for (const v of this.opts.svantaggiSorgente) {
          new Setting(contentEl).setName(v).addToggle(t => t
            .setValue(false)
            .onChange(checked => {
              if (checked) this.svantaggiTrasferiti.add(v);
              else this.svantaggiTrasferiti.delete(v);
            }));
        }
      }
    }

    new Setting(contentEl).addButton(btn => btn
      .setButtonText('Crea fazione')
      .setCta()
      .onClick(() => {
        if (!s.nome.trim() || !s.id) return;
        const fazione: FazioneConfig = {
          id: s.id,
          nome: s.nome.trim(),
          mc: s.mc,
          tipo: s.tipo,
          obiettivo: s.obiettivo,
          concetto: s.concetto,
          vantaggi: [s.vantaggio1, s.vantaggio2].filter(v => v.trim() !== ''),
          svantaggi: [s.svantaggio1].filter(v => v.trim() !== ''),
          leader: s.nomeLeader ? { nome: s.nomeLeader, presente: true } : undefined,
        };
        this.onConfirm(fazione, [...this.vantaggiTrasferiti], [...this.svantaggiTrasferiti]);
        this.close();
      }));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
