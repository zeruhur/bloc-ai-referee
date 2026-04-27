# BLOC AI Referee — Patch 3

## Contesto
Plugin Obsidian TypeScript. Entry point: `src/main.ts`. La pipeline è
organizzata a step sequenziali in `src/pipeline/`. Gli artefatti per turno
vivono in `campagne/<slug>/turno-<n>/`. Lo stato campagna avanza tramite
`patchCampagnaStato()` attraverso le transizioni definite in `STATO_TRANSITIONS`
(constants.ts).

---

## PRIMA DI TUTTO: ricognizione obbligatoria

Leggi e mappa i seguenti file prima di modificare qualsiasi cosa:

1. `src/main.ts` — tutti i comandi registrati, quali funzioni chiamano
2. `src/commands/` — tutti i file presenti, relativo handler, step invocato
3. `src/pipeline/StepCounterArg.ts` — cosa produce, cosa scrive
4. `src/pipeline/Step2Evaluate.ts` — cosa produce, cosa scrive
5. qualsiasi step che gestisce i tiri (cerca riferimenti a `ROLLS_FILE` e
   `tiri.md` al di fuori di `Step1Matrix.ts`)
6. `src/vault/VaultManager.ts` — utility di lettura/scrittura vault
7. `src/pipeline/prompts/evaluatePrompt.ts` e `narrativePrompt.ts`

Produci come primo output una tabella:
| Comando UI | Handler | Step invocato | File scritti | Stato aggiornato |

---

## FIX 1 — `matrice.md` come artefatto progressivo del turno

### Problema
`matrice.md` e `matrice-arbitro.md` sono oggi generati solo in `Step1Matrix`
e non vengono aggiornati nei passi successivi. I comandi
"Aggiorna Svantaggi/Auto contro-argomentazione", "Valuta azioni" e
"Esegui tiri" devono arricchire la matrice con i dati del proprio step.

### Azioni richieste

**1. Estrai `MatrixWriter` come modulo condiviso**

Crea `src/vault/MatrixWriter.ts`. Sposta lì `buildMatrixFileContent()` da
`Step1Matrix.ts` e rendila generica. Deve:
- accettare un array di `MatrixEntry` esteso (vedi sotto)
- essere chiamabile da qualunque step
- gestire sia la vista pubblica sia quella arbitro
- riusare la stessa logica di frontmatter + markdown già presente

**2. Estendi il tipo `MatrixEntry` in `src/types.ts`**

Aggiungi i campi opzionali che i passi successivi devono popolare:
```typescript
contro_argomentazione?: string;
valutazione?: {
  esito: Esito;
  motivazione: string;
};
esito_tiro?: {
  dado: number;
  modificatore: number;
  risultato: number;
  esito: Esito;
};
```

Tutti opzionali — devono essere undefined finché lo step non li produce.

**3. Implementa la logica di merge nella matrice**

Ogni step che deve aggiornare la matrice deve:

