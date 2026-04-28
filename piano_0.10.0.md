# BLOC AI Referee — v0.8.0: Sidebar e Ribbon

## Contesto
Plugin Obsidian TypeScript. I comandi sono già registrati in `src/main.ts`
tramite `this.addCommand()`. Il flusso è definito in `STATO_TRANSITIONS`
(constants.ts). Gli stati possibili sono: raccolta → matrice_generata →
contro_args → valutazione → tiri → review → chiuso. Il `run-state.yaml`
introdotto in Patch 2 traccia lo stato corrente del turno e i messaggi
di avanzamento.

---

## PRIMA DI TUTTO: ricognizione obbligatoria

Leggi e mappa prima di modificare:

1. `src/main.ts` — tutti i comandi registrati con id, name, condizioni
   di abilitazione (se esistono), eventuali ribbon già aggiunti
2. `src/types.ts` — tipo `CampagnaStato`, `BlocPluginSettings`, struttura
   di `Campagna`
3. `src/constants.ts` — `STATO_TRANSITIONS`, `PROVIDER_LABELS`,
   etichette esistenti
4. `src/ui/` — tutti i file presenti: modal, settings tab, eventuali view
5. `src/vault/VaultManager.ts` — funzioni di caricamento campagna attiva
6. `run-state.yaml` (struttura definita in Patch 2) — campi disponibili

Produci come primo output:
| Comando esistente | addCommand id | Stato richiesto | Ha ribbon? |

---

## ARCHITETTURA GENERALE

Crea una Obsidian ItemView custom: `src/ui/RefereeView.ts`.
La view si registra con un `VIEW_TYPE` univoco, ad esempio
`bloc-referee-sidebar`, e viene aperta automaticamente al caricamento
del plugin se una campagna attiva è configurata.

La sidebar è divisa in quattro sezioni verticali:
1. **Info turno** — dati statici del turno corrente
2. **Stato flusso** — pipeline visuale con step evidenziato
3. **Messaggi live** — log di avanzamento e errori
4. **Azioni rapide** — bottoni comando contestuali

---

## FIX 1 — Registrazione della View e apertura automatica

### File da creare: `src/ui/RefereeView.ts`

```typescript
import { ItemView, WorkspaceLeaf } from 'obsidian';

export const VIEW_TYPE_REFEREE = 'bloc-referee-sidebar';

export class RefereeView extends ItemView {
  getViewType(): string { return VIEW_TYPE_REFEREE; }
  getDisplayText(): string { return 'BLOC Referee'; }
  getIcon(): string { return 'shield'; }  // icona Obsidian built-in

  async onOpen(): Promise<void> {
    // build iniziale del DOM
  }

  async onClose(): Promise<void> {
    // cleanup listener
  }
}
```


### In `src/main.ts`

```typescript
// onload()
this.registerView(VIEW_TYPE_REFEREE, leaf => new RefereeView(leaf, this));

this.addRibbonIcon('shield', 'BLOC Referee', () => {
  this.activateRefereeView();
});

await this.activateRefereeView();
```

```typescript
async activateRefereeView(): Promise<void> {
  const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_REFEREE);
  if (existing.length > 0) {
    this.app.workspace.revealLeaf(existing);
    return;
  }
  const leaf = this.app.workspace.getRightLeaf(false);
  await leaf.setViewState({ type: VIEW_TYPE_REFEREE, active: true });
  this.app.workspace.revealLeaf(leaf);
}
```


---

## FIX 2 — Sezione "Info turno"

### Dati da mostrare

Carica la campagna attiva tramite `VaultManager` (slug in settings).
Mostra:

- **Titolo campagna** (`campagna.meta.titolo`)
- **Turno corrente** (`campagna.meta.turno_corrente`)
- **Numero fazioni** (`campagna.fazioni.length`)
- **Provider LLM** (`PROVIDER_LABELS[campagna.llm.provider]`)
- **Modello** (`campagna.llm.model`)

Se nessuna campagna è configurata, mostra un placeholder:
> "Nessuna campagna attiva. Configura uno slug nelle impostazioni."

### Implementazione

```typescript
private async renderTurnInfo(container: HTMLElement): Promise<void> {
  const section = container.createEl('div', { cls: 'bloc-section' });
  section.createEl('h4', { text: 'Turno corrente' });

  const campagna = await this.loadActiveCampaign();
  if (!campagna) {
    section.createEl('p', {
      text: 'Nessuna campagna attiva.',
      cls: 'bloc-muted'
    });
    return;
  }

  const grid = section.createEl('div', { cls: 'bloc-info-grid' });
  this.infoRow(grid, 'Campagna', campagna.meta.titolo);
  this.infoRow(grid, 'Turno', String(campagna.meta.turno_corrente));
  this.infoRow(grid, 'Fazioni', String(campagna.fazioni.length));
  this.infoRow(grid, 'Modello', campagna.llm.model);
}
```


