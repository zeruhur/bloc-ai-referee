## Premessa al piano

Inviare a Claude Code con questo contesto iniziale:

> Questo è un plugin Obsidian TypeScript per gestire turni di gioco del wargame BLOC. La state machine del turno è `raccolta → matrice_generata → contro_args → valutazione → tiri → review → chiuso`. Le modifiche seguono una nuova versione delle regole e devono essere **minimali e chirurgiche**: non riscrivere logica già funzionante, non cambiare la state machine core, non toccare `Step1Matrix`, `Step2Evaluate`, `Step3Narrative` salvo dove esplicitamente indicato.

***

## Blocco 1 — `src/types.ts`

### 1.1 — Rimuovere semantica "azione leader"

```
RIMUOVI il valore 'leader' da TipoAzione.
RISULTATO: TipoAzione = 'principale' (solo)
```


### 1.2 — Aggiungere modalità leader come metadato della dichiarazione

```
AGGIUNGI a AzioneDeclaration il campo opzionale:
  leader_mode?: 'presenza_comando' | 'azione_leadership' | 'intervento_limitato';

SEMANTICA:
- presenza_comando: non sostituisce l'azione, la modifica; aggiunge un dado positivo
  condizionale in Step2Evaluate se coerente con la dichiarazione
- azione_leadership: l'azione è dichiarata normalmente nella pipeline standard;
  questo campo segnala solo che sostituisce l'azione ordinaria della fazione
- intervento_limitato: NON entra nella pipeline; va gestito da un handler
  separato post-review (vedi Blocco 5)
```


### 1.3 — Spostare aiuto da categoria ad intervento reattivo

```
RIMUOVI 'aiuto' da CategoriaAzione.
RISULTATO: CategoriaAzione = 'standard' | 'latente' | 'difesa' | 'segreta' | 'spionaggio'

AGGIUNGI nuovo tipo:
  export type TipoReazione = 'svantaggio' | 'aiuto';

AGGIUNGI nuova interfaccia:
  export interface InterventoReattivo {
    fazione_interveniente: string;
    fazione_target: string;       // la fazione a cui si riferisce l'azione dichiarata
    tipo: TipoReazione;
    argomento: string;
    risorsa_usata?: string;       // vantaggio o risorsa messa a disposizione per l'aiuto
    turno: number;
  }
```


### 1.4 — Aggiungere metadato leader per-turno

```
RIMUOVI il campo leader da FazioneConfig:
  leader?: { nome?: string; presente: boolean }

SOSTITUISCI con:
  leader?: {
    nome?: string;
    presente: boolean;        // stato persistente (sopravvivenza)
  }

AGGIUNGI nuova interfaccia separata per l'esito della verifica di turno:
  export interface LeaderCheckResult {
    fazione: string;
    turno: number;
    dado: number;             // risultato grezzo 1d6
    mc: MC;                   // MC della fazione al momento del tiro
    valore_modificato: number; // dado + MC
    disponibile: boolean;     // true se valore_modificato >= 4
    mode?: 'presenza_comando' | 'azione_leadership' | 'intervento_limitato';
  }
```


### 1.5 — Aggiungere campo per la fase di movimento

```
AGGIUNGI a Campagna.meta il campo opzionale:
  usa_mappa?: boolean;

AGGIUNGI nuova interfaccia:
  export interface MovimentoTurno {
    fazione: string;
    turno: number;
    descrizione: string;    // testo libero dell'Arbitro
    territori_coinvolti?: string[];
  }
```


### 1.6 — Rinominare argomento_vantaggio

```
RINOMINA in AzioneDeclaration:
  argomento_vantaggio → argomento_favorevole

RINOMINA in MatrixEntry:
  argomento_vantaggio → argomento_favorevole

NOTA: questa rinomina va propagata in TUTTI i file che referenziano
il campo; Claude Code deve fare una ricerca globale su 'argomento_vantaggio'
prima di procedere.
```


***

## Blocco 2 — `src/constants.ts`

### 2.1 — Aggiungere pre-step opzionali in STATO_ACTION_MAP

```
MODIFICA la chiave 'raccolta' di STATO_ACTION_MAP aggiungendo in testa:
  { label: '🗺 Movimento del turno',      commandId: 'bloc-ai-referee:movimento-turno' },
  { label: '🤝 Registra negoziazione',    commandId: 'bloc-ai-referee:registra-negoziazione' },
  { label: '👑 Check leader del turno',   commandId: 'bloc-ai-referee:check-leader-turno' },

NOTA: movimento-turno va mostrato solo se campagna.meta.usa_mappa === true.
La UI deve condizionarne la visibilità (vedi Blocco 3 — UI).
```


### 2.2 — Aggiungere costanti nuovi file vault

```
AGGIUNGI:
  export const LEADER_CHECK_FILE = 'leader-check.md';
  export const MOVIMENTO_FILE = 'movimento.md';
  export const INTERVENTO_FILE = 'intervento-limitato.md';
```


### 2.3 — Aggiungere Intervento Limitato agli STATELESS_ACTIONS sotto review