1. leggere la matrice corrente dal frontmatter YAML di `matrice.md` /
`matrice-arbitro.md` tramite il vault
2. fare merge dei nuovi dati sulle entry corrispondenti (match per
`fazione` o un id univoco di azione)
3. riscrivere sia `matrice.md` (senza campi riservati all'arbitro) sia
`matrice-arbitro.md` (versione completa) tramite `MatrixWriter`

Non manipolare `matrice.md` come testo grezzo. Usa sempre il ciclo
frontmatter → merge → rewrite.

**4. Assegna responsabilità chiare per step**

- `Step1Matrix` → genera la matrice base con: fazione, azione, metodo,
argomento_vantaggio, conflitti_con, fog-of-war secrets
- `StepCounterArg` → aggiunge `contro_argomentazione` a ogni entry
rilevante e riscrive matrice
- `Step2Evaluate` → aggiunge `valutazione` a ogni entry e riscrive matrice
- Step tiri → aggiunge `esito_tiro` a ogni entry e riscrive matrice

**5. Mantieni la distinzione pubblica / arbitro**

La logica fog-of-war già presente in Step1 deve essere rispettata anche
negli aggiornamenti successivi. Se un'entry è marcata `[SEGRETO]`,
i suoi dati aggiornati compaiono solo in `matrice-arbitro.md`.

**6. Test di regressione**

Aggiungi test Vitest che verificano:

- dopo StepCounterArg, le entry di `matrice.md` contengono
`contro_argomentazione` e il resto dei campi è invariato
- dopo Step2Evaluate, le entry contengono `valutazione`
- dopo step tiri, le entry contengono `esito_tiro`
- le entry [SEGRETO] non appaiono in `matrice.md` in nessuno step

---

## FIX 2 — Nomi fazione leggibili in tutti gli artefatti user-facing

### Problema

La narrativa (e potenzialmente altri artefatti) usa lo slug/id della fazione
invece del campo `nome` leggibile.

### Azioni richieste

**1. Crea utility centralizzata in `src/utils/factionUtils.ts`**

```typescript
export function resolveFactionName(
  factionId: string,
  fazioni: Fazione[]
): string {
  return fazioni.find(f => f.id === factionId)?.nome ?? factionId;
}

export function buildFactionNameMap(
  fazioni: Fazione[]
): Record<string, string> {
  return Object.fromEntries(fazioni.map(f => [f.id, f.nome]));
}
```

**2. Applica in `narrativePrompt.ts`**

Quando vengono passati dati di fazioni al prompt narrativo, usa
`resolveFactionName()` per sostituire tutti gli id con i nomi leggibili
prima della serializzazione. In particolare nei campi:

- dichiarazioni di azione (`fazione` field)
- entry della matrice usate come input alla narrativa
- qualsiasi riferimento incrociato tra fazioni (conflitti, accordi)

**3. Post-processing dell'output LLM nella narrativa**

Dopo aver ricevuto il testo narrativo dal modello, applica una
normalizzazione aggiuntiva: sostituisci ogni occorrenza di id-fazione noti
con il relativo `nome` tramite `buildFactionNameMap()`. Questo copre i casi
in cui il modello copia uno slug dall'input nonostante le istruzioni.

**4. Estendi la correzione a tutti gli artefatti user-facing**

Verifica e correggi se necessario:

- `matrice.md` (colonna Fazione): deve usare `nome`, non `id`
- `tiri.md` nei log di spionaggio: usa `nome`
- `narrativa.md`: usa `nome`
- `matrice-arbitro.md`: usa `nome` nel rendering

Nei file interni e nel codice TypeScript continua a usare `id` come
identificatore tecnico.

**5. Test**

Dato un setup con `{ id: 'aquila-nord', nome: 'Aquila del Nord' }`:

- il testo di `narrativa.md` deve contenere `Aquila del Nord` e non
`aquila-nord`
- la colonna Fazione di `matrice.md` deve mostrare `Aquila del Nord`

---

## FIX 3 — Resilienza della pipeline: stato persistente e resume

### Problema

Se una generazione si interrompe (errore API, timeout, eccezione) non c'è
traccia persistente di dove si è fermata e non è possibile riprenderla
dallo step corretto.

### Azioni richieste

**1. Crea `src/vault/RunStateManager.ts`**

Gestisce lettura/scrittura di un file `run-state.yaml` per turno in
`campagne/<slug>/turno-<n>/run-state.yaml`.

Struttura del file:

```yaml
run_id: "20260427T164000"       # timestamp ISO di avvio
started_at: "2026-04-27T16:40:00"
updated_at: "2026-04-27T16:41:00"
current_step: "Step2Evaluate"
status: "failed"               # idle | running | failed | completed
completed_steps:
  - Step1Matrix
  - StepCounterArg
last_error: "Gemini API error 429: quota exceeded"
last_written_files:
  - campagne/mia-campagna/turno-3/matrice.md
  - campagne/mia-campagna/turno-3/matrice-arbitro.md
```

Esponi le funzioni:

```typescript
initRunState(app, slug, turno): Promise<void>
markStepStarted(app, slug, turno, stepName): Promise<void>
markStepCompleted(app, slug, turno, stepName, writtenFiles): Promise<void>
markRunFailed(app, slug, turno, stepName, error): Promise<void>
markRunCompleted(app, slug, turno): Promise<void>
loadRunState(app, slug, turno): Promise<RunState | null>
```

**2. Integra in ogni step della pipeline**

In `Step1Matrix.ts`, `StepCounterArg.ts`, `Step2Evaluate.ts` e step tiri:

```typescript
await markStepStarted(app, slug, turno, 'Step1Matrix');
try {
  // ... logica esistente dello step ...
  await markStepCompleted(app, slug, turno, 'Step1Matrix', [outPath]);
} catch (err) {
  await markRunFailed(app, slug, turno, 'Step1Matrix', err.message);
  throw err; // ri-lancia per propagare l'errore al comando UI
}
```

**3. Implementa la logica di resume nei comandi**

In `src/main.ts` o in un helper `src/pipeline/PipelineRunner.ts`,
prima di avviare qualsiasi step verifica `run-state.yaml`:

```
se status === 'failed' o status === 'running':
  mostra Notice: "Generazione precedente interrotta allo step X. Riprendo?"
  se l'utente conferma:
    salta gli step presenti in completed_steps
    riprendi dal current_step interrotto
  se l'utente rifiuta:
    azz era run-state e ricomincia da capo
```

**4. Rendi gli step idempotenti**

Ogni step deve verificare se il suo file output esiste già E se è marcato
come completato in `run-state.yaml`. Se entrambe le condizioni sono vere,
salta l'esecuzione salvo conferma esplicita di overwrite.

`Step1Matrix` ha già la logica di `onConfirmOverwrite`: estendi lo stesso
pattern a tutti gli step.

**5. Feedback UI immediato**

Dopo ogni step completato, emetti una `new Notice(...)` in Obsidian con:

- nome dello step completato
- token usati (se disponibili da `response.tokens_used`)
- modello effettivo usato (da `response.model`)

In caso di errore, la Notice deve riportare il nome dello step fallito e
un messaggio leggibile, non un stack trace grezzo.

**6. Test**

- simula un errore nel mezzo della pipeline con MockLLMAdapter che lancia
eccezione al secondo step: verifica che `run-state.yaml` contenga
`status: failed` e `completed_steps: ['Step1Matrix']`
- simula resume: con `run-state.yaml` che indica Step1 completato e
Step2 fallito, verifica che l'esecuzione riparta da Step2 senza
rieseguire Step1
- verifica idempotenza: eseguire due volte lo stesso step con stesso input
non produce file diversi

---

## Vincoli generali

- Nessuna dipendenza npm aggiuntiva
- Compatibilità con Obsidian API esistente (`requestUrl`, `app.vault`)
- Tutti i file nuovi vanno in `src/vault/` o `src/utils/` o
`src/pipeline/` secondo la loro natura
- Non modificare l'interfaccia pubblica di `LLMAdapter` né `LLMPrompt`
- Mantenere il `MockLLMAdapter` funzionante per i test

---

## Output atteso da Claude Code

1. Tabella ricognizione iniziale (comando → step → file → stato)
2. Elenco completo dei file modificati e creati
3. Implementazione di tutti e tre i fix
4. Elenco dei test aggiunti o aggiornati con nome e asserzione principale
5. Note su eventuali ambiguità trovate durante la ricognizione

