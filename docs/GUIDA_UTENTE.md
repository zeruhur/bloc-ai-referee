# BLOC AI Referee — Guida Utente

Questa guida copre tutto il necessario per usare il plugin, dalla prima installazione alla gestione di campagne avanzate.

## Indice

1. [Quick Start](#1-quick-start)
2. [Configurazione iniziale](#2-configurazione-iniziale)
3. [Creare una campagna](#3-creare-una-campagna)
4. [Flusso di un turno](#4-flusso-di-un-turno)
5. [Fazioni IA](#5-fazioni-ia)
6. [Gestione ciclo di vita delle fazioni](#6-gestione-ciclo-di-vita-delle-fazioni)
7. [Azioni speciali](#7-azioni-speciali)
8. [Chiudi campagna](#8-chiudi-campagna)
9. [Oracolo](#9-oracolo)
10. [Meccanica Leader](#10-meccanica-leader)
11. [Accordi e alleanze](#11-accordi-e-alleanze)
12. [Struttura dei file](#12-struttura-dei-file)
13. [Gestione provider LLM](#13-gestione-provider-llm)
14. [Riferimento comandi](#14-riferimento-comandi)
15. [Domande frequenti](#15-domande-frequenti)

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

Il modello selezionato diventa il default per le nuove campagne; puoi cambiarlo in `campagna.md` per ogni campagna, oppure usare i dropdown nella sidebar (vedi [Sidebar interattiva](#sidebar-interattiva)).

### Sidebar interattiva

La sidebar **BLOC Referee** (icona scudo nel ribbon) mostra in cima una sezione **Configurazione** con tre dropdown:

- **Campagna** — elenca tutte le campagne in `/campagne/`; selezionarne una la rende attiva senza aprire le impostazioni
- **Provider** — cambia il provider LLM della campagna corrente direttamente dalla sidebar
- **Modello** — seleziona il modello tra quelli scaricati per il provider; se nessuna lista è disponibile mostra un campo testo editabile

Le modifiche a provider e modello aggiornano immediatamente `campagna.md`.

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
| **Nome leader** *(opzionale)* | Abilita la [meccanica leader](#9-meccanica-leader) per questa fazione |

> **Come scrivere un buon profilo.** Non elencare vantaggi e svantaggi in modo rigido: descrivi la fazione come faresti in una presentazione narrativa. *"I Draghi del Nord eccellono in operazioni notturne e movimenti rapidi, ma faticano a mantenere il controllo di territori vasti per la loro struttura decentralizzata."* L'LLM interpreterà questi tratti contestualmente per ogni azione dichiarata.

Clicca **Crea campagna** — il plugin genera `campagna.md` e le schede fazione nella vault.

## 4. Flusso di un turno

Lo stato della campagna avanza in sequenza fissa:

```
raccolta → matrice_generata → contro_args → valutazione → tiri → review → chiuso
```

Ogni fase richiede lo stato corretto. Tutti gli step che producono file sono **idempotenti**: rieseguirli sovrascrive l'output precedente previo conferma.

### Pre-step opzionali (fase raccolta)

Prima di dichiarare le azioni, l'arbitro può eseguire tre comandi preparatori:

**`BLOC: Check leader del turno`** — tira `1d6 + MC` per ogni fazione con leader presente. Se il risultato è ≥ 4, il leader è disponibile: un modal chiede di scegliere la **modalità** per il turno:

| Modalità | Effetto |
|---|---|
| Presenza di Comando | L'azione ordinaria della fazione riceve +1 dado positivo in valutazione |
| Azione di Leadership | L'azione dichiarata sostituisce quella ordinaria della fazione |
| Intervento Limitato | Il leader interviene solo in fase review (vedi [Intervento Limitato](#intervento-limitato)) |

Il risultato viene scritto in `leader-check.md` del turno corrente. Se il dado non raggiunge la soglia, il leader non è disponibile e nessuna modalità viene assegnata.

**`BLOC: Registra negoziazione`** — registra un accordo formale o una nota di coordinazione informale tra fazioni. Scegli tra:
- **Accordo formale** → apre il form standard degli accordi (privato o pubblico)
- **Nota negoziazione** → scrive solo un testo libero in `negoziazione.md` del turno, senza struttura formale — utile per coordinazioni che non hanno ancora forma di accordo

**`BLOC: Movimento del turno`** — disponibile solo se la campagna ha `usa_mappa: true` nel frontmatter. Apre un form con fazione, descrizione del movimento e territori coinvolti (opzionale). L'output viene scritto in `movimento.md` del turno.

---

### Fase 1 — Raccolta dichiarazioni

**Stato richiesto:** `raccolta`

Usa **`BLOC: Dichiara azione`** per ogni fazione. Le fazioni marcate `tipo: ia` vengono gestite automaticamente (vedi [Fazioni IA](#5-fazioni-ia)); il form si apre poi per le sole fazioni umane.

**Campi del form:**

| Campo | Limite | Descrizione |
|---|---|---|
| **Fazione** | — | Seleziona tra le fazioni umane della campagna |
| **Giocatore** | — | Nome o handle del giocatore |
| **Azione** | libero | Obiettivo sintetico dell'azione |
| **Metodo** | libero | Come viene eseguita |
| **Argomento favorevole** | libero | *Perché* questa fazione ha le capacità e le condizioni per riuscire in questa azione specifica |
| **Modalità leader** | — | Visibile solo se il leader è presente **e** disponibile (check del turno ≥ 4). Opzioni: *Nessuna*, *Presenza di Comando*, *Azione di Leadership* |
| **Dettaglio narrativo** | libero | Solo per layer umano — **non inviato all'LLM** |

> **L'argomento favorevole è contestuale, non generico.** Non basta dire "siamo bravi in combattimento" — argomenta rispetto all'azione specifica: *"I Draghi attaccano di notte sfruttando la loro visione notturna e l'effetto sorpresa sul versante nord, ancora privo di sentinelle."* Un argomento pertinente e dettagliato vale più dadi.

> **Modalità leader**: il dropdown appare solo se prima del turno è stato eseguito `BLOC: Check leader del turno` e il leader risulta disponibile. *Intervento Limitato* non è selezionabile qui — va gestito in fase review.

> **Categoria `aiuto` rimossa**: l'aiuto tra fazioni si gestisce ora con gli *interventi reattivi* (vedi sotto), che permettono di dichiarare il supporto dopo la pubblicazione della matrice, in modo narrativamente più coerente.

Quando tutte le fazioni hanno dichiarato, usa **`BLOC: Genera matrice`**: l'LLM analizza le dichiarazioni e produce `matrice.md` con tabella leggibile e frontmatter machine-readable. Lo stato avanza a `matrice_generata`.

### Checkpoint 1 — Contro-argomentazioni

**Stato richiesto:** `matrice_generata`

Dopo aver condiviso `matrice.md` con i giocatori, è possibile sollevare obiezioni contestuali su ciascuna azione. Hai due opzioni:

**`BLOC: Aggiorna svantaggi`** — form manuale con l'elenco delle azioni; per ognuna inserisci le contro-argomentazioni (una per riga), ovvero le ragioni contestuali per cui quell'azione potrebbe non riuscire. Ideale per campagne multiplayer con discussione tra i giocatori. Porta lo stato a `contro_args`.

**`BLOC: Auto contro-argomentazione`** — l'LLM analizza la matrice e genera per ogni azione tutte le obiezioni contestuali plausibili: ostacoli concreti, condizioni sfavorevoli, debolezze nell'argomento dichiarato. Gli argomenti sono valutazioni arbitrali del contesto, non dichiarazioni in-character delle fazioni. Ideale per campagne solitarie o per velocizzare il flusso. Porta lo stato a `contro_args`.

**Flusso misto (giocatori umani + fazioni IA):** puoi usare i due comandi in sequenza. Prima `BLOC: Aggiorna svantaggi` per raccogliere i contributi umani, poi `BLOC: Auto contro-argomentazione` per integrare le obiezioni mancanti. Il secondo comando legge gli argomenti già presenti e aggiunge solo quelli non ancora coperti — il contributo umano non viene sovrascritto.

### Fase 2 — Valutazione e dadi

**Stato richiesto:** `contro_args`

**`BLOC: Valuta azioni`** — chiama l'LLM una volta per ogni fazione (non in batch, per evitare cross-contaminazione). Una notifica mostra il progresso: *"Valutando azioni: 2/5"*.

Per ogni azione l'LLM calcola:
- **Peso argomento vantaggio**: 0–3 (quanti dadi positivi merita)
- **Peso ogni contro-argomento**: 0 o 1 (se valido, aggiunge un dado negativo; il totale dipende dal numero di obiezioni valide)
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

**Stato richiesto:** `tiri` → `review`

**`BLOC: Genera conseguenze`** — l'LLM interpreta i risultati dei tiri e produce `narrativa.md` con le conseguenze di ogni azione nel contesto della campagna. Il file è editabile liberamente prima di condividerlo con i giocatori — le modifiche non influenzano lo stato della macchina. Lo stato avanza a `review`.

In fase `review` sono disponibili due azioni aggiuntive prima di chiudere il turno:

**`BLOC: Intervento limitato`** — permette a un leader con modalità *Intervento Limitato* (o all'arbitro) di registrare un piccolo intervento post-narrativa che non costituisce un'azione dichiarata e non genera nuovi tiri. Il form richiede:
- Fazione che interviene
- Descrizione dell'intervento
- Tipo di effetto (consolida risultato / contiene complicazione / sostiene alleato / protegge coesione)
- Una checkbox di conferma esplicita dopo aver verificato i **guardrail** mostrati nel form: l'intervento non deve richiedere dichiarazione strutturata, non deve generare opposizione significativa, non deve produrre tiri di dadi, non deve avviare un conflitto diretto

L'output viene scritto in `intervento-limitato.md` del turno. Non modifica la matrice né chiama la pipeline.

**`BLOC: Chiudi turno`** — archivia i file del turno in `turno-NN/archivio/`, aggiorna il `narrative_seed` in `campagna.yaml` e prepara il turno successivo. Lo stato torna a `raccolta`.

## 5. Fazioni IA

Le fazioni `tipo: ia` vengono gestite automaticamente da **`BLOC: Dichiara azione`** prima del form manuale.

Per ogni fazione IA senza dichiarazione:

1. Tira `rollTipoAzioneIA` (1d6) — tipo tematico: *Consolidamento, Espansione, Attacco Diretto, Difesa, Diplomatico/Politico, Evento Speciale*
2. Inietta il tipo nel prompt come vincolo (*"orienta l'azione verso questa categoria"*)
3. Chiama l'LLM per generare `azione`, `metodo` e `argomento_favorevole` → scrive `azione-{id}.md`
4. Se la fazione ha il leader presente (`leader.presente: true`), genera **sempre** anche l'azione di leadership con una seconda chiamata LLM → scrive `azione-{id}-leader.md` con `leader_mode: azione_leadership` (nessun tiro di dado: se il leader è presente, agisce)

Le reazioni tra fazioni IA usano `rollReactionTable` (1d6: 1–2 Ostile, 3–4 Neutrale, 5–6 Collaborativa). I conflitti IA-vs-IA usano `rollIAConflictOutcome` (1d6: 1–2 Vittoria totale, 3–4 Vittoria parziale, 5–6 Stallo) — senza chiamate LLM.

### Campagna interamente automatizzata

Se **tutte** le fazioni sono `tipo: ia` (nessuna umana), `BLOC: Dichiara azione` genera tutte le dichiarazioni automaticamente e, al termine, lancia automaticamente **`BLOC: Genera matrice`** — portando lo stato direttamente a `matrice_generata` senza intervento manuale.

Per generare rapidamente le dichiarazioni delle fazioni IA senza aprire il form manuale usa **`BLOC: Dichiara azione`** quando tutte le fazioni umane hanno già dichiarato: il plugin rileva che non ci sono fazioni umane in attesa e chiude automaticamente il form.

## 6. Gestione ciclo di vita delle fazioni

Durante una campagna, le fazioni possono subire cambiamenti strutturali: essere eliminate, fondersi, scindere una corrente interna o passare da controllo umano a IA. Tutti questi eventi si gestiscono con i comandi dedicati — senza modificare manualmente `campagna.yaml`.

> **Momento consigliato**: usa questi comandi all'inizio di un turno (stato `raccolta`), prima di dichiarare le azioni. I comandi funzionano in qualsiasi stato, ma modificare una fazione a metà pipeline può generare incoerenze nella matrice o nella valutazione già prodotta.

### Eliminazione e ripristino

**`BLOC: Elimina fazione`** — segna una fazione come `eliminata: true`. La fazione scompare da tutti i picker e dal contesto LLM inviato ai prompt. L'operazione è **reversibile**.

**`BLOC: Ripristina fazione`** — riporta allo stato attivo una fazione eliminata (rimuove il flag `eliminata`).

### Controllo IA / umano

**`BLOC: Converti fazione a controllo IA`** — converte una fazione umana in IA (`tipo: ia`). Al prossimo `BLOC: Dichiara azione` la dichiarazione sarà generata automaticamente.

**`BLOC: Converti fazione a controllo umano`** — riporta una fazione IA a controllo umano (`tipo: normale`). Il prossimo turno si aprirà il form di dichiarazione.

### Sospensione temporanea

La sospensione è diversa dall'eliminazione: la fazione **rimane nel contesto narrativo LLM** (appare nei prompt) ma non dichiara azioni nel turno corrente. Utile per fazioni temporaneamente neutralizzate o in attesa di eventi.

**`BLOC: Sospendi fazione`** — imposta `sospesa: true`. La fazione non compare nel picker di `BLOC: Dichiara azione`.

**`BLOC: Riattiva fazione sospesa`** — rimuove `sospesa` e ripristina la partecipazione alla dichiarazione.

### Modifica profilo e statistiche

**`BLOC: Modifica profilo fazione`** — aggiorna nome, obiettivo e concetto di una fazione attraverso un form. L'ID file (`id`) rimane invariato — i file di azione già scritti sul disco non vengono rinominati.

**`BLOC: Modifica vantaggi fazione`** — riscrive gli array `vantaggi` e `svantaggi` di una fazione. Il form mostra i valori attuali in una textarea (un elemento per riga); salva la versione modificata.

### Operazioni strutturali

**`BLOC: Fondi fazioni`** — fonde due fazioni: la fazione A sopravvive assorbendo B.

Flusso:
1. Picker fazione A (sopravvissuta)
2. Picker fazione B (assorbita)
3. Modal con checkbox sui vantaggi e svantaggi combinati (default: tutti selezionati) e scelta dell'MC risultante (default: `max(A.mc, B.mc)`)
4. Submit: vantaggi aggiornati su A, B marcata come eliminata

**`BLOC: Aggiungi nuova fazione`** — crea una nuova fazione mid-campagna. Apre lo stesso form del wizard di creazione (nome, obiettivo, concetto, vantaggi, MC, tipo, leader opzionale). Al salvataggio, aggiunge la fazione a `campagna.yaml` e crea `fazioni/{id}.md`.

**`BLOC: Scindi fazione`** — crea una seconda fazione per scissione da una esistente.

Flusso:
1. Picker fazione sorgente
2. Form nuova fazione (precompilato con nome suggerito `{sorgente} — Ala dissidente`)
3. Sezione opzionale "Ridistribuisci vantaggi": checkbox per trasferire vantaggi dalla sorgente alla nuova fazione
4. Submit: nuova fazione creata, vantaggi trasferiti rimossi dalla sorgente (la sorgente rimane attiva)

**`BLOC: Genera leader fazione`** — genera tramite LLM il nome e il profilo del leader per una fazione priva di leader. Il nome viene salvato in `campagna.yaml` (`leader.nome`) e il profilo narrativo nella scheda `fazioni/{id}.md`.

## 7. Azioni speciali

### Azioni latenti

Le azioni con `categoria_azione: latente` vengono salvate in `/fazioni/{slug}-latenti.md` — visibili solo all'arbitro. Il plugin le include nel contesto LLM solo al turno di attivazione dichiarato.

Usa **`BLOC: Attiva azione latente`** per renderle operative al momento opportuno.

### Azioni di difesa

Le azioni con `categoria_azione: difesa` non richiedono un obiettivo offensivo. La valutazione LLM le tratta come risposta reattiva: gli argomenti difensivi vengono valutati con più attenzione al contesto e, in caso di parità di netto nel conflitto diretto, il difensore prevale.

### Interventi reattivi (aiuto e svantaggio)

Dopo la pubblicazione di `matrice.md`, una fazione può dichiarare un intervento reattivo verso l'azione di un'altra fazione usando il comando **`BLOC: Dichiara intervento reattivo`** (disponibile in stato `matrice_generata`). Gli interventi sono **opzionali**: se nessuno li dichiara, la pipeline prosegue normalmente.

**Tipi di intervento:**

- **Aiuto** — la fazione interveniente supporta la fazione target fornendo una risorsa o un argomento favorevole. Ogni aiuto aggiunge +1 dado positivo al pool della fazione target in Step 2.
- **Svantaggio** — la fazione interveniente si oppone con un argomento specifico (incorporato come contro-argomento).

**Form:** fazione interveniente → fazione target → tipo → argomento (testo libero) → risorsa usata (opzionale).

Il risultato viene scritto in `intervento-reattivo.md` del turno (formato YAML, più interventi ammessi). `BLOC: Auto contro-argomentazione` legge automaticamente il file e incorpora gli interventi nella valutazione.

> Questa meccanica sostituisce la vecchia categoria `aiuto` in `DichiaraAzione`. La separazione temporale — dichiarazione prima, aiuto dopo la matrice — è più fedele alla procedura del gioco.

### Azioni segrete

Le azioni con `categoria_azione: segreta` vengono risolte **nel turno corrente** — entrano nel pipeline LLM normalmente — ma non appaiono nella `matrice.md` pubblica condivisa con i giocatori. L'arbitro può consultare `matrice-arbitro.md` che le include con il marcatore `[SEGRETO]`.

**Costo**: un'azione segreta richiede il sacrificio di un vantaggio della fazione. Il form chiede di selezionare quale vantaggio viene "bruciato" per mantenere la segretezza.

Dopo la generazione della narrativa, la segretezza decade: `narrativa.md` include gli effetti dell'azione segreta come qualsiasi altra.

> **Differenza da latente**: l'azione latente non viene risolta nel turno corrente; l'azione segreta sì — è solo invisibile agli altri giocatori durante la fase di dichiarazione e matrice.

### Azioni di spionaggio

Le azioni con `categoria_azione: spionaggio` tentano di scoprire un'azione segreta attiva di una fazione bersaglio.

**Come funziona:**

1. Dichiara l'azione di spionaggio con **`BLOC: Dichiara azione`** → scegli `Spionaggio` e seleziona la fazione bersaglio
2. Prima della chiamata LLM di Step 1, il plugin tira automaticamente il **dado scoperta**: `1d6 + MC_spia − MC_target`
3. Se il risultato è ≥ 4 → **scoperta**: l'azione segreta bersaglio appare in `matrice.md` con il marcatore `[SCOPERTA]`
4. Se il risultato è < 4 → **fallimento**: la segreta rimane nascosta

Il tiro viene registrato in `tiri.md` nella sezione pre-pipeline, prima dei tiri normali.

| Risultato modificato | Esito |
|:---:|---|
| 1–3 | Fallimento — l'azione segreta rimane nascosta |
| 4–6 | Scoperta — l'azione segreta entra in `matrice.md` con `[SCOPERTA]` |

## 8. Chiudi campagna

**Comando:** `BLOC: Chiudi campagna`

Genera tramite LLM un epilogo narrativo dell'intera campagna, sintetizzando gli eventi chiave registrati in `game_state_delta`. Può essere usato in qualsiasi momento — non richiede uno stato particolare.

**Output:**

- Se esiste già `narrativa.md` nel turno corrente, l'epilogo viene aggiunto in coda come sezione `## Epilogo — Fine Campagna`
- Se non esiste, viene creato `campagne/{slug}/conclusione.md` con l'epilogo completo

Il file prodotto è editabile liberamente come qualsiasi altro documento Markdown della vault.

---

## 9. Oracolo

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

## 10. Meccanica Leader

Il leader è un personaggio chiave che può agire come risorsa aggiuntiva nel turno, ma la cui disponibilità non è garantita. La meccanica si articola in tre fasi: check di disponibilità, scelta della modalità, utilizzo durante il turno.

### Configurare un leader

Aggiungi il **nome leader** nel wizard di creazione campagna (Passo 3). Lasciarlo vuoto significa che la fazione non ha leader. In `campagna.yaml`:

```yaml
leader:
  nome: "Generale Aurelio"
  presente: true
```

Per aggiungere un leader a una fazione già esistente usa **`BLOC: Genera leader fazione`** — genera nome e profilo tramite LLM, poi li salva in `campagna.md` e nella scheda fazione.

### Check di disponibilità del turno

**Comando:** `BLOC: Check leader del turno`

All'inizio di ogni turno (fase `raccolta`), esegui il check prima di dichiarare le azioni. Il plugin tira `1d6 + MC` per ogni fazione con leader presente:

- **Risultato ≥ 4** → leader disponibile: un modal chiede di scegliere la **modalità** per questo turno
- **Risultato < 4** → leader non disponibile: nessuna azione speciale

Il risultato (dado, MC, valore modificato, disponibilità, modalità scelta) viene salvato in `leader-check.md` del turno corrente.

### Modalità leader

| Modalità | Come si usa | Effetto meccanico |
|---|---|---|
| **Presenza di Comando** | Il giocatore dichiara l'azione ordinaria; nel form seleziona *Presenza di Comando* come modalità leader | +1 dado positivo aggiunto automaticamente in Step 2 (Valuta azioni) |
| **Azione di Leadership** | Il giocatore dichiara un'azione che sostituisce quella ordinaria della fazione; seleziona *Azione di Leadership* | Nessun bonus automatico — l'azione entra nel pipeline normalmente |
| **Intervento Limitato** | Non si dichiara nulla ora; si usa il comando `BLOC: Intervento limitato` in fase review | Intervento narrativo post-review senza tiri (vedi [Checkpoint 2](#checkpoint-2--revisione-narrativa)) |

> **Per le fazioni IA**: nessun tiro di dado. Se `leader.presente: true`, l'azione di leadership viene sempre generata automaticamente come seconda chiamata LLM durante `BLOC: Dichiara azione`.

### Usare la modalità leader nel form

Il dropdown **Modalità leader** appare nel form di `BLOC: Dichiara azione` solo se:
1. La fazione selezionata ha `leader.presente: true`
2. Il check del turno ha prodotto `disponibile: true` per quella fazione

Se il check non è stato eseguito o il leader non è disponibile, il dropdown non compare e l'azione viene dichiarata normalmente.

*Intervento Limitato* non è selezionabile da questo form — va gestito esclusivamente in fase review.

### Eliminazione

**Comando:** `BLOC: Elimina leader fazione`

Seleziona la fazione dal picker (mostra solo fazioni con `leader.presente === true`). Il plugin:
1. Imposta `leader.presente: false`
2. Applica MC −1 (clampato a −1)
3. Aggiunge una nota in `tiri.md`: *"[nome] è stato eliminato. La fazione [nome] subisce MC −1 e uno svantaggio narrativo da definire."*

Lo svantaggio narrativo è una nota aperta per l'arbitro, non un effetto automatico.

## 11. Accordi e alleanze

Il plugin supporta due tipi di accordi tra fazioni: **pubblici** (noti a tutti, iniettati nel contesto LLM) e **privati** (segreti, mai inviati all'LLM).

### Accordi pubblici

Gli accordi pubblici vengono salvati in `campagna-accordi-pubblici.md` e **iniettati come sezione `ACCORDI ATTIVI` nel system prompt** di ogni chiamata LLM del turno. L'LLM conosce l'esistenza dell'accordo e i suoi termini — questo influenza la valutazione degli argomenti e la narrativa.

**Comando:** `BLOC: Registra accordo pubblico`

| Campo | Descrizione |
|---|---|
| **Fazioni coinvolte** | Toggle multiplo — richiede almeno 2 fazioni |
| **Tipo accordo** | `non_aggressione`, `militare`, `scambio`, `supporto` |
| **Termini** | Testo libero che descrive l'accordo |
| **Turno di scadenza** *(opzionale)* | Se specificato, l'accordo scade automaticamente in `ChiudiTurno` |

### Accordi privati

Gli accordi privati vengono salvati in `campagna-privato.md`. Questo file **non viene mai incluso nel contesto inviato all'LLM** — è l'unico file della campagna con questa garanzia.

Nel contesto LLM gli accordi privati appaiono solo come `[RISERVATO — accordo privato tra Fazione A / Fazione B]`: l'LLM sa che esiste un accordo senza conoscerne i termini.

**Comando:** `BLOC: Registra accordo privato`

Il form è identico a quello per gli accordi pubblici.

### Tradimento

Quando una fazione viola un accordo attivo:

**Comando:** `BLOC: Dichiara tradimento`

1. Seleziona l'accordo violato dal picker (mostra tutti gli accordi `attivo`)
2. Indica la fazione traditrice
3. Il plugin aggiorna lo stato dell'accordo a `violato`, registra la violazione con il numero di turno, e applica **MC −1** alla fazione traditrice
4. Nei turni successivi, il flag `[TRADIMENTO RECENTE]` viene iniettato nel profilo della fazione nel prompt di valutazione — l'LLM pesa gli argomenti diplomatici e di supporto di quella fazione con scetticismo narrativo

### Sciogliere un accordo

Per terminare un accordo consensualmente, senza penalità:

**Comando:** `BLOC: Sciogli accordo`

Lo stato dell'accordo passa a `risolto`. Gli accordi scaduti o risolti rimangono nei file come storico consultabile.

### Scadenza automatica

In **`BLOC: Chiudi turno`**, prima di incrementare il numero di turno, il plugin verifica tutti gli accordi attivi con `turno_scadenza` impostato. Quelli con `turno_scadenza ≤ turno_corrente` vengono automaticamente marcati come `scaduto`. Una notice elenca gli accordi scaduti nel turno.

### Struttura dei file

**`campagna-accordi-pubblici.md`** (frontmatter YAML):
```yaml
---
accordi:
  - id: accordo-1714234800000
    fazioni: [draghi, mercenari]
    tipo: militare
    termini: "I Draghi forniscono copertura aerea; i Mercenari garantiscono forza a terra."
    turno_stipula: 2
    turno_scadenza: 6
    stato: attivo
    violazioni: []
---
```

**`campagna-privato.md`** (stesso schema, termini mai inviati all'LLM):
```yaml
---
accordi:
  - id: accordo-1714234900000
    fazioni: [negromanti, empire]
    tipo: non_aggressione
    termini: "Cessate il fuoco segreto — nessun attacco diretto fino al turno 5."
    turno_stipula: 1
    turno_scadenza: 5
    stato: attivo
    violazioni: []
---
```

## 12. Struttura dei file

Il plugin gestisce tutto nella cartella `campagne/` della vault:

```
campagne/
└── {slug}/
    ├── campagna.md                      # Stato principale della campagna (frontmatter)
    ├── campagna-privato.md              # Accordi privati — mai inviato all'LLM (frontmatter)
    ├── campagna-accordi-pubblici.md     # Accordi pubblici — iniettati nel contesto LLM (frontmatter)
    ├── oracolo.md                       # Log delle risposte oracolari
    ├── conclusione.md                   # Epilogo LLM (se generato fuori turno)
    ├── fazioni/
    │   ├── {slug}.md                    # Scheda fazione (frontmatter + corpo narrativo)
    │   └── {slug}-latenti.md            # Azioni latenti archiviate (frontmatter)
    └── turno-NN/
        ├── azione-{fazione}.md          # Dichiarazioni del turno (con leader_mode opzionale)
        ├── azione-{fazione}-leader.md   # Azione leadership IA (se fazione IA con leader)
        ├── azione-{fazione}-segreta.md  # Azioni segrete (solo per l'arbitro)
        ├── leader-check.md              # Risultati check leader del turno
        ├── movimento.md                 # Movimenti su mappa (se usa_mappa: true)
        ├── negoziazione.md              # Note negoziali informali del turno
        ├── intervento-reattivo.md       # Interventi reattivi (aiuto/svantaggio) post-matrice
        ├── intervento-limitato.md       # Interventi post-review registrati in fase review
        ├── matrice.md                   # Output Step 1 — pubblica (no segrete)
        ├── matrice-arbitro.md           # Output Step 1 — completa (include segrete)
        ├── tiri.md                      # Seed, dadi, esiti (include tiri spionaggio e note leader)
        ├── narrativa.md                 # Output Step 3
        └── run-state.md                 # Stato interno pipeline (frontmatter)
```

## 13. Gestione provider LLM

### Cambiare provider per una campagna specifica

Il modo più rapido è usare i dropdown nella sidebar (sezione **Configurazione**): seleziona provider e modello senza uscire dalla vault.

In alternativa, modifica direttamente il frontmatter di `campagna.md`:

```yaml
---
llm:
  provider: anthropic
  model: claude-sonnet-4-6
  temperature_mechanical: 0.2
  temperature_narrative: 0.7
---
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

## 14. Riferimento comandi

### Pipeline di gioco

| Comando | Stato richiesto | Descrizione |
|---|---|---|
| `BLOC: Nuova campagna` | sempre | Wizard di creazione campagna |
| `BLOC: Check leader del turno` | `raccolta` | Tira disponibilità leader (1d6+MC), chiede modalità se disponibile, scrive `leader-check.md` |
| `BLOC: Registra negoziazione` | `raccolta` | Registra accordo formale o nota informale di coordinazione |
| `BLOC: Movimento del turno` | `raccolta` | Registra movimenti su mappa (solo se `usa_mappa: true`) |
| `BLOC: Dichiara azione` | `raccolta` | Auto-gen fazioni IA + form fazioni umane; se tutte IA lancia automaticamente Genera matrice |
| `BLOC: Genera matrice` | `raccolta` | LLM Step 1 — produce `matrice.md` + `matrice-arbitro.md` |
| `BLOC: Aggiorna svantaggi` | `matrice_generata` | Inserimento manuale contro-argomentazioni (una per riga per ogni azione) |
| `BLOC: Dichiara intervento reattivo` | `matrice_generata` | Registra aiuto (+1 dado) o svantaggio reattivo verso un'altra fazione (opzionale, multipli ammessi) |
| `BLOC: Auto contro-argomentazione` | `matrice_generata` / `contro_args` | LLM genera le contro-argomentazioni (include interventi reattivi `aiuto` da `intervento-reattivo.md`); in flusso misto, fa merge con i contributi umani già presenti |
| `BLOC: Valuta azioni` | `contro_args` | LLM Step 2 — valuta argomenti, calcola pool (+1 dado per `presenza_comando` e `aiuto`) |
| `BLOC: Esegui tiri` | `valutazione` | Tira i dadi (deterministico, no LLM) |
| `BLOC: Genera conseguenze` | `tiri` / `review` | LLM Step 3 — produce `narrativa.md` |
| `BLOC: Intervento limitato` | `review` | Registra un intervento post-review con guardrail di validità |
| `BLOC: Chiudi turno` | `review` | Scade accordi, archivia e prepara il turno successivo |
| `BLOC: Stato campagna` | sempre | Riepilogo campagna e fazioni |

### Strumenti di arbitraggio

| Comando | Stato richiesto | Descrizione |
|---|---|---|
| `BLOC: Attiva azione latente` | sempre | Attiva un'azione latente archiviata |
| `BLOC: Interroga oracolo` | sempre | Risposta Sì/No a domanda (dado modificato) |
| `BLOC: Verifica disponibilità leader` | sempre | Alias legacy di Check leader del turno |
| `BLOC: Elimina leader fazione` | sempre | Segna leader come eliminato (MC −1, nota narrativa in `tiri.md`) |
| `BLOC: Genera leader fazione` | sempre | Genera nome e profilo leader tramite LLM |
| `BLOC: Registra accordo privato` | sempre | Salva accordo segreto in `campagna-privato.md` |
| `BLOC: Registra accordo pubblico` | sempre | Registra accordo pubblico iniettato nel contesto LLM |
| `BLOC: Dichiara tradimento` | sempre | Viola un accordo attivo (MC −1 alla fazione traditrice) |
| `BLOC: Sciogli accordo` | sempre | Chiude un accordo consensualmente, senza penalità |
| `BLOC: Chiudi campagna` | sempre | LLM genera l'epilogo della campagna; aggiunge a `narrativa.md` o crea `conclusione.md` |

### Gestione fazioni

| Comando | Stato richiesto | Descrizione |
|---|---|---|
| `BLOC: Elimina fazione` | sempre | Segna una fazione come eliminata — scompare da picker e contesto LLM |
| `BLOC: Ripristina fazione` | sempre | Riporta allo stato attivo una fazione eliminata |
| `BLOC: Converti fazione a controllo IA` | sempre | Converte una fazione umana in IA |
| `BLOC: Converti fazione a controllo umano` | sempre | Converte una fazione IA in umana |
| `BLOC: Sospendi fazione` | sempre | Esclude temporaneamente una fazione dalla dichiarazione azioni |
| `BLOC: Riattiva fazione sospesa` | sempre | Riporta la fazione nella lista delle dichiaranti |
| `BLOC: Modifica profilo fazione` | sempre | Aggiorna nome, obiettivo e concetto |
| `BLOC: Modifica vantaggi fazione` | sempre | Riscrive l'elenco vantaggi e svantaggi |
| `BLOC: Fondi fazioni` | sempre | Fonde due fazioni: A assorbe B (B viene eliminata) |
| `BLOC: Aggiungi nuova fazione` | sempre | Crea una nuova fazione mid-campagna |
| `BLOC: Scindi fazione` | sempre | Crea una nuova fazione per scissione, con ridistribuzione opzionale dei vantaggi |

> Tutti i comandi sono accessibili dalla **Command Palette** (`Ctrl+P` / `Cmd+P`).

## 15. Domande frequenti

### Devo specificare vantaggi e svantaggi come liste?

No. Il sistema usa argomenti liberi in linguaggio naturale. Ogni fazione ha un **profilo** (descrizione narrativa delle capacità) e ogni dichiarazione di azione include un **argomento di vantaggio** specifico per quell'azione. L'LLM valuta la forza degli argomenti contestualmente: un argomento solido vale fino a 3 dadi positivi, uno generico o debole 0.

Questo è fedele a come BLOC funziona: i vantaggi non sono token da spendere, ma argomenti da dichiarare e giustificare in base all'azione.

### Qual è la differenza tra "Aggiorna svantaggi" e "Auto contro-argomentazione"?

Entrambi generano contro-argomentazioni: ragioni contestuali per cui un'azione potrebbe non riuscire, scritte come valutazioni arbitrali del contesto di gioco (non dichiarazioni in-character delle fazioni).

`BLOC: Aggiorna svantaggi` apre un form con una textarea per ogni azione — inserisci le obiezioni a mano, una per riga, raccogliendo il contributo dei giocatori. Ideale per campagne multiplayer con discussione asincrona.

`BLOC: Auto contro-argomentazione` chiede all'LLM di generarle autonomamente: per ogni azione produce tutte le obiezioni plausibili (anche zero, se non ci sono). Ideale per campagne solitarie o per velocizzare il flusso.

I due comandi sono **componibili**: usa prima `Aggiorna svantaggi` per i contributi umani, poi `Auto contro-argomentazione` per integrare le obiezioni mancanti. Il secondo comando non sovrascrive gli argomenti già presenti.

### Ho eseguito un comando per errore — posso ripartire?

Sì. Ogni step è idempotente: rieseguirlo sovrascrive l'output precedente previo conferma.

Per tornare a uno step precedente, apri `campagne/{slug}/campagna.md` e modifica il campo `stato` nel frontmatter con il valore desiderato:

```yaml
---
meta:
  stato: matrice_generata   # ← torna allo step contro-argomentazioni
---
```

Valori validi: `raccolta`, `matrice_generata`, `contro_args`, `valutazione`, `tiri`, `review`.

Dopo aver salvato, il comando corrispondente torna disponibile nella Command Palette. Per esempio, impostare `matrice_generata` riabilita `BLOC: Auto contro-argomentazione` e `BLOC: Aggiorna svantaggi`.

### Posso modificare la narrativa generata?

Sì. `narrativa.md` è un normale file Markdown editabile liberamente prima di condividerlo. Le modifiche non influenzano lo stato della campagna.

### Come funziona la riproducibilità dei dadi?

Ogni tiro usa il timestamp come seed, registrato in `tiri.md`. Dati lo stesso seed e la stessa pool, il risultato è sempre identico — utile per verifiche o dispute tra giocatori.

### Posso gestire più campagne contemporaneamente?

Sì. Il plugin carica la campagna specificata in *Impostazioni → Campagna predefinita*, oppure tramite il dropdown **Campagna** nella sidebar. Se il campo è vuoto, al primo comando che lo richiede appare un selettore con tutte le campagne in `/campagne/`.

### La chiave API è al sicuro?

La chiave viene salvata in `.obsidian/plugins/bloc-ai-referee/data.json` — file locale, mai scritto in Markdown o YAML. Se usi Obsidian Sync, verifica che la cartella `.obsidian/plugins/` sia esclusa dalla sincronizzazione.

### Il pulsante "Aggiorna lista" non mostra modelli

Verifica che la chiave API sia inserita correttamente. Per Ollama, assicurati che il servizio sia attivo (`ollama serve`). Per OpenRouter la lista funziona anche senza chiave.

### Qual è la differenza tra azione segreta e azione latente?

L'**azione latente** non viene risolta nel turno corrente: viene archiviata e attivata in un turno futuro con `BLOC: Attiva azione latente`. Non entra mai nel pipeline LLM fino all'attivazione.

L'**azione segreta** viene risolta **nel turno corrente** — partecipa al pipeline LLM normalmente — ma non compare nella `matrice.md` pubblica condivisa con i giocatori. L'arbitro vede tutto in `matrice-arbitro.md`. Richiede il sacrificio di un vantaggio della fazione.

### Come funziona il dado spionaggio?

`1d6 + MC_spia − MC_target`. Il risultato è clampato tra 1 e 6. Con risultato ≥ 4 l'azione segreta bersaglio viene scoperta e appare in `matrice.md` con `[SCOPERTA]`. Il tiro avviene automaticamente in `BLOC: Genera matrice` prima di qualsiasi chiamata LLM, e viene registrato in `tiri.md`.

Lo spionaggio funziona solo se la fazione bersaglio ha effettivamente un'azione segreta nel turno corrente — se non ce l'ha, il tiro non viene effettuato.

### Gli accordi influenzano meccanicamente i dadi?

No. Gli accordi **non aggiungono o tolgono dadi automaticamente**. Vengono iniettati nel contesto LLM come informazione narrativa: è l'argomentazione del giocatore a citarli e l'LLM a pesarli nella valutazione degli argomenti. Un accordo militare con una fazione alleata rafforza la credibilità di un argomento di supporto — ma solo se il giocatore lo dichiara nell'argomento di vantaggio.

### Cosa succede se un accordo viene violato più volte?

Ogni tradimento si registra nel campo `violazioni` dell'accordo (con turno e fazione). Il flag `[TRADIMENTO RECENTE]` viene iniettato solo per la violazione più recente: l'LLM viene avvisato di trattare con scetticismo gli argomenti diplomatici di quella fazione nel turno successivo. Non c'è limite al numero di violazioni registrabili.

### Qual è la differenza tra "Sospendi fazione" ed "Elimina fazione"?

**Sospesa**: la fazione non dichiara azioni nel turno ma rimane nel contesto narrativo inviato all'LLM — appare nei prompt come entità presente nel setting. Utile per fazioni momentaneamente inattive (tregua, riorganizzazione interna).

**Eliminata**: la fazione scompare sia dai picker sia dal contesto LLM. È la scelta corretta per fazioni definitivamente rimosse dalla narrativa (sconfitte, dissolte, assorbite da un'altra fazione).

Entrambe le operazioni sono reversibili: usa "Ripristina fazione" o "Riattiva fazione sospesa".
