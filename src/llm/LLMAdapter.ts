import type { App } from 'obsidian';
import type { LLMAdapter, LLMConfig, LLMPrompt, LLMResponse } from '../types';

export type { LLMAdapter, LLMPrompt, LLMResponse };

export class LLMValidationError extends Error {
  constructor(
    message: string,
    public readonly raw: string,
  ) {
    super(message);
    this.name = 'LLMValidationError';
  }
}

export async function createAdapter(config: LLMConfig, app: App): Promise<LLMAdapter> {
  const apiKey = resolveApiKey(config, app);

  switch (config.provider) {
    case 'google_ai_studio': {
      const { GeminiAdapter } = await import('./GeminiAdapter');
      return new GeminiAdapter(config.model, apiKey);
    }
    case 'ollama': {
      const { OllamaAdapter } = await import('./OllamaAdapter');
      const baseUrl = (app as any).plugins?.getPlugin('bloc-ai-referee')?.settings?.ollamaBaseUrl
        ?? 'http://localhost:11434';
      return new OllamaAdapter(config.model, baseUrl);
    }
    case 'openai': {
      const { OpenAIAdapter } = await import('./OpenAIAdapter');
      const baseUrl = (app as any).plugins?.getPlugin('bloc-ai-referee')?.settings?.openAIBaseUrl
        ?? 'https://api.openai.com/v1';
      return new OpenAIAdapter(config.model, apiKey, baseUrl);
    }
    case 'anthropic': {
      const { AnthropicAdapter } = await import('./AnthropicAdapter');
      return new AnthropicAdapter(config.model, apiKey);
    }
    case 'openrouter': {
      const { OpenRouterAdapter } = await import('./OpenRouterAdapter');
      const baseUrl = (app as any).plugins?.getPlugin('bloc-ai-referee')?.settings?.openRouterBaseUrl
        ?? 'https://openrouter.ai/api/v1';
      return new OpenRouterAdapter(config.model, apiKey, baseUrl);
    }
  }
}

function resolveApiKey(config: LLMConfig, app: App): string {
  // 1. Key stored in plugin settings (set via Settings tab)
  const pluginSettings = (app as any).plugins?.getPlugin('bloc-ai-referee')?.settings;
  const stored: string | undefined = pluginSettings?.apiKeys?.[config.provider];
  if (stored) return stored;

  // 2. Environment variable (power-user / CI fallback)
  if (config.api_key_env && typeof process !== 'undefined' && process.env?.[config.api_key_env]) {
    return process.env[config.api_key_env] as string;
  }

  return '';
}

export class MockLLMAdapter implements LLMAdapter {
  private calls: LLMPrompt[] = [];

  constructor(private fixture: unknown) {}

  async complete(_prompt: LLMPrompt): Promise<LLMResponse> {
    this.calls.push(_prompt);
    return {
      content: JSON.stringify(this.fixture),
      parsed: this.fixture,
      model: 'mock',
    };
  }

  getCalls(): LLMPrompt[] {
    return this.calls;
  }
}