```
AGGIUNGI in STATO_ACTION_MAP, nuova chiave 'review' (non esiste ancora):
  review: [
    { label: '⚡ Genera conseguenze',  commandId: 'bloc-ai-referee:genera-conseguenze' },
    { label: '🔹 Intervento limitato', commandId: 'bloc-ai-referee:intervento-limitato' },
    { label: '✓ Chiudi turno',         commandId: 'bloc-ai-referee:chiudi-turno' },
  ],

RIMUOVI genera-conseguenze e chiudi-turno dai rispettivi bucket attuali
('tiri' e 'review') se già presenti, per evitare duplicati.
```


***

## Blocco 3 — `src/commands/` — file da modificare

### 3.1 — `DichiaraAzione.ts`

```
SOSTITUISCI integralmente la sezione sulla modalità leader con:

AGGIUNGI al form di dichiarazione un campo select opzionale "Modalità leader",
visibile SOLO se:
  - leader.presente === true per questa fazione
  - LeaderCheckResult.disponibile === true per questa fazione nel turno corrente

Le opzioni disponibili sono ESCLUSIVAMENTE:
  - Nessuna (default)
  - Presenza di Comando
  - Azione di Leadership

"Intervento Limitato" NON appare in questo form in nessun caso.
Non va bloccato, non va mostrato come opzione disabilitata:
è semplicemente fuori dallo scope di questa fase procedurale.

Se l'utente seleziona "Azione di Leadership":
  Il form procede normalmente.
  Scrive leader_mode: 'azione_leadership' nella dichiarazione.

Se l'utente seleziona "Presenza di Comando":
  Il form procede normalmente.
  Scrive leader_mode: 'presenza_comando' nella dichiarazione.
  NON rimuovere l'azione ordinaria: modifica l'azione, non la sostituisce.
```


### 3.2 — `VerificaLeader.ts`

```
QUESTO FILE DIVENTA il nucleo del nuovo comando check-leader-turno.

RINOMINA il comando registrato da 'bloc-ai-referee:verifica-leader'
a 'bloc-ai-referee:check-leader-turno'.

MODIFICA la logica:
- Per ogni fazione attiva con leader.presente === true:
    1. Tira 1d6 (usa la dice logic esistente)
    2. Leggi MC della fazione
    3. Calcola valore_modificato = dado + MC
    4. disponibile = valore_modificato >= LEADER_AVAILABILITY_THRESHOLD
    5. Se disponibile === true, chiedi all'Arbitro di scegliere la modalità
       (presenza_comando | azione_leadership | intervento_limitato)
    6. Scrivi LeaderCheckResult nel file LEADER_CHECK_FILE del turno corrente

- Se disponibile === false: scrive solo l'assenza, nessuna scelta modale.

MANTIENI il vecchio comando 'bloc-ai-referee:verifica-leader' negli
STATELESS_ACTIONS come alias legacy che chiama lo stesso handler
(per non rompere shortcut esistenti).
```


### 3.3 — `EliminaLeader.ts`

```
AGGIUNGI dopo l'aggiornamento di leader.presente = false:
  1. Decrementa mc della fazione di 1 (mc = Math.max(-1, mc - 1) per rispettare
     il tipo MC = -1 | 0 | 1)
  2. Scrivi in narrativa del turno corrente (append su NARRATIVE_FILE):
     "## Perdita del Leader\n[nome leader] è stato eliminato.
     La fazione [nome fazione] subisce MC -1 e uno svantaggio narrativo da definire."
  3. Aggiorna il file della fazione con il nuovo MC.

NOTA: lo svantaggio narrativo non è automatico — il plugin deve solo
segnalarlo come nota aperta per l'Arbitro, non applicarlo meccanicamente.
```


***

## Blocco 4 — `src/commands/` — file nuovi da creare

### 4.1 — `MovimentoTurno.ts` (nuovo)

```
CREA comando 'bloc-ai-referee:movimento-turno'.

CONDIZIONE di esecuzione: campagna.meta.usa_mappa === true AND stato === 'raccolta'.
Se usa_mappa è false o assente, mostra Notice "La campagna non usa una mappa."
e termina senza aprire form.

FORM:
- Fazione (select tra fazioni attive)
- Descrizione movimento (textarea libera)
- Territori coinvolti (campo testo, opzionale, comma-separated)

OUTPUT: scrive MovimentoTurno in MOVIMENTO_FILE del turno corrente (append se
più fazioni si muovono). Non cambia stato della campagna.
```


### 4.2 — `RegistraNegoziazione.ts` (nuovo)

```
CREA comando 'bloc-ai-referee:registra-negoziazione'.

CONDIZIONE: stato === 'raccolta'.

FORM: riusa il form già esistente per gli accordi (RegistraAccordoPrivato /
RegistraAccordoPubblico) con un campo aggiuntivo:
  - tipo_registrazione: 'accordo_formale' | 'nota_negoziazione'
  
Se 'accordo_formale': chiama la logica esistente di RegistraAccordoPrivato
o RegistraAccordoPubblico a seconda della scelta.

Se 'nota_negoziazione': scrive solo una nota testuale in un frontmatter
del file del turno, senza creare un Accordo strutturato. Utile per
coordinazioni informali che non hanno ancora forma di accordo.

Non cambia stato della campagna.
```


