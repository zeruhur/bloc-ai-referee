import type { App } from 'obsidian';
import type {
  Campagna,
  EvaluationOutput,
  FazioneConfig,
  LLMAdapter,
  MatrixOutput,
  NarrativeOutput,
  RollResult,
} from '../types';
import { loadActionsForTurn } from '../vault/ActionLoader';
import { parseFrontmatter, buildFileWithFrontmatter } from '../utils/yaml';
import {
  matrixFilePath,
  narrativeFilePath,
  fileExists,
  appendToRollsFile,
} from '../vault/VaultManager';
import { patchCampagnaStato, appendGameStateDelta, patchFazioneMC } from '../vault/CampaignWriter';
import { buildNarrativePrompt } from './prompts/narrativePrompt';
import { narrativeOutputSchema, NarrativeOutputZod } from './schemas/narrativeSchema';
import { LLMValidationError } from '../llm/LLMAdapter';
import { getCompressedDeltas, getHistorySummary } from '../utils/contextWindow';
import { markdownSection } from '../utils/markdown';
import { buildFactionNameMap, replaceFactionIds, resolveFactionName } from '../utils/factionUtils';
import { ESITO_LABELS } from '../constants';

export async function runStep3Narrative(
  app: App,
  campagna: Campagna,
  adapter: LLMAdapter,
  rolls: RollResult[],
  onConfirmOverwrite?: () => Promise<boolean>,
): Promise<NarrativeOutput> {
  const { slug, turno_corrente } = campagna.meta;
  const outPath = narrativeFilePath(slug, turno_corrente);

  if (await fileExists(app, outPath)) {
    if (!onConfirmOverwrite || !(await onConfirmOverwrite())) {
      throw new Error('Generazione conseguenze annullata: file esistente.');
    }
  }

  const matrixPath = matrixFilePath(slug, turno_corrente);
  const matrixContent = await app.vault.adapter.read(matrixPath);
  const matrice = parseFrontmatter<MatrixOutput>(matrixContent);
  if (!matrice) {
    throw new Error('Impossibile leggere la matrice.');
  }

  const actions = await loadActionsForTurn(app, slug, turno_corrente);
  const evaluations: EvaluationOutput[] = actions
    .filter(a => a.valutazione)
    .map(a => a.valutazione as EvaluationOutput);

  const isLastTurn = campagna.meta.turno_corrente >= campagna.meta.turno_totale;
  const deltas = getCompressedDeltas(campagna.game_state_delta, campagna.llm.provider);
  const historySummary = getHistorySummary(campagna.game_state_delta, campagna.llm.provider);
  const { system, user } = buildNarrativePrompt(campagna, matrice, rolls, evaluations, deltas, historySummary, null, isLastTurn);

  const response = await adapter.complete({
    system,
    user,
    output_schema: narrativeOutputSchema,
    temperature: campagna.llm.temperature_narrative,
  });

  if (response.tokens_used) {
    await appendToRollsFile(app, slug, turno_corrente,
      `\n> 🔢 Step3Narrative — modello: ${response.model}, token usati: ${response.tokens_used}\n`);
  }

  const validation = NarrativeOutputZod.safeParse(response.parsed);
  if (!validation.success) {
    throw new LLMValidationError(
      `Output conseguenze non valido: ${validation.error.message}`,
      response.content,
    );
  }

  const narrative = validation.data;

  // ---- FIX 2: normalise faction references ----
  // Ensure fazione fields are IDs (LLM may return names if it misread the prompt)
  const nameToId = Object.fromEntries(campagna.fazioni.map(f => [f.nome, f.id]));
  for (const c of narrative.conseguenze) {
    if (!campagna.fazioni.find(f => f.id === c.fazione)) {
      const resolved = nameToId[c.fazione];
      if (resolved) c.fazione = resolved;
    }
  }

  // Replace faction IDs with human-readable names in text-only fields
  const nameMap = buildFactionNameMap(campagna.fazioni);
  for (const c of narrative.conseguenze) {
    c.testo_conseguenza = replaceFactionIds(c.testo_conseguenza, nameMap);
  }
  narrative.eventi_turno = narrative.eventi_turno.map(e => replaceFactionIds(e, nameMap));
  narrative.narrative_seed_prossimo_turno = replaceFactionIds(
    narrative.narrative_seed_prossimo_turno, nameMap,
  );

  // Update MC for each faction
  for (const conseguenza of narrative.conseguenze) {
    if (conseguenza.state_delta.mc_delta !== 0) {
      await patchFazioneMC(app, slug, conseguenza.fazione, conseguenza.state_delta.mc_delta);
    }
  }

  // Append game state delta
  await appendGameStateDelta(app, slug, {
    turno: turno_corrente,
    eventi_chiave: narrative.eventi_turno,
    stato_fazioni: Object.fromEntries(
      narrative.conseguenze.map(c => [
        c.fazione,
        {
          mc: (campagna.fazioni.find(f => f.id === c.fazione)?.mc ?? 0) + c.state_delta.mc_delta,
          territorio: c.state_delta.territorio ?? '',
        },
      ]),
    ),
    narrative_seed: narrative.narrative_seed_prossimo_turno,
  });

  // Write human-readable narrative file
  const narrativeBody = buildNarrativeBody(narrative, turno_corrente, campagna.fazioni, isLastTurn);
  await app.vault.adapter.write(outPath, buildFileWithFrontmatter(narrative, narrativeBody));

  await patchCampagnaStato(app, slug, 'review');

  return narrative;
}

function buildNarrativeBody(
  narrative: NarrativeOutput,
  turno: number,
  fazioni: FazioneConfig[],
  isLastTurn = false,
): string {
  const sections = narrative.conseguenze.map(c => {
    const esito = ESITO_LABELS[c.esito] ?? c.esito;
    const nomeFazione = resolveFactionName(c.fazione, fazioni);
    return markdownSection(
      `${nomeFazione} — ${c.azione}`,
      2,
      `**Esito**: ${esito}\n\n${c.testo_conseguenza}`,
    );
  });

  const eventiSection = narrative.eventi_turno.length > 0
    ? markdownSection('Eventi del Turno', 2, narrative.eventi_turno.map(e => `- ${e}`).join('\n'))
    : '';

  const seedTitle = isLastTurn ? 'Conclusione Campagna' : 'Aggancio Prossimo Turno';
  const seedSection = narrative.narrative_seed_prossimo_turno
    ? markdownSection(seedTitle, 2, `*${narrative.narrative_seed_prossimo_turno}*`)
    : '';

  return markdownSection(
    `Narrativa — Turno ${turno}`,
    1,
    [sections.join('\n'), eventiSection, seedSection].filter(Boolean).join('\n'),
  );
}
