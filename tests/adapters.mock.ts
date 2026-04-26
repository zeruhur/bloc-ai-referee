import type { LLMAdapter, LLMPrompt, LLMResponse } from '../src/types';

export class MockLLMAdapter implements LLMAdapter {
  private calls: LLMPrompt[] = [];

  constructor(private fixture: unknown) {}

  async complete(prompt: LLMPrompt): Promise<LLMResponse> {
    this.calls.push(prompt);
    return {
      content: JSON.stringify(this.fixture),
      parsed: this.fixture,
      model: 'mock',
    };
  }

  getCalls(): LLMPrompt[] {
    return this.calls;
  }

  reset(): void {
    this.calls = [];
  }
}
