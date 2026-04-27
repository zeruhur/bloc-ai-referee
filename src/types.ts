// ---- IA procedural tables ----

export type TipoAzioneIA =
  | 'Consolidamento' | 'Espansione' | 'Attacco Diretto'
  | 'Difesa' | 'Diplomatico/Politico' | 'Evento Speciale';
export type ReactionResult = 'ostile' | 'neutrale' | 'collaborativa';
export type IAConflictOutcome = 'vittoria_totale' | 'vittoria_parziale' | 'stallo';

// ---- Oracle ----

export type OracleEsito = 'no' | 'si_ma' | 'si';
export interface OracleResult {
  domanda: string;
  modificatore: -1 | 0 | 1;
  seed: number;
  dado: number;
  valore_modificato: number;
  esito: OracleEsito;
  turno: number;
}

// ---- Fog of war: private agreements ----

export interface AccordoPrivato {
  fazioni: string[];
  termini: string;
  turno_scadenza?: number;
}
export interface CampagnaPrivata {
  accordi: AccordoPrivato[];
}

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
export type TipoAzione = 'principale' | 'leader';
export type CategoriaAzione = 'standard' | 'latente' | 'difesa' | 'aiuto' | 'segreta';
export type TipoFazione = 'normale' | 'ia';
export type Esito = 'no_e' | 'no' | 'no_ma' | 'si_ma' | 'si' | 'si_e';
export type Modalita = 'alto' | 'basso' | 'neutro';
export type MC = -1 | 0 | 1;

// ---- Campaign data ----

export interface FazioneConfig {
  id: string;
  nome: string;
  mc: MC;
  tipo?: TipoFazione;
  obiettivo: string;
  concetto: string;
  vantaggi: string[];
  svantaggi: string[];
  leader?: { nome?: string; presente: boolean };
}

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  api_key_env?: string;
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
    livello_operativo?: string;
    distribuzione_temporale?: 'lineare' | 'non_lineare';
    intervallo_temporale?: string;
  };
  premessa: string;
  llm: LLMConfig;
  fazioni: FazioneConfig[];
  game_state_delta: GameStateDelta[];
}

// ---- Action declaration ----

export interface ArgomentoContro {
  fazione: string;
  argomento: string;
}

export interface AzioneDeclaration {
  fazione: string;
  giocatore: string;
  turno: number;
  tipo_azione: TipoAzione;
  categoria_azione: CategoriaAzione;
  azione: string;
  metodo: string;
  /** Free-form argument for why this action should succeed. */
  argomento_vantaggio: string;
  /** Counter-arguments from opponent factions — filled at Checkpoint 1. */
  argomenti_contro: ArgomentoContro[];
  fazione_aiutata?: string;
  dettaglio_narrativo?: string;
  azione_extra?: boolean;
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
  argomento_vantaggio: string;
  conflitti_con: string[];
}

export interface MatrixOutput {
  azioni: MatrixEntry[];
}

export interface DicePool {
  positivi: number;
  negativi: number;
  netto: number;
  modalita: Modalita;
}

export interface ValutazioneArgomento {
  /** 0-3 for vantaggio, 0-1 for each contro. */
  peso: number;
  motivazione: string;
}

export interface EvaluationOutput {
  fazione: string;
  azione: string;
  valutazione_vantaggio: ValutazioneArgomento;
  valutazioni_contro: ({ fazione: string } & ValutazioneArgomento)[];
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
  apiKeys: Partial<Record<LLMProvider, string>>;
  cachedModels: Partial<Record<LLMProvider, string[]>>;
}
