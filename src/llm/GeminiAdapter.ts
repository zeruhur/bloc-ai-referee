import { requestUrl } from 'obsidian';
import type { LLMAdapter, LLMPrompt, LLMResponse } from '../types';
import { LLMValidationError } from './LLMAdapter';

export class GeminiAdapter implements LLMAdapter {
  constructor(
    private model: string,
    private apiKey: string,
  ) {}

  async complete(prompt: LLMPrompt): Promise<LLMResponse> {
    const body = {
      system_instruction: { parts: [{ text: prompt.system }] },
      contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
      generationConfig: {
        temperature: prompt.temperature,
        responseMimeType: 'application/json',
        responseSchema: prompt.output_schema,
      },
    };

    const res = await requestUrl({
      url: `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      throw: false,
    });

    if (res.status !== 200) {
      throw new Error(`Gemini API error ${res.status}: ${res.text}`);
    }

    const rawText: string = res.json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new LLMValidationError('Gemini response is not valid JSON', rawText);
    }

    return {
      content: rawText,
      parsed,
      model: this.model,
      tokens_used: res.json?.usageMetadata?.totalTokenCount,
    };
  }
}
