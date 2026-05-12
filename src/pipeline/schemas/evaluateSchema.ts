import { z } from 'zod';

const valutazioneArgomentoSchema = {
  type: 'object',
  properties: {
    peso: { type: 'integer' },
    motivazione: { type: 'string' },
  },
  required: ['peso', 'motivazione'],
} as const;

export const evaluateOutputSchema = {
  type: 'object',
  properties: {
    fazione: { type: 'string' },
    azione: { type: 'string' },
    valutazione_vantaggio: valutazioneArgomentoSchema,
    valutazioni_contro: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          peso: { type: 'integer' },
          motivazione: { type: 'string' },
        },
        required: ['peso', 'motivazione'],
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
  required: ['fazione', 'azione', 'valutazione_vantaggio', 'valutazioni_contro', 'pool'],
} as const;

export const EvaluateOutputZod = z.object({
  fazione: z.string(),
  azione: z.string(),
  valutazione_vantaggio: z.object({ peso: z.number(), motivazione: z.string() }),
  valutazioni_contro: z.array(
    z.object({ peso: z.number(), motivazione: z.string() }),
  ),
  pool: z.object({
    positivi: z.number(),
    negativi: z.number(),
    netto: z.number(),
    modalita: z.enum(['alto', 'basso', 'neutro']),
  }),
});
