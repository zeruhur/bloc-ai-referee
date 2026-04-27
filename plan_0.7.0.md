## Piano di implementazione — BLOC v0.7.0

### Scope

Questa versione implementa le meccaniche Fog of War:

1. **Azioni Segrete** — risolte nel turno corrente ma invisibili agli altri giocatori fino alla narrativa
2. **Alleanze e Accordi** — patti tra fazioni con effetti meccanici sul pipeline LLM
3. **Rischio scoperta** — azioni di spionaggio con dado scoperta e pipeline condizionale
4. **Scadenza automatica accordi** — hook in `ChiudiTurno` per gestire accordi scaduti

---

### Principi guida

- Le azioni segrete **entrano nel pipeline LLM del turno corrente** — si distinguono dalle latenti solo per storage e visibilità nella matrice pubblica
- Gli accordi **non aggiungono dadi automaticamente** — vengono iniettati nel contesto LLM come informazione; è l'argomentazione del giocatore a citarli e l'LLM a pesarli
- Il tradimento genera MC −1 + flag contestuale al prompt di Step 2; nessuna meccanizzazione rigida dei dadi
- Lo spionaggio si risolve **pre-Step1**: se ha successo, l'azione segreta bersaglio entra in `matrice.md` pubblica marcata `[SCOPERTA]`
- La scadenza degli accordi è automatica: `ChiudiTurno` imposta `stato: 'scaduto'` senza interazione manuale

---

### Struttura file vault — nuovo layout

```
campagne/{slug}/
├── campagna.yaml
├── campagna-privato.yaml              # esistente — accordi privati
├── campagna-accordi-pubblici.yaml     # NUOVO
└── turno-NN/
    ├── azione-{id}.md                 # normale
    ├── azione-{id}-segreta.md         # NUOVO — stessa cartella del turno
    ├── matrice.md                     # pubblica — NO azioni segrete (salvo scoperte)
    ├── matrice-arbitro.md             # NUOVO — completa, con segrete marcate [SEGRETO]
    ├── valutazione.md                 # include le segrete
    ├── tiri.md                        # include tiri pre-pipeline (spionaggio)
    └── narrativa.md                   # effetti rivelati post-risoluzione
fazioni/
└── {slug}-latenti.yaml                # invariato — solo latenti (attivazione futura)
```

---

### Distinzione Latente vs Segreta

| | Latente | Segreta |
|---|---|---|
| Turno di risoluzione | Futuro (N+k) | Corrente (N) |
| Nel pipeline LLM del turno | No | **Sì** |
| In `matrice.md` (pubblica) | No | No (salvo scoperta da spionaggio) |
| In `matrice-arbitro.md` | No | **Sì** — marcata `[SEGRETO]` o `[SCOPERTA]` |
| In `narrativa.md` | No (fino ad attivazione) | **Sì** (segretezza decade post-risoluzione) |
| Storage | `/fazioni/{slug}-latenti.yaml` | `turno-NN/azione-{id}-segreta.md` |
| Richiede costo (vantaggio sacrificato) | No | **Sì** — campo `costo_vantaggio` |

---

### Wave 1 — Tipi e schema (`src/types.ts` + `src/vault/schemas.ts`)

**`CategoriaAzione`** — aggiunto `'spionaggio'`:

```typescript
type CategoriaAzione = 'standard' | 'latente' | 'difesa' | 'aiuto' | 'segreta' | 'spionaggio'
```

**`AzioneDeclaration`** — aggiunti:
- `costo_vantaggio?: string` — solo per `categoria_azione === 'segreta'`; etichetta del vantaggio sacrificato
- `target_fazione?: string` — solo per `categoria_azione === 'spionaggio'`; fazione bersaglio

**Nuovo tipo `Accordo`**:

```typescript
type TipoAccordo = 'scambio' | 'non_aggressione' | 'militare' | 'supporto'
type StatoAccordo = 'attivo' | 'violato' | 'scaduto' | 'risolto'

interface Accordo {
  id: string
  fazioni: string[]
  tipo: TipoAccordo
  termini: string
  turno_stipula: number
  turno_scadenza?: number   // undefined = permanente fino a rottura
  stato: StatoAccordo
  violazioni: { turno: number; fazione: string }[]
}

interface AccordiPubblici {
  accordi: Accordo[]
}
```

**Schema Zod** speculare in `schemas.ts`: `AccordoSchema`, `AccordiPubbliciSchema`.

**`campagna-privato.yaml`** — allineamento: aggiunto campo `tipo: TipoAccordo` agli accordi esistenti (retrocompatibile con default `'non_aggressione'`).

---

### Wave 2 — VaultManager (`src/vault/VaultManager.ts`)

**`loadActionsForTurn()`** — modifica:
- Carica sia `azione-{id}.md` che `azione-{id}-segreta.md`
- Imposta metadata `segreta: true` per i file `-segreta.md`
- **Non filtra** le segrete — entrano nel pipeline come le normali

