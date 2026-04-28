import { App, Modal, Notice, Setting, SuggestModal } from 'obsidian';
import type { FazioneConfig, MC } from '../types';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { patchFazioneVantaggi, setFazioneMC, patchFazioneEliminata } from '../vault/CampaignWriter';
import { activeFazioni } from '../utils/factionUtils';

class FazionePickerModal extends SuggestModal<FazioneConfig> {
  constructor(
    app: App,
    private fazioni: FazioneConfig[],
    private resolve: (f: FazioneConfig) => void,
    private placeholder = '',
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
    this.resolve(fazione);
  }
}

class FusioneModal extends Modal {
  private selectedVantaggi: Set<string>;
  private selectedSvantaggi: Set<string>;
  private mc: MC;

  constructor(
    app: App,
    private fazioneA: FazioneConfig,
    private fazioneB: FazioneConfig,
    private onConfirm: (vantaggi: string[], svantaggi: string[], mc: MC) => void,
  ) {
    super(app);
    // Default: tutti i vantaggi di entrambe selezionati
    this.selectedVantaggi = new Set([...fazioneA.vantaggi, ...fazioneB.vantaggi]);
    this.selectedSvantaggi = new Set([...fazioneA.svantaggi, ...fazioneB.svantaggi]);
    this.mc = Math.max(fazioneA.mc, fazioneB.mc) as MC;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: `Fusione: "${this.fazioneA.nome}" assorbe "${this.fazioneB.nome}"` });
    contentEl.createEl('p', {
      text: `"${this.fazioneB.nome}" sarà eliminata. Seleziona i vantaggi che "${this.fazioneA.nome}" conserverà.`,
      cls: 'setting-item-description',
    });

    // Vantaggi combinati
    if (this.selectedVantaggi.size > 0) {
      contentEl.createEl('h3', { text: 'Vantaggi' });
      for (const v of this.selectedVantaggi) {
        const fonte = this.fazioneA.vantaggi.includes(v) ? this.fazioneA.nome : this.fazioneB.nome;
        new Setting(contentEl).setName(v).setDesc(`da: ${fonte}`).addToggle(t => t
          .setValue(true)
          .onChange(checked => {
            if (checked) this.selectedVantaggi.add(v);
            else this.selectedVantaggi.delete(v);
          }));
      }
    }

    // Svantaggi combinati
    if (this.selectedSvantaggi.size > 0) {
      contentEl.createEl('h3', { text: 'Svantaggi' });
      for (const v of this.selectedSvantaggi) {
        const fonte = this.fazioneA.svantaggi.includes(v) ? this.fazioneA.nome : this.fazioneB.nome;
        new Setting(contentEl).setName(v).setDesc(`da: ${fonte}`).addToggle(t => t
          .setValue(true)
          .onChange(checked => {
            if (checked) this.selectedSvantaggi.add(v);
            else this.selectedSvantaggi.delete(v);
          }));
      }
    }

    // MC risultante
    const mcSetting = new Setting(contentEl)
      .setName('MC risultante')
      .setDesc(`Attuale: ${this.mc > 0 ? '+' : ''}${this.mc} (suggerito: max tra i due)`);
    mcSetting.addDropdown(d => {
      d.addOption('-1', '-1');
      d.addOption('0', '0');
      d.addOption('1', '+1');
      d.setValue(String(this.mc));
      d.onChange(v => { this.mc = parseInt(v) as MC; });
    });

    new Setting(contentEl).addButton(btn => btn
      .setButtonText('Fondi fazioni')
      .setCta()
      .onClick(() => {
        this.onConfirm(
          [...this.selectedVantaggi],
          [...this.selectedSvantaggi],
          this.mc,
        );
        this.close();
      }));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export async function cmdFondiFazioni(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  const tutte = activeFazioni(campagna.fazioni);
  if (tutte.length < 2) {
    new Notice('Servono almeno due fazioni attive per una fusione.');
    return;
  }

  const fazioneA = await new Promise<FazioneConfig | null>((resolve) => {
    const modal = new FazionePickerModal(app, tutte, resolve, 'Seleziona fazione sopravvissuta (A)…');
    modal.onClose = () => resolve(null);
    modal.open();
  });
  if (!fazioneA) return;

  const candidatiB = tutte.filter(f => f.id !== fazioneA.id);
  const fazioneB = await new Promise<FazioneConfig | null>((resolve) => {
    const modal = new FazionePickerModal(app, candidatiB, resolve, `Seleziona fazione da assorbire in "${fazioneA.nome}"…`);
    modal.onClose = () => resolve(null);
    modal.open();
  });
  if (!fazioneB) return;

  await new Promise<void>((resolve) => {
    const modal = new FusioneModal(app, fazioneA, fazioneB, async (vantaggi, svantaggi, mc) => {
      const { slug } = campagna.meta;
      try {
        await patchFazioneVantaggi(app, slug, fazioneA.id, vantaggi, svantaggi);
        await setFazioneMC(app, slug, fazioneA.id, mc);
        await patchFazioneEliminata(app, slug, fazioneB.id, true);
        new Notice(`"${fazioneB.nome}" fusa in "${fazioneA.nome}". MC aggiornato a ${mc > 0 ? '+' : ''}${mc}.`);
      } catch (e) {
        new Notice(`Errore: ${(e as Error).message}`);
      }
      resolve();
    });
    modal.onClose = () => resolve();
    modal.open();
  });
}
