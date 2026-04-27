### Obiettivi

1. Eliminare il routing implicito a `gemini-2.5-pro` causato da `responseSchema`
2. Ridurre il consumo di token per turno

***

## Fix 1 — Rimuovere `responseSchema` dal body Gemini

**File:** `src/llm/GeminiAdapter.ts`

**Problema:** Il campo `responseSchema` nel `generationConfig` triggera il routing automatico di Google AI Studio al modello più capace, ignorando il modello specificato nell'URL.

**Azione:** Rimuovere `responseSchema` dal body della richiesta. Mantenere `responseMimeType: 'application/json'` per garantire output JSON, ma spostare tutta la validazione strutturale su Zod lato client (già presente nella pipeline).

```typescript
// PRIMA
generationConfig: {
  temperature: prompt.temperature,
  responseMimeType: 'application/json',
  responseSchema: prompt.output_schema,
},

// DOPO
generationConfig: {
  temperature: prompt.temperature,
  responseMimeType: 'application/json',
  // responseSchema rimosso deliberatamente: causa routing a gemini-2.5-pro
},
```

Rimuovere di conseguenza il campo `output_schema` dal body passato a `GeminiAdapter.complete()` — gli altri adapter (OpenAI, Anthropic, Ollama, OpenRouter) non usano `output_schema` nel body HTTP, quindi nessuna modifica necessaria per loro.

Aggiungere un log diagnostico per verificare il modello effettivamente usato:

```typescript
return {
  content: rawText,
  parsed,
  model: res.json?.modelVersion ?? this.model, // usa il modello reale se disponibile
  tokens_used: res.json?.usageMetadata?.totalTokenCount,
};
```


***

## Fix 2 — Ridurre il context window storico

**File:** `src/constants.ts`

**Problema:** `MAX_GAME_STATE_DELTAS_FULL = 10` porta dopo pochi turni a includere YAML molto pesante nel prompt.

**Azione:** Abbassare a 5 (allineato a Ollama), con commento esplicativo:

```typescript
export const MAX_GAME_STATE_DELTAS_FULL = 5;   // ridotto da 10 per contenere i token
export const MAX_GAME_STATE_DELTAS_OLLAMA = 3;  // ridotto da 5
```


***

## Fix 3 — Non ripetere i profili fazione in ogni step

**File:** `src/pipeline/prompts/matrixPrompt.ts`, `evaluatePrompt.ts`, `narrativePrompt.ts`, `counterArgPrompt.ts`

**Problema:** I profili completi di tutte le fazioni (`concetto`, `vantaggi`, `svantaggi`) vengono serializzati nel `user` prompt di ogni step, anche quando il contenuto non è pertinente.

**Azione per ciascun prompt:**

- **`matrixPrompt.ts`** — mantieni i profili fazione (necessari per analizzare i conflitti), ma comprimi il formato: invece di ripetere vantaggi/svantaggi per intero, usa solo `id`, `nome`, `concetto` (una riga per fazione). Vantaggi e svantaggi sono già nelle dichiarazioni di azione.

```typescript
// PRIMA
campagna.fazioni.map(f =>
  `- ${f.id} (${f.nome}):\n  Concetto: ${f.concetto}\n  Vantaggi: ${f.vantaggi.join(', ')}\n  Svantaggi: ${f.svantaggi.join(', ')}`
).join('\n')

// DOPO
campagna.fazioni.map(f =>
  `- ${f.id} (${f.nome}): ${f.concetto}`
).join('\n')
```

- **`evaluatePrompt.ts`** — rimuovi i profili fazione dal prompt se lo step riceve già la matrice dal turno corrente (che li implica). Passa solo `id` e `nome` come riferimento.
- **`narrativePrompt.ts`** — i profili fazione non servono alla narrativa; rimuovili del tutto o sostituisci con solo `id + nome`.
- **`counterArgPrompt.ts`** — verifica se i profili sono usati; se lo step riceve già gli argomenti di vantaggio dalla matrice, i profili sono ridondanti.

***

## Fix 4 — Non ripetere la `premessa` integralmente in ogni step

**File:** `src/pipeline/prompts/evaluatePrompt.ts`, `narrativePrompt.ts`, `counterArgPrompt.ts`

**Problema:** `campagna.premessa` è un testo fisso potenzialmente lungo che viene iniettato nel `system` prompt di tutti e 4 gli step.

**Azione:** Creare una funzione `buildSystemPreamble(campagna, includeFullPremessa: boolean)` in un file condiviso `src/pipeline/prompts/shared.ts`:

```typescript
export function buildSystemPreamble(campagna: Campagna, full = false): string {
  const premessa = full
    ? campagna.premessa
    : campagna.premessa.split('\n').slice(0, 5).join('\n') + '\n[...]';
  return `Sei l'arbitro della campagna "${campagna.meta.titolo}".\n\nPREMESSA:\n${premessa}`;
}
```

- **Step1Matrix** → `full = true` (ha bisogno del contesto completo)
- **Step2Evaluate, Step3Narrative, StepCounterArg** → `full = false` (conoscono già il contesto dal turno)

***

## Fix 5 — Aggiungere logging token per step

**File:** `src/pipeline/Step1Matrix.ts`, `Step2Evaluate.ts`, `Step3Narrative.ts`, `StepCounterArg.ts`

**Problema:** Attualmente non c'è visibilità su quanti token consuma ogni singolo step, rendendo difficile diagnosticare regressioni future.

**Azione:** Dopo ogni `adapter.complete()`, loggare nel file `tiri.md` (già usato per log diagnostici) il conteggio token:

```typescript
if (response.tokens_used) {
  await appendToRollsFile(
    app, slug, turno_corrente,
    `\n> 🔢 Step1Matrix — modello: ${response.model}, token usati: ${response.tokens_used}\n`
  );
}
```


***

## Ordine di esecuzione consigliato

1. **Fix 1** (GeminiAdapter) — risolve subito il problema di fatturazione, zero rischi di regressione
2. **Fix 5** (logging) — da fare subito dopo Fix 1 per avere dati di baseline
3. **Fix 2** (costanti) — impatto immediato, verificare con i test esistenti in `tests/`
4. **Fix 3** (profili fazione nei prompt) — testare che la qualità dell'output LLM non degradi
5. **Fix 4** (premessa compressa) — il più delicato, da validare con una campagna reale

***

## Note per Claude Code

- I test esistenti sono in `tests/` con Vitest — eseguire `npm test` dopo ogni fix
- Il `MockLLMAdapter` in `LLMAdapter.ts` non usa `output_schema`, quindi i test non sono impattati dal Fix 1
- Per Fix 3 e Fix 4, valutare se aggiornare i test di snapshot dei prompt se esistenti
- Non modificare l'interfaccia `LLMPrompt` in `types.ts` per il Fix 1: `output_schema` può restare come campo opzionale usato dagli altri adapter in futuro

