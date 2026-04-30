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
export const CAMPAGNA_FILE = 'campagna.md';
export const CAMPAGNA_PRIVATO_FILE = 'campagna-privato.md';
export const ACTION_FILE_PREFIX = 'azione-';
export const SECRET_ACTION_SUFFIX = '-segreta';
export const MATRIX_FILE = 'matrice.md';
export const ARBITER_MATRIX_FILE = 'matrice-arbitro.md';
export const ROLLS_FILE = 'tiri.md';
export const NARRATIVE_FILE = 'narrativa.md';
export const ORACLE_FILE = 'oracolo.md';
export const RUN_STATE_FILE = 'run-state.md';
export const LATENT_SUFFIX = '-latenti.md';
export const TURN_FOLDER_PREFIX = 'turno-';
export const CAMPAGNA_ACCORDI_PUBBLICI_FILE = 'campagna-accordi-pubblici.md';

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

export const STATO_LABELS: Record<CampagnaStato, string> = {
  raccolta:         '1 · Raccolta azioni',
  matrice_generata: '2 · Matrice generata',
  contro_args:      '3 · Contro-argomentazioni',
  valutazione:      '4 · Valutazione azioni',
  tiri:             '5 · Esecuzione tiri',
  review:           '6 · Review arbitro',
  chiuso:           '7 · Turno chiuso',
};

export interface StatoAction { label: string; commandId: string }

export const STATO_ACTION_MAP: Partial<Record<CampagnaStato, StatoAction[]>> = {
  raccolta: [
    { label: '🗺 Movimento del turno',    commandId: 'bloc-ai-referee:movimento-turno' },
    { label: '🤝 Registra negoziazione', commandId: 'bloc-ai-referee:registra-negoziazione' },
    { label: '👑 Check leader del turno', commandId: 'bloc-ai-referee:check-leader-turno' },
    { label: '⚡ Dichiara azione',        commandId: 'bloc-ai-referee:dichiara-azione' },
    { label: '⚡ Genera matrice',         commandId: 'bloc-ai-referee:genera-matrice' },
    { label: '⚙ Simula turno (IA)',      commandId: 'bloc-ai-referee:simula-turno' },
  ],
  matrice_generata: [
    { label: '⚡ Auto contro-argomentazione',  commandId: 'bloc-ai-referee:auto-contro-argomentazione' },
    { label: '🔄 Dichiara intervento reattivo', commandId: 'bloc-ai-referee:dichiara-intervento-reattivo' },
  ],
  contro_args:      [{ label: '⚡ Valuta azioni',              commandId: 'bloc-ai-referee:valuta-azioni' }],
  valutazione:      [{ label: '⚡ Esegui tiri',                commandId: 'bloc-ai-referee:esegui-tiri' }],
  tiri:             [{ label: '⚡ Genera conseguenze',         commandId: 'bloc-ai-referee:genera-conseguenze' }],
  review: [
    { label: '⚡ Genera conseguenze',  commandId: 'bloc-ai-referee:genera-conseguenze' },
    { label: '🔹 Intervento limitato', commandId: 'bloc-ai-referee:intervento-limitato' },
    { label: '✓ Chiudi turno',        commandId: 'bloc-ai-referee:chiudi-turno' },
  ],
};

export interface ActionGroup { title: string; actions: StatoAction[] }

export const STATELESS_ACTIONS: ActionGroup[] = [
  {
    title: 'Strumenti',
    actions: [
      { label: 'Nuova campagna',        commandId: 'bloc-ai-referee:nuova-campagna' },
      { label: 'Stato campagna',        commandId: 'bloc-ai-referee:stato-campagna' },
      { label: 'Oracolo',               commandId: 'bloc-ai-referee:interroga-oracolo' },
      { label: 'Check leader turno',    commandId: 'bloc-ai-referee:check-leader-turno' },
      { label: 'Verifica leader',       commandId: 'bloc-ai-referee:verifica-leader' },
      { label: 'Elimina leader',        commandId: 'bloc-ai-referee:elimina-leader' },
      { label: 'Genera leader',         commandId: 'bloc-ai-referee:genera-leader' },
      { label: 'Azione latente',        commandId: 'bloc-ai-referee:attiva-azione-latente' },
      { label: 'Chiudi campagna',       commandId: 'bloc-ai-referee:chiudi-campagna' },
    ],
  },
  {
    title: 'Fazioni',
    actions: [
      { label: 'Aggiungi fazione',      commandId: 'bloc-ai-referee:aggiungi-nuova-fazione' },
      { label: 'Genera fazione (IA)',   commandId: 'bloc-ai-referee:genera-fazione' },
      { label: 'Elimina fazione',       commandId: 'bloc-ai-referee:elimina-fazione' },
      { label: 'Ripristina fazione',    commandId: 'bloc-ai-referee:ripristina-fazione' },
      { label: 'Sospendi fazione',      commandId: 'bloc-ai-referee:sospendi-fazione' },
      { label: 'Riattiva fazione',      commandId: 'bloc-ai-referee:riattiva-fazione' },
      { label: 'Modifica profilo',      commandId: 'bloc-ai-referee:modifica-fazione' },
      { label: 'Modifica vantaggi',     commandId: 'bloc-ai-referee:modifica-vantaggi-fazione' },
      { label: 'Fondi fazioni',         commandId: 'bloc-ai-referee:fondi-fazioni' },
      { label: 'Scindi fazione',        commandId: 'bloc-ai-referee:scindi-fazione' },
      { label: 'Converti a IA',         commandId: 'bloc-ai-referee:converti-a-ia' },
      { label: 'Converti a umano',      commandId: 'bloc-ai-referee:converti-a-umano' },
    ],
  },
  {
    title: 'Accordi',
    actions: [
      { label: 'Accordo privato',       commandId: 'bloc-ai-referee:registra-accordo-privato' },
      { label: 'Accordo pubblico',      commandId: 'bloc-ai-referee:registra-accordo-pubblico' },
      { label: 'Dichiara tradimento',   commandId: 'bloc-ai-referee:dichiara-tradimento' },
      { label: 'Sciogli accordo',       commandId: 'bloc-ai-referee:sciogli-accordo' },
    ],
  },
];

export const LEADER_CHECK_FILE = 'leader-check.md';
export const MOVIMENTO_FILE = 'movimento.md';
export const INTERVENTO_FILE = 'intervento-limitato.md';
export const INTERVENTO_REATTIVO_FILE = 'intervento-reattivo.md';

export const LEADER_AVAILABILITY_THRESHOLD = 4;

export const MAX_GAME_STATE_DELTAS_FULL = 5;   // ridotto da 10 per contenere i token
export const MAX_GAME_STATE_DELTAS_OLLAMA = 3;  // ridotto da 5
