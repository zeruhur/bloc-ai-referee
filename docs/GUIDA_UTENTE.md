# BLOC AI Referee — Guida Utente

Questa guida descrive il flusso completo di utilizzo del plugin, dalla configurazione iniziale alla chiusura di un turno.

---

## Indice

1. [Configurazione iniziale](#1-configurazione-iniziale)
2. [Creare una campagna](#2-creare-una-campagna)
3. [Flusso di un turno](#3-flusso-di-un-turno)
   - [Fase 1 — Raccolta dichiarazioni](#fase-1--raccolta-dichiarazioni)
   - [Checkpoint 1 — Contro-argomentazioni](#checkpoint-1--contro-argomentazioni)
   - [Fase 2 — Valutazione e dadi](#fase-2--valutazione-e-dadi)
   - [Checkpoint 2 — Revisione narrativa](#checkpoint-2--revisione-narrativa)
4. [Struttura dei file](#4-struttura-dei-file)
5. [Fazioni IA](#5-fazioni-ia)
6. [Azioni speciali](#6-azioni-speciali)
7. [Riferimento comandi](#7-riferimento-comandi)
8. [Gestione provider LLM](#8-gestione-provider-llm)
9. [Domande frequenti](#9-domande-frequenti)

---

## 1. Configurazione iniziale

### Aprire le impostazioni del plugin

*Impostazioni Obsidian → Plugin di terze parti → BLOC AI Referee → icona ingranaggio*

### Chiave API

Nella sezione **Chiavi API** trovi un campo per ogni provider cloud. Incolla la chiave direttamente nel campo — viene salvata nei dati interni del plugin (file `.obsidian/plugins/bloc-ai-referee/data.json`), **mai** nei file della vault.

| Provider | Dove ottenere la chiave |
|---|---|
| Google AI Studio | [aistudio.google.com](https://aistudio.google.com) → Get API key |
| Anthropic | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| OpenAI | [platform.openai.com](https://platform.openai.com) → API keys |
| OpenRouter | [openrouter.ai](https://openrouter.ai) → Keys |
| Ollama | Nessuna chiave — installa Ollama localmente |

### Scegliere il modello

1. Seleziona il **Provider** dal menu a tendina
2. Clicca **Aggiorna lista** — il plugin scarica i modelli disponibili dal provider
3. Scegli il **Modello** dal menu che appare

Il modello selezionato viene usato come valore predefinito per le nuove campagne. Puoi sempre cambiarlo in `campagna.yaml` per una campagna specifica.

**Raccomandazioni:**

| Provider | Modello consigliato | Note |
|---|---|---|
| Google AI Studio | `gemini-2.5-flash` | Rapido, 1M token context, ottimo structured output |
| Anthropic | `claude-sonnet-4-6` | Qualità narrativa elevata |
| OpenRouter | `google/gemini-2.5-flash` | Accesso multi-provider con un'unica chiave |
| Ollama | `gemma3:12b` o superiore | Privacy totale, richiede GPU |

---

## 2. Creare una campagna

Usa il comando **`BLOC: Nuova campagna`** dalla Command Palette (`Ctrl/Cmd+P`).

Il wizard si divide in 3 passi:

### Passo 1 — Informazioni

| Campo | Descrizione |
|---|---|
| **Titolo** | Nome della campagna (es. "Arcanastrum") |
| **Slug** | Identificatore usato nei percorsi file (auto-generato dal titolo, modificabile) |
| **Turni totali** | Numero di turni previsti per la campagna |
| **Premessa** | Descrizione del setting (max 500 caratteri) — viene inviata come system prompt a ogni chiamata LLM |

### Passo 2 — Modello AI

| Campo | Descrizione |
|---|---|
| **Provider** | Il provider LLM da usare per questa campagna |
| **Modello** | Selezionabile dal menu se hai già cliccato "Aggiorna lista" nelle impostazioni |

Se vedi il simbolo ✓ verde il provider ha la chiave API configurata. Se vedi ⚠ devi prima aggiungere la chiave nelle impostazioni.

### Passo 3 — Fazioni

Aggiungi le fazioni con il pulsante **+ Aggiungi fazione**. Per ogni fazione:

| Campo | Descrizione |
|---|---|
| **Nome** | Nome completo della fazione |
| **Obiettivo** | Obiettivo strategico — usato dall'LLM per valutare la coerenza delle azioni |
| **Svantaggio ID** | Identificatore breve del svantaggio strutturale (es. `isolamento`) |
| **Svantaggio Etichetta** | Descrizione leggibile (es. "Isolamento diplomatico") |

> I **vantaggi** si aggiungono direttamente in `/fazioni/{slug}.md` dopo la creazione, modificando il frontmatter YAML.

Clicca **Crea campagna** — il plugin genera `campagna.yaml` e le schede fazione.

### Aggiungere vantaggi alle fazioni

Apri `/campagne/{slug}/fazioni/{fazione}.md` e modifica il frontmatter:

```yaml
---
id: draghi
nome: "Draghi delle Montagne Eremite"
mc: 0
vantaggi:
  - id: posizioni_note
    label: "Conoscenza posizioni nemiche"
  - id: mobilita_aerea
    label: "Mobilità aerea e terreno nativo"
svantaggio:
  id: isolamento
  label: "Isolamento diplomatico"
obiettivo: "Proteggere le montagne eremitiche"
leader:
  presente: true
---
```

**`mc`** è il Modificatore Coesione: `-1`, `0`, o `+1`. Influenza i tiri di disponibilità leader e viene aggiornato automaticamente dopo ogni turno.

---

## 3. Flusso di un turno

Lo stato della campagna (`campagna.yaml → meta.stato`) avanza seguendo questa sequenza:

```
raccolta → matrice_generata → contro_args → valutazione → tiri → review → chiuso
```

I comandi sono disponibili solo quando lo stato è quello corretto — Obsidian mostrerà una notifica se provi a usarli fuori sequenza.

---

### Fase 1 — Raccolta dichiarazioni

**Stato richiesto:** `raccolta`

Per ogni fazione attiva usa **`BLOC: Dichiara azione`**.

Si apre un form con questi campi:

| Campo | Limite | Note |
|---|---|---|
| **Fazione** | — | Seleziona dalla lista delle fazioni della campagna |
| **Giocatore** | — | Nome o handle del giocatore |
| **Tipo azione** | — | `principale`, `leader`, `latente`, `difesa` |
| **Azione** | 80 car. | Descrizione sintetica dell'obiettivo |
| **Metodo** | 200 car. | Come viene eseguita l'azione |
| **Vantaggi da usare** | — | Checkbox dai vantaggi disponibili sulla scheda fazione |
| **Dettaglio narrativo** | illimitato | Solo per il layer umano — **non viene mai inviato all'LLM** |

Il form crea `/campagne/{slug}/turno-NN/azione-{fazione}.md`.

> **Tipo `leader`**: prima di aprire il form, il plugin tira automaticamente `1d6 + MC`. Se il risultato è inferiore a 4, il leader non è disponibile: il form non si apre e l'evento viene registrato in `tiri.md`.

Quando tutte le fazioni hanno dichiarato, procedi con il passo successivo.

**Genera la matrice** con **`BLOC: Genera matrice`**:

L'LLM analizza tutte le dichiarazioni e produce:
- Un file `matrice.md` con tabella leggibile (per i giocatori)
- Un frontmatter YAML machine-readable (per i passi successivi)

Lo stato avanza a `matrice_generata`.

---

### Checkpoint 1 — Contro-argomentazioni

**Stato richiesto:** `matrice_generata`

Condividi `matrice.md` con i giocatori. Ogni giocatore può dichiarare quali svantaggi oppone alle azioni avversarie (sincrono o asincrono via chat/forum).

Quando hai raccolto tutte le contro-argomentazioni, usa **`BLOC: Aggiorna svantaggi`**:

Si apre una finestra con l'elenco delle azioni. Per ogni azione puoi selezionare quali svantaggi degli avversari vengono opposti.

Lo stato avanza a `contro_args`.

---

### Fase 2 — Valutazione e dadi

**Stato richiesto:** `contro_args`

#### Valutazione vantaggi

Usa **`BLOC: Valuta azioni`**.

Il plugin chiama l'LLM **una volta per ogni fazione** (non in batch, per evitare cross-contaminazione del ragionamento). Una notifica mostra il progresso: *"Valutando azioni: 2/5"*.

Per ogni azione l'LLM:
- Conferma, riduce o nega ogni vantaggio dichiarato (con motivazione)
- Identifica gli svantaggi propri che si attivano
- Calcola il pool di dadi: `positivi = vantaggi confermati + aiuti alleati`, `negativi = svantaggi attivati + svantaggi opposti`
- Determina la modalità: `alto` (prendi il massimo), `basso` (prendi il minimo), `neutro` (primo dado)

Lo stato avanza a `valutazione`.

#### Tiri dadi

Usa **`BLOC: Esegui tiri`**.

Il plugin tira i dadi **deterministicamente** (algoritmo Mulberry32, seed = timestamp registrato). Non viene fatta nessuna chiamata LLM.

Per i **conflitti diretti** (due fazioni si attaccano a vicenda), vengono generate pool separate e i tiri avvengono simultaneamente — il vincitore è determinato dal confronto dei risultati.

La tabella esiti:

| Dado | Esito | Significato |
|---|---|---|
| 1 | No, e... | Fallimento critico — conseguenze aggiuntive negative |
| 2 | No | Fallimento secco |
| 3 | No, ma... | Fallimento parziale — qualcosa di positivo emerge |
| 4 | Sì, ma... | Successo parziale — con complicazione |
| 5 | Sì | Successo |
| 6 | Sì, e... | Successo critico — benefici aggiuntivi |

I risultati vengono salvati in `tiri.md` con seed, dadi girati ed esito per ogni azione.

Lo stato avanza a `tiri`.

#### Conseguenze narrative

Usa **`BLOC: Genera conseguenze`**.

L'LLM riceve la matrice, le valutazioni e tutti i risultati dei dadi, e produce:
- Una conseguenza narrativa per ogni azione, coerente con l'esito
- Le interazioni tra azioni (azione A che influenza il contesto di azione B)
- I delta di stato: MC, territorio, note per ogni fazione
- Gli eventi chiave del turno
- Un *narrative seed* (1-2 frasi) che servirà da aggancio per il prossimo turno

Output:
- `narrativa.md` — testo leggibile per i giocatori
- `campagna.yaml` aggiornato (`game_state_delta`, MC fazioni)

Lo stato avanza a `review`.

---

### Checkpoint 2 — Revisione narrativa

**Stato richiesto:** `review`

Leggi `narrativa.md`. Puoi editarlo direttamente in Obsidian prima di condividerlo con i giocatori — l'arbitro ha sempre l'ultima parola sulla narrazione.

Quando sei soddisfatto, usa **`BLOC: Chiudi turno`**:
- Crea la cartella `/turno-NN+1/`
- Incrementa `turno_corrente` in `campagna.yaml`
- Riporta lo stato a `raccolta`

---

## 4. Struttura dei file

### `campagna.yaml`

Il file centrale di ogni campagna. Contiene:

```yaml
meta:
  titolo: "Arcanastrum"
  slug: arcanastrum
  turno_corrente: 4
  turno_totale: 10
  stato: raccolta        # lo stato attuale del turno

premessa: >
  Breve descrizione dello scenario (max 500 car.)

llm:
  provider: google_ai_studio
  model: gemini-2.5-flash
  temperature_mechanical: 0.2   # step di valutazione (preciso)
  temperature_narrative: 0.7    # step narrativo (creativo)

fazioni:
  - id: draghi
    nome: "Draghi delle Montagne Eremite"
    mc: 0           # modificatore coesione: -1 | 0 | +1
    vantaggi:
      - id: mobilita_aerea
        label: "Mobilità aerea"
    svantaggio:
      id: isolamento
      label: "Isolamento diplomatico"
    obiettivo: "Proteggere le montagne"
    leader:
      presente: false

game_state_delta:    # storico compresso dei turni passati
  - turno: 3
    eventi_chiave:
      - "I Draghi hanno difeso il passo nord"
    stato_fazioni:
      draghi: { mc: 0, territorio: montagne_nord }
    narrative_seed: "Le tensioni aumentano al confine settentrionale."
```

> **Non modificare `stato` a mano** — usa i comandi del plugin per evitare inconsistenze.

### `azione-{fazione}.md`

Generata dal form di dichiarazione. Il plugin aggiunge `valutazione` al frontmatter dopo lo Step 2.

```yaml
---
fazione: draghi
giocatore: "@M0rgH4N"
turno: 4
tipo_azione: principale
azione: "Interrompere il rituale dei Negromanti"
metodo: "Attacco aereo + valanga sul versante nemico"
vantaggi_usati:
  - mobilita_aerea
svantaggi_opposti: []
svantaggi_propri_attivati: []
aiuti_alleati: []
dettaglio_narrativo: >
  Solo layer umano — non entra nel contesto LLM.
valutazione:
  pool: { positivi: 2, negativi: 1, netto: 1, modalita: alto }
  vantaggi_confermati: [mobilita_aerea]
  ...
---
```

### Layer di output per turno

| File | Audience | Contenuto |
|---|---|---|
| `matrice.md` | Arbitro + giocatori | Tabella azioni, conflitti rilevati, pool calcolati |
| `tiri.md` | Arbitro | Seed, dadi girati, esito per ogni azione |
| `narrativa.md` | Tutti | Conseguenze narrative, delta stato, aggancio prossimo turno |

---

## 5. Fazioni IA

Puoi marcare una fazione come controllata dall'IA aggiungendo `tipo: ia` nella scheda fazione:

```yaml
---
id: mercenari
nome: "Compagnia dei Mercenari"
tipo: ia
...
---
```

Quando il turno raggiunge la Fase 1, il plugin genera automaticamente la dichiarazione di azione per questa fazione usando l'LLM, coerentemente con il suo obiettivo e gli eventi recenti. La dichiarazione appare come una normale `azione-mercenari.md` che puoi modificare prima di procedere.

---

## 6. Azioni speciali

### Azioni latenti

Le azioni con `tipo_azione: latente` vengono salvate in `/fazioni/{slug}-latenti.yaml` anziché nella cartella del turno — sono visibili solo all'arbitro. Il plugin le include nel contesto LLM solo al turno di attivazione dichiarato.

### Azioni di difesa

Le azioni con `tipo_azione: difesa` non richiedono obiettivo offensivo. La valutazione LLM le tratta come risposta reattiva: i vantaggi difensivi pesano di più, i conflitti vengono risolti a favore del difensore in caso di parità.

### Aiuti alleati

Il campo `aiuti_alleati` in `azione-{fazione}.md` accetta gli ID delle fazioni alleate che spendono un vantaggio per supportare questa azione. Ogni aiuto aggiunge +1 al pool positivo.

### Fog of War

Gli accordi privati tra fazioni vanno in `campagna-privato.yaml` (nella stessa cartella di `campagna.yaml`). Questo file non viene mai incluso nel contesto LLM condiviso.

---

## 7. Riferimento comandi

| Comando | Stato richiesto | Descrizione |
|---|---|---|
| `BLOC: Nuova campagna` | sempre | Apre il wizard di creazione |
| `BLOC: Dichiara azione` | `raccolta` | Form dichiarazione per una fazione |
| `BLOC: Genera matrice` | `raccolta` | LLM Step 1 — crea `matrice.md` |
| `BLOC: Aggiorna svantaggi` | `matrice_generata` | Registra le contro-argomentazioni |
| `BLOC: Valuta azioni` | `contro_args` | LLM Step 2 — calcola i pool |
| `BLOC: Esegui tiri` | `valutazione` | Tira i dadi (deterministico) |
| `BLOC: Genera conseguenze` | `tiri` | LLM Step 3 — crea `narrativa.md` |
| `BLOC: Chiudi turno` | `review` | Archivia e prepara il turno successivo |
| `BLOC: Stato campagna` | sempre | Mostra riepilogo campagna e fazioni |

> Tutti i comandi sono accessibili dalla **Command Palette** (`Ctrl+P` / `Cmd+P`).

---

## 8. Gestione provider LLM

### Cambiare provider per una campagna

Modifica direttamente `campagna.yaml`:

```yaml
llm:
  provider: anthropic
  model: claude-sonnet-4-6
  temperature_mechanical: 0.2
  temperature_narrative: 0.7
```

### Temperature

- `temperature_mechanical` (default `0.2`) — usata per gli step di valutazione vantaggi e calcolo pool: bassa per risposte coerenti e riproducibili
- `temperature_narrative` (default `0.7`) — usata per la generazione delle conseguenze: più alta per narrativa varia

### Context window e turni lunghi

Con Google AI Studio (Gemini 2.5, 1M token) il contesto cumulativo di 10 turni è sempre entro i limiti.

Con Ollama (256K token) il plugin applica automaticamente una finestra mobile degli ultimi **5 turni** di `game_state_delta`. Il `narrative_seed` di ogni turno funge da riassunto compresso — la narrativa grezza non entra mai nel contesto LLM dei turni successivi.

### Provider locali (Ollama)

Assicurati che Ollama sia in ascolto prima di usare i comandi. L'URL base predefinito è `http://localhost:11434` — modificabile nelle impostazioni del plugin.

Modelli consigliati per structured output: `gemma3:12b`, `mistral-nemo`, `llama3.3`. Attiva l'opzione `think: true` (già abilitata nell'adapter) per modelli che lo supportano (es. Gemma 4).

---

## 9. Domande frequenti

**Il pulsante "Aggiorna lista" non mostra modelli**

Verifica che la chiave API sia inserita correttamente nelle impostazioni. Per Ollama, assicurati che il servizio sia attivo (`ollama serve`). Per OpenRouter la lista funziona anche senza chiave.

**Ho eseguito un comando per errore — posso ripartire?**

Sì — ogni step è **idempotente**: rieseguirlo sovrascrive l'output precedente previo conferma. L'arbitro può riportare manualmente lo stato in `campagna.yaml` al valore precedente se necessario.

**Posso cambiare la narrativa generata?**

Assolutamente sì. `narrativa.md` è un normale file Markdown che puoi editare liberamente prima di condividerlo. La modifica non influenza lo stato della campagna.

**Come funziona la riproducibilità dei dadi?**

Ogni tiro usa il timestamp come seed (registrato in `tiri.md`). Dati lo stesso seed e la stessa pool, il risultato è sempre identico — utile per verifiche e dispute.

**Posso usare più campagne contemporaneamente?**

Sì. Il plugin carica la campagna specificata in *Impostazioni → Campagna predefinita*. Se il campo è vuoto, al primo comando che lo richiede apparirà un selettore con tutte le campagne trovate in `/campagne/`.

**La chiave API è al sicuro?**

La chiave viene salvata in `.obsidian/plugins/bloc-ai-referee/data.json` — un file locale sulla tua macchina, non sincronizzato nella vault. Non viene mai scritta in file Markdown o YAML. Se usi Obsidian Sync, verifica che la cartella `.obsidian/plugins/` non sia inclusa nella sincronizzazione.
