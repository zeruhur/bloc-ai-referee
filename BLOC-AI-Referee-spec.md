# BLOC AI Referee — Specifiche Architetturali Plugin Obsidian

## Panoramica

BLOC AI Referee è un plugin Obsidian che assiste l'arbitraggio di partite Matrix Games basate sul sistema BLOC (Battaglie, Leghe, Operazioni, Conflitti). Il plugin implementa un pipeline LLM a step separati per valutare azioni, calcolare pool di dadi e generare conseguenze narrative, mantenendo i tiri deterministici via `Math.random` e il contesto cumulativo di campagna strutturato in YAML.

Il design privilegia la modalità **asincrona** (giocatori dichiarano in momenti diversi) come caso d'uso primario; la modalità sincrona è un edge case dello stesso flusso.

---

## Principi architetturali

- **Separazione responsabilità LLM / dadi**: l'LLM non genera mai risultati casuali; tutti i tiri sono delegati a `Math.random` con seed registrato per riproducibilità.
- **Pipeline step-by-step**: ogni fase LLM ha input e output strutturati (JSON/YAML), non un prompt all-in-one.
- **Dual output**: ogni turno produce un layer machine-readable (YAML per il contesto LLM) e un layer human-readable (Markdown per i giocatori e l'archivio).
- **Provider agnostico**: il plugin astrae il provider LLM via adapter layer configurabile.
- **Vault-first**: tutto lo stato di gioco vive in file nella vault; il plugin non ha database esterni.

---

## Struttura vault

Ogni campagna corrisponde a una cartella dedicata con la seguente struttura fissa:

```
/campagne/
  /{slug-campagna}/
    campagna.yaml              # stato globale + configurazione
    /fazioni/
      {slug-fazione}.md        # scheda fazione con token vantaggi/svantaggi
    /turno-01/
      azione-{fazione}.md      # una nota per dichiarazione (output Modal Form)
      matrice.md               # output LLM step 1
      tiri.md                  # log deterministico dadi (generato da Math.random)
      narrativa.md             # output LLM step 3 (leggibile)
    /turno-02/
      ...
```

Il file `campagna.yaml` è il **punto di verità singolo** letto dal plugin all'inizio di ogni step.

---

## Schema dati

### `campagna.yaml`

```yaml
meta:
  titolo: "Arcanastrum"
  slug: arcanastrum
  turno_corrente: 4
  turno_totale: 10
  stato: raccolta  # enum: raccolta | matrice_generata | contro_args | valutazione | tiri | review | chiuso

premessa: >
  Breve descrizione dello scenario (max 500 car.) usata come system context in ogni prompt LLM.

llm:
  provider: google_ai_studio  # enum: google_ai_studio | ollama | openai
  model: gemini-2.5-flash
  api_key_env: GEMINI_API_KEY  # mai in chiaro, letta da variabile d'ambiente
  temperature_mechanical: 0.2  # step di valutazione vantaggi/calcolo pool
  temperature_narrative: 0.7   # step di generazione conseguenze

fazioni:
  - id: draghi
    nome: "Draghi delle Montagne Eremite"
    mc: 0           # modificatore coesione: -1 | 0 | +1
    vantaggi:
      - id: posizioni_note
        label: "Conoscenza posizioni nemiche (ric. T3)"
      - id: mobilita_aerea
        label: "Mobilità aerea e terreno nativo"
    svantaggio:
      id: isolamento
      label: "Isolamento diplomatico"
    obiettivo: "Proteggere le montagne eremitiche"
    leader:
      presente: false  # aggiornato ogni turno via tiro 1d6+MC

game_state_delta:  # aggiornato dopo ogni turno chiuso
  - turno: 3
    eventi_chiave:
      - "Quorilani perdono influenza sul concilio"
      - "Negromanti completano rituale parziale a Monte Argentum"
    stato_fazioni:
      draghi: { mc: 0, territorio: montagne_nord }
      negromanti: { mc: +1, territorio: [paludi, monte_argentum] }
```

### Nota azione (`azione-{fazione}.md`)

Il frontmatter è generato dal Modal Form. Il campo `dettaglio_narrativo` è opzionale e non entra nel layer LLM.

```yaml
---
fazione: draghi
giocatore: "@M0rgH4N"
turno: 4
tipo_azione: principale  # enum: principale | leader | latente | difesa
azione: "Interrompere il rituale dei Negromanti"
metodo: "Attacco frontale aereo dall'alto + scioglimento ghiacciai per valanga sul versante nemico"
vantaggi_usati:
  - posizioni_note
  - mobilita_aerea
svantaggi_opposti: []           # compilato dopo il checkpoint umano
svantaggi_propri_attivati: []   # compilati dall'LLM step 2
aiuti_alleati: []               # fazioni alleate che spendono un vantaggio
dettaglio_narrativo: >          # solo layer umano, non entra nel context LLM
  Xorghan guida personalmente l'assalto durante l'esecuzione del rituale incompleto...
---
```

---

## Pipeline completo

### Fase 0 — Setup campagna (one-time)

Il plugin espone un comando `BLOC: Nuova campagna` che guida l'arbitro nella creazione di:
- `campagna.yaml` con premessa e configurazione LLM
- Le note `/fazioni/{slug}.md` con i token vantaggi/svantaggio per ogni fazione

I token vantaggi sono stringhe brevi (max 60 car.) che fungono da etichette selezionabili nei form successivi.

---

### Fase 1 — Raccolta dichiarazioni

**Trigger**: comando `BLOC: Dichiara azione` (disponibile per ogni giocatore o per l'arbitro per conto di un giocatore).

**Meccanismo**: Modal Form con i seguenti campi.

| Campo | Tipo | Max | Destinazione layer |
|---|---|---|---|
| `fazione` | select (da fazioni in campagna.yaml) | — | LLM + umano |
| `tipo_azione` | select [principale / leader / latente / difesa] | — | LLM + umano |
| `azione` | text | 80 car. | LLM + umano |
| `metodo` | textarea | 200 car. | LLM + umano |
| `vantaggi_usati` | multi-select (token fissi da scheda fazione) | — | LLM meccanico |
| `dettaglio_narrativo` | textarea | illimitato | solo umano |

Il form scrive una nota `azione-{fazione}.md` nella cartella `/turno-N/`.

**Condizione di avanzamento**: tutte le fazioni attive hanno una nota azione. L'arbitro può forzare l'avanzamento manualmente.

---

### Fase 2 — Generazione matrice azioni [LLM Step 1]

**Trigger**: comando `BLOC: Genera matrice` (arbitro), attivo quando `stato == raccolta`.

**Input al prompt**:
```
system: {premessa campagna} + {game_state_delta ultimi 3 turni}
user:   lista strutturata di tutte le note-azione del turno corrente (solo campi LLM, senza dettaglio_narrativo)
task:   genera una matrice leggibile che mostri per ogni fazione: azione dichiarata, metodo sintetico,
        vantaggi dichiarati, eventuali conflitti/sovrapposizioni con azioni di altre fazioni.
output_schema: { azioni: [ { fazione, azione, metodo, vantaggi, conflitti_con: [] } ] }
```

**Output**:
- YAML strutturato (layer LLM, salvato come frontmatter di `matrice.md`)
- Sezione Markdown leggibile in `matrice.md` (layer umano, condivisa con i giocatori)

**Aggiornamento stato**: `stato → matrice_generata`

---

### ━━ CHECKPOINT UMANO 1 ━━

L'arbitro condivide `matrice.md` con i giocatori. Ha luogo la discussione delle contro-argomentazioni (sincrona o asincrona). L'arbitro raccoglie gli svantaggi dichiarati dagli avversari e aggiorna i campi `svantaggi_opposti` nelle note azione tramite il comando `BLOC: Aggiorna svantaggi`.

**Aggiornamento stato**: `stato → contro_args` (manuale, arbitro)

---

### Fase 3 — Valutazione vantaggi/svantaggi [LLM Step 2]

**Trigger**: comando `BLOC: Valuta azioni`, attivo quando `stato == contro_args`.

Eseguito **una volta per ogni nota azione** in sequenza (non in batch, per evitare cross-contaminazione del ragionamento).

**Input al prompt**:
```
system: {premessa} + {game_state_delta} + {matrice turno corrente}
user:   singola nota-azione con svantaggi_opposti già compilati
task:   valuta la rilevanza contestuale di ogni vantaggio dichiarato rispetto al metodo.
        Conferma, riduci o nega ogni vantaggio con motivazione narrativa.
        Calcola il pool di dadi risultante.
output_schema: {
  fazione, azione,
  vantaggi_confermati: [],
  vantaggi_ridotti: [ { id, motivazione } ],
  vantaggi_negati: [ { id, motivazione } ],
  svantaggi_attivati: [ { id, motivazione } ],
  pool: { positivi: N, negativi: M, netto: K, modalita: "alto|basso|neutro" }
}
```

**Output**: frontmatter `valutazione` aggiunto alla nota-azione. Nota `matrice.md` aggiornata con i pool calcolati.

**Aggiornamento stato**: `stato → valutazione`

---

### Fase 4 — Tiri dadi [deterministico, no LLM]

**Trigger**: automatico dopo Fase 3, oppure manuale con `BLOC: Esegui tiri`.

**Algoritmo** (TypeScript):

```typescript
function tiraDadi(pool: DicePool): RollResult {
  const seed = Date.now(); // registrato per audit
  const dadi: number[] = [];
  const totale = Math.max(pool.positivi, pool.negativi, 1);

  for (let i = 0; i < totale; i++) {
    dadi.push(Math.floor(seededRandom(seed + i) * 6) + 1);
  }

  const risultato = pool.modalita === 'alto'
    ? Math.max(...dadi.slice(0, pool.positivi))
    : pool.modalita === 'basso'
    ? Math.min(...dadi.slice(0, pool.negativi))
    : dadi[0];

  return { dadi, risultato, esito: mappaEsito(risultato) };
}

function mappaEsito(n: number): string {
  const mappa = { 1: 'no_e', 2: 'no', 3: 'no_ma', 4: 'si_ma', 5: 'si', 6: 'si_e' };
  return mappa[n];
}
```

**Gestione conflitti diretti**: quando due fazioni si attaccano a vicenda nello stesso turno, vengono generate **due pool indipendenti** e i tiri avvengono simultaneamente. L'esito comparativo segue la tabella BLOC (attaccante vince se risultato > difensore, ecc.).

**Output**: `tiri.md` con log completo (seed, dadi girati, risultato, esito per ogni azione).

**Aggiornamento stato**: `stato → tiri`

---

### Fase 5 — Conseguenze narrative [LLM Step 3]

**Trigger**: comando `BLOC: Genera conseguenze`, attivo quando `stato == tiri`.

**Input al prompt**:
```
system: {premessa} + {game_state_delta}
user:   matrice turno + tutti i risultati tiri + valutazioni vantaggi
task:   per ogni azione, genera la conseguenza narrativa coerente con l'esito del dado.
        Tieni conto delle interazioni tra azioni (es. azione A influenza il contesto di azione B).
        Calcola i delta di stato (MC, territorio, risorse, svantaggi acquisiti).
output_schema: {
  conseguenze: [
    { fazione, azione, esito, testo_conseguenza, state_delta: { mc_delta, territorio, note } }
  ],
  eventi_turno: [],  # eventi significativi da aggiungere a game_state_delta
  narrative_seed_prossimo_turno: ""  # 1-2 frasi di aggancio narrativo per il turno successivo
}
```

**Output**:
- Aggiornamento `campagna.yaml` (game_state_delta + stato fazioni)
- Generazione `narrativa.md` (layer umano, leggibile dai giocatori)

**Aggiornamento stato**: `stato → review`

---

### ━━ CHECKPOINT UMANO 2 (Review finale) ━━

L'arbitro legge `narrativa.md` e può editarla direttamente. Il comando `BLOC: Chiudi turno` crea la cartella `/turno-N+1/`, azzera le note azione, incrementa `turno_corrente` e porta `stato → raccolta`.

---

## Layer output per turno

| Layer | File | Formato | Audience | Contiene |
|---|---|---|---|---|
| Machine-readable | frontmatter di ogni `.md` + `campagna.yaml` | YAML | LLM | Stato strutturato, token, delta |
| Intermedio umano | `matrice.md` | Markdown tabellare | Arbitro + giocatori | Chi fa cosa, pool calcolati, conflitti |
| Narrativo finale | `narrativa.md` | Markdown prosa | Tutti | Conseguenze narrative, stato aggiornato |

Il `dettaglio_narrativo` delle note azione appare solo in `narrativa.md`, mai nel context LLM.

---

## Adapter LLM

Il plugin espone un'interfaccia `LLMAdapter` con un unico metodo:

```typescript
interface LLMAdapter {
  complete(prompt: LLMPrompt): Promise<LLMResponse>;
}

interface LLMPrompt {
  system: string;
  user: string;
  output_schema: object;  // JSON Schema per structured output
  temperature: number;
}
```

Implementazioni richieste:

| Provider | Classe | Note |
|---|---|---|
| Google AI Studio | `GeminiAdapter` | Usa `generationConfig.responseSchema`; richiede `GEMINI_API_KEY` da env |
| Ollama | `OllamaAdapter` | Usa `format: json`; tieni `think=true` per evitare bug structured output su Gemma 4 |
| OpenAI-compatible | `OpenAIAdapter` | Usa `response_format: { type: "json_schema" }`; copre OpenAI e proxy compatibili |

Il provider attivo è selezionato da `campagna.yaml → llm.provider`. È possibile configurare provider diversi per step meccanici (temperature bassa) e step narrativi (temperature alta) con i campi `temperature_mechanical` e `temperature_narrative`.

---

## Modalità solitaria assistita

Attivabile per singola fazione con `tipo: ia` nella scheda fazione. Quando il turno raggiunge Fase 1 con fazioni IA presenti, il plugin esegue automaticamente un prompt aggiuntivo:

```
task: genera la dichiarazione di azione per la fazione IA {nome} nel turno corrente,
      coerente con il suo obiettivo e con gli eventi recenti. Usa il formato output_schema
      della nota azione (campi: azione, metodo, vantaggi_usati).
      Non usare vantaggi non presenti nella scheda fazione.
```

L'output viene scritto come nota azione standard e prosegue nel pipeline normale. L'arbitro può modificarla prima di procedere alla Fase 2.

---

## Gestione casi speciali

### Azioni leader
Le azioni leader sono note azione con `tipo_azione: leader`. Prima di creare il form, il plugin esegue il tiro di disponibilità leader (`1d6 + MC >= 4`). Se il leader non è disponibile, il form non viene aperto e viene loggato in `tiri.md`.

### Azioni latenti
Azioni con `tipo_azione: latente` vengono salvate in `/fazioni/{slug}-latenti.yaml` (non nella cartella turno), visibili solo all'arbitro. Il plugin le include nel context LLM solo al turno di attivazione dichiarato.

### Conflitti diretti
Quando due fazioni si dichiarano target a vicenda nello stesso turno, Fase 3 genera pool separati per attaccante e difensore. Fase 4 tira entrambe le pool e applica la tabella esiti BLOC comparativa (attaccante > difensore = vittoria attaccante, ecc.).

### Fog of War
Gli accordi privati tra fazioni sono salvati in `campagna-privato.yaml`, accessibile solo all'arbitro. Non entra mai nel context LLM condiviso.

---

## Comandi plugin (Command Palette)

| Comando | Fase attivata | Disponibile quando |
|---|---|---|
| `BLOC: Nuova campagna` | Setup | sempre |
| `BLOC: Dichiara azione` | Fase 1 | stato == raccolta |
| `BLOC: Genera matrice` | Fase 2 | stato == raccolta, tutte azioni presenti |
| `BLOC: Aggiorna svantaggi` | Checkpoint 1 | stato == matrice_generata |
| `BLOC: Valuta azioni` | Fase 3 | stato == contro_args |
| `BLOC: Esegui tiri` | Fase 4 | stato == valutazione |
| `BLOC: Genera conseguenze` | Fase 5 | stato == tiri |
| `BLOC: Chiudi turno` | Checkpoint 2 | stato == review |
| `BLOC: Stato campagna` | — | sempre |

---

## Dipendenze Obsidian

| Plugin | Ruolo | Note |
|---|---|---|
| **Modal Form** | Form strutturati per dichiarazioni azione | Richiesto |
| **Templater** | Trigger automatico post-form | Richiesto |
| **Dataview** | Query su note azione per aggregazione turno | Raccomandato |
| **Meta Bind** | Editing inline frontmatter (aggiornamento svantaggi) | Opzionale |

Il plugin BLOC può funzionare come plugin standalone che integra Modal Form via API, senza richiedere configurazione manuale dei form da parte dell'utente.

---

## Vincoli e note implementative

- **Nessuna chiamata LLM per i tiri**: `Math.random` con seed registrato è l'unico meccanismo di randomizzazione.
- **API key mai in vault**: le chiavi API sono lette esclusivamente da variabili d'ambiente o dal vault sicuro di Obsidian (non da file Markdown o YAML).
- **Idempotenza**: ogni step può essere rieseguito senza corrompere lo stato; il plugin sovrascrive gli output esistenti con conferma dell'arbitro.
- **Formato `narrative_seed`**: il campo `narrative_seed` in ogni delta turno (max 50 token) è il meccanismo di compressione narrativa cumulativa; evita di passare testo narrativo grezzo nei context LLM dei turni successivi.
- **Context window**: con provider Google AI Studio (Gemini 2.5, 1M token) e campagne fino a 10 turni, il context cumulativo compresso rimane ampiamente entro i limiti. Con Ollama/Gemma 4 (256K token) applicare rolling window degli ultimi 5 turni per campagne > 8 turni.
