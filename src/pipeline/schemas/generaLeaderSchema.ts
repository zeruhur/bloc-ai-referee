import { z } from 'zod';

export const generaLeaderOutputSchema = {
  type: 'object',
  properties: {
    nome: { type: 'string' },
    descrizione: { type: 'string' },
  },
  required: ['nome', 'descrizione'],
} as const;

export const GeneraLeaderOutputZod = z.object({
  nome: z.string(),
  descrizione: z.string().max(300),
});
