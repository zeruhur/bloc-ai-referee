import type { LLMAdapter, LLMPrompt, LLMResponse } from '../types';
import { LLMValidationError } from './LLMAdapter';

export class GeminiAdapter implements LLMAdapter {
  constructor(
    private model: string,
    private apiKey: string,
  ) {}

  async complete(prompt: LLMPrompt): Promise<LLMResponse> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const body = {
      system_instruction: { parts: [{ text: prompt.system }] },
      contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
      generationConfig: {
        temperature: prompt.temperature,
        responseMimeType: 'application/json',
        responseSchema: prompt.output_schema,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

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
      tokens_used: data?.usageMetadata?.totalTokenCount,
    };
  }
}
