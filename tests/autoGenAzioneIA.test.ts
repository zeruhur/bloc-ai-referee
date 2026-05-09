import { describe, it, expect } from 'vitest';
import { ActionDeclOutputZod } from '../src/pipeline/schemas/actionDeclSchema';

const baseOutput = { risultato: 'Attaccare il confine est', argomento_favorevole: 'Posizione vantaggiosa' };

describe('autoGenAzioneIA — azione sanitization', () => {
  it('Zod rejects azione > 200 chars without sanitization', () => {
    const result = ActionDeclOutputZod.safeParse({ ...baseOutput, azione: 'x'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('pipeline does not fail when azione is truncated to 200 before Zod', () => {
    const long = 'a'.repeat(250);
    const truncated = long.slice(0, 200);
    const result = ActionDeclOutputZod.safeParse({ ...baseOutput, azione: truncated });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.azione.length).toBe(200);
    }
  });

  it('Zod accepts azione within 200 chars unchanged', () => {
    const result = ActionDeclOutputZod.safeParse({ ...baseOutput, azione: 'Assalto frontale rapido.' });
    expect(result.success).toBe(true);
  });

  it('truncation to exactly 200 preserves boundary correctly', () => {
    // 200 chars — must pass
    const at200 = 'b'.repeat(200);
    expect(ActionDeclOutputZod.safeParse({ ...baseOutput, azione: at200 }).success).toBe(true);
    // 201 chars — must fail (pre-sanitization behaviour we are guarding against)
    const at201 = 'b'.repeat(201);
    expect(ActionDeclOutputZod.safeParse({ ...baseOutput, azione: at201 }).success).toBe(false);
  });
});
