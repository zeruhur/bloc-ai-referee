import type { LLMAdapter, LLMPrompt, LLMResponse } from '../types';
import { LLMValidationError } from './LLMAdapter';

export class OpenRouterAdapter implements LLMAdapter {
  constructor(
    private model: string,
    private apiKey: string,
    private baseUrl: string,
  ) {}

  async complete(prompt: LLMPrompt): Promise<LLMResponse> {
    const url = `${this.baseUrl}/chat/completions`;

    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      temperature: prompt.temperature,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'output',
          strict: true,
          schema: prompt.output_schema,
        },
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://github.com/zeruhur/bloc-ai-referee',
        'X-Title': 'BLOC AI Referee',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const rawText: string = data?.choices?.[0]?.message?.content ?? '';

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new LLMValidationError('OpenRouter response is not valid JSON', rawText);
    }

    return {
      content: rawText,
      parsed,
      model: this.model,
      tokens_used: data?.usage?.total_tokens,
    };
  }
}
