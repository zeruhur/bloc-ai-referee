import { z } from 'zod';

export const actionDeclOutputSchema = {
  type: 'object',
  properties: {
    azione: { type: 'string' },
    metodo: { type: 'string' },
    argomento_favorevole: { type: 'string' },
  },
  required: ['azione', 'metodo', 'argomento_favorevole'],
} as const;

export const ActionDeclOutputZod = z.object({
  azione: z.string().max(80),
  metodo: z.string().max(200),
  argomento_favorevole: z.string(),
});