---

## FIX 3 — Sezione "Stato flusso"

### Logica

Mostra la sequenza degli step del turno con indicatore visivo:

- step completati: checkmark + stile "done"
- step corrente: evidenziato + stile "active"
- step futuri: neutri + stile "pending"
- step in errore: icona errore + stile "error"

La sequenza degli step è derivata da `STATO_TRANSITIONS`:

```
raccolta → matrice_generata → contro_args → valutazione → tiri → review → chiuso
```

Associa ogni stato a una label leggibile. Crea in `constants.ts`:

```typescript
export const STATO_LABELS: Record<CampagnaStato, string> = {
  raccolta:          '1 · Raccolta azioni',
  matrice_generata:  '2 · Matrice generata',
  contro_args:       '3 · Contro-argomentazioni',
  valutazione:       '4 · Valutazione azioni',
  tiri:              '5 · Esecuzione tiri',
  review:            '6 · Review arbitro',
  chiuso:            '7 · Turno chiuso',
};
```


### Implementazione

```typescript
private renderFlowState(
  container: HTMLElement,
  statoCorrente: CampagnaStato,
  runState: RunState | null
): void {
  const section = container.createEl('div', { cls: 'bloc-section' });
  section.createEl('h4', { text: 'Flusso turno' });

  const steps = Object.keys(STATO_TRANSITIONS) as CampagnaStato[];
  const currentIndex = steps.indexOf(statoCorrente);

  steps.forEach((step, i) => {
    const row = section.createEl('div', { cls: 'bloc-flow-row' });
    const isFailed = runState?.status === 'failed' &&
                     runState?.current_step === step;

    if (isFailed) {
      row.addClass('bloc-flow-error');
      row.createEl('span', { text: '✗', cls: 'bloc-flow-icon' });
    } else if (i < currentIndex) {
      row.addClass('bloc-flow-done');
      row.createEl('span', { text: '✓', cls: 'bloc-flow-icon' });
    } else if (i === currentIndex) {
      row.addClass('bloc-flow-active');
      row.createEl('span', { text: '›', cls: 'bloc-flow-icon' });
    } else {
      row.addClass('bloc-flow-pending');
      row.createEl('span', { text: '·', cls: 'bloc-flow-icon' });
    }

    row.createEl('span', {
      text: STATO_LABELS[step],
      cls: 'bloc-flow-label'
    });
  });
}
```


---

## FIX 4 — Sezione "Messaggi live"

### Sistema di eventi

Crea `src/ui/RefereeEventBus.ts`: un event emitter leggero che permette
agli step della pipeline di inviare messaggi alla sidebar senza
dipendenze circolari.

```typescript
type RefereeEventType = 'progress' | 'step-start' | 'step-done' | 'error';

interface RefereeEvent {
  type: RefereeEventType;
  step?: string;
  message: string;
  timestamp: Date;
}

export class RefereeEventBus {
  private listeners: ((e: RefereeEvent) => void)[] = [];

  emit(event: RefereeEvent): void {
    this.listeners.forEach(l => l(event));
  }

  on(listener: (e: RefereeEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}

export const refereeEventBus = new RefereeEventBus();
```


### Integrazione negli step della pipeline

In ogni step (`Step1Matrix`, `StepCounterArg`, `Step2Evaluate`, step tiri)
emetti eventi nei punti chiave:

```typescript
// inizio step
refereeEventBus.emit({
  type: 'step-start',
  step: 'Step2Evaluate',
  message: 'Avvio valutazione azioni...',
  timestamp: new Date()
});

// avanzamento granulare (es. per ogni azione valutata)
refereeEventBus.emit({
  type: 'progress',
  step: 'Step2Evaluate',
  message: `Valutando azioni: ${i + 1}/${total}`,
  timestamp: new Date()
});

// completamento
refereeEventBus.emit({
  type: 'step-done',
  step: 'Step2Evaluate',
  message: `Valutazione completata. Token usati: ${response.tokens_used ?? '—'}`,
  timestamp: new Date()
});

// errore
refereeEventBus.emit({
  type: 'error',
  step: 'Step2Evaluate',
  message: `Errore: ${err.message}`,
  timestamp: new Date()
});
```


### Rendering nella sidebar

