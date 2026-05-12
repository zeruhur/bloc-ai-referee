import { z } from 'zod';

export const actionDeclOutputSchema = {
  type: 'object',
  properties: {
    risultato: { type: 'string' },
    azione: { type: 'string' },
    argomento_favorevole: { type: 'string' },
  },
  required: ['risultato', 'azione', 'argomento_favorevole'],
} as const;

export const ActionDeclOutputZod = z.object({
  risultato: z.string(),
  azione: z.string(),
  argomento_favorevole: z.string(),
});
