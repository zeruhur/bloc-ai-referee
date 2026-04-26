import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type { LLMProvider } from '../types';
import { PROVIDER_LABELS } from '../constants';
import { fetchModels } from '../llm/ModelFetcher';
import type BlocPlugin from '../main';

const PROVIDER_ORDER: LLMProvider[] = [
  'google_ai_studio',
  'anthropic',
  'openai',
  'openrouter',
  'ollama',
];

// Providers that require an API key
const PROVIDERS_WITH_KEY: LLMProvider[] = ['google_ai_studio', 'anthropic', 'openai', 'openrouter'];

export class BlocSettingsTab extends PluginSettingTab {
  private modelDropdown: HTMLSelectElement | null = null;

  constructor(
    app: App,
    private plugin: BlocPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // ---- Campaign ----
    containerEl.createEl('h3', { text: 'Campagna' });

    new Setting(containerEl)
      .setName('Campagna predefinita')
      .setDesc('Slug della campagna attiva (cartella in /campagne/)')
      .addText(text =>
        text
          .setPlaceholder('slug-campagna')
          .setValue(this.plugin.settings.defaultCampaignSlug)
          .onChange(async (value) => {
            this.plugin.settings.defaultCampaignSlug = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    // ---- Provider & Model ----
    containerEl.createEl('h3', { text: 'Provider LLM' });

    new Setting(containerEl)
      .setName('Provider predefinito')
      .addDropdown(drop => {
        for (const p of PROVIDER_ORDER) {
          drop.addOption(p, PROVIDER_LABELS[p]);
        }
        drop
          .setValue(this.plugin.settings.defaultProvider)
          .onChange(async (value: string) => {
            this.plugin.settings.defaultProvider = value as LLMProvider;
            await this.plugin.saveSettings();
            this.refreshModelDropdown();
          });
      });

    const modelSetting = new Setting(containerEl)
      .setName('Modello')
      .setDesc('Clicca "Aggiorna" per scaricare la lista dal provider (richiede la chiave API configurata sotto).');

    const selectWrapper = modelSetting.controlEl.createDiv({ cls: 'bloc-model-select-wrapper' });
    const select = selectWrapper.createEl('select', { cls: 'dropdown' });
    this.modelDropdown = select;
    this.populateModelDropdown(select);

    select.addEventListener('change', async () => {
      const provider = this.plugin.settings.defaultProvider;
      if (!this.plugin.settings.cachedModels) this.plugin.settings.cachedModels = {};
      const models = this.plugin.settings.cachedModels[provider] ?? [];
      const chosen = select.value;
      this.plugin.settings.cachedModels[provider] = [
        chosen,
        ...models.filter(m => m !== chosen),
      ];
      await this.plugin.saveSettings();
    });

    modelSetting.addButton(btn =>
      btn
        .setButtonText('Aggiorna lista')
        .setTooltip('Scarica la lista dei modelli dal provider selezionato')
        .onClick(() => this.fetchAndRefreshModels()),
    );

    // ---- API Keys ----
    containerEl.createEl('h3', { text: 'Chiavi API' });
    containerEl.createEl('p', {
      text: 'Le chiavi sono salvate nei dati del plugin (non nei file della vault). Non vengono mai scritte in campagna.yaml.',
      cls: 'setting-item-description',
    });

    for (const provider of PROVIDERS_WITH_KEY) {
      new Setting(containerEl)
        .setName(PROVIDER_LABELS[provider])
        .addText(text => {
          const input = text
            .setPlaceholder('Incolla la chiave API')
            .setValue(this.plugin.settings.apiKeys?.[provider] ?? '')
            .onChange(async (value) => {
              if (!this.plugin.settings.apiKeys) this.plugin.settings.apiKeys = {};
              if (value.trim()) {
                this.plugin.settings.apiKeys[provider] = value.trim();
              } else {
                delete this.plugin.settings.apiKeys[provider];
              }
              await this.plugin.saveSettings();
            });
          // Make it a password field
          input.inputEl.type = 'password';
          input.inputEl.autocomplete = 'off';
          return input;
        });
    }

    // ---- URL overrides ----
    containerEl.createEl('h3', { text: 'URL locali / proxy' });

    new Setting(containerEl)
      .setName('URL base Ollama')
      .addText(text =>
        text
          .setPlaceholder('http://localhost:11434')
          .setValue(this.plugin.settings.ollamaBaseUrl)
          .onChange(async (value) => {
            this.plugin.settings.ollamaBaseUrl = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('URL base OpenAI / compatibile')
      .addText(text =>
        text
          .setPlaceholder('https://api.openai.com/v1')
          .setValue(this.plugin.settings.openAIBaseUrl)
          .onChange(async (value) => {
            this.plugin.settings.openAIBaseUrl = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('URL base OpenRouter')
      .addText(text =>
        text
          .setPlaceholder('https://openrouter.ai/api/v1')
          .setValue(this.plugin.settings.openRouterBaseUrl)
          .onChange(async (value) => {
            this.plugin.settings.openRouterBaseUrl = value.trim();
            await this.plugin.saveSettings();
          }),
      );
  }

  private populateModelDropdown(select: HTMLSelectElement): void {
    select.empty();
    const provider = this.plugin.settings.defaultProvider;
    const models = this.plugin.settings.cachedModels?.[provider] ?? [];

    if (models.length === 0) {
      const opt = select.createEl('option', { text: '— clicca "Aggiorna lista" —' });
      opt.value = '';
      opt.disabled = true;
      opt.selected = true;
    } else {
      for (const model of models) {
        const opt = select.createEl('option', { text: model, value: model });
        opt.selected = model === models[0];
      }
    }
  }

  private refreshModelDropdown(): void {
    if (this.modelDropdown) {
      this.populateModelDropdown(this.modelDropdown);
    }
  }

  private async fetchAndRefreshModels(): Promise<void> {
    const provider = this.plugin.settings.defaultProvider;
    const notice = new Notice(`Recupero modelli da ${PROVIDER_LABELS[provider]}...`, 0);

    try {
      const models = await fetchModels({ provider, settings: this.plugin.settings });

      if (models.length === 0) throw new Error('Nessun modello trovato.');

      if (!this.plugin.settings.cachedModels) this.plugin.settings.cachedModels = {};
      const prev = this.plugin.settings.cachedModels[provider]?.[0];
      const deduped = prev && models.includes(prev)
        ? [prev, ...models.filter(m => m !== prev)]
        : models;

      this.plugin.settings.cachedModels[provider] = deduped;
      await this.plugin.saveSettings();

      notice.hide();
      new Notice(`${models.length} modelli caricati per ${PROVIDER_LABELS[provider]}.`);
      this.refreshModelDropdown();
    } catch (e) {
      notice.hide();
      new Notice(`Errore: ${(e as Error).message}`);
    }
  }
}
