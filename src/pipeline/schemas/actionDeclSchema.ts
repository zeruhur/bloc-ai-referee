import { z } from 'zod';

export const actionDeclOutputSchema = {
  type: 'object',
  properties: {
    azione: { type: 'string' },
    metodo: { type: 'string' },
    argomento_vantaggio: { type: 'string' },
  },
  required: ['azione', 'metodo', 'argomento_vantaggio'],
} as const;

export const ActionDeclOutputZod = z.object({
  azione: z.string().max(80),
  metodo: z.string().max(200),
  argomento_vantaggio: z.string(),
});
