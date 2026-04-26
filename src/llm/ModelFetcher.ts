import { requestUrl } from 'obsidian';
import type { BlocPluginSettings, LLMProvider } from '../types';

export interface FetchModelsOptions {
  provider: LLMProvider;
  settings: BlocPluginSettings;
}

export async function fetchModels(opts: FetchModelsOptions): Promise<string[]> {
  const key = opts.settings.apiKeys?.[opts.provider] ?? '';
  switch (opts.provider) {
    case 'google_ai_studio': return fetchGeminiModels(key);
    case 'ollama':           return fetchOllamaModels(opts.settings.ollamaBaseUrl);
    case 'openai':           return fetchOpenAIModels(opts.settings.openAIBaseUrl, key);
    case 'anthropic':        return fetchAnthropicModels(key);
    case 'openrouter':       return fetchOpenRouterModels(opts.settings.openRouterBaseUrl, key);
  }
}

async function fetchGeminiModels(apiKey: string): Promise<string[]> {
  if (!apiKey) throw new Error('Chiave API mancante per Google AI Studio. Aggiungila nelle impostazioni.');
  const res = await requestUrl({
    url: `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`,
    method: 'GET',
    throw: false,
  });
  if (res.status !== 200) throw new Error(`Gemini models API: ${res.status} — chiave non valida?`);
  return (res.json.models as any[])
    .map((m: any) => (m.name as string).replace('models/', ''))
    .filter((name: string) => name.startsWith('gemini'))
    .sort();
}

async function fetchOllamaModels(baseUrl: string): Promise<string[]> {
  const res = await requestUrl({ url: `${baseUrl}/api/tags`, method: 'GET', throw: false });
  if (res.status !== 200) throw new Error(`Ollama non raggiungibile su ${baseUrl} (${res.status})`);
  return (res.json.models as any[]).map((m: any) => m.name as string).sort();
}

async function fetchOpenAIModels(baseUrl: string, apiKey: string): Promise<string[]> {
  if (!apiKey) throw new Error('Chiave API mancante per OpenAI. Aggiungila nelle impostazioni.');
  const res = await requestUrl({
    url: `${baseUrl}/models`,
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
    throw: false,
  });
  if (res.status !== 200) throw new Error(`OpenAI models API: ${res.status} — chiave non valida?`);
  return (res.json.data as any[])
    .map((m: any) => m.id as string)
    .filter((id: string) => id.startsWith('gpt') || id.startsWith('o'))
    .sort();
}

async function fetchAnthropicModels(apiKey: string): Promise<string[]> {
  if (!apiKey) throw new Error('Chiave API mancante per Anthropic. Aggiungila nelle impostazioni.');
  const res = await requestUrl({
    url: 'https://api.anthropic.com/v1/models',
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    throw: false,
  });
  if (res.status !== 200) throw new Error(`Anthropic models API: ${res.status} — chiave non valida?`);
  return (res.json.data as any[]).map((m: any) => m.id as string).sort();
}

async function fetchOpenRouterModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const headers: Record<string, string> = {
    'HTTP-Referer': 'https://github.com/zeruhur/bloc-ai-referee',
    'X-Title': 'BLOC AI Referee',
  };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const res = await requestUrl({ url: `${baseUrl}/models`, method: 'GET', headers, throw: false });
  if (res.status !== 200) throw new Error(`OpenRouter models API: ${res.status}`);
  return (res.json.data as any[]).map((m: any) => m.id as string).sort();
}
