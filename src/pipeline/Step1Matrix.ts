import type { App } from 'obsidian';
import type { Campagna, LLMAdapter, MatrixEntry, MatrixOutput } from '../types';
import { loadActionsForTurn } from '../vault/ActionLoader';
import {
  fileExists,
  matrixFilePath,
  arbiterMatrixFilePath,
  appendToRollsFile,
  loadAccordiPubblici,
} from '../vault/VaultManager';
import { loadCampagnaPrivata } from '../vault/CampagnaPrivataManager';
import { patchCampagnaStato } from '../vault/CampaignWriter';
import { buildMatrixPrompt } from './prompts/matrixPrompt';
import { buildAccordiContext } from './accordiContext';
import { matrixOutputSchema, MatrixOutputZod } from './schemas/matrixSchema';
import { LLMValidationError } from '../llm/LLMAdapter';
import { getCompressedDeltas, getHistorySummary } from '../utils/contextWindow';
import { markdownTable, markdownSection } from '../utils/markdown';
import { buildFileWithFrontmatter } from '../utils/yaml';
import { resolveSpionaggio } from '../dice/DiceEngine';

export async function runStep1Matrix(
  app: App,
  campagna: Campagna,
  adapter: LLMAdapter,
  onConfirmOverwrite?: () => Promise<boolean>,
): Promise<MatrixOutput> {
  const { slug, turno_corrente } = campagna.meta;
  const outPath = matrixFilePath(slug, turno_corrente);

  if (await fileExists(app, outPath)) {
    if (!onConfirmOverwrite || !(await onConfirmOverwrite())) {
      throw new Error('Generazione matrice annullata: file esistente.');
    }
  }

  const actions = await loadActionsForTurn(app, slug, turno_corrente);
  if (actions.length === 0) {
    throw new Error('Nessuna dichiarazione azione trovata per questo turno.');
  }

  // ---- Spionaggio pre-pipeline ----
  const spyActions = actions.filter(a => a.categoria_azione === 'spionaggio');
  const secretActions = actions.filter(a => a.categoria_azione === 'segreta');
  const spyDiscoveries: Record<string, boolean> = {};

  if (spyActions.length > 0) {
    const spyLogLines: string[] = ['## Tiri Spionaggio (pre-pipeline)\n'];
    const baseSeed = Date.now();
    for (let i = 0; i < spyActions.length; i++) {
      const spia = spyActions[i];
      if (!spia.target_fazione) continue;
      const hasTarget = secretActions.some(a => a.fazione === spia.target_fazione);
      if (!hasTarget) continue;

      const result = resolveSpionaggio(spia, campagna, baseSeed + i);
      const modStr = result.modificatore >= 0 ? `+${result.modificatore}` : String(result.modificatore);
      const esito = result.scoperta ? 'SCOPERTA' : 'Fallimento';
      spyLogLines.push(
        `- ${spia.fazione} spia ${spia.target_fazione}: dado ${result.dado} ${modStr} → ${result.risultato} — **${esito}**`,
      );

      if (result.scoperta) {
        spyDiscoveries[spia.target_fazione] = true;
      }
    }
    await appendToRollsFile(app, slug, turno_corrente, spyLogLines.join('\n') + '\n');
  }

  // ---- Accordi context ----
  const [accordiPubblici, accordiPrivati] = await Promise.all([
    loadAccordiPubblici(app, slug),
    loadCampagnaPrivata(app, slug),
  ]);
  const accordiContext = buildAccordiContext(accordiPubblici, accordiPrivati);

  // ---- LLM call ----
  const deltas = getCompressedDeltas(campagna.game_state_delta, campagna.llm.provider);
  const historySummary = getHistorySummary(campagna.game_state_delta, campagna.llm.provider);
  const { system, user } = buildMatrixPrompt(
    campagna,
    actions,
    deltas,
    historySummary,
    accordiContext,
    spyDiscoveries,
  );

  const response = await adapter.complete({
    system,
    user,
    output_schema: matrixOutputSchema,
    temperature: campagna.llm.temperature_mechanical,
  });

  if (response.tokens_used) {
    await appendToRollsFile(app, slug, turno_corrente,
      `\n> 🔢 Step1Matrix — modello: ${response.model}, token usati: ${response.tokens_used}\n`);
  }

  const validation = MatrixOutputZod.safeParse(response.parsed);
  if (!validation.success) {
    throw new LLMValidationError(
      `Output matrice non valido: ${validation.error.message}`,
      response.content,
    );
  }

  const matrix = validation.data;

  // ---- Write matrice.md (public) ----
  const publicContent = buildMatrixFileContent(matrix.azioni, turno_corrente, false);
  await app.vault.adapter.write(outPath, publicContent);

  // ---- Write matrice-arbitro.md (full, with secrets) ----
  if (matrix.matrice_arbitro && matrix.matrice_arbitro.length > 0) {
    const arbiterContent = buildMatrixFileContent(matrix.matrice_arbitro, turno_corrente, true);
    await app.vault.adapter.write(arbiterMatrixFilePath(slug, turno_corrente), arbiterContent);
  }

  await patchCampagnaStato(app, slug, 'matrice_generata');

  return matrix;
}

function buildMatrixFileContent(entries: MatrixEntry[], turno: number, isArbiter: boolean): string {
  const headers = ['Fazione', 'Azione', 'Metodo', 'Argomento vantaggio', 'Conflitti'];
  const rows = entries.map(a => [
    a.fazione,
    a.azione,
    a.metodo,
    a.argomento_vantaggio || '—',
    a.conflitti_con.join(', ') || '—',
  ]);

  const table = markdownTable(headers, rows);
  const title = isArbiter
    ? `Matrice Arbitro — Turno ${turno}`
    : `Matrice Azioni — Turno ${turno}`;
  const body = markdownSection(title, 1, table);
  const frontmatter: Record<string, unknown> = { azioni: entries };
  if (isArbiter) frontmatter._arbitro = true;

  return buildFileWithFrontmatter(frontmatter, body);
}
