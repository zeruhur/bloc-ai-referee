import { z } from 'zod';

export const matrixOutputSchema = {
  type: 'object',
  properties: {
    azioni: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fazione: { type: 'string' },
          azione: { type: 'string' },
          metodo: { type: 'string' },
          argomento_vantaggio: { type: 'string' },
          conflitti_con: { type: 'array', items: { type: 'string' } },
        },
        required: ['fazione', 'azione', 'metodo', 'argomento_vantaggio', 'conflitti_con'],
      },
    },
  },
  required: ['azioni'],
} as const;

export const MatrixOutputZod = z.object({
  azioni: z.array(
    z.object({
      fazione: z.string(),
      azione: z.string(),
      metodo: z.string(),
      argomento_vantaggio: z.string(),
      conflitti_con: z.array(z.string()),
    }),
  ),
});