La `RefereeView` si sottoscrive al bus in `onOpen()` e si de-sottoscrive
in `onClose()`. Mantiene un buffer degli ultimi N messaggi (es. 50).

```typescript
private messages: RefereeEvent[] = [];
private unsubscribe?: () => void;

async onOpen(): Promise<void> {
  this.unsubscribe = refereeEventBus.on(event => {
    this.messages.push(event);
    if (this.messages.length > 50) this.messages.shift();
    this.refreshMessages();
  });
  await this.refresh();
}

async onClose(): Promise<void> {
  this.unsubscribe?.();
}
```

I messaggi sono renderizzati come lista scrollabile con timestamp e
classe CSS per tipo (`bloc-msg-progress`, `bloc-msg-error`, ecc.).
Il pannello fa auto-scroll all'ultimo messaggio.

---

## FIX 5 — Sezione "Azioni rapide" (bottoni contestuali)

### Logica contestuale

I bottoni visibili dipendono dallo stato corrente del turno e dal
`run-state.yaml`. Usa questa mappatura:


| Stato campagna | Bottone primario | Note |
| :-- | :-- | :-- |
| raccolta | "Genera matrice" | sempre abilitato |
| matrice_generata | "Auto contro-argomentazione" |  |
| contro_args | "Valuta azioni" |  |
| valutazione | "Esegui tiri" |  |
| tiri | "Genera narrativa" |  |
| review | "Chiudi turno" |  |
| chiuso | "Nuovo turno" |  |
| qualsiasi (failed) | "Riprendi pipeline" (evidenziato in rosso) |  |

Mostra sempre anche:

- "Oracolo" — disponibile in qualsiasi stato
- "Avanza turno" — disponibile solo in stato `chiuso`


### Implementazione

```typescript
private renderActions(
  container: HTMLElement,
  stato: CampagnaStato,
  runState: RunState | null
): void {
  const section = container.createEl('div', { cls: 'bloc-section' });
  section.createEl('h4', { text: 'Azioni' });

  // Resume prioritario se run fallita
  if (runState?.status === 'failed') {
    const btn = section.createEl('button', {
      text: `↩ Riprendi da: ${runState.current_step}`,
      cls: 'bloc-btn bloc-btn-error'
    });
    btn.addEventListener('click', () =>
      this.plugin.app.commands.executeCommandById('bloc-ai-referee:riprendi-pipeline')
    );
  }

  // Bottone principale contestuale
  const primaryAction = STATO_ACTION_MAP[stato];
  if (primaryAction) {
    const btn = section.createEl('button', {
      text: primaryAction.label,
      cls: 'bloc-btn bloc-btn-primary'
    });
    btn.addEventListener('click', () =>
      this.plugin.app.commands.executeCommandById(primaryAction.commandId)
    );
  }

  // Azioni secondarie sempre visibili
  const oracoloBtn = section.createEl('button', {
    text: '🔮 Oracolo',
    cls: 'bloc-btn bloc-btn-secondary'
  });
  oracoloBtn.addEventListener('click', () =>
    this.plugin.app.commands.executeCommandById('bloc-ai-referee:oracolo')
  );
}
```

Definisci `STATO_ACTION_MAP` in `constants.ts`:

```typescript
export const STATO_ACTION_MAP: Partial<Record<CampagnaStato, {
  label: string;
  commandId: string;
}>> = {
  raccolta:         { label: '⚡ Genera matrice',              commandId: 'bloc-ai-referee:genera-matrice' },
  matrice_generata: { label: '⚡ Auto contro-argomentazione',   commandId: 'bloc-ai-referee:contro-argomentazione' },
  contro_args:      { label: '⚡ Valuta azioni',               commandId: 'bloc-ai-referee:valuta-azioni' },
  valutazione:      { label: '⚡ Esegui tiri',                 commandId: 'bloc-ai-referee:esegui-tiri' },
  tiri:             { label: '⚡ Genera narrativa',            commandId: 'bloc-ai-referee:genera-narrativa' },
  review:           { label: '✓ Chiudi turno',                commandId: 'bloc-ai-referee:chiudi-turno' },
  chiuso:           { label: '+ Nuovo turno',                 commandId: 'bloc-ai-referee:nuovo-turno' },
};
```


---

## FIX 6 — Aggiornamento reattivo della sidebar

La sidebar deve aggiornarsi automaticamente senza bisogno di ricarica
manuale nei seguenti casi:

