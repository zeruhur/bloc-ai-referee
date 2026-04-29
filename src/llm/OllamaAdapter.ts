import { requestUrl } from 'obsidian';
import type { LLMAdapter, LLMPrompt, LLMResponse } from '../types';
import { LLMValidationError } from './LLMAdapter';

export class OllamaAdapter implements LLMAdapter {
  constructor(
    private model: string,
    private baseUrl: string,
  ) {}

  async complete(prompt: LLMPrompt): Promise<LLMResponse> {
    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      // Pass the JSON schema when available (Ollama 0.5+); fall back to generic JSON mode
      format: prompt.output_schema ?? 'json',
      stream: false,
      options: {
        temperature: prompt.temperature,
        think: true,
      },
    };

    const res = await requestUrl({
      url: `${this.baseUrl}/api/chat`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      throw: false,
    });

    if (res.status !== 200) {
      throw new Error(`Ollama API error ${res.status}: ${res.text}`);
    }

    const rawText: string = res.json?.message?.content ?? '';
    // Some thinking models (deepseek-r1, qwen3) embed <think>…</think> in content before the JSON
    const cleanText = rawText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanText);
    } catch {
      throw new LLMValidationError('Ollama response is not valid JSON', rawText);
    }

    return { content: cleanText, parsed, model: this.model };
  }
}
