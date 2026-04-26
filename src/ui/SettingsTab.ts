import { App, PluginSettingTab, Setting } from 'obsidian';
import type BlocPlugin from '../main';

export class BlocSettingsTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: BlocPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

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

    new Setting(containerEl)
      .setName('Provider LLM predefinito')
      .addDropdown(drop =>
        drop
          .addOption('google_ai_studio', 'Google AI Studio (Gemini)')
          .addOption('ollama', 'Ollama (locale)')
          .addOption('openai', 'OpenAI / compatibile')
          .setValue(this.plugin.settings.defaultProvider)
          .onChange(async (value: string) => {
            this.plugin.settings.defaultProvider = value as any;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('URL base Ollama')
      .setDesc('Es. http://localhost:11434')
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
      .setName('URL base OpenAI')
      .setDesc('Es. https://api.openai.com/v1 (o un proxy compatibile)')
      .addText(text =>
        text
          .setPlaceholder('https://api.openai.com/v1')
          .setValue(this.plugin.settings.openAIBaseUrl)
          .onChange(async (value) => {
            this.plugin.settings.openAIBaseUrl = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    containerEl.createEl('p', {
      text: 'Le chiavi API non vanno salvate qui. Impostale come variabili d\'ambiente (es. GEMINI_API_KEY) prima di avviare Obsidian.',
      cls: 'setting-item-description',
    });
  }
}
