import type { App } from 'obsidian';
import type { Campagna, LLMAdapter, MatrixOutput } from '../types';
import { loadActionsForTurn } from '../vault/ActionLoader';
import { fileExists, matrixFilePath } from '../vault/VaultManager';
import { patchCampagnaStato } from '../vault/CampaignWriter';
import { buildMatrixPrompt } from './prompts/matrixPrompt';
import { matrixOutputSchema, MatrixOutputZod } from './schemas/matrixSchema';
import { LLMValidationError } from '../llm/LLMAdapter';
import { getCompressedDeltas } from '../utils/contextWindow';
import { markdownTable, markdownSection } from '../utils/markdown';
import { buildFileWithFrontmatter } from '../utils/yaml';

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

  const deltas = getCompressedDeltas(campagna.game_state_delta, campagna.llm.provider);
  const { system, user } = buildMatrixPrompt(campagna, actions, deltas);

  const response = await adapter.complete({
    system,
    user,
    output_schema: matrixOutputSchema,
    temperature: campagna.llm.temperature_mechanical,
  });

  const validation = MatrixOutputZod.safeParse(response.parsed);
  if (!validation.success) {
    throw new LLMValidationError(
      `Output matrice non valido: ${validation.error.message}`,
      response.content,
    );
  }

  const matrix = validation.data;
  const fileContent = buildMatrixFileContent(matrix, campagna.meta.turno_corrente);
  await app.vault.adapter.write(outPath, fileContent);

  await patchCampagnaStato(app, slug, 'matrice_generata');

  return matrix;
}

function buildMatrixFileContent(matrix: MatrixOutput, turno: number): string {
  const headers = ['Fazione', 'Azione', 'Metodo', 'Vantaggi', 'Conflitti'];
  const rows = matrix.azioni.map(a => [
    a.fazione,
    a.azione,
    a.metodo,
    a.vantaggi.join(', ') || '—',
    a.conflitti_con.join(', ') || '—',
  ]);

  const table = markdownTable(headers, rows);
  const body = markdownSection(`Matrice Azioni — Turno ${turno}`, 1, table);

  return buildFileWithFrontmatter(matrix, body);
}