1. **Cambio di stato campagna** — quando `patchCampagnaStato()` viene
chiamato, emetti un evento `refereeEventBus.emit({ type: 'step-done', ... })`
e fai sì che la `RefereeView` chiami `this.refresh()` su qualsiasi
evento ricevuto dal bus.
2. **Apertura del vault** — registra un `this.registerEvent( this.app.vault.on('modify', ...) )` filtrato sui file rilevanti
(`campagna.yaml`, `run-state.yaml`) per aggiornare la view quando
cambiano su disco.
3. **Metodo `refresh()`** nella `RefereeView`:
```typescript
async refresh(): Promise<void> {
  const container = this.containerEl.children as HTMLElement;
  container.empty();
  const campagna = await this.loadActiveCampaign();
  const runState = campagna
    ? await loadRunState(
        this.app,
        campagna.meta.slug,
        campagna.meta.turno_corrente
      )
    : null;

  await this.renderTurnInfo(container);
  if (campagna) {
    this.renderFlowState(container, campagna.stato, runState);
    this.renderMessages(container);
    this.renderActions(container, campagna.stato, runState);
  }
}
```


---

## FIX 7 — Stile CSS

Crea `styles.css` nella root del plugin (Obsidian lo carica automaticamente
se dichiarato in `manifest.json` con `"css": "styles.css"`).

Classi minime necessarie:

```css
.bloc-section { margin-bottom: 16px; padding: 8px 0; }
.bloc-section h4 { font-size: 11px; text-transform: uppercase;
                   letter-spacing: 0.05em; color: var(--text-muted);
                   margin: 0 0 8px 0; }

.bloc-info-grid { display: grid; grid-template-columns: auto 1fr;
                  gap: 2px 8px; font-size: 12px; }
.bloc-info-label { color: var(--text-muted); }
.bloc-info-value { color: var(--text-normal); font-weight: 500; }

.bloc-flow-row { display: flex; align-items: center; gap: 6px;
                 padding: 3px 0; font-size: 12px; }
.bloc-flow-icon { width: 14px; text-align: center; }
.bloc-flow-done    { color: var(--color-green); }
.bloc-flow-active  { color: var(--color-accent); font-weight: 600; }
.bloc-flow-pending { color: var(--text-faint); }
.bloc-flow-error   { color: var(--color-red); }

.bloc-messages { max-height: 160px; overflow-y: auto;
                 font-size: 11px; font-family: var(--font-monospace); }
.bloc-msg { padding: 2px 0; border-bottom: 1px solid var(--background-modifier-border); }
.bloc-msg-error    { color: var(--color-red); }
.bloc-msg-progress { color: var(--text-muted); }
.bloc-msg-step-done{ color: var(--color-green); }

.bloc-btn { width: 100%; margin-bottom: 6px; padding: 6px 10px;
            border-radius: 4px; cursor: pointer; font-size: 12px;
            border: 1px solid var(--background-modifier-border); }
.bloc-btn-primary   { background: var(--color-accent);
                      color: var(--text-on-accent); border-color: transparent; }
.bloc-btn-secondary { background: var(--background-secondary); }
.bloc-btn-error     { background: var(--color-red);
                      color: white; border-color: transparent; }
```


---

## Ribbon aggiuntivo

Oltre al ribbon che apre la sidebar, aggiungi ribbon shortcut per le due
azioni più frequenti, configurabili nelle settings:

```typescript
this.addRibbonIcon('dice', 'Esegui tiri', () => {
  this.app.commands.executeCommandById('bloc-ai-referee:esegui-tiri');
});
this.addRibbonIcon('book-open', 'Genera narrativa', () => {
  this.app.commands.executeCommandById('bloc-ai-referee:genera-narrativa');
});
```


---

## Vincoli

- Nessuna dipendenza npm aggiuntiva
- Nessun framework reattivo (React, Svelte): solo Obsidian DOM API vanilla
- I comandi invocati dalla sidebar devono essere gli stessi già registrati
in `main.ts` via `addCommand`, non duplicati
- La sidebar non deve bloccare il workspace se la campagna non è configurata
- Compatibile con temi Obsidian tramite variabili CSS `var(--...)`

---

## Output atteso da Claude Code

1. Tabella ricognizione iniziale (comandi esistenti + ribbon esistenti)
2. File creati: `RefereeView.ts`, `RefereeEventBus.ts`, `styles.css`
3. File modificati: `main.ts`, `constants.ts`, `types.ts`,
tutti gli step della pipeline
4. Elenco aggiornamenti a `manifest.json` se necessari
5. Test Vitest per `RefereeEventBus` (emit/subscribe/unsubscribe)
6. Note su eventuali conflitti con l'API Obsidian riscontrati


