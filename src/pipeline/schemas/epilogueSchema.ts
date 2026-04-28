import { z } from 'zod';

export const epilogueOutputSchema = {
  type: 'object',
  properties: {
    epilogo: { type: 'string' },
  },
  required: ['epilogo'],
} as const;

export const EpilogueOutputZod = z.object({
  epilogo: z.string(),
});
