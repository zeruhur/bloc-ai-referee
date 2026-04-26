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
      format: 'json',
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
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new LLMValidationError('Ollama response is not valid JSON', rawText);
    }

    return { content: rawText, parsed, model: this.model };
  }
}