**`saveAzioneDeclaration()`** — modifica:
- Se `categoria_azione === 'segreta'` → path `turno-NN/azione-{id}-segreta.md`
- Se `categoria_azione === 'latente'` → path `fazioni/{slug}-latenti.yaml` (invariato)

**Nuovi metodi**:
- `loadAccordiPubblici(): Promise<AccordiPubblici>` — legge `campagna-accordi-pubblici.yaml`; crea file vuoto se assente
- `loadAccordiPrivati(): Promise<AccordiPrivati>` — legge `campagna-privato.yaml` esistente
- `saveAccordoPubblico(accordo: Accordo): Promise<void>`
- `patchAccordoStato(id: string, stato: StatoAccordo, violazione?: { turno: number; fazione: string }): Promise<void>`

---

### Wave 3 — Prompt LLM (`src/pipeline/prompts/`)

**Tutti i prompt** che ricevono il contesto fazioni aggiungono una sezione `ACCORDI ATTIVI`:

```
ACCORDI ATTIVI (turno corrente)
- Draghi / Impero — militare (turno 2-5): "I Draghi forniscono truppe; l'Impero garantisce copertura logistica."
- Conclave / Mercenari — privato (turno 3-?): [RISERVATO — accordo privato tra Conclave e Mercenari]
```

Gli accordi privati appaiono solo come `[RISERVATO]` con le fazioni coinvolte — l'LLM conosce l'esistenza dell'accordo senza conoscerne i termini.

**`Step1MatrixPrompt.ts`** — modifica:
- Segrega le azioni segrete dall'output pubblico
- Istruzione esplicita: *"Le azioni marcate [SEGRETO] non devono apparire in matrice pubblica. Producile solo nel blocco `matrice_arbitro`. Le azioni marcate [SCOPERTA] (spionaggio riuscito) compaiono in entrambi i blocchi."*
- L'output schema aggiunge `matrice_arbitro: MatrixEntry[]` accanto a `matrice: MatrixEntry[]`

**`evaluatePrompt.ts`** — aggiunta:
- Flag `tradimento_recente` nella sezione fazione: *"Questa fazione ha violato un accordo al turno precedente. Pesa eventuali argomentazioni diplomatiche o di supporto con scetticismo narrativo."*

---

### Wave 4 — DiceEngine: `resolveSpionaggio` (`src/dice/DiceEngine.ts`)

Nuova funzione `resolveSpionaggio(spia: AzioneDeclaration, campagna: Campagna, seed?: number)`:

```typescript
// Tira 1d6 + MC_spia - MC_target (clamp 1-6)
// Risultato >= 4 → scoperta = true
// Risultato < 4  → scoperta = false
// Restituisce { seed, dado, modificatore, risultato, scoperta }
```

- Usa Mulberry32 come tutti gli altri tiri
- Il seed viene registrato in `tiri.md` nella sezione pre-pipeline (prima delle azioni normali)
- Chiamata in `Step1Matrix.ts` prima di qualsiasi chiamata LLM

**Tabella esiti spionaggio:**

| Risultato modificato | Esito |
|:---:|---|
| 1–3 | Fallimento — la segreta rimane nascosta |
| 4–6 | Scoperta — l'azione segreta entra in `matrice.md` con tag `[SCOPERTA]` |

---

### Wave 5 — Step 1: Genera matrice (`src/pipeline/Step1Matrix.ts`)

Flusso aggiornato:

```
1. resolveSpionaggio() per ogni azione con categoria_azione === 'spionaggio'
   → aggiorna flag scoperta sulle azioni segrete target
   → scrive risultati in tiri.md (sezione pre-pipeline)
2. Chiama LLM con tutte le azioni (segrete incluse, con flag scoperta)
3. Scrive matrice.md — azioni normali + segrete con flag [SCOPERTA]
4. Scrive matrice-arbitro.md — tutte le azioni, con [SEGRETO] o [SCOPERTA]
5. Notice: "matrice.md creata. matrice-arbitro.md disponibile per l'Arbitro."
```

---

### Wave 6 — Modal: Dichiara Azione (`src/ui/modals/DichiaraAzioneModal.ts`)

**Sezione condizionale per `categoria_azione === 'segreta'`**:
- Campo `costo_vantaggio` (dropdown dei vantaggi della fazione o testo libero)
- Label: *"Le azioni segrete richiedono il sacrificio di un vantaggio. L'azione verrà risolta in questo turno ma non sarà visibile nella matrice pubblica."*

**Sezione condizionale per `categoria_azione === 'spionaggio'`**:
- Campo `target_fazione` (dropdown fazioni avversarie)
- Label: *"Se la fazione bersaglio ha un'azione segreta attiva questo turno, verrà effettuato un dado scoperta prima della generazione della matrice (1d6 + MC_spia − MC_target, soglia 4)."*

