import { z } from 'zod';

export const evaluateOutputSchema = {
  type: 'object',
  properties: {
    fazione: { type: 'string' },
    azione: { type: 'string' },
    vantaggi_confermati: { type: 'array', items: { type: 'string' } },
    vantaggi_ridotti: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          motivazione: { type: 'string' },
        },
        required: ['id', 'motivazione'],
      },
    },
    vantaggi_negati: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          motivazione: { type: 'string' },
        },
        required: ['id', 'motivazione'],
      },
    },
    svantaggi_attivati: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          motivazione: { type: 'string' },
        },
        required: ['id', 'motivazione'],
      },
    },
    pool: {
      type: 'object',
      properties: {
        positivi: { type: 'integer' },
        negativi: { type: 'integer' },
        netto: { type: 'integer' },
        modalita: { type: 'string', enum: ['alto', 'basso', 'neutro'] },
      },
      required: ['positivi', 'negativi', 'netto', 'modalita'],
    },
  },
  required: [
    'fazione',
    'azione',
    'vantaggi_confermati',
    'vantaggi_ridotti',
    'vantaggi_negati',
    'svantaggi_attivati',
    'pool',
  ],
} as const;

export const EvaluateOutputZod = z.object({
  fazione: z.string(),
  azione: z.string(),
  vantaggi_confermati: z.array(z.string()),
  vantaggi_ridotti: z.array(z.object({ id: z.string(), motivazione: z.string() })),
  vantaggi_negati: z.array(z.object({ id: z.string(), motivazione: z.string() })),
  svantaggi_attivati: z.array(z.object({ id: z.string(), motivazione: z.string() })),
  pool: z.object({
    positivi: z.number(),
    negativi: z.number(),
    netto: z.number(),
    modalita: z.enum(['alto', 'basso', 'neutro']),
  }),
});
