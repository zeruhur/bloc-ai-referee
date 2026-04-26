# BLOC AI Referee — Guida Utente

Questa guida copre tutto il necessario per usare il plugin, dalla prima installazione alla gestione di campagne avanzate.

## Indice

1. [Quick Start](#1-quick-start)
2. [Configurazione iniziale](#2-configurazione-iniziale)
3. [Creare una campagna](#3-creare-una-campagna)
4. [Flusso di un turno](#4-flusso-di-un-turno)
5. [Fazioni IA](#5-fazioni-ia)
6. [Azioni speciali](#6-azioni-speciali)
7. [Oracolo](#7-oracolo)
8. [Meccanica Leader](#8-meccanica-leader)
9. [Accordi privati (fog of war)](#9-accordi-privati-fog-of-war)
10. [Struttura dei file](#10-struttura-dei-file)
11. [Gestione provider LLM](#11-gestione-provider-llm)
12. [Riferimento comandi](#12-riferimento-comandi)
13. [Domande frequenti](#13-domande-frequenti)

## 1. Quick Start

Cinque passi per arrivare al primo dado tirato:

1. **Installa il plugin** e inserisci la chiave API nelle impostazioni (*Impostazioni → Plugin di terze parti → BLOC AI Referee → ⚙*)
2. **`BLOC: Nuova campagna`** — inserisci titolo, premessa e almeno due fazioni
3. **`BLOC: Dichiara azione`** — compila il form per ogni fazione (o lascia che le fazioni IA si gestiscano da sole)
4. **`BLOC: Genera matrice`** → **`BLOC: Valuta azioni`** → **`BLOC: Esegui tiri`**
5. **`BLOC: Genera conseguenze`** → **`BLOC: Chiudi turno`**

I comandi sono disponibili solo quando lo stato della campagna è quello corretto — se usi un comando fuori sequenza, una notifica te lo segnala.

> **Già conosci BLOC?** I vantaggi e gli svantaggi delle fazioni non sono token fissi: ogni dichiarazione di azione include un *argomento di vantaggio* libero in linguaggio naturale. L'LLM valuta la forza dell'argomento rispetto al contesto dell'azione — un argomento solido vale fino a 3 dadi positivi, uno debole 0. Vedi la [FAQ dedicata](#devo-specificare-vantaggi-e-svantaggi-come-liste).

## 2. Configurazione iniziale

### Aprire le impostazioni del plugin

*Impostazioni Obsidian → Plugin di terze parti → BLOC AI Referee → icona ingranaggio*

### Chiave API

Nella sezione **Chiavi API** trovi un campo per ogni provider cloud. Incolla la chiave direttamente — viene salvata nel file `.obsidian/plugins/bloc-ai-referee/data.json`, **mai** nei file della vault.

| Provider | Dove ottenere la chiave |
|---|---|
| Google AI Studio | [aistudio.google.com](https://aistudio.google.com) → Get API key |
| Anthropic | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| OpenAI | [platform.openai.com](https://platform.openai.com) → API keys |
| OpenRouter | [openrouter.ai](https://openrouter.ai) → Keys |
| Ollama | Nessuna chiave — installa Ollama localmente |

### Scegliere il modello

1. Seleziona il **Provider** dal menu a tendina
2. Clicca **Aggiorna lista** — il plugin scarica i modelli disponibili
3. Scegli il **Modello**

Il modello selezionato diventa il default per le nuove campagne; puoi cambiarlo in `campagna.yaml` per ogni campagna.

**Modelli consigliati:**

| Provider | Modello | Note |
|---|---|---|
| Google AI Studio | `gemini-2.5-flash` | Rapido, 1M token context, ottimo structured output |
| Anthropic | `claude-sonnet-4-6` | Qualità narrativa elevata |
| OpenRouter | `google/gemini-2.5-flash` | Accesso multi-provider con un'unica chiave |
| Ollama | `gemma3:12b` o superiore | Privacy totale, richiede GPU |

## 3. Creare una campagna

Usa il comando **`BLOC: Nuova campagna`** dalla Command Palette (`Ctrl/Cmd+P`).

### Passo 1 — Informazioni

| Campo | Descrizione |
|---|---|
| **Titolo** | Nome della campagna |
| **Slug** | Identificatore per i percorsi file (auto-generato, modificabile) |
| **Turni totali** | Numero di turni previsti |
| **Premessa** | Descrizione del setting (max 500 caratteri) — inviata come system prompt a ogni chiamata LLM |

### Passo 2 — Modello AI

Seleziona provider e modello. Il simbolo ✓ verde indica che la chiave API è configurata; ⚠ indica che manca.

### Passo 3 — Fazioni

Per ogni fazione, compila:

| Campo | Descrizione |
|---|---|
| **Nome** | Nome completo della fazione |
| **Obiettivo** | Obiettivo strategico — l'LLM lo usa per valutare la coerenza delle azioni |
| **Profilo** | Descrizione libera delle capacità, punti di forza e debolezze |
| **Nome leader** *(opzionale)* | Abilita la [meccanica leader](#8-meccanica-leader) per questa fazione |

> **Come scrivere un buon profilo.** Non elencare vantaggi e svantaggi in modo rigido: descrivi la fazione come faresti in una presentazione narrativa. *"I Draghi del Nord eccellono in operazioni notturne e movimenti rapidi, ma faticano a mantenere il controllo di territori vasti per la loro struttura decentralizzata."* L'LLM interpreterà questi tratti contestualmente per ogni azione dichiarata.

Clicca **Crea campagna** — il plugin genera `campagna.yaml` e le schede fazione nella vault.

## 4. Flusso di un turno

Lo stato della campagna avanza in sequenza fissa:

```
raccolta → matrice_generata → contro_args → valutazione → tiri → review → chiuso
```

Ogni fase richiede lo stato corretto. Tutti gli step che producono file sono **idempotenti**: rieseguirli sovrascrive l'output precedente previo conferma.

### Fase 1 — Raccolta dichiarazioni

**Stato richiesto:** `raccolta`

Usa **`BLOC: Dichiara azione`** per ogni fazione. Le fazioni marcate `tipo: ia` vengono gestite automaticamente (vedi [Fazioni IA](#5-fazioni-ia)); il form si apre poi per le sole fazioni umane.

**Campi del form:**

| Campo | Limite | Descrizione |
|---|---|---|
| **Fazione** | — | Seleziona tra le fazioni umane della campagna |
| **Giocatore** | — | Nome o handle del giocatore |
| **Tipo azione** | — | `principale`, `leader`, `latente`, `difesa` |
| **Azione** | 80 car. | Obiettivo sintetico dell'azione |
| **Metodo** | 200 car. | Come viene eseguita |
| **Argomento di vantaggio** | libero | *Perché* questa fazione ha le capacità e le condizioni per riuscire in questa azione specifica |
| **Dettaglio narrativo** | libero | Solo per layer umano — **non inviato all'LLM** |

> **L'argomento di vantaggio è contestuale, non generico.** Non basta dire "siamo bravi in combattimento" — argomenta rispetto all'azione specifica: *"I Draghi attaccano di notte sfruttando la loro visione notturna e l'effetto sorpresa sul versante nord, ancora privo di sentinelle."* Un argomento pertinente e dettagliato vale più dadi.

> **Tipo `leader`**: il plugin tira automaticamente `1d6 + MC`. Se il risultato è < 4, il leader non è disponibile: il form non si apre e l'evento viene registrato in `tiri.md`.

Quando tutte le fazioni hanno dichiarato, usa **`BLOC: Genera matrice`**: l'LLM analizza le dichiarazioni e produce `matrice.md` con tabella leggibile e frontmatter machine-readable. Lo stato avanza a `matrice_generata`.

### Checkpoint 1 — Contro-argomentazioni

**Stato richiesto:** `matrice_generata`

Dopo aver condiviso `matrice.md` con i giocatori, le fazioni avversarie possono sollevare argomenti contrari. Hai due opzioni:

**`BLOC: Aggiorna svantaggi`** — form manuale con l'elenco delle azioni; inserisci l'argomento per ogni fazione avversaria (lascia vuoto se non si oppone). Ideale per campagne multiplayer con discussione tra i giocatori.

**`BLOC: Auto contro-argomentazione`** — l'LLM determina autonomamente quali fazioni si opporrebbero razionalmente a quali azioni e genera l'argomento. Ideale per campagne solitarie o per velocizzare il flusso.

Entrambe portano allo stato `contro_args`.

### Fase 2 — Valutazione e dadi

**Stato richiesto:** `contro_args`

**`BLOC: Valuta azioni`** — chiama l'LLM una volta per ogni fazione (non in batch, per evitare cross-contaminazione). Una notifica mostra il progresso: *"Valutando azioni: 2/5"*.

Per ogni azione l'LLM calcola:
- **Peso argomento vantaggio**: 0–3 (quanti dadi positivi merita)
- **Peso ogni contro-argomento**: 0 o 1 (se valido, aggiunge un dado negativo)
- **Pool risultante**: `positivi = peso vantaggio`, `negativi = somma pesi contro`
- **Modalità di lettura**: `alto` (prendi il massimo), `basso` (prendi il minimo), `neutro` (primo dado)

Lo stato avanza a `valutazione`.

**`BLOC: Esegui tiri`** — tira i dadi deterministicamente (Mulberry32, seed = timestamp registrato). Nessuna chiamata LLM.

Per i **conflitti diretti** (due fazioni si attaccano), le pool vengono tirate separatamente e i risultati confrontati. Per i **conflitti IA-vs-IA** il plugin usa la tabella procedurale `rollIAConflictOutcome` (1d6) invece delle pool LLM.

**Tabella esiti:**

| Dado | Esito | Significato |
|:---:|---|---|
| 1 | No, e... | Fallimento critico — conseguenze aggiuntive negative |
| 2 | No | Fallimento secco |
| 3 | No, ma... | Fallimento con un piccolo vantaggio o informazione |
| 4 | Sì, ma... | Successo con una complicazione o costo |
| 5 | Sì | Successo |
| 6 | Sì, e... | Successo critico con benefici aggiuntivi |

I risultati vengono salvati in `tiri.md` con seed, dadi e esito per ogni azione. Lo stato avanza a `tiri`.

### Checkpoint 2 — Revisione narrativa

**Stato richiesto:** `tiri`

**`BLOC: Genera conseguenze`** — l'LLM interpreta i risultati dei tiri e produce `narrativa.md` con le conseguenze di ogni azione nel contesto della campagna. Il file è editabile liberamente prima di condividerlo con i giocatori — le modifiche non influenzano lo stato della macchina.

**`BLOC: Chiudi turno`** — archivia i file del turno in `turno-NN/archivio/`, aggiorna il `narrative_seed` in `campagna.yaml` e prepara il turno successivo. Lo stato torna a `raccolta`.

## 5. Fazioni IA

Le fazioni `tipo: ia` vengono gestite automaticamente da **`BLOC: Dichiara azione`** prima del form manuale.

Per ogni fazione IA senza dichiarazione:

1. Tira `rollTipoAzioneIA` (1d6) — tipo tematico: *Consolidamento, Espansione, Attacco Diretto, Difesa, Diplomatico/Politico, Evento Speciale*
2. Inietta il tipo nel prompt come vincolo (*"orienta l'azione verso questa categoria"*)
3. Chiama l'LLM per generare `azione`, `metodo` e `argomento_vantaggio`
4. Se la fazione ha un leader, tira la disponibilità automaticamente

Le reazioni tra fazioni IA usano `rollReactionTable` (1d6: 1–2 Ostile, 3–4 Neutrale, 5–6 Collaborativa). I conflitti IA-vs-IA usano `rollIAConflictOutcome` (1d6: 1–2 Vittoria totale, 3–4 Vittoria parziale, 5–6 Stallo) — senza chiamate LLM.

Per generare rapidamente le dichiarazioni delle fazioni IA senza aprire il form manuale usa **`BLOC: Dichiara azione`** quando tutte le fazioni umane hanno già dichiarato: il plugin rileva che non ci sono fazioni umane in attesa e chiude automaticamente il form.

## 6. Azioni speciali

### Azioni latenti

Le azioni con `tipo_azione: latente` vengono salvate in `/fazioni/{slug}-latenti.yaml` — visibili solo all'arbitro. Il plugin le include nel contesto LLM solo al turno di attivazione dichiarato.

Usa **`BLOC: Attiva azione latente`** per renderle operative al momento opportuno.

### Azioni di difesa

Le azioni con `tipo_azione: difesa` non richiedono un obiettivo offensivo. La valutazione LLM le tratta come risposta reattiva: gli argomenti difensivi vengono valutati con più attenzione al contesto e, in caso di parità di netto nel conflitto diretto, il difensore prevale.

## 7. Oracolo

L'oracolo risponde a domande chiuse (sì/no) senza coinvolgere l'LLM. È lo strumento classico per risolvere incertezze di stato del mondo in campagne solitarie: *"I rinforzi arrivano in tempo?"*, *"Il territorio è già presidiato?"*.

**Quando usarlo:** in qualsiasi momento del flusso, ogni volta che emerge una domanda di contesto che non costituisce un'azione dichiarata e non vale la pena rimandare all'LLM.

**Comando:** `BLOC: Interroga oracolo`

### Funzionamento

1. Inserisci la **domanda**
2. Seleziona la **probabilità** in base al contesto:

| Opzione | Modificatore |
|---|---|
| Improbabile | −1 |
| Neutro | 0 |
| Probabile | +1 |

3. Il plugin tira 1d6, applica il modificatore (clamp 1–6) e restituisce:

| Valore modificato | Esito |
|:---:|---|
| 1–2 | **No** |
| 3–4 | **Sì, ma...** — successo con complicazione |
| 5–6 | **Sì** |

Il risultato viene appeso a `campagne/{slug}/oracolo.md` con turno, dado, modificatore e valore finale.

## 8. Meccanica Leader

Il leader è un personaggio chiave che può agire come risorsa aggiuntiva nel turno, ma la cui disponibilità non è garantita.

### Configurare un leader

Aggiungi il **nome leader** nel wizard di creazione campagna (Passo 3). Lasciarlo vuoto significa che la fazione non ha leader. In `campagna.yaml`:

```yaml
leader:
  nome: "Generale Aurelio"
  presente: true
```

### Verificare la disponibilità

**Comando:** `BLOC: Verifica disponibilità leader`

Tira `1d6 + MC` per ogni fazione con leader. Con risultato ≥ 4 il leader è disponibile (`presente: true`); altrimenti `presente: false`. Una notice elenca i leader disponibili nel turno.

Per le fazioni IA la disponibilità viene verificata automaticamente durante `BLOC: Dichiara azione`.

### Usare il leader

Dichiara un'azione con `tipo_azione: leader`. Il form verifica automaticamente la disponibilità prima di procedere: se il leader non è disponibile, la dichiarazione viene bloccata e l'evento registrato in `tiri.md`.

### Eliminazione

**Comando:** `BLOC: Elimina leader fazione`

Seleziona la fazione dal picker (mostra solo fazioni con `leader.presente === true`). Il plugin imposta `presente: false` e applica MC −1.

## 9. Accordi privati (fog of war)

Gli accordi segreti tra fazioni vengono registrati in `campagna-privato.yaml`. Questo file **non viene mai incluso nel contesto inviato all'LLM** — è l'unico file della campagna con questa garanzia.

**Quando usarlo:** ogni volta che due fazioni stringono un patto che le altre fazioni — e l'LLM-arbitro — non devono conoscere.

**Comando:** `BLOC: Registra accordo privato`

### Form di registrazione

| Campo | Descrizione |
|---|---|
| **Fazioni coinvolte** | Toggle multiplo — richiede almeno 2 fazioni |
| **Termini** | Testo libero che descrive l'accordo |
| **Turno di scadenza** *(opzionale)* | Promemoria per l'arbitro — non applicato automaticamente |

### Struttura del file

```yaml
accordi:
  - fazioni: [draghi, mercenari]
    termini: "I Draghi non intervengono a ovest del fiume. I Mercenari non accettano incarichi contro i Draghi per 3 turni."
    turno_scadenza: 7
  - fazioni: [negromanti, empire]
    termini: "Cessate il fuoco segreto — nessun attacco diretto fino al turno 5."
```

Il file viene creato automaticamente alla prima registrazione.

## 10. Struttura dei file

Il plugin gestisce tutto nella cartella `campagne/` della vault:

```
campagne/
└── {slug}/
    ├── campagna.yaml          # Stato principale della campagna
    ├── campagna-privato.yaml  # Accordi privati — mai inviato all'LLM
    ├── oracolo.md             # Log delle risposte oracolari
    └── turno-NN/
        ├── azione-{fazione}.md    # Dichiarazioni del turno
        ├── matrice.md             # Output Step 1
        ├── valutazione.md         # Output Step 2 (pool e pesi)
        ├── tiri.md                # Seed, dadi, esiti
        ├── narrativa.md           # Output Step 3
        └── archivio/              # File archiviati dopo ChiudiTurno
fazioni/
└── {slug}-latenti.yaml        # Azioni latenti in attesa di attivazione
```

## 11. Gestione provider LLM

### Cambiare provider per una campagna specifica

Modifica direttamente `campagna.yaml`:

```yaml
llm:
  provider: anthropic
  model: claude-sonnet-4-6
  temperature_mechanical: 0.2
  temperature_narrative: 0.7
```

### Temperature

| Parametro | Default | Usato per |
|---|---|---|
| `temperature_mechanical` | `0.2` | Valutazione argomenti, calcolo pool — bassa per coerenza e riproducibilità |
| `temperature_narrative` | `0.7` | Generazione conseguenze — più alta per narrativa varia |

### Context window e turni lunghi

Con Gemini 2.5 (1M token) il contesto cumulativo di 10 turni è sempre entro i limiti. Con Ollama (256K token) il plugin applica automaticamente una finestra mobile degli ultimi **5 turni** di `game_state_delta`. Il `narrative_seed` di ogni turno funge da riassunto compresso — la narrativa grezza non entra mai nel contesto dei turni successivi.

### Provider locali (Ollama)

Assicurati che Ollama sia in ascolto prima di usare i comandi. L'URL base predefinito è `http://localhost:11434` — modificabile nelle impostazioni. Modelli consigliati per structured output: `gemma3:12b`, `mistral-nemo`, `llama3.3`.

## 12. Riferimento comandi

| Comando | Stato richiesto | Descrizione |
|---|---|---|
| `BLOC: Nuova campagna` | sempre | Wizard di creazione campagna |
| `BLOC: Dichiara azione` | `raccolta` | Auto-gen fazioni IA + form fazioni umane |
| `BLOC: Genera matrice` | `raccolta` | LLM Step 1 — produce `matrice.md` |
| `BLOC: Aggiorna svantaggi` | `matrice_generata` | Inserimento manuale contro-argomentazioni |
| `BLOC: Auto contro-argomentazione` | `matrice_generata` | LLM genera le contro-argomentazioni |
| `BLOC: Valuta azioni` | `contro_args` | LLM Step 2 — valuta argomenti e calcola pool |
| `BLOC: Esegui tiri` | `valutazione` | Tira i dadi (deterministico, no LLM) |
| `BLOC: Genera conseguenze` | `tiri` | LLM Step 3 — produce `narrativa.md` |
| `BLOC: Chiudi turno` | `review` | Archivia e prepara il turno successivo |
| `BLOC: Stato campagna` | sempre | Riepilogo campagna e fazioni |
| `BLOC: Attiva azione latente` | sempre | Attiva un'azione latente archiviata |
| `BLOC: Interroga oracolo` | sempre | Risposta Sì/No a domanda (dado modificato) |
| `BLOC: Verifica disponibilità leader` | sempre | Tira disponibilità leader, aggiorna `campagna.yaml` |
| `BLOC: Elimina leader fazione` | sempre | Segna leader come eliminato (MC −1) |
| `BLOC: Registra accordo privato` | sempre | Salva accordo segreto in `campagna-privato.yaml` |

> Tutti i comandi sono accessibili dalla **Command Palette** (`Ctrl+P` / `Cmd+P`).

## 13. Domande frequenti

### Devo specificare vantaggi e svantaggi come liste?

No. Il sistema usa argomenti liberi in linguaggio naturale. Ogni fazione ha un **profilo** (descrizione narrativa delle capacità) e ogni dichiarazione di azione include un **argomento di vantaggio** specifico per quell'azione. L'LLM valuta la forza degli argomenti contestualmente: un argomento solido vale fino a 3 dadi positivi, uno generico o debole 0.

Questo è fedele a come BLOC funziona: i vantaggi non sono token da spendere, ma argomenti da dichiarare e giustificare in base all'azione.

### Qual è la differenza tra "Aggiorna svantaggi" e "Auto contro-argomentazione"?

`BLOC: Aggiorna svantaggi` apre un form dove inserisci manualmente gli argomenti contrari raccolti dai giocatori — ideale per campagne multiplayer con discussione asincrona. `BLOC: Auto contro-argomentazione` chiede all'LLM di generarli autonomamente — ideale per solitaria o per velocizzare il flusso.

### Ho eseguito un comando per errore — posso ripartire?

Sì. Ogni step è idempotente: rieseguirlo sovrascrive l'output precedente previo conferma. Se necessario, puoi riportare manualmente lo stato in `campagna.yaml` al valore precedente (campo `meta.stato`).

### Posso modificare la narrativa generata?

Sì. `narrativa.md` è un normale file Markdown editabile liberamente prima di condividerlo. Le modifiche non influenzano lo stato della campagna.

### Come funziona la riproducibilità dei dadi?

Ogni tiro usa il timestamp come seed, registrato in `tiri.md`. Dati lo stesso seed e la stessa pool, il risultato è sempre identico — utile per verifiche o dispute tra giocatori.

### Posso gestire più campagne contemporaneamente?

Sì. Il plugin carica la campagna specificata in *Impostazioni → Campagna predefinita*. Se il campo è vuoto, al primo comando che lo richiede appare un selettore con tutte le campagne in `/campagne/`.

### La chiave API è al sicuro?

La chiave viene salvata in `.obsidian/plugins/bloc-ai-referee/data.json` — file locale, mai scritto in Markdown o YAML. Se usi Obsidian Sync, verifica che la cartella `.obsidian/plugins/` sia esclusa dalla sincronizzazione.

### Il pulsante "Aggiorna lista" non mostra modelli

Verifica che la chiave API sia inserita correttamente. Per Ollama, assicurati che il servizio sia attivo (`ollama serve`). Per OpenRouter la lista funziona anche senza chiave.