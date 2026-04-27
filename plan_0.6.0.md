## Piano di implementazione — BLOC v0.6.0

### Principi guida

- `profilo` (free-text) → schema strutturato con `concetto`, `vantaggi[]`, `svantaggi[]`
- `tipo_azione` diventa solo esecutore (`principale`|`leader`); la natura dell'azione va in `categoria_azione`
- I vantaggi/svantaggi sono **etichette testuali semplici** (`string[]`) — possono evolvere nel tempo o emergere contestualmente
- L'argomentazione resta **libera** (`argomento_vantaggio: string`); l'LLM valuta il testo usando vantaggi/svantaggi come contesto, non come lista da spuntare
- Il modello di valutazione LLM rimane `peso-su-argomento-libero` (`valutazione_vantaggio: { peso, motivazione }`)
- I test `prompts.test.ts` contengono fixture speculative errate — vanno allineati al design reale, non il contrario

---

### Wave 1 — Core types (`src/types.ts`)

**Aggiunte:**

- `CategoriaAzione = 'standard' | 'latente' | 'difesa' | 'aiuto' | 'segreta'`

**Modifiche:**

- `TipoAzione` → rimuove `'latente'` e `'difesa'` (diventano `CategoriaAzione`)
- `FazioneConfig`: `profilo: string` → `concetto: string`; aggiunti `vantaggi: string[]` e `svantaggi: string[]` (etichette libere, es. `"Flotta navale superiore"`)
- `Campagna.meta`: aggiunti `livello_operativo: string` e `distribuzione_temporale: 'lineare' | 'non_lineare'`
- `AzioneDeclaration`: aggiunto `categoria_azione: CategoriaAzione`; aggiunto `fazione_aiutata?: string` (per categoria `aiuto`); `argomento_vantaggio` e `argomenti_contro` **rimangono invariati**

**Invariate:**

- `EvaluationOutput`: mantiene `valutazione_vantaggio: { peso, motivazione }` e `valutazioni_contro`
- `MatrixEntry`: mantiene `argomento_vantaggio: string`
- `ArgomentoContro`: rimane

---

### Wave 2 — Zod schemas (`src/vault/schemas.ts`)

Aggiornamento speculare alle modifiche di Wave 1:

- `FazioneConfigSchema`: `profilo` → `concetto`, aggiunti `vantaggi: z.array(z.string())` e `svantaggi: z.array(z.string())`
- `CampagnaSchema.meta`: aggiunti `livello_operativo` e `distribuzione_temporale`
- `AzioneDeclarationSchema`: aggiunto `categoria_azione`, aggiunto `fazione_aiutata` opzionale; `argomento_vantaggio` e `argomenti_contro` rimangono

---

### Wave 3 — Pipeline schemas (`src/pipeline/schemas/`)

- **`evaluateSchema.ts`**: **invariato** — l'LLM continua a produrre `valutazione_vantaggio: { peso, motivazione }` e `valutazioni_contro`
- **`actionDeclSchema.ts`**: **invariato** — l'LLM genera ancora `argomento_vantaggio` per le azioni IA
- **`matrixSchema.ts`**: **invariato** — mantiene `argomento_vantaggio`
- **`counterArgSchema.ts`**: **invariato**

---

### Wave 4 — DiceEngine (`src/dice/DiceEngine.ts`)

Aggiunta funzione `rollFudge(seed?: number): { seed: number; risultato: MC }`:

- Usa Mulberry32, mappa `[0,1,2]` → `[-1, 0, 1]`
- Usata dal modal di creazione fazione per il tiro MC iniziale

---

### Wave 5 — Prompt LLM (`src/pipeline/prompts/`)

Tutti e 5 i file vengono aggiornati per:

- Sostituire `f.profilo` con un blocco strutturato: `Concetto: ${f.concetto}`, `Vantaggi: ${f.vantaggi.join(', ')}`, `Svantaggi: ${f.svantaggi.join(', ')}` nella sezione PROFILI FAZIONI
- `argomento_vantaggio` rimane nel payload azione — l'LLM lo valuta come testo libero, con i vantaggi/svantaggi come contesto esplicito

**`evaluatePrompt.ts`** — modifica sostanziale nel *contesto*, non nella struttura di output:

- L'LLM ora vede vantaggi/svantaggi della fazione separati e può pesare l'`argomento_vantaggio` libero rispetto ad essi
- Aggiunta sezione **LINEE GUIDA ARBITRO** nel system prompt (estratte da `docs/bloc.md` §"Linee guida per l'Arbitro"): plausibilità narrativa, rilevanza vantaggio/svantaggio, creatività premiata, gestione incoerenze logiche

---

### Wave 6 — VaultManager + Loaders

- **`VaultManager.ts`**: `action.tipo_azione === 'latente'` → `action.categoria_azione === 'latente' || action.categoria_azione === 'segreta'` (entrambe vanno fuori dal turno corrente — vedi nota sotto)
- **`AggiornaSvantaggiModal.ts`**: **invariato** — continua a patchare `argomenti_contro`
- **`StepCounterArg.ts`**: **invariato** — continua a patchare `argomenti_contro`
- **`AutoGenAzioneIA.ts`**: aggiunto `categoria_azione: 'standard'`; `argomento_vantaggio` rimane nel payload generato

---

