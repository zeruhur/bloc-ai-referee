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
7. [Oracolo](#7-oracolo)
8. [Meccanica Leader](#8-meccanica-leader)
9. [Accordi privati (fog of war)](#9-accordi-privati-fog-of-war)
10. [Riferimento comandi](#10-riferimento-comandi)
11. [Gestione provider LLM](#11-gestione-provider-llm)
12. [Domande frequenti](#12-domande-frequenti)

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
| **Profilo** | Descrizione libera delle capacità, punti di forza e debolezze tipiche della fazione — contesto per l'LLM |
| **Nome leader** *(opzionale)* | Se compilato, abilita la meccanica leader per questa fazione (disponibilità per turno, eliminazione). Se vuoto la fazione non ha leader. |

Clicca **Crea campagna** — il plugin genera `campagna.yaml` e le schede fazione.

> **Il profilo è contestuale.** Non descrivere vantaggi e svantaggi come liste fisse: descrivili come caratteristiche narrative che l'LLM interpreterà caso per caso in base all'azione specifica dichiarata.

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

#### Fazioni IA

Se la campagna ha fazioni marcate come `tipo: ia`, il plugin le gestisce automaticamente **prima** di aprire il form manuale. Per ogni fazione IA che non ha ancora dichiarato:

1. Tira `rollTipoAzioneIA` (1d6) — ottiene un tipo tematico tra: *Consolidamento, Espansione, Attacco Diretto, Difesa, Diplomatico/Politico, Evento Speciale*
2. Inietta il tipo nel prompt come vincolo narrativo (*"orienta l'azione verso questa categoria"*)
3. Chiama l'LLM per generare `azione`, `metodo` e `argomento_vantaggio`
4. Se la fazione ha un leader configurato, tira anche la disponibilità (vedi [Meccanica Leader](#8-meccanica-leader))

Il form si apre poi per le sole fazioni umane.

#### Form dichiarazione (fazioni umane)

| Campo | Limite | Note |
|---|---|---|
| **Fazione** | — | Seleziona tra le fazioni umane della campagna |
| **Giocatore** | — | Nome o handle del giocatore |
| **Tipo azione** | — | `principale`, `leader`, `latente`, `difesa` |
| **Azione** | 80 car. | Descrizione sintetica dell'obiettivo |
| **Metodo** | 200 car. | Come viene eseguita l'azione |
| **Argomento di vantaggio** | libero | Testo libero: *perché* questa fazione ha le capacità e le condizioni per riuscire in questa azione specifica |
| **Dettaglio narrativo** | libero | Solo per il layer umano — **non viene mai inviato all'LLM** |

> **L'argomento di vantaggio è contestuale all'azione.** Non è un elenco di caratteristiche generiche della fazione, ma una motivazione specifica: *"I Draghi attaccano di notte sfruttando la loro visione notturna e l'effetto sorpresa sul versante nord, ancora privo di sentinelle"*.

> **Tipo `leader`**: prima di aprire il form, il plugin tira automaticamente `1d6 + MC`. Se il risultato è inferiore a 4, il leader non è disponibile: il form non si apre e l'evento viene registrato in `tiri.md`.

Il form crea `/campagne/{slug}/turno-NN/azione-{fazione}.md`.

#### Generazione matrice

Quando tutte le fazioni hanno dichiarato, usa **`BLOC: Genera matrice`**:

L'LLM analizza tutte le dichiarazioni e produce:
- Un file `matrice.md` con tabella leggibile (per i giocatori)
- Un frontmatter YAML machine-readable (per i passi successivi)

Lo stato avanza a `matrice_generata`.

---

### Checkpoint 1 — Contro-argomentazioni

**Stato richiesto:** `matrice_generata`

Dopo aver condiviso `matrice.md` con i giocatori, le fazioni avversarie possono sollevare argomenti contrari alle azioni altrui. Hai due modalità:

#### Modalità manuale — `BLOC: Aggiorna svantaggi`

Si apre una finestra con l'elenco delle azioni. Per ogni azione, puoi inserire un argomento libero per ciascuna fazione avversaria (lascia vuoto se quella fazione non si oppone). Utile per campagne con giocatori attivi che discutono le contro-argomentazioni in chat o forum.

#### Modalità automatica — `BLOC: Auto contro-argomentazione`

L'LLM analizza la matrice e i profili delle fazioni e determina autonomamente quali fazioni si opporrebbero razionalmente a quali azioni, generando l'argomento contestuale. Ideale per campagne solitarie o quando vuoi velocizzare il flusso.

Entrambe le modalità portano allo stato `contro_args`.

---

### Fase 2 — Valutazione e dadi

**Stato richiesto:** `contro_args`

#### Valutazione argomenti

Usa **`BLOC: Valuta azioni`**.

Il plugin chiama l'LLM **una volta per ogni fazione** (non in batch, per evitare cross-contaminazione del ragionamento). Una notifica mostra il progresso: *"Valutando azioni: 2/5"*.

Per ogni azione l'LLM valuta:
- **Argomento di vantaggio** → `peso` da 0 a 3 (quanti dadi positivi merita, in base a forza e pertinenza contestuale)
- **Ogni contro-argomento** → `peso` 0 o 1 (se il contro-argomento è valido aggiunge un dado negativo)
- **Pool risultante**: `positivi = peso vantaggio`, `negativi = somma pesi contro`, `netto = positivi − negativi`
- **Modalità**: `alto` (prendi il massimo), `basso` (prendi il minimo), `neutro` (primo dado)

Lo stato avanza a `valutazione`.

#### Tiri dadi

Usa **`BLOC: Esegui tiri`**.

Il plugin tira i dadi **deterministicamente** (algoritmo Mulberry32, seed = timestamp registrato). Non viene fatta nessuna chiamata LLM.

Per i **conflitti diretti** (due fazioni si attaccano a vicenda), vengono generate pool separate e i tiri avvengono simultaneamente — il vincitore è determinato dal confronto dei risultati.

Per i **conflitti IA-vs-IA** il plugin usa una tabella procedurale (`rollIAConflictOutcome`, 1d6) anziché le pool LLM: 1-2 → vittoria totale dell'attaccante, 3-4 → vittoria parziale, 5-6 → stallo. Questo riduce le chiamate LLM non necessarie per interazioni puramente meccaniche.

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
    obiettivo: "Proteggere le montagne"
    profilo: >
      Forza militare aerea superiore e conoscenza del territorio montano.
      Isolati diplomaticamente e dipendenti dall'iniziativa individuale dei clan.
      Vulnerabili a campagne prolungate di logoramento.
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
metodo: "Attacco aereo sul versante nord al crepuscolo, preceduto da valanga controllata"
argomento_vantaggio: >
  I Draghi attaccano di notte sfruttando la visione notturna e la familiarità con il
  versante nord, ancora privo di sentinelle dopo la ritirata dei Negromanti al passo est.
  La valanga controllata isola il sito prima dell'assalto aereo.
argomenti_contro:
  - fazione: negromanti
    argomento: >
      Il rituale è in fase avanzata: anche un'interruzione parziale produrrà un'onda
      di energia non controllata che potrebbe danneggiare gli stessi Draghi.
dettaglio_narrativo: >
  Solo layer umano — non entra nel contesto LLM.
valutazione:
  valutazione_vantaggio:
    peso: 2
    motivazione: "Argomento solido e contestuale. La finestra notturna è sfruttata in modo convincente."
  valutazioni_contro:
    - fazione: negromanti
      peso: 1
      motivazione: "Il rischio dell'onda residua è plausibile e aggiunge un dado negativo."
  pool: { positivi: 2, negativi: 1, netto: 1, modalita: alto }
---
```

### Layer di output per turno

| File | Audience | Contenuto |
|---|---|---|
| `matrice.md` | Arbitro + giocatori | Tabella azioni, argomenti di vantaggio, conflitti rilevati |
| `tiri.md` | Arbitro | Seed, dadi girati, esito per ogni azione |
| `narrativa.md` | Tutti | Conseguenze narrative, delta stato, aggancio prossimo turno |

---

## 5. Fazioni IA

Puoi marcare una fazione come controllata dall'IA aggiungendo `tipo: ia` nella scheda fazione o in `campagna.yaml`:

```yaml
- id: mercenari
  nome: "Compagnia dei Mercenari"
  tipo: ia
  obiettivo: "Massimizzare i profitti nel conflitto"
  profilo: >
    Fanteria pesante mercenaria, altamente motivata dal guadagno economico.
    Si schiera con chi offre di più e può cambiare alleanze a metà campagna.
    Priva di territorio proprio, vulnerabile a blocchi economici.
  mc: 0
  leader:
    nome: "Comandante Varro"
    presente: true
```

Quando usi **`BLOC: Dichiara azione`**, il plugin:
1. Rileva le fazioni `tipo: ia` che non hanno ancora dichiarato per il turno corrente
2. Tira `rollTipoAzioneIA` (1d6) per determinare il tipo tematico dell'azione
3. Se la fazione ha un leader, tira la disponibilità (1d6 + MC ≥ 4); se non disponibile, aggiorna `campagna.yaml` e scrive `azione_extra: false` nel file azione
4. Chiama l'LLM con profilo, storia recente e tipo procedurale come vincolo narrativo
5. Salva il file come una normale dichiarazione (modificabile prima di procedere)
6. Apre il form manuale per le fazioni umane

L'operazione è idempotente: se `azione-{id}.md` esiste già, quella fazione viene saltata.

---

## 6. Azioni speciali

### Azioni latenti

Le azioni con `tipo_azione: latente` vengono salvate in `/fazioni/{slug}-latenti.yaml` anziché nella cartella del turno — sono visibili solo all'arbitro. Il plugin le include nel contesto LLM solo al turno di attivazione dichiarato.

### Azioni di difesa

Le azioni con `tipo_azione: difesa` non richiedono obiettivo offensivo. La valutazione LLM le tratta come risposta reattiva: gli argomenti difensivi vengono valutati con più attenzione al contesto, e i conflitti si risolvono a favore del difensore in caso di parità di netto.

---

## 7. Oracolo

L'oracolo risponde a domande chiuse (sì/no) dell'arbitro usando un dado modificabile. È uno strumento da tavolo classico per campagne solitarie o per risolvere incertezze narrative senza coinvolgere l'LLM.

**Comando:** `BLOC: Interroga oracolo`

### Funzionamento

1. Inserisci la **domanda** (es. *"I rinforzi arrivano in tempo?"*)
2. Seleziona la **probabilità** in base al contesto di gioco:

| Opzione | Modificatore | Effetto |
|---|---|---|
| Improbabile | −1 | Abbassa il risultato di 1 |
| Neutro | 0 | Nessuna modifica |
| Probabile | +1 | Alza il risultato di 1 |

3. Il plugin tira 1d6, applica il modificatore (con clamp 1-6) e restituisce:

| Valore modificato | Esito |
|---|---|
| 1-2 | **No** |
| 3-4 | **Sì, ma...** — successo con complicazione |
| 5-6 | **Sì** |

Il risultato viene appeso a `campagne/{slug}/oracolo.md` con turno, dado, modificatore e valore finale — consultabile durante la sessione.

---

## 8. Meccanica Leader

Il leader è un personaggio chiave di una fazione che può influenzare le azioni in modo diretto (tipo azione `leader`) ma la cui disponibilità non è garantita a ogni turno.

### Configurare un leader

Aggiungi il campo `nome leader` nel wizard **Nuova campagna** (Passo 3 — Fazioni). Lasciarlo vuoto significa che la fazione non ha leader e la meccanica non si applica.

In `campagna.yaml` il leader appare così:
```yaml
leader:
  nome: "Generale Aurelio"
  presente: true
```

Se il campo `leader` è assente, la fazione non ha meccanica leader.

### Verificare la disponibilità

**Comando:** `BLOC: Verifica disponibilità leader`

Tira `1d6 + MC` per ogni fazione con leader. Se il risultato è ≥ 4 il leader è disponibile, altrimenti `presente` viene aggiornato a `false` in `campagna.yaml`. Una notice elenca i leader disponibili nel turno.

Per le fazioni IA, la disponibilità viene verificata automaticamente durante `BLOC: Dichiara azione`.

### Eliminazione di un leader

**Comando:** `BLOC: Elimina leader fazione`

Seleziona la fazione dal picker (mostra solo le fazioni con `leader.presente === true`). Il plugin:
- Imposta `presente: false` nella fazione
- Applica MC −1 (la perdita del leader indebolisce la coesione)

> **Leader e tipo azione `leader`**: quando un giocatore dichiara un'azione con `tipo_azione: leader`, il form verifica automaticamente la disponibilità prima di procedere. Se il leader non è disponibile, la dichiarazione viene bloccata e l'evento registrato in `tiri.md`.

---

## 9. Accordi privati (fog of war)

Gli accordi segreti tra fazioni — alleanze temporanee, cessate il fuoco tacite, promesse di non intervento — vengono registrati in `campagna-privato.yaml`. Questo file non viene **mai** incluso nel contesto inviato all'LLM.

**Comando:** `BLOC: Registra accordo privato`

### Form di registrazione

| Campo | Descrizione |
|---|---|
| **Fazioni coinvolte** | Seleziona con toggle; richiede almeno 2 fazioni |
| **Termini** | Testo libero che descrive l'accordo |
| **Turno di scadenza** *(opzionale)* | Turno dopo il quale l'accordo cessa automaticamente |

### Struttura del file

```yaml
accordi:
  - fazioni: [draghi, mercenari]
    termini: "I Draghi non intervengono a ovest del fiume. I Mercenari non accettano incarichi contro i Draghi per 3 turni."
    turno_scadenza: 7
  - fazioni: [negromanti, empire]
    termini: "Cessate il fuoco segreto — nessun attacco diretto fino al turno 5."
```

> Il file viene creato automaticamente alla prima registrazione. La scadenza non viene applicata automaticamente: è un promemoria per l'arbitro.

---

## 10. Riferimento comandi

| Comando | Stato richiesto | Descrizione |
|---|---|---|
| `BLOC: Nuova campagna` | sempre | Apre il wizard di creazione |
| `BLOC: Dichiara azione` | `raccolta` | Auto-gen fazioni IA + form per fazioni umane |
| `BLOC: Genera matrice` | `raccolta` | LLM Step 1 — crea `matrice.md` |
| `BLOC: Aggiorna svantaggi` | `matrice_generata` | Registra manualmente le contro-argomentazioni |
| `BLOC: Auto contro-argomentazione` | `matrice_generata` | LLM genera le contro-argomentazioni automaticamente |
| `BLOC: Valuta azioni` | `contro_args` | LLM Step 2 — valuta gli argomenti e calcola i pool |
| `BLOC: Esegui tiri` | `valutazione` | Tira i dadi (deterministico) |
| `BLOC: Genera conseguenze` | `tiri` | LLM Step 3 — crea `narrativa.md` |
| `BLOC: Chiudi turno` | `review` | Archivia e prepara il turno successivo |
| `BLOC: Stato campagna` | sempre | Mostra riepilogo campagna e fazioni |
| `BLOC: Interroga oracolo` | sempre | Risposta Yes/No a una domanda (dado modificato), log in `oracolo.md` |
| `BLOC: Verifica disponibilità leader` | sempre | Tira disponibilità leader, aggiorna `campagna.yaml` |
| `BLOC: Elimina leader fazione` | sempre | Segna il leader come eliminato (MC −1) |
| `BLOC: Registra accordo privato` | sempre | Salva un accordo segreto in `campagna-privato.yaml` |

> Tutti i comandi sono accessibili dalla **Command Palette** (`Ctrl+P` / `Cmd+P`).

---

## 11. Gestione provider LLM

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

- `temperature_mechanical` (default `0.2`) — usata per gli step di valutazione argomenti e calcolo pool: bassa per risposte coerenti e riproducibili
- `temperature_narrative` (default `0.7`) — usata per la generazione delle conseguenze: più alta per narrativa varia

### Context window e turni lunghi

Con Google AI Studio (Gemini 2.5, 1M token) il contesto cumulativo di 10 turni è sempre entro i limiti.

Con Ollama (256K token) il plugin applica automaticamente una finestra mobile degli ultimi **5 turni** di `game_state_delta`. Il `narrative_seed` di ogni turno funge da riassunto compresso — la narrativa grezza non entra mai nel contesto LLM dei turni successivi.

### Provider locali (Ollama)

Assicurati che Ollama sia in ascolto prima di usare i comandi. L'URL base predefinito è `http://localhost:11434` — modificabile nelle impostazioni del plugin.

Modelli consigliati per structured output: `gemma3:12b`, `mistral-nemo`, `llama3.3`.

---

## 12. Domande frequenti

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

**Devo specificare vantaggi e svantaggi come liste?**

No. Dal v0.3.0 il sistema usa argomenti liberi in linguaggio naturale. Invece di token fissi, ogni fazione ha un **profilo** (descrizione delle capacità e debolezze tipiche) e ogni dichiarazione di azione include un **argomento di vantaggio** specifico per quell'azione. L'LLM valuta la forza degli argomenti contestualmente — un argomento ottimo vale fino a 3 dadi positivi, uno debole 0.

**Qual è la differenza tra "Aggiorna svantaggi" e "Auto contro-argomentazione"?**

`BLOC: Aggiorna svantaggi` apre un form dove l'arbitro inserisce manualmente gli argomenti contrari raccolti dai giocatori — ideale per campagne multiplayer con discussione asincrona tra turni. `BLOC: Auto contro-argomentazione` chiede all'LLM di generarli autonomamente basandosi sul profilo delle fazioni e sulla matrice — ideale per campagne solitarie o per accelerare il flusso.
