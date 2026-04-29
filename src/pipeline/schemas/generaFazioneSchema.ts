import { z } from 'zod';

export const generaFazioneOutputSchema = {
  type: 'object',
  properties: {
    nome:      { type: 'string' },
    obiettivo: { type: 'string' },
    concetto:  { type: 'string' },
    vantaggi:  { type: 'array', items: { type: 'string' } },
    svantaggi: { type: 'array', items: { type: 'string' } },
  },
  required: ['nome', 'obiettivo', 'concetto', 'vantaggi', 'svantaggi'],
} as const;

export const GeneraFazioneOutputZod = z.object({
  nome:      z.string().min(1),
  obiettivo: z.string().min(1),
  concetto:  z.string().min(1),
  vantaggi:  z.array(z.string()).min(1).max(3),
  svantaggi: z.array(z.string()).min(1).max(2),
});
