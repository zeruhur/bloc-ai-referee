# BLOC AI Referee

Plugin per [Obsidian](https://obsidian.md) che assiste l'arbitraggio di campagne **Matrix Games** basate sul sistema **BLOC** (Battaglie, Leghe, Operazioni, Conflitti).

Il plugin implementa una pipeline LLM a step separati per valutare le dichiarazioni di azione, calcolare i pool di dadi e generare conseguenze narrative — mantenendo i tiri completamente deterministici e il contesto di campagna strutturato in YAML nella vault.

---

## Caratteristiche principali

- **Pipeline LLM a 3 step** — matrice azioni → valutazione argomenti/pool → conseguenze narrative
- **Argomenti liberi** — vantaggi e svantaggi sono testo libero contestuale all'azione, non token fissi
- **Dadi deterministici** — PRNG Mulberry32 con seed registrato; nessun tiro delegato all'LLM
- **5 provider LLM** — Google AI Studio (Gemini), Anthropic (Claude), OpenAI, OpenRouter, Ollama (locale)
- **Vault-first** — tutto lo stato di gioco vive in file Markdown/YAML nella vault; nessun database esterno
- **Doppio layer di output** — YAML machine-readable per il contesto LLM + Markdown leggibile per i giocatori
- **Chiavi API sicure** — salvate nei dati del plugin, mai nei file della vault
- **Fazioni IA** — auto-genera la dichiarazione di azione per fazioni non controllate da giocatori
- **Contro-argomentazione automatizzata** — l'LLM può generare le contro-argomentazioni al posto dei giocatori
- **Modalità asincrona** — i giocatori possono dichiarare in momenti diversi; la modalità sincrona è un sottoinsieme dello stesso flusso

---

## Installazione

### Via BRAT (consigliata)

1. Installa il plugin [BRAT](https://github.com/TfTHacker/obsidian42-brat) dalla Community Plugins di Obsidian
2. Apri le impostazioni di BRAT → **Add Beta plugin**
3. Incolla: `https://github.com/zeruhur/bloc-ai-referee`
4. BRAT scaricherà e installerà l'ultima versione

### Installazione manuale

1. Scarica `main.js` e `manifest.json` dall'[ultima release](https://github.com/zeruhur/bloc-ai-referee/releases/latest)
2. Crea la cartella `.obsidian/plugins/bloc-ai-referee/` nella tua vault
3. Copia i due file nella cartella
4. Riavvia Obsidian e attiva il plugin da *Impostazioni → Plugin di terze parti*

---

## Setup rapido

1. Vai in **Impostazioni → BLOC AI Referee**
2. Nella sezione **Chiavi API**, incolla la chiave del provider che vuoi usare
3. Seleziona il provider e clicca **Aggiorna lista** per scaricare i modelli disponibili
4. Scegli il modello dal menu a tendina
5. Usa il comando `BLOC: Nuova campagna` per creare la tua prima campagna

Per la guida completa vedi [GUIDA_UTENTE.md](docs/GUIDA_UTENTE.md).

---

## Comandi disponibili

| Comando | Stato | Funzione |
|---|---|---|
| `BLOC: Nuova campagna` | sempre | Wizard di creazione campagna |
| `BLOC: Dichiara azione` | `raccolta` | Form dichiarazione + auto-gen fazioni IA |
| `BLOC: Genera matrice` | `raccolta` | LLM Step 1 — genera la matrice delle azioni del turno |
| `BLOC: Aggiorna svantaggi` | `matrice_generata` | Registra manualmente le contro-argomentazioni |
| `BLOC: Auto contro-argomentazione` | `matrice_generata` | LLM genera automaticamente le contro-argomentazioni |
| `BLOC: Valuta azioni` | `contro_args` | LLM Step 2 — valuta gli argomenti e calcola i pool di dadi |
| `BLOC: Esegui tiri` | `valutazione` | Tira i dadi deterministicamente e registra i risultati |
| `BLOC: Genera conseguenze` | `tiri` | LLM Step 3 — genera la narrativa e aggiorna lo stato di campagna |
| `BLOC: Chiudi turno` | `review` | Archivia il turno corrente e prepara quello successivo |
| `BLOC: Stato campagna` | sempre | Mostra il riepilogo dello stato attuale |

---

## Struttura della vault

```
/campagne/
  /{slug-campagna}/
    campagna.yaml          ← stato globale + config LLM + profili fazioni
    /fazioni/
      {slug}.md            ← scheda fazione (profilo, obiettivo)
    /turno-01/
      azione-{fazione}.md  ← dichiarazione azione con argomento di vantaggio
      matrice.md           ← output LLM Step 1
      tiri.md              ← log deterministico dei dadi
      narrativa.md         ← output LLM Step 3 (per i giocatori)
    /turno-02/
      ...
```

---

## Sviluppo

```bash
git clone https://github.com/zeruhur/bloc-ai-referee
cd bloc-ai-referee
npm install
npm run dev       # watch mode (output: main.js)
npm test          # unit tests (vitest)
npm run build     # build di produzione
```

Per rilasciare una nuova versione:

```bash
npm version patch   # o minor / major
git push && git push --tags
```

GitHub Actions compila e pubblica automaticamente la release con i file richiesti da BRAT.

---

## Licenza

MIT © 2026 zeruhur
