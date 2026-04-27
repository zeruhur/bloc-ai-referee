import type { BlocPluginSettings, CampagnaStato, Esito } from './types';

export const STATO_TRANSITIONS: Record<CampagnaStato, CampagnaStato | null> = {
  raccolta: 'matrice_generata',
  matrice_generata: 'contro_args',
  contro_args: 'valutazione',
  valutazione: 'tiri',
  tiri: 'review',
  review: 'chiuso',
  chiuso: null,
};

export const ESITO_MAP: Record<number, Esito> = {
  1: 'no_e',
  2: 'no',
  3: 'no_ma',
  4: 'si_ma',
  5: 'si',
  6: 'si_e',
};

export const ESITO_LABELS: Record<Esito, string> = {
  no_e: 'No, e... (critico negativo)',
  no: 'No',
  no_ma: 'No, ma... (parziale)',
  si_ma: 'Sì, ma... (parziale)',
  si: 'Sì',
  si_e: 'Sì, e... (critico positivo)',
};

export const CAMPAGNE_FOLDER = 'campagne';
export const FAZIONI_FOLDER = 'fazioni';
export const CAMPAGNA_FILE = 'campagna.yaml';
export const CAMPAGNA_PRIVATO_FILE = 'campagna-privato.yaml';
export const ACTION_FILE_PREFIX = 'azione-';
export const SECRET_ACTION_SUFFIX = '-segreta';
export const MATRIX_FILE = 'matrice.md';
export const ARBITER_MATRIX_FILE = 'matrice-arbitro.md';
export const ROLLS_FILE = 'tiri.md';
export const NARRATIVE_FILE = 'narrativa.md';
export const ORACLE_FILE = 'oracolo.md';
export const RUN_STATE_FILE = 'run-state.yaml';
export const LATENT_SUFFIX = '-latenti.yaml';
export const TURN_FOLDER_PREFIX = 'turno-';
export const CAMPAGNA_ACCORDI_PUBBLICI_FILE = 'campagna-accordi-pubblici.yaml';

export const DEFAULT_SETTINGS: BlocPluginSettings = {
  defaultProvider: 'google_ai_studio',
  ollamaBaseUrl: 'http://localhost:11434',
  openAIBaseUrl: 'https://api.openai.com/v1',
  openRouterBaseUrl: 'https://openrouter.ai/api/v1',
  defaultCampaignSlug: '',
  apiKeys: {},
  cachedModels: {},
};

export const PROVIDER_LABELS: Record<import('./types').LLMProvider, string> = {
  google_ai_studio: 'Google AI Studio (Gemini)',
  ollama: 'Ollama (locale)',
  openai: 'OpenAI / compatibile',
  anthropic: 'Anthropic (Claude)',
  openrouter: 'OpenRouter',
};

export const LEADER_AVAILABILITY_THRESHOLD = 4;

export const MAX_GAME_STATE_DELTAS_FULL = 5;   // ridotto da 10 per contenere i token
export const MAX_GAME_STATE_DELTAS_OLLAMA = 3;  // ridotto da 5
