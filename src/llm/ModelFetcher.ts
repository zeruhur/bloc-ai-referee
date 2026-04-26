import type { BlocPluginSettings, LLMProvider } from '../types';

export interface FetchModelsOptions {
  provider: LLMProvider;
  settings: BlocPluginSettings;
  apiKey: string;
}

export async function fetchModels(opts: FetchModelsOptions): Promise<string[]> {
  switch (opts.provider) {
    case 'google_ai_studio': return fetchGeminiModels(opts.apiKey);
    case 'ollama':           return fetchOllamaModels(opts.settings.ollamaBaseUrl);
    case 'openai':           return fetchOpenAIModels(opts.settings.openAIBaseUrl, opts.apiKey);
    case 'anthropic':        return fetchAnthropicModels(opts.apiKey);
    case 'openrouter':       return fetchOpenRouterModels(opts.settings.openRouterBaseUrl, opts.apiKey);
  }
}

async function fetchGeminiModels(apiKey: string): Promise<string[]> {
  if (!apiKey) throw new Error('API key richiesta per Google AI Studio');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`,
  );
  if (!res.ok) throw new Error(`Gemini models API: ${res.status}`);
  const data = await res.json();
  return (data.models as any[])
    .map((m: any) => m.name.replace('models/', ''))
    .filter((name: string) => name.startsWith('gemini'));
}

async function fetchOllamaModels(baseUrl: string): Promise<string[]> {
  const res = await fetch(`${baseUrl}/api/tags`);
  if (!res.ok) throw new Error(`Ollama tags API: ${res.status}`);
  const data = await res.json();
  return (data.models as any[]).map((m: any) => m.name);
}

async function fetchOpenAIModels(baseUrl: string, apiKey: string): Promise<string[]> {
  if (!apiKey) throw new Error('API key richiesta per OpenAI');
  const res = await fetch(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`OpenAI models API: ${res.status}`);
  const data = await res.json();
  return (data.data as any[])
    .map((m: any) => m.id)
    .filter((id: string) => id.startsWith('gpt') || id.startsWith('o'))
    .sort();
}

async function fetchAnthropicModels(apiKey: string): Promise<string[]> {
  if (!apiKey) throw new Error('API key richiesta per Anthropic');
  const res = await fetch('https://api.anthropic.com/v1/models', {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
  });
  if (!res.ok) throw new Error(`Anthropic models API: ${res.status}`);
  const data = await res.json();
  return (data.data as any[]).map((m: any) => m.id).sort();
}

async function fetchOpenRouterModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const headers: Record<string, string> = {
    'HTTP-Referer': 'https://github.com/zeruhur/bloc-ai-referee',
    'X-Title': 'BLOC AI Referee',
  };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const res = await fetch(`${baseUrl}/models`, { headers });
  if (!res.ok) throw new Error(`OpenRouter models API: ${res.status}`);
  const data = await res.json();
  return (data.data as any[]).map((m: any) => m.id).sort();
}

export function readApiKeyFromEnv(envVar: string): string {
  if (!envVar) return '';
  return (typeof process !== 'undefined' && process.env?.[envVar]) ? process.env[envVar]! : '';
}
