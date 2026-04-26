import { z } from 'zod';

export const narrativeOutputSchema = {
  type: 'object',
  properties: {
    conseguenze: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fazione: { type: 'string' },
          azione: { type: 'string' },
          esito: {
            type: 'string',
            enum: ['no_e', 'no', 'no_ma', 'si_ma', 'si', 'si_e'],
          },
          testo_conseguenza: { type: 'string' },
          state_delta: {
            type: 'object',
            properties: {
              mc_delta: { type: 'integer' },
              territorio: { type: 'string' },
              note: { type: 'string' },
            },
            required: ['mc_delta', 'note'],
          },
        },
        required: ['fazione', 'azione', 'esito', 'testo_conseguenza', 'state_delta'],
      },
    },
    eventi_turno: { type: 'array', items: { type: 'string' } },
    narrative_seed_prossimo_turno: { type: 'string' },
  },
  required: ['conseguenze', 'eventi_turno', 'narrative_seed_prossimo_turno'],
} as const;

export const NarrativeOutputZod = z.object({
  conseguenze: z.array(
    z.object({
      fazione: z.string(),
      azione: z.string(),
      esito: z.enum(['no_e', 'no', 'no_ma', 'si_ma', 'si', 'si_e']),
      testo_conseguenza: z.string(),
      state_delta: z.object({
        mc_delta: z.number(),
        territorio: z.string().optional(),
        note: z.string(),
      }),
    }),
  ),
  eventi_turno: z.array(z.string()),
  narrative_seed_prossimo_turno: z.string(),
});
