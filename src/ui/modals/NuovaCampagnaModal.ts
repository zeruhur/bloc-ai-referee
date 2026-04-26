import { App, Modal, Notice, Setting } from 'obsidian';
import type { Campagna, FazioneConfig, LLMProvider, VantaggioToken } from '../../types';
import { writeCampaignFile, writeFactionFile } from '../../vault/VaultManager';
import { slugify } from '../../utils/slugify';

interface WizardState {
  titolo: string;
  slug: string;
  turno_totale: number;
  premessa: string;
  provider: LLMProvider;
  model: string;
  api_key_env: string;
  fazioni: Array<{
    id: string;
    nome: string;
    obiettivo: string;
    vantaggi: VantaggioToken[];
    svantaggio: { id: string; label: string };
  }>;
}

export class NuovaCampagnaModal extends Modal {
  private step = 0;
  private state: WizardState = {
    titolo: '',
    slug: '',
    turno_totale: 10,
    premessa: '',
    provider: 'google_ai_studio',
    model: 'gemini-2.5-flash',
    api_key_env: 'GEMINI_API_KEY',
    fazioni: [],
  };

  constructor(
    app: App,
    private onComplete: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.renderStep();
  }

  private renderStep(): void {
    const { contentEl } = this;
    contentEl.empty();

    switch (this.step) {
      case 0: this.renderStepMeta(); break;
      case 1: this.renderStepLLM(); break;
      case 2: this.renderStepFazioni(); break;
      case 3: this.renderStepConfirm(); break;
    }
  }

  private renderStepMeta(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Nuova campagna — Passo 1/3: Informazioni' });

    new Setting(contentEl)
      .setName('Titolo campagna')
      .addText(t => t.setValue(this.state.titolo).onChange(v => {
        this.state.titolo = v;
        this.state.slug = slugify(v);
      }));

    new Setting(contentEl)
      .setName('Slug (auto-generato)')
      .addText(t => t.setValue(this.state.slug).onChange(v => { this.state.slug = v; }));

    new Setting(contentEl)
      .setName('Numero turni totali')
      .addText(t => t.setValue(String(this.state.turno_totale)).onChange(v => {
        this.state.turno_totale = parseInt(v) || 10;
      }));

    new Setting(contentEl)
      .setName('Premessa (max 500 car.)')
      .addTextArea(t => t.setValue(this.state.premessa).onChange(v => { this.state.premessa = v.slice(0, 500); }));

    this.renderNavButtons(false, true);
  }

  private renderStepLLM(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Nuova campagna — Passo 2/3: LLM' });

    new Setting(contentEl)
      .setName('Provider')
      .addDropdown(d => d
        .addOption('google_ai_studio', 'Google AI Studio (Gemini)')
        .addOption('ollama', 'Ollama (locale)')
        .addOption('openai', 'OpenAI / compatibile')
        .setValue(this.state.provider)
        .onChange(v => { this.state.provider = v as LLMProvider; }));

    new Setting(contentEl)
      .setName('Modello')
      .addText(t => t.setValue(this.state.model).onChange(v => { this.state.model = v; }));

    new Setting(contentEl)
      .setName('Variabile d\'ambiente API key')
      .setDesc('Il nome della variabile, non la chiave stessa')
      .addText(t => t.setValue(this.state.api_key_env).onChange(v => { this.state.api_key_env = v; }));

    this.renderNavButtons(true, true);
  }

  private renderStepFazioni(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Nuova campagna — Passo 3/3: Fazioni' });

    for (let fi = 0; fi < this.state.fazioni.length; fi++) {
      const f = this.state.fazioni[fi];
      const box = contentEl.createDiv({ cls: 'bloc-faction-box' });
      box.createEl('strong', { text: f.nome || `Fazione ${fi + 1}` });

      new Setting(box).setName('Nome').addText(t => t.setValue(f.nome).onChange(v => { f.nome = v; f.id = slugify(v); }));
      new Setting(box).setName('Obiettivo').addText(t => t.setValue(f.obiettivo).onChange(v => { f.obiettivo = v; }));
      new Setting(box).setName('Svantaggio ID').addText(t => t.setValue(f.svantaggio.id).onChange(v => { f.svantaggio.id = v; }));
      new Setting(box).setName('Svantaggio Label').addText(t => t.setValue(f.svantaggio.label).onChange(v => { f.svantaggio.label = v; }));

      const removeBtn = box.createEl('button', { text: 'Rimuovi fazione', cls: 'mod-warning' });
      removeBtn.addEventListener('click', () => {
        this.state.fazioni.splice(fi, 1);
        this.renderStep();
      });
    }

    const addBtn = contentEl.createEl('button', { text: '+ Aggiungi fazione' });
    addBtn.addEventListener('click', () => {
      this.state.fazioni.push({
        id: '',
        nome: '',
        obiettivo: '',
        vantaggi: [],
        svantaggio: { id: '', label: '' },
      });
      this.renderStep();
    });

    this.renderNavButtons(true, true, 'Crea campagna');
  }

  private renderStepConfirm(): void {
    this.createCampaign();
  }

  private renderNavButtons(showBack: boolean, showNext: boolean, nextLabel = 'Avanti'): void {
    const { contentEl } = this;
    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });

    if (showBack) {
      btnRow.createEl('button', { text: 'Indietro' }).addEventListener('click', () => {
        this.step--;
        this.renderStep();
      });
    }

    if (showNext) {
      const nextBtn = btnRow.createEl('button', { text: nextLabel, cls: 'mod-cta' });
      nextBtn.addEventListener('click', () => {
        this.step++;
        this.renderStep();
      });
    }
  }

  private async createCampaign(): Promise<void> {
    const { contentEl } = this;
    contentEl.createEl('p', { text: 'Creazione campagna in corso...' });

    try {
      const campagna: Campagna = {
        meta: {
          titolo: this.state.titolo,
          slug: this.state.slug,
          turno_corrente: 1,
          turno_totale: this.state.turno_totale,
          stato: 'raccolta',
        },
        premessa: this.state.premessa,
        llm: {
          provider: this.state.provider,
          model: this.state.model,
          api_key_env: this.state.api_key_env,
          temperature_mechanical: 0.2,
          temperature_narrative: 0.7,
        },
        fazioni: this.state.fazioni.map(f => ({
          id: f.id,
          nome: f.nome,
          mc: 0,
          vantaggi: f.vantaggi,
          svantaggio: f.svantaggio,
          obiettivo: f.obiettivo,
          leader: { presente: true },
        })) as FazioneConfig[],
        game_state_delta: [],
      };

      await writeCampaignFile(this.app, this.state.slug, campagna);

      for (const f of campagna.fazioni) {
        await writeFactionFile(this.app, this.state.slug, f.id, f, '');
      }

      new Notice(`Campagna "${this.state.titolo}" creata.`);
      this.onComplete();
      this.close();
    } catch (e) {
      contentEl.empty();
      contentEl.createEl('p', { text: `Errore: ${(e as Error).message}`, cls: 'mod-warning' });
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