### 4.3 — `InterventoLimitato.ts` (nuovo)

```
CREA comando 'bloc-ai-referee:intervento-limitato'.

CONDIZIONE: stato === 'review'. Fuori da questo stato mostra Notice e termina.

FORM:
- Fazione che interviene (select tra fazioni attive)
- Descrizione dell'intervento (textarea)
- Tipo di effetto (select):
    - Consolida un risultato già ottenuto
    - Contiene una complicazione già emersa
    - Sostiene un alleato già coinvolto nell'esito
    - Protegge la coesione della fazione

GUARDRAIL (mostrare come prompt di conferma prima di salvare):
"Verificare che l'intervento NON:
  □ richieda una dichiarazione strutturata
  □ generi opposizione significativa
  □ produca un tiro di dadi
  □ possa avviare un conflitto diretto
Se anche solo una di queste condizioni è vera, rimandare al turno successivo."

L'Arbitro deve spuntare esplicitamente una checkbox "Confermo: questo è
un Intervento Limitato valido" prima che il comando scriva l'output.

OUTPUT: scrive in append su INTERVENTO_FILE del turno. Non aggiunge entry
alla matrice. Non chiama nessun pipeline step. Non costruisce DicePool.
```


***

## Blocco 5 — `src/pipeline/Step2Evaluate.ts`

```
AGGIUNGI un caso condizionale nel calcolo del DicePool:

Dopo aver calcolato il pool base da vantaggi/svantaggi, verifica:
  IF azione.leader_mode === 'presenza_comando'
  AND il LeaderCheckResult del turno per questa fazione ha disponibile === true:
    pool.positivi += 1
    aggiungi in motivazione: "+ 1 dado positivo (Presenza di Comando del leader)"

Non toccare nessun'altra logica del file.
```


***

## Blocco 6 — `src/pipeline/StepCounterArg.ts`

```
MODIFICA per includere gli InterventoReattivo di tipo 'aiuto'
nel processo di contro-argomentazione.

Attualmente StepCounterArg raccoglie ArgomentoContro dalla matrice.
AGGIUNGI: leggi anche il file degli interventi reattivi del turno (se esiste)
e incorpora gli interventi di tipo 'aiuto' come fonti di dado positivo
per la fazione target, da passare a Step2Evaluate.

Questa modifica allinea l'aiuto alla sua nuova posizione procedurale
(reazione post-dichiarazione) senza rompere la struttura dell'output.
```


***

## Blocco 7 — Prompt LLM in `src/pipeline/prompts/`

```
RICERCA GLOBALE su tutti i file in src/pipeline/prompts/ per:
  - 'argomento_vantaggio' → sostituire con 'argomento_favorevole'
  - 'fazione attiva' → sostituire con 'azione dichiarata' o 'fazione interessata'
    ECCEZIONE: nei prompt che gestiscono conflitti diretti, 'fazione attiva'
    può restare se usato per distinguere attaccante da difensore.
  - Eventuali riferimenti a tipo_azione = 'leader' → rimuovere o allineare
    alla nuova semantica di leader_mode.

ATTENZIONE: i prompt contengono schemi JSON attesi nel parsing della risposta
LLM. Qualunque rinomina di chiave nei prompt deve essere allineata anche
nei tipi TypeScript e nei parser corrispondenti. Verificare sempre che
il campo rinominato non sia usato come chiave di deserializzazione in altri
punti della pipeline prima di salvare.
```


***

## Blocco 8 — Test

```
AGGIORNA o AGGIUNGI test in tests/ per:
1. LeaderCheckResult: verifica che dado + MC >= 4 produca disponibile = true
2. EliminaLeader: verifica che mc venga decrementato di 1 dopo eliminazione
3. Step2Evaluate: verifica che presenza_comando aggiunga esattamente 1 dado positivo
4. InterventoLimitato: verifica che non produca MatrixEntry, non chiami Step2Evaluate,
   non costruisca DicePool
5. DichiaraAzione con leader_mode = 'intervento_limitato': verifica che il form
   blocchi la dichiarazione e non scriva AzioneDeclaration

Non modificare i test esistenti sul core pipeline salvo per la rinomina
argomento_vantaggio → argomento_favorevole.
```


***

## Ordine di esecuzione consigliato

1. Blocco 1 (types.ts) — tutto insieme, è la base tipologica
2. Blocco 2 (constants.ts) — nessuna dipendenza da logica
3. Blocco 7 (prompts) — ricerca globale prima di modificare types
4. Blocco 3.2 e 3.3 (VerificaLeader, EliminaLeader) — modifiche ai comandi esistenti
5. Blocco 3.1 (DichiaraAzione) — dipende dal tipo `LeaderCheckResult` già definito
6. Blocco 4 (nuovi comandi) — dipendono da tutti i tipi del Blocco 1
7. Blocco 5 e 6 (pipeline) — ultimi, dipendono da tipi e comandi
8. Blocco 8 (test) — sempre per ultimi
