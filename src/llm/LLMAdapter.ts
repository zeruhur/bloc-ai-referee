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
  const apiKey = readApiKey(config.api_key_env, app);

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
  }
}

function readApiKey(envVar: string, _app: App): string {
  if (typeof process !== 'undefined' && process.env?.[envVar]) {
    return process.env[envVar] as string;
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
