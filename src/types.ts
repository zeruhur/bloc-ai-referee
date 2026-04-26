// ---- State machine ----

export type CampagnaStato =
  | 'raccolta'
  | 'matrice_generata'
  | 'contro_args'
  | 'valutazione'
  | 'tiri'
  | 'review'
  | 'chiuso';

export type LLMProvider = 'google_ai_studio' | 'ollama' | 'openai' | 'anthropic' | 'openrouter';
export type TipoAzione = 'principale' | 'leader' | 'latente' | 'difesa';
export type TipoFazione = 'normale' | 'ia';
export type Esito = 'no_e' | 'no' | 'no_ma' | 'si_ma' | 'si' | 'si_e';
export type Modalita = 'alto' | 'basso' | 'neutro';
export type MC = -1 | 0 | 1;

// ---- Campaign data ----

export interface VantaggioToken {
  id: string;
  label: string;
}

export interface SvantaggioToken {
  id: string;
  label: string;
}

export interface FazioneConfig {
  id: string;
  nome: string;
  mc: MC;
  tipo?: TipoFazione;
  vantaggi: VantaggioToken[];
  svantaggio: SvantaggioToken;
  obiettivo: string;
  leader: { presente: boolean };
}

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  api_key_env: string;
  temperature_mechanical: number;
  temperature_narrative: number;
}

export interface GameStateDelta {
  turno: number;
  eventi_chiave: string[];
  stato_fazioni: Record<string, { mc: number; territorio: string | string[] }>;
  narrative_seed?: string;
}

export interface Campagna {
  meta: {
    titolo: string;
    slug: string;
    turno_corrente: number;
    turno_totale: number;
    stato: CampagnaStato;
  };
  premessa: string;
  llm: LLMConfig;
  fazioni: FazioneConfig[];
  game_state_delta: GameStateDelta[];
}

// ---- Action declaration ----

export interface AzioneDeclaration {
  fazione: string;
  giocatore: string;
  turno: number;
  tipo_azione: TipoAzione;
  azione: string;
  metodo: string;
  vantaggi_usati: string[];
  svantaggi_opposti: string[];
  svantaggi_propri_attivati: string[];
  aiuti_alleati: string[];
  dettaglio_narrativo?: string;
  valutazione?: EvaluationOutput;
}

// ---- LLM Adapter ----

export interface LLMPrompt {
  system: string;
  user: string;
  output_schema: object;
  temperature: number;
}

export interface LLMResponse {
  content: string;
  parsed: unknown;
  model: string;
  tokens_used?: number;
}

export interface LLMAdapter {
  complete(prompt: LLMPrompt): Promise<LLMResponse>;
}

// ---- Pipeline step outputs ----

export interface MatrixEntry {
  fazione: string;
  azione: string;
  metodo: string;
  vantaggi: string[];
  conflitti_con: string[];
}

export interface MatrixOutput {
  azioni: MatrixEntry[];
}

export interface VantaggioValutato {
  id: string;
  motivazione: string;
}

export interface DicePool {
  positivi: number;
  negativi: number;
  netto: number;
  modalita: Modalita;
}

export interface EvaluationOutput {
  fazione: string;
  azione: string;
  vantaggi_confermati: string[];
  vantaggi_ridotti: VantaggioValutato[];
  vantaggi_negati: VantaggioValutato[];
  svantaggi_attivati: VantaggioValutato[];
  pool: DicePool;
}

export interface RollResult {
  fazione: string;
  seed: number;
  dadi: number[];
  risultato: number;
  esito: Esito;
}

export interface DiceResult {
  seed: number;
  dadi: number[];
  risultato: number;
  esito: Esito;
}

export interface StateDelta {
  mc_delta: number;
  territorio?: string;
  note: string;
}

export interface ConsequenceEntry {
  fazione: string;
  azione: string;
  esito: Esito;
  testo_conseguenza: string;
  state_delta: StateDelta;
}

export interface NarrativeOutput {
  conseguenze: ConsequenceEntry[];
  eventi_turno: string[];
  narrative_seed_prossimo_turno: string;
}

export interface DirectConflict {
  fazione_a: string;
  fazione_b: string;
}

// ---- Plugin settings ----

export interface BlocPluginSettings {
  defaultProvider: LLMProvider;
  ollamaBaseUrl: string;
  openAIBaseUrl: string;
  openRouterBaseUrl: string;
  defaultCampaignSlug: string;
  modelApiKeyEnvVar: string;
  cachedModels: Partial<Record<LLMProvider, string[]>>;
}
