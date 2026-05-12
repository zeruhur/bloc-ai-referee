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
          argomenti: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['fazione_target', 'argomenti'],
      },
    },
  },
  required: ['contro_argomentazioni'],
} as const;

export const CounterArgOutputZod = z.object({
  contro_argomentazioni: z.array(
    z.object({
      fazione_target: z.string(),
      argomenti: z.array(z.string()),
    }),
  ),
});

export type CounterArgOutput = z.infer<typeof CounterArgOutputZod>;
