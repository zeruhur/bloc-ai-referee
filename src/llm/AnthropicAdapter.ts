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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${errText}`);
    }

    const data = await response.json();

    // Tool use response: content is an array; find the tool_use block
    const toolBlock = data?.content?.find((c: any) => c.type === 'tool_use');
    if (!toolBlock) {
      throw new LLMValidationError('Anthropic returned no tool_use block', JSON.stringify(data));
    }

    const parsed: unknown = toolBlock.input;
    const rawText = JSON.stringify(parsed);

    return {
      content: rawText,
      parsed,
      model: this.model,
      tokens_used: data?.usage?.input_tokens + data?.usage?.output_tokens,
    };
  }
}
