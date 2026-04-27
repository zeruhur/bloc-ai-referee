import type { App } from 'obsidian';
import type { FazioneConfig, MatrixEntry, MatrixOutput } from '../types';
import { buildFileWithFrontmatter, parseFrontmatter } from '../utils/yaml';
import { markdownTable, markdownSection } from '../utils/markdown';
import { matrixFilePath, arbiterMatrixFilePath } from './VaultManager';
import { resolveFactionName } from '../utils/factionUtils';

export function buildMatrixFileContent(
  entries: MatrixEntry[],
  turno: number,
  isArbiter: boolean,
  fazioni: FazioneConfig[] = [],
): string {
  const headers = ['Fazione', 'Azione', 'Metodo', 'Argomento vantaggio', 'Conflitti'];
  const rows = entries.map(a => [
    resolveFactionName(a.fazione, fazioni),
    a.azione,
    a.metodo,
    a.argomento_vantaggio || '—',
    a.conflitti_con.map(id => resolveFactionName(id, fazioni)).join(', ') || '—',
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

export async function readMatrixEntries(
  app: App,
  slug: string,
  turno: number,
): Promise<{ publicEntries: MatrixEntry[]; allEntries: MatrixEntry[] }> {
  const publicPath = matrixFilePath(slug, turno);
  const arbiterPath = arbiterMatrixFilePath(slug, turno);

  const publicContent = await app.vault.adapter.read(publicPath);
  const publicData = parseFrontmatter<MatrixOutput>(publicContent);
  const publicEntries: MatrixEntry[] = publicData?.azioni ?? [];

  const arbiterExists = await app.vault.adapter.exists(arbiterPath);
  if (arbiterExists) {
    const arbiterContent = await app.vault.adapter.read(arbiterPath);
    const arbiterData = parseFrontmatter<MatrixOutput>(arbiterContent);
    return { publicEntries, allEntries: arbiterData?.azioni ?? publicEntries };
  }

  return { publicEntries, allEntries: publicEntries };
}

export function mergeMatrixEntries(
  existing: MatrixEntry[],
  updates: Partial<MatrixEntry>[],
): MatrixEntry[] {
  return existing.map(entry => {
    const update = updates.find(u => u.fazione === entry.fazione);
    return update ? { ...entry, ...update } : entry;
  });
}

export async function writeMatrixFiles(
  app: App,
  slug: string,
  turno: number,
  publicEntries: MatrixEntry[],
  allEntries: MatrixEntry[],
  fazioni: FazioneConfig[] = [],
): Promise<void> {
  const publicContent = buildMatrixFileContent(publicEntries, turno, false, fazioni);
  await app.vault.adapter.write(matrixFilePath(slug, turno), publicContent);

  const arbiterPath = arbiterMatrixFilePath(slug, turno);
  const arbiterExists = await app.vault.adapter.exists(arbiterPath);
  const hasSecretEntries = allEntries.length !== publicEntries.length ||
    allEntries.some(e => !publicEntries.find(p => p.fazione === e.fazione));
  if (arbiterExists || hasSecretEntries) {
    const arbiterContent = buildMatrixFileContent(allEntries, turno, true, fazioni);
    await app.vault.adapter.write(arbiterPath, arbiterContent);
  }
}
