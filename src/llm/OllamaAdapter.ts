import type { LLMAdapter, LLMPrompt, LLMResponse } from '../types';
import { LLMValidationError } from './LLMAdapter';

export class OllamaAdapter implements LLMAdapter {
  constructor(
    private model: string,
    private baseUrl: string,
  ) {}

  async complete(prompt: LLMPrompt): Promise<LLMResponse> {
    const url = `${this.baseUrl}/api/chat`;

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

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const rawText: string = data?.message?.content ?? '';

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new LLMValidationError('Ollama response is not valid JSON', rawText);
    }

    return {
      content: rawText,
      parsed,
      model: this.model,
    };
  }
}
