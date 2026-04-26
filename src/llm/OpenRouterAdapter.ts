import { requestUrl } from 'obsidian';
import type { LLMAdapter, LLMPrompt, LLMResponse } from '../types';
import { LLMValidationError } from './LLMAdapter';

export class OpenRouterAdapter implements LLMAdapter {
  constructor(
    private model: string,
    private apiKey: string,
    private baseUrl: string,
  ) {}

  async complete(prompt: LLMPrompt): Promise<LLMResponse> {
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

    const res = await requestUrl({
      url: `${this.baseUrl}/chat/completions`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://github.com/zeruhur/bloc-ai-referee',
        'X-Title': 'BLOC AI Referee',
      },
      body: JSON.stringify(body),
      throw: false,
    });

    if (res.status !== 200) {
      throw new Error(`OpenRouter API error ${res.status}: ${res.text}`);
    }

    const rawText: string = res.json?.choices?.[0]?.message?.content ?? '';
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
      tokens_used: res.json?.usage?.total_tokens,
    };
  }
}
