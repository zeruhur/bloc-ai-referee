import type { App, TFile } from 'obsidian';
import type { AzioneDeclaration, Campagna } from '../types';
import {
  buildFileWithFrontmatter,
  parseFrontmatter,
  patchFrontmatter,
  stringifyYaml,
} from '../utils/yaml';
import { turnFolderName } from '../utils/markdown';
import {
  CAMPAGNE_FOLDER,
  FAZIONI_FOLDER,
  CAMPAGNA_FILE,
  ACTION_FILE_PREFIX,
  MATRIX_FILE,
  ROLLS_FILE,
  NARRATIVE_FILE,
} from '../constants';

export function campaignPath(slug: string): string {
  return `${CAMPAGNE_FOLDER}/${slug}`;
}

export function turnPath(slug: string, turno: number): string {
  return `${campaignPath(slug)}/${turnFolderName(turno)}`;
}

export function actionFilePath(slug: string, turno: number, fazioneId: string): string {
  return `${turnPath(slug, turno)}/${ACTION_FILE_PREFIX}${fazioneId}.md`;
}

export function matrixFilePath(slug: string, turno: number): string {
  return `${turnPath(slug, turno)}/${MATRIX_FILE}`;
}

export function rollsFilePath(slug: string, turno: number): string {
  return `${turnPath(slug, turno)}/${ROLLS_FILE}`;
}

export function narrativeFilePath(slug: string, turno: number): string {
  return `${turnPath(slug, turno)}/${NARRATIVE_FILE}`;
}

export async function ensureFolder(app: App, path: string): Promise<void> {
  const exists = await app.vault.adapter.exists(path);
  if (!exists) {
    await app.vault.createFolder(path);
  }
}

export async function ensureTurnFolder(app: App, slug: string, turno: number): Promise<void> {
  await ensureFolder(app, campaignPath(slug));
  await ensureFolder(app, turnPath(slug, turno));
}

export async function writeActionFile(
  app: App,
  slug: string,
  turno: number,
  action: AzioneDeclaration,
): Promise<void> {
  await ensureTurnFolder(app, slug, turno);
  const path = actionFilePath(slug, turno, action.fazione);
  const { dettaglio_narrativo, ...llmFields } = action;
  const frontmatterData = dettaglio_narrativo
    ? { ...llmFields, dettaglio_narrativo }
    : llmFields;
  const content = buildFileWithFrontmatter(frontmatterData, '');
  await app.vault.adapter.write(path, content);
}

export async function appendToRollsFile(
  app: App,
  slug: string,
  turno: number,
  content: string,
): Promise<void> {
  await ensureTurnFolder(app, slug, turno);
  const path = rollsFilePath(slug, turno);
  const exists = await app.vault.adapter.exists(path);
  if (exists) {
    const current = await app.vault.adapter.read(path);
    await app.vault.adapter.write(path, current + '\n' + content);
  } else {
    await app.vault.adapter.write(path, content);
  }
}

export async function patchActionFrontmatter<T extends object>(
  app: App,
  filePath: string,
  patch: Partial<T>,
): Promise<void> {
  const file = app.vault.getAbstractFileByPath(filePath) as TFile | null;
  if (file) {
    await app.vault.process(file, (content: string) => patchFrontmatter(content, patch));
  } else {
    const content = await app.vault.adapter.read(filePath);
    const patched = patchFrontmatter(content, patch);
    await app.vault.adapter.write(filePath, patched);
  }
}

export async function writeCampaignFile(
  app: App,
  slug: string,
  campagna: Campagna,
): Promise<void> {
  const folder = campaignPath(slug);
  await ensureFolder(app, folder);
  const path = `${folder}/${CAMPAGNA_FILE}`;
  await app.vault.adapter.write(path, stringifyYaml(campagna));
}

export async function writeFactionFile(
  app: App,
  slug: string,
  fazioneId: string,
  data: unknown,
  body: string,
): Promise<void> {
  const folder = `${campaignPath(slug)}/${FAZIONI_FOLDER}`;
  await ensureFolder(app, folder);
  const path = `${folder}/${fazioneId}.md`;
  await app.vault.adapter.write(path, buildFileWithFrontmatter(data, body));
}

export async function clearTurnFiles(
  app: App,
  slug: string,
  turno: number,
): Promise<void> {
  await ensureTurnFolder(app, slug, turno);
}

export async function fileExists(app: App, path: string): Promise<boolean> {
  return app.vault.adapter.exists(path);
}
