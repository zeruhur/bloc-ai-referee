import { requestUrl } from 'obsidian';
import type { LLMAdapter, LLMPrompt, LLMResponse } from '../types';
import { LLMValidationError } from './LLMAdapter';

const ANTHROPIC_VERSION = '2023-06-01';
const MAX_TOKENS = 8192;

export class AnthropicAdapter implements LLMAdapter {
  constructor(
    private model: string,
    private apiKey: string,
  ) {}

  async complete(prompt: LLMPrompt): Promise<LLMResponse> {
    const body = {
      model: this.model,
      max_tokens: MAX_TOKENS,
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.user }],
      temperature: prompt.temperature,
      tools: [
        {
          name: 'output',
          description: 'Produce the structured JSON output for this task.',
          input_schema: prompt.output_schema,
        },
      ],
      tool_choice: { type: 'tool', name: 'output' },
    };

    const res = await requestUrl({
      url: 'https://api.anthropic.com/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
      throw: false,
    });

    if (res.status !== 200) {
      throw new Error(`Anthropic API error ${res.status}: ${res.text}`);
    }

    const toolBlock = res.json?.content?.find((c: any) => c.type === 'tool_use');
    if (!toolBlock) {
      throw new LLMValidationError('Anthropic returned no tool_use block', res.text);
    }

    const parsed: unknown = toolBlock.input;
    const rawText = JSON.stringify(parsed);

    return {
      content: rawText,
      parsed,
      model: this.model,
      tokens_used: (res.json?.usage?.input_tokens ?? 0) + (res.json?.usage?.output_tokens ?? 0),
    };
  }
}