### Wave 7 — Modal: Nuova Campagna (`src/ui/modals/NuovaCampagnaModal.ts`)

**Step 1 — Informazioni** (aggiunte):

- `livello_operativo`: text field con esempi (Nazione / Grande org. / Piccola org. / Gruppo)
- `distribuzione_temporale`: dropdown `lineare` | `non_lineare`
- `intervallo_temporale`: campo libero, descrive la tipologia di intervallo temporale e la distribuzione rispetto a `distribuzione_temporale` → verifica che venga poi passato nel contesto LLM dei prompt

**Step 3 — Fazioni** (modifiche per ogni fazione):

- `profilo` → `concetto` (textarea, etichetta aggiornata)
- `vantaggi`: due campi testo separati (Vantaggio 1, Vantaggio 2), salvati come `string[]`
- `svantaggi`: un campo testo (Svantaggio), salvato come `string[]` con un elemento
- **Tasto "Tira MC"**: chiama `rollFudge()`, mostra risultato `-1/0/+1` e lo salva
- **Toggle "Fazione IA"**: imposta `tipo: 'ia'` | `'normale'`

---

### Wave 8 — Modal: Dichiara Azione (`src/ui/modals/DichiaraAzioneModal.ts`)

Ristrutturazione completa:

**`tipo_azione`** (dropdown): `Principale` | `Leader` — solo questi due

**`categoria_azione`** (nuova combobox): `Standard` | `Latente` | `Difesa` | `Aiuto` | `Segreta`

**Sezione condizionale per `aiuto`**:

- `fazione_aiutata`: dropdown (tutte le fazioni tranne sé stessa)
- `argomento_vantaggio`: precompilato con indicazione del vantaggio speso (testo libero, come per le altre categorie)

**Sezione condizionale per `segreta`**:

- Per ora routing identico a `latente` (salva in `-latenti.yaml`, fuori dal pipeline LLM del turno)
- ⚠ **Nota di design**: per le regole BLOC le azioni segrete sono risolte nel turno corrente (nascoste agli altri giocatori ma incluse nel pipeline), mentre le latenti sono attivate in futuro. La distinzione meccanica corretta richiederebbe un file separato nel turno (es. `azione-{id}-segreta.md`) non caricato da `loadActionsForTurn` degli altri giocatori. **Decisione rinviata a v0.7** — per ora si usa lo stesso storage delle latenti, differenziando solo `categoria_azione`.

**Leader availability check**: invariato (roll al submit se `tipo_azione === 'leader'`)

---

### Wave 9 — Nuovo comando: Genera Leader (`src/commands/GeneraLeader.ts`)

Flusso:

1. Carica campagna attiva
2. Modal: seleziona fazione (anche quelle già con leader, per sostituzione)
3. Chiama LLM con system context = premessa + profilo fazione (concetto + vantaggi + svantaggi + obiettivo)
4. Output schema: `{ nome: string; descrizione: string }` (nome del leader + descrizione narrativa breve)
5. Patcha `campagna.yaml` → `fazione.leader = { nome, presente: true }`
6. Patcha il file `fazioni/{id}.md`

**Nuovo prompt** da aggiungere in `src/pipeline/prompts/generaLeaderPrompt.ts`

Registrazione in `main.ts`:

```
id: 'genera-leader'
name: 'BLOC: Genera leader fazione'
```

---

### Wave 10 — Tests (`tests/prompts.test.ts`)

Le fixture attuali contengono campi speculativi errati. Aggiornamento:

- `campagnaFixture.fazioni[0]`: rimuove `profilo`, aggiunge `concetto: string`, `vantaggi: string[]`, `svantaggi: string[]`
- `campagnaFixture.meta`: aggiunti `livello_operativo` e `distribuzione_temporale`
- `actionFixture`: aggiunto `categoria_azione: 'standard'`; rimossi `vantaggi_usati`, `svantaggi_opposti`, `svantaggi_propri_attivati`, `aiuti_alleati` (non esistono); ripristinati `argomento_vantaggio` e `argomenti_contro`
- `matrixFixture.azioni[0]`: mantiene `argomento_vantaggio: string`
- `evalFixture`: corretto da `vantaggi_confermati` ecc. a `valutazione_vantaggio: { peso, motivazione }` e `valutazioni_contro`

---

### Fuori scope (da concepire separatamente)

**Alleanze e Accordi**: l'attuale `RegistraAccordoPrivato` copre solo accordi privati. Il regolamento distingue accordi pubblici, privati, scambio, non-aggressione, militari. Serve una sessione di design dedicata per decidere: come si dichiara un accordo pubblico, come influenza i dadi (come `aiuto` ma persistente?), come si registra il tradimento, se serve un file per accordo o si usa `campagna-privato.yaml` + un log pubblico.

---

### Ordine di esecuzione suggerito

```
Wave 1 → Wave 2 → Wave 3   (schema-first, tutto compila da qui)
Wave 4                      (DiceEngine indipendente)
Wave 5                      (prompt dipendono da types)
Wave 6                      (vault/loaders dipendono da types)
Wave 7 → Wave 8             (modali dipendono da tutto sopra)
Wave 9                      (comando nuovo)
Wave 10                     (test last, dopo che tutto compila)
```

Al termine aggiorna README.md e GUIDA_UTENTE.md