import type { App } from 'obsidian';
import type { FazioneConfig, MatrixEntry, MatrixOutput } from '../types';
import { buildFileWithFrontmatter, parseFrontmatter } from '../utils/yaml';
import { markdownTable, markdownSection } from '../utils/markdown';
import { matrixFilePath, arbiterMatrixFilePath } from './VaultManager';
import { resolveFactionName } from '../utils/factionUtils';
import { ESITO_LABELS } from '../constants';

export function buildMatrixFileContent(
  entries: MatrixEntry[],
  turno: number,
  isArbiter: boolean,
  fazioni: FazioneConfig[] = [],
): string {
  const hasControArg = entries.some(e => e.contro_argomentazione);
  const hasValutazione = entries.some(e => e.valutazione);
  const hasEsito = entries.some(e => e.esito_tiro);

  const headers = ['Fazione', 'Risultato', 'Azione', 'Argomento vantaggio', 'Conflitti'];
  if (hasControArg) headers.push('Contro-argomentazione');
  if (hasValutazione) headers.push('Pool dadi', 'Motivazione');
  if (hasEsito) headers.push('Tiro', 'Esito');

  const rows = entries.map(a => {
    const row = [
      resolveFactionName(a.fazione, fazioni),
      a.risultato,
      a.azione,
      a.argomento_favorevole || '—',
      a.conflitti_con.map(id => resolveFactionName(id, fazioni)).join(', ') || '—',
    ];
    if (hasControArg) row.push(a.contro_argomentazione || '—');
    if (hasValutazione) {
      if (a.valutazione) {
        const { positivi, negativi, netto, modalita } = a.valutazione.pool;
        row.push(`+${positivi}/-${negativi} (netto ${netto > 0 ? '+' : ''}${netto}, ${modalita})`);
        row.push(a.valutazione.motivazione);
      } else {
        row.push('—', '—');
      }
    }
    if (hasEsito) {
      if (a.esito_tiro) {
        row.push(`[${a.esito_tiro.dadi.join(', ')}] → ${a.esito_tiro.risultato}`);
        row.push(ESITO_LABELS[a.esito_tiro.esito]);
      } else {
        row.push('—', '—');
      }
    }
    return row;
  });

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
