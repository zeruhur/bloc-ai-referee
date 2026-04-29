import { z } from 'zod';

const MatrixEntrySchema = z.object({
  fazione: z.string(),
  azione: z.string(),
  metodo: z.string(),
  argomento_vantaggio: z.string().nullish().transform(v => v ?? ''),
  conflitti_con: z.array(z.string()).nullish().transform(v => v ?? []),
});

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
    matrice_arbitro: {
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

export const MatrixOutputZod = z.preprocess(
  // Some models return the array directly instead of wrapping in {azioni: [...]}
  (data) => (Array.isArray(data) ? { azioni: data } : data),
  z.object({
    azioni: z.array(MatrixEntrySchema),
    matrice_arbitro: z.array(MatrixEntrySchema).optional(),
  }),
);
