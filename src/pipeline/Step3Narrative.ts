import type { App } from 'obsidian';
import type {
  Campagna,
  EvaluationOutput,
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
} from '../vault/VaultManager';
import { patchCampagnaStato, appendGameStateDelta, patchFazioneMC } from '../vault/CampaignWriter';
import { buildNarrativePrompt } from './prompts/narrativePrompt';
import { narrativeOutputSchema, NarrativeOutputZod } from './schemas/narrativeSchema';
import { LLMValidationError } from '../llm/LLMAdapter';
import { getCompressedDeltas } from '../utils/contextWindow';
import { markdownSection } from '../utils/markdown';
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

  const deltas = getCompressedDeltas(campagna.game_state_delta, campagna.llm.provider);
  const { system, user } = buildNarrativePrompt(campagna, matrice, rolls, evaluations, deltas);

  const response = await adapter.complete({
    system,
    user,
    output_schema: narrativeOutputSchema,
    temperature: campagna.llm.temperature_narrative,
  });

  const validation = NarrativeOutputZod.safeParse(response.parsed);
  if (!validation.success) {
    throw new LLMValidationError(
      `Output conseguenze non valido: ${validation.error.message}`,
      response.content,
    );
  }

  const narrative = validation.data;

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
  const narrativeBody = buildNarrativeBody(narrative, turno_corrente);
  await app.vault.adapter.write(outPath, buildFileWithFrontmatter(narrative, narrativeBody));

  await patchCampagnaStato(app, slug, 'review');

  return narrative;
}

function buildNarrativeBody(narrative: NarrativeOutput, turno: number): string {
  const sections = narrative.conseguenze.map(c => {
    const esito = ESITO_LABELS[c.esito] ?? c.esito;
    return markdownSection(
      `${c.fazione} — ${c.azione}`,
      2,
      `**Esito**: ${esito}\n\n${c.testo_conseguenza}`,
    );
  });

  const eventiSection = narrative.eventi_turno.length > 0
    ? markdownSection('Eventi del Turno', 2, narrative.eventi_turno.map(e => `- ${e}`).join('\n'))
    : '';

  const seedSection = narrative.narrative_seed_prossimo_turno
    ? markdownSection('Aggancio Prossimo Turno', 2, `*${narrative.narrative_seed_prossimo_turno}*`)
    : '';

  return markdownSection(
    `Narrativa — Turno ${turno}`,
    1,
    [sections.join('\n'), eventiSection, seedSection].filter(Boolean).join('\n'),
  );
}