---

### Wave 7 — Nuovi comandi Alleanze (`src/commands/`)

#### `RegistraAccordoPubblico.ts`

Flusso:
1. Form con campi: fazioni coinvolte (multi-toggle), tipo accordo (dropdown), termini (textarea), turno scadenza (numero opzionale)
2. Genera `id` univoco (`accordo-{timestamp}`)
3. Salva in `campagna-accordi-pubblici.yaml` con `stato: 'attivo'` e `turno_stipula: turno_corrente`
4. Notice: *"Accordo pubblico registrato tra [fazioni]."*

Registrazione in `main.ts`:
```
id: 'registra-accordo-pubblico'
name: 'BLOC: Registra accordo pubblico'
```

#### `DichiaraTradimento.ts`

Flusso:
1. Picker: mostra accordi con `stato: 'attivo'` (pubblici + privati)
2. Seleziona accordo e fazione traditrice
3. `patchAccordoStato(id, 'violato', { turno: N, fazione })`
4. Applica MC −1 alla fazione traditrice in `campagna.yaml`
5. Notice: *"Accordo [id] violato. MC di [fazione] ridotto di 1."*

Registrazione in `main.ts`:
```
id: 'dichiara-tradimento'
name: 'BLOC: Dichiara tradimento'
```

#### `SciogliAccordo.ts`

Flusso:
1. Picker: accordi `attivo`
2. Conferma
3. `patchAccordoStato(id, 'risolto')`
4. Nessuna penalità

Registrazione in `main.ts`:
```
id: 'sciogli-accordo'
name: 'BLOC: Sciogli accordo'
```

Il comando `BLOC: Registra accordo privato` esistente rimane invariato; lo schema `campagna-privato.yaml` viene allineato al tipo `Accordo` (retrocompatibile).

---

### Wave 8 — Scadenza automatica accordi (`src/commands/ChiudiTurno.ts`)

Hook aggiunto a `BLOC: Chiudi turno`, eseguito prima dell'archiviazione:

```typescript
async function expireAccordi(campagna: Campagna): Promise<string[]> {
  const turnoCorrente = campagna.meta.turno_corrente
  const scaduti: string[] = []

  for (const accordo of accordiPubblici.accordi) {
    if (accordo.stato === 'attivo' &&
        accordo.turno_scadenza !== undefined &&
        accordo.turno_scadenza <= turnoCorrente) {
      await patchAccordoStato(accordo.id, 'scaduto')
      scaduti.push(accordo.id)
    }
  }
  // idem per campagna-privato.yaml
  return scaduti
}
```

Se uno o più accordi scadono, una notice li elenca: *"Accordi scaduti questo turno: [lista]. Aggiornato campagna-accordi-pubblici.yaml."*

Gli accordi scaduti rimangono nel file con `stato: 'scaduto'` — storico consultabile.

---

### Wave 9 — Tests (`tests/`)

- `secretAction.test.ts`: verifica che `loadActionsForTurn()` carichi sia file normali che `-segreta.md`; verifica path di salvataggio per `categoria_azione === 'segreta'`
- `spionaggio.test.ts`: fixture azione spia + azione segreta; testa soglia dado (< 4 → nascosta, ≥ 4 → scoperta); verifica che `matrice.md` includa `[SCOPERTA]` solo se soglia raggiunta; verifica che `matrice-arbitro.md` includa sempre entrambe
- `matrix.test.ts`: aggiorna fixture per includere `matrice_arbitro` nell'output schema di Step 1
- `accordi.test.ts`: verifica `loadAccordiPubblici()`, `saveAccordoPubblico()`, `patchAccordoStato()` con stati e violazioni; verifica hook scadenza in `ChiudiTurno` per accordi con `turno_scadenza <= turno_corrente` e accordi senza scadenza
- `prompts.test.ts`: verifica che il blocco `ACCORDI ATTIVI` venga iniettato correttamente; verifica che i termini degli accordi privati non compaiano nel prompt (solo `[RISERVATO]`); fixture con `categoria_azione: 'spionaggio'` e `target_fazione`

---

### Ordine di esecuzione suggerito

```
Wave 1          (tipi e schema — fondamenta)
Wave 2          (VaultManager — dipende da Wave 1)
Wave 3          (prompt — dipende da Wave 1)
Wave 4          (DiceEngine resolveSpionaggio — indipendente)
Wave 5          (Step1Matrix — dipende da Wave 2, Wave 3, Wave 4)
Wave 6          (modal — dipende da Wave 1 e Wave 2)
Wave 7          (nuovi comandi Alleanze — dipendono da Wave 2)
Wave 8          (scadenza accordi in ChiudiTurno — dipende da Wave 2 e Wave 7)
Wave 9          (test — last, dopo che tutto compila)
```

Al termine aggiorna `README.md` e `GUIDA_UTENTE.md`.
