import { z } from 'zod';

export const counterArgOutputSchema = {
  type: 'object',
  properties: {
    contro_argomentazioni: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fazione_target: { type: 'string' },
          svantaggi_opposti: { type: 'array', items: { type: 'string' } },
        },
        required: ['fazione_target', 'svantaggi_opposti'],
      },
    },
  },
  required: ['contro_argomentazioni'],
} as const;

export const CounterArgOutputZod = z.object({
  contro_argomentazioni: z.array(
    z.object({
      fazione_target: z.string(),
      svantaggi_opposti: z.array(z.string()),
    }),
  ),
});

export type CounterArgOutput = z.infer<typeof CounterArgOutputZod>;
