import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type { LLMProvider } from '../types';
import { PROVIDER_LABELS } from '../constants';
import { fetchModels, readApiKeyFromEnv } from '../llm/ModelFetcher';
import type BlocPlugin from '../main';

const PROVIDER_ORDER: LLMProvider[] = [
  'google_ai_studio',
  'anthropic',
  'openai',
  'openrouter',
  'ollama',
];

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

    // ---- LLM provider ----
    containerEl.createEl('h3', { text: 'Configurazione LLM' });

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

    // ---- Model selection ----
    const modelSetting = new Setting(containerEl)
      .setName('Modello')
      .setDesc('Seleziona il modello oppure clicca "Aggiorna" per recuperare la lista dal provider.');

    // Native <select> for the model list
    const selectWrapper = modelSetting.controlEl.createDiv({ cls: 'bloc-model-select-wrapper' });
    const select = selectWrapper.createEl('select', { cls: 'dropdown' });
    this.modelDropdown = select;
    this.populateModelDropdown(select);

    select.addEventListener('change', async () => {
      const provider = this.plugin.settings.defaultProvider;
      if (!this.plugin.settings.cachedModels) this.plugin.settings.cachedModels = {};
      // Store selected model as first in the list so it stays selected after reload
      const models = this.plugin.settings.cachedModels[provider] ?? [];
      const chosen = select.value;
      this.plugin.settings.cachedModels[provider] = [
        chosen,
        ...models.filter(m => m !== chosen),
      ];
      await this.plugin.saveSettings();
    });

    // Refresh button
    modelSetting.addButton(btn =>
      btn
        .setButtonText('Aggiorna lista')
        .setTooltip('Scarica la lista dei modelli disponibili dal provider selezionato')
        .onClick(() => this.fetchAndRefreshModels()),
    );

    // ---- API key env var (for fetching models) ----
    new Setting(containerEl)
      .setName('Variabile d\'ambiente API key')
      .setDesc('Nome della variabile d\'ambiente contenente la chiave API del provider selezionato (usata solo per scaricare la lista modelli)')
      .addText(text =>
        text
          .setPlaceholder('es. GEMINI_API_KEY, ANTHROPIC_API_KEY')
          .setValue(this.plugin.settings.modelApiKeyEnvVar)
          .onChange(async (value) => {
            this.plugin.settings.modelApiKeyEnvVar = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    // ---- Provider-specific URLs ----
    containerEl.createEl('h3', { text: 'URL provider locali / proxy' });

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

    // ---- Note ----
    containerEl.createEl('p', {
      text: 'Le chiavi API non vengono mai salvate in questo plugin. Impostale come variabili d\'ambiente prima di avviare Obsidian (es. GEMINI_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY).',
      cls: 'setting-item-description',
    });
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
    const apiKey = readApiKeyFromEnv(this.plugin.settings.modelApiKeyEnvVar);

    const notice = new Notice(`Recupero modelli da ${PROVIDER_LABELS[provider]}...`, 0);

    try {
      const models = await fetchModels({
        provider,
        settings: this.plugin.settings,
        apiKey,
      });

      if (models.length === 0) {
        throw new Error('Nessun modello trovato.');
      }

      if (!this.plugin.settings.cachedModels) this.plugin.settings.cachedModels = {};

      // Preserve the previously selected model at the top if still valid
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
