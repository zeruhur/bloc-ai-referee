import { App, Modal, Notice, Setting } from 'obsidian';
import type { Campagna, FazioneConfig, LLMProvider } from '../../types';
import { PROVIDER_LABELS } from '../../constants';
import { writeCampaignFile, writeFactionFile } from '../../vault/VaultManager';
import { slugify } from '../../utils/slugify';
import type BlocPlugin from '../../main';

const PROVIDER_ORDER: LLMProvider[] = [
  'google_ai_studio',
  'anthropic',
  'openai',
  'openrouter',
  'ollama',
];

interface WizardState {
  titolo: string;
  slug: string;
  turno_totale: number;
  premessa: string;
  provider: LLMProvider;
  model: string;
  fazioni: Array<{
    id: string;
    nome: string;
    obiettivo: string;
    profilo: string;
    nomeLeader?: string;
  }>;
}

export class NuovaCampagnaModal extends Modal {
  private step = 0;
  private state: WizardState;

  constructor(
    app: App,
    private plugin: BlocPlugin,
    private onComplete: () => void,
  ) {
    super(app);
    const s = plugin.settings;
    const provider = s.defaultProvider;
    const model = s.cachedModels?.[provider]?.[0] ?? '';
    this.state = {
      titolo: '',
      slug: '',
      turno_totale: 10,
      premessa: '',
      provider,
      model,
      fazioni: [],
    };
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
      .setName('Slug (auto-generato, modificabile)')
      .addText(t => t.setValue(this.state.slug).onChange(v => { this.state.slug = v; }));

    new Setting(contentEl)
      .setName('Numero turni totali')
      .addText(t => t.setValue(String(this.state.turno_totale)).onChange(v => {
        this.state.turno_totale = parseInt(v) || 10;
      }));

    new Setting(contentEl)
      .setName('Premessa (max 500 car.)')
      .setDesc('Contesto dello scenario — usato come system prompt in ogni chiamata LLM.')
      .addTextArea(t => t
        .setValue(this.state.premessa)
        .onChange(v => { this.state.premessa = v.slice(0, 500); }));

    this.renderNavButtons(false, true);
  }

  private renderStepLLM(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Nuova campagna — Passo 2/3: Modello AI' });

    // Provider dropdown
    new Setting(contentEl)
      .setName('Provider')
      .addDropdown(d => {
        for (const p of PROVIDER_ORDER) {
          d.addOption(p, PROVIDER_LABELS[p]);
        }
        d.setValue(this.state.provider).onChange(v => {
          this.state.provider = v as LLMProvider;
          const cached = this.plugin.settings.cachedModels?.[this.state.provider]?.[0] ?? '';
          this.state.model = cached;
          this.renderStep();
        });
      });

    // Model dropdown from cached list
    const models = this.plugin.settings.cachedModels?.[this.state.provider] ?? [];

    if (models.length > 0) {
      new Setting(contentEl)
        .setName('Modello')
        .addDropdown(d => {
          for (const m of models) d.addOption(m, m);
          d.setValue(this.state.model || models[0]).onChange(v => { this.state.model = v; });
          this.state.model = this.state.model || models[0];
        });
    } else {
      new Setting(contentEl)
        .setName('Modello')
        .setDesc('Nessun modello in cache. Inserisci il nome manualmente, oppure vai nelle Impostazioni del plugin e clicca "Aggiorna lista".')
        .addText(t => t
          .setPlaceholder('es. gemini-2.5-flash')
          .setValue(this.state.model)
          .onChange(v => { this.state.model = v.trim(); }));
    }

    // Key status hint
    const hasKey = !!(this.plugin.settings.apiKeys?.[this.state.provider]);
    const isOllama = this.state.provider === 'ollama';
    if (!hasKey && !isOllama) {
      contentEl.createEl('p', {
        text: `⚠ Nessuna chiave API configurata per ${PROVIDER_LABELS[this.state.provider]}. Aggiungila nelle Impostazioni del plugin prima di usare la campagna.`,
        cls: 'setting-item-description mod-warning',
      });
    } else if (hasKey) {
      contentEl.createEl('p', {
        text: `✓ Chiave API configurata per ${PROVIDER_LABELS[this.state.provider]}.`,
        cls: 'setting-item-description',
      });
    }

    this.renderNavButtons(true, true);
  }

  private renderStepFazioni(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Nuova campagna — Passo 3/3: Fazioni' });

    for (let fi = 0; fi < this.state.fazioni.length; fi++) {
      const f = this.state.fazioni[fi];
      const box = contentEl.createDiv({ cls: 'bloc-faction-box' });
      box.createEl('strong', { text: f.nome || `Fazione ${fi + 1}` });

      new Setting(box).setName('Nome').addText(t => t
        .setValue(f.nome)
        .onChange(v => { f.nome = v; f.id = slugify(v); }));
      new Setting(box).setName('Obiettivo').addText(t => t
        .setValue(f.obiettivo)
        .onChange(v => { f.obiettivo = v; }));
      new Setting(box).setName('Profilo')
        .setDesc('Capacità, punti di forza e debolezze tipiche — usato come contesto per l\'LLM.')
        .addTextArea(t => t
          .setValue(f.profilo)
          .onChange(v => { f.profilo = v; }));

      new Setting(box)
        .setName('Nome leader (opzionale)')
        .setDesc('Se assente, la fazione non avrà meccanica leader.')
        .addText(t => t
          .setPlaceholder('es. Generale Rossi')
          .setValue(f.nomeLeader ?? '')
          .onChange(v => { f.nomeLeader = v.trim() || undefined; }));

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
        profilo: '',
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
      btnRow.createEl('button', { text: nextLabel, cls: 'mod-cta' })
        .addEventListener('click', () => {
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
          temperature_mechanical: 0.2,
          temperature_narrative: 0.7,
        },
        fazioni: this.state.fazioni.map(f => ({
          id: f.id,
          nome: f.nome,
          mc: 0,
          obiettivo: f.obiettivo,
          profilo: f.profilo,
          leader: f.nomeLeader ? { nome: f.nomeLeader, presente: true } : undefined,
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
