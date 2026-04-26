import { z } from 'zod';

const VantaggioTokenSchema = z.object({
  id: z.string(),
  label: z.string(),
});

const SvantaggioTokenSchema = z.object({
  id: z.string(),
  label: z.string(),
});

const FazioneConfigSchema = z.object({
  id: z.string(),
  nome: z.string(),
  mc: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  tipo: z.enum(['normale', 'ia']).optional(),
  vantaggi: z.array(VantaggioTokenSchema),
  svantaggio: SvantaggioTokenSchema,
  obiettivo: z.string(),
  leader: z.object({ presente: z.boolean() }),
});

const LLMConfigSchema = z.object({
  provider: z.enum(['google_ai_studio', 'ollama', 'openai']),
  model: z.string(),
  api_key_env: z.string(),
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
  }),
  premessa: z.string(),
  llm: LLMConfigSchema,
  fazioni: z.array(FazioneConfigSchema),
  game_state_delta: z.array(GameStateDeltaSchema),
});

export const AzioneDeclarationSchema = z.object({
  fazione: z.string(),
  giocatore: z.string(),
  turno: z.number(),
  tipo_azione: z.enum(['principale', 'leader', 'latente', 'difesa']),
  azione: z.string().max(80),
  metodo: z.string().max(200),
  vantaggi_usati: z.array(z.string()),
  svantaggi_opposti: z.array(z.string()),
  svantaggi_propri_attivati: z.array(z.string()),
  aiuti_alleati: z.array(z.string()),
  dettaglio_narrativo: z.string().optional(),
  valutazione: z
    .object({
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
    })
    .optional(),
});
