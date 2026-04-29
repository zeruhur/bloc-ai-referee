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

// ---- Agreements ----

export type TipoAccordo = 'scambio' | 'non_aggressione' | 'militare' | 'supporto';
export type StatoAccordo = 'attivo' | 'violato' | 'scaduto' | 'risolto';

export interface Accordo {
  id: string;
  fazioni: string[];
  tipo: TipoAccordo;
  termini: string;
  turno_stipula: number;
  turno_scadenza?: number;
  stato: StatoAccordo;
  violazioni: { turno: number; fazione: string }[];
}

export interface AccordiPubblici {
  accordi: Accordo[];
}

// ---- Fog of war ----

export interface CampagnaPrivata {
  accordi: Accordo[];
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
export type TipoAzione = 'principale';
export type CategoriaAzione = 'standard' | 'latente' | 'difesa' | 'segreta' | 'spionaggio';
export type TipoReazione = 'svantaggio' | 'aiuto';
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
  eliminata?: boolean;
  sospesa?: boolean;
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
    usa_mappa?: boolean;
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

export interface InterventoReattivo {
  fazione_interveniente: string;
  fazione_target: string;
  tipo: TipoReazione;
  argomento: string;
  risorsa_usata?: string;
  turno: number;
}

export interface LeaderCheckResult {
  fazione: string;
  turno: number;
  dado: number;
  mc: MC;
  valore_modificato: number;
  disponibile: boolean;
  mode?: 'presenza_comando' | 'azione_leadership' | 'intervento_limitato';
}

export interface AzioneDeclaration {
  fazione: string;
  giocatore: string;
  turno: number;
  tipo_azione: TipoAzione;
  categoria_azione: CategoriaAzione;
  azione: string;
  metodo: string;
  argomento_favorevole: string;
  argomenti_contro: ArgomentoContro[];
  argomenti_aiuto?: ArgomentoContro[];
  leader_mode?: 'presenza_comando' | 'azione_leadership' | 'intervento_limitato';
  /** Cost paid for a secret action — the advantage sacrificed. */
  costo_vantaggio?: string;
  /** Target faction for a spionaggio action. */
  target_fazione?: string;
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

export interface MovimentoTurno {
  fazione: string;
  turno: number;
  descrizione: string;
  territori_coinvolti?: string[];
}

export interface MatrixEntry {
  fazione: string;
  azione: string;
  metodo: string;
  argomento_favorevole: string;
  conflitti_con: string[];
  // Progressive fields added by subsequent pipeline steps
  contro_argomentazione?: string;
  valutazione?: {
    pool: DicePool;
    motivazione: string;
  };
  esito_tiro?: {
    dadi: number[];
    risultato: number;
    esito: Esito;
  };
}

export interface MatrixOutput {
  azioni: MatrixEntry[];
  /** Full matrix including secret actions — written to matrice-arbitro.md only. */
  matrice_arbitro?: MatrixEntry[];
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

// ---- Spionaggio dice result ----

export interface SpionaggioResult {
  seed: number;
  dado: number;
  modificatore: number;
  risultato: number;
  scoperta: boolean;
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
