# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Watch mode build (esbuild, outputs main.js)
npm run build         # Type-check + production build
npm test              # Run vitest tests (single run)
npm run test:watch    # Vitest in watch mode
npm run lint          # ESLint on src/
```

Run a single test file: `npx vitest run tests/dice.test.ts`

## Architecture

**bloc-ai-referee** is an Obsidian plugin that orchestrates a multi-step LLM pipeline for refereeing BLOC-system Matrix Games campaigns. All game state lives in the Obsidian vault — no external database.

### State Machine Pipeline

Each campaign turn progresses through fixed states with valid transitions defined in `src/constants.ts:STATO_TRANSITIONS`:

```
setup → raccolta → matrice_generata → contro_args → valutazione → tiri → review → chiuso
```

Each state maps to a command:
- **Step 1** (`GeneraMatrice`) — LLM builds a conflict matrix from declared actions
- **Step 2** (`ValutaAzioni`) — LLM evaluates each action per-faction, outputs dice pools
- **Step 3** (`GeneraConseguenze`) — LLM narrates outcomes after deterministic rolls
- **Step 4** (`EseguiTiri`) — Deterministic dice (Mulberry32 PRNG, `src/dice/DiceEngine.ts`) — randomness is never delegated to the LLM

### Vault Layout

```
/campagne/{slug}/
  campagna.yaml              # Single source of truth (state, config, faction stats)
  campagna-privato.yaml      # Fog of war (not sent to LLM)
  /fazioni/{slug}.md         # Faction sheets (vantaggi/svantaggi blocks)
  /turno-NN/
    azione-{fazione}.md      # Player-declared actions
    matrice.md               # Step 1 output
    tiri.md                  # Step 4 deterministic roll log
    narrativa.md             # Step 3 narrative
```

### Key Design Invariants

- **Vault-first**: YAML frontmatter + Markdown body gives dual output (machine context + human-readable). Never store authoritative state outside vault files.
- **Seeded PRNG only**: `DiceEngine.tiraDadi(pool, seed)` uses Mulberry32. The seed comes from the campaign file, not the LLM.
- **Zod validation on every LLM response**: All pipeline steps validate output against schemas in `src/vault/schemas.ts` before writing to disk.
- **Context window budgeting**: `campagna.yaml` tracks `game_state_delta` history; full providers get last 10 deltas, Ollama gets last 5 (see `src/constants.ts`). When older deltas are dropped, `getHistorySummary()` (`src/utils/contextWindow.ts`) concatenates their `narrative_seed` strings and injects them as "STORIA PREGRESSA" in every prompt.
- **Latent actions fog-of-war**: `tipo_azione: latente` routes to `fazioni/{slug}-latenti.yaml` (via `writeActionFile` in `VaultManager.ts`), keeping them out of `loadActionsForTurn` and all LLM prompts. Use `BLOC: Attiva azione latente` to promote a latent action into the current turn.

### LLM Provider Layer

`src/llm/` contains one adapter per provider (`GeminiAdapter`, `AnthropicAdapter`, `OpenAIAdapter`, `OpenRouterAdapter`, `OllamaAdapter`), all implementing the `LLMAdapter` interface. Each uses structured output (tool_use / response_schema / `format: json`) — never free-text parsing.

### Prompt Construction

`src/pipeline/prompts/` has one file per step. Prompts receive typed context objects; the system message carries campaign state, the user message carries the action-specific payload. Tests in `tests/prompts.test.ts` verify prompt structure.

### Testing

Obsidian API is mocked at `tests/__mocks__/obsidian.ts` so tests run in Node without an Obsidian instance. The `vitest.config.ts` alias maps `obsidian` imports to this mock.

### Plugin Entry Point

`src/main.ts` extends Obsidian's `Plugin`, registers all commands, and wires up the settings tab. Commands call into `src/commands/`, which orchestrate vault reads, pipeline steps, and vault writes.

### Release

GitHub Actions (`.github/workflows/release.yml`) triggers on `v*.*.*` tags, builds, and publishes `main.js` + `manifest.json` as a GitHub Release for BRAT installation.

### Vault Layout — additional files

- `oracolo.md` — per-campaign oracle log, appended by `BLOC: Interroga oracolo`
- `campagna-privato.yaml` — fog-of-war data (secret agreements, private notes); managed by `src/vault/CampagnaPrivataManager.ts`; never loaded by `CampaignLoader` or sent to the LLM
