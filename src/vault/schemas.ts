import { z } from 'zod';

const FazioneConfigSchema = z.object({
  id: z.string(),
  nome: z.string(),
  mc: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  tipo: z.enum(['normale', 'ia']).optional(),
  obiettivo: z.string(),
  concetto: z.string(),
  vantaggi: z.array(z.string()),
  svantaggi: z.array(z.string()),
  leader: z.object({ nome: z.string().optional(), presente: z.boolean() }).optional(),
});

const LLMConfigSchema = z.object({
  provider: z.enum(['google_ai_studio', 'ollama', 'openai', 'anthropic', 'openrouter']),
  model: z.string(),
  api_key_env: z.string().optional(),
  temperature_mechanical: z.number(),
  temperature_narrative: z.number(),
});

const GameStateDeltaSchema = z.object({
  turno: z.number(),
  eventi_chiave: z.array(z.string()),
  stato_fazioni: z.record(
    z.object({
      mc: z.number(),
      territorio: z.union([z.string(), z.array(z.string())]),
    }),
  ),
  narrative_seed: z.string().optional(),
});

export const CampagnaSchema = z.object({
  meta: z.object({
    titolo: z.string(),
    slug: z.string(),
    turno_corrente: z.number(),
    turno_totale: z.number(),
    stato: z.enum([
      'raccolta',
      'matrice_generata',
      'contro_args',
      'valutazione',
      'tiri',
      'review',
      'chiuso',
    ]),
    livello_operativo: z.string().optional(),
    distribuzione_temporale: z.enum(['lineare', 'non_lineare']).optional(),
    intervallo_temporale: z.string().optional(),
  }),
  premessa: z.string(),
  llm: LLMConfigSchema,
  fazioni: z.array(FazioneConfigSchema),
  game_state_delta: z.array(GameStateDeltaSchema),
});

const ArgomentoControSchema = z.object({
  fazione: z.string(),
  argomento: z.string(),
});

export const AzioneDeclarationSchema = z.object({
  fazione: z.string(),
  giocatore: z.string(),
  turno: z.number(),
  tipo_azione: z.enum(['principale', 'leader']),
  categoria_azione: z.enum(['standard', 'latente', 'difesa', 'aiuto', 'segreta']),
  azione: z.string().max(80),
  metodo: z.string().max(200),
  argomento_vantaggio: z.string(),
  argomenti_contro: z.array(ArgomentoControSchema),
  fazione_aiutata: z.string().optional(),
  dettaglio_narrativo: z.string().optional(),
  azione_extra: z.boolean().optional(),
  valutazione: z
    .object({
      fazione: z.string(),
      azione: z.string(),
      valutazione_vantaggio: z.object({ peso: z.number(), motivazione: z.string() }),
      valutazioni_contro: z.array(
        z.object({ fazione: z.string(), peso: z.number(), motivazione: z.string() }),
      ),
      pool: z.object({
        positivi: z.number(),
        negativi: z.number(),
        netto: z.number(),
        modalita: z.enum(['alto', 'basso', 'neutro']),
      }),
    })
    .optional(),
});
