import { describe, it, expect } from 'vitest';
import { ActionDeclOutputZod } from '../src/pipeline/schemas/actionDeclSchema';

const baseOutput = { risultato: 'Attaccare il confine est', argomento_favorevole: 'Posizione vantaggiosa' };

describe('autoGenAzioneIA — azione validation', () => {
  it('Zod accepts any non-empty azione string', () => {
    const result = ActionDeclOutputZod.safeParse({ ...baseOutput, azione: 'x'.repeat(500) });
    expect(result.success).toBe(true);
  });

  it('Zod accepts short azione', () => {
    const result = ActionDeclOutputZod.safeParse({ ...baseOutput, azione: 'Assalto frontale rapido.' });
    expect(result.success).toBe(true);
  });

  it('Zod accepts long azione without truncation', () => {
    const long = 'a'.repeat(400);
    const result = ActionDeclOutputZod.safeParse({ ...baseOutput, azione: long });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.azione.length).toBe(400);
    }
  });
});
