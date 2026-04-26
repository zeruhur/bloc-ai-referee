import { z } from 'zod';

export const actionDeclOutputSchema = {
  type: 'object',
  properties: {
    azione: { type: 'string' },
    metodo: { type: 'string' },
    vantaggi_usati: { type: 'array', items: { type: 'string' } },
  },
  required: ['azione', 'metodo', 'vantaggi_usati'],
} as const;

export const ActionDeclOutputZod = z.object({
  azione: z.string().max(80),
  metodo: z.string().max(200),
  vantaggi_usati: z.array(z.string()),
});
