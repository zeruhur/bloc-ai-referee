import type { App, TFile } from 'obsidian';
import type { Accordo, AccordiPubblici, AzioneDeclaration, Campagna, StatoAccordo } from '../types';
import {
  buildFileWithFrontmatter,
  parseFrontmatter,
  patchFrontmatter,
  parseYaml,
  stringifyYaml,
} from '../utils/yaml';
import { turnFolderName } from '../utils/markdown';
import {
  CAMPAGNE_FOLDER,
  FAZIONI_FOLDER,
  CAMPAGNA_FILE,
  ACTION_FILE_PREFIX,
  SECRET_ACTION_SUFFIX,
  MATRIX_FILE,
  ARBITER_MATRIX_FILE,
  ROLLS_FILE,
  NARRATIVE_FILE,
  CAMPAGNA_ACCORDI_PUBBLICI_FILE,
} from '../constants';
import { saveLatentAction } from './FactionLoader';
import { AccordiPubbliciSchema } from './schemas';

export function campaignPath(slug: string): string {
  return `${CAMPAGNE_FOLDER}/${slug}`;
}

export function turnPath(slug: string, turno: number): string {
  return `${campaignPath(slug)}/${turnFolderName(turno)}`;
}

export function actionFilePath(slug: string, turno: number, fazioneId: string): string {
  return `${turnPath(slug, turno)}/${ACTION_FILE_PREFIX}${fazioneId}.md`;
}

export function secretActionFilePath(slug: string, turno: number, fazioneId: string): string {
  return `${turnPath(slug, turno)}/${ACTION_FILE_PREFIX}${fazioneId}${SECRET_ACTION_SUFFIX}.md`;
}

export function matrixFilePath(slug: string, turno: number): string {
  return `${turnPath(slug, turno)}/${MATRIX_FILE}`;
}

export function arbiterMatrixFilePath(slug: string, turno: number): string {
  return `${turnPath(slug, turno)}/${ARBITER_MATRIX_FILE}`;
}

export function rollsFilePath(slug: string, turno: number): string {
  return `${turnPath(slug, turno)}/${ROLLS_FILE}`;
}

export function narrativeFilePath(slug: string, turno: number): string {
  return `${turnPath(slug, turno)}/${NARRATIVE_FILE}`;
}

export function accordiPubbliciPath(slug: string): string {
  return `${campaignPath(slug)}/${CAMPAGNA_ACCORDI_PUBBLICI_FILE}`;
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
  if (action.categoria_azione === 'latente') {
    await saveLatentAction(app, slug, action.fazione, action);
    return;
  }
  await ensureTurnFolder(app, slug, turno);
  const isSecret = action.categoria_azione === 'segreta';
  const path = isSecret
    ? secretActionFilePath(slug, turno, action.fazione)
    : actionFilePath(slug, turno, action.fazione);
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

// ---- Accordi pubblici ----

export async function loadAccordiPubblici(app: App, slug: string): Promise<AccordiPubblici> {
  const path = accordiPubbliciPath(slug);
  const exists = await app.vault.adapter.exists(path);
  if (!exists) return { accordi: [] };
  const content = await app.vault.adapter.read(path);
  const raw = parseYaml<unknown>(content);
  return AccordiPubbliciSchema.parse(raw ?? { accordi: [] });
}

export async function saveAccordoPubblico(app: App, slug: string, accordo: Accordo): Promise<void> {
  const current = await loadAccordiPubblici(app, slug);
  current.accordi.push(accordo);
  await app.vault.adapter.write(accordiPubbliciPath(slug), stringifyYaml(current));
}

export async function patchAccordoStato(
  app: App,
  slug: string,
  id: string,
  stato: StatoAccordo,
  violazione?: { turno: number; fazione: string },
): Promise<void> {
  const pubblici = await loadAccordiPubblici(app, slug);
  const pubIdx = pubblici.accordi.findIndex(a => a.id === id);
  if (pubIdx >= 0) {
    pubblici.accordi[pubIdx].stato = stato;
    if (violazione) pubblici.accordi[pubIdx].violazioni.push(violazione);
    await app.vault.adapter.write(accordiPubbliciPath(slug), stringifyYaml(pubblici));
    return;
  }

  // Fall back to private agreements
  const { loadCampagnaPrivata, saveAccordiPrivati } = await import('./CampagnaPrivataManager');
  const privata = await loadCampagnaPrivata(app, slug);
  const privIdx = privata.accordi.findIndex(a => a.id === id);
  if (privIdx >= 0) {
    privata.accordi[privIdx].stato = stato;
    if (violazione) privata.accordi[privIdx].violazioni.push(violazione);
    await saveAccordiPrivati(app, slug, privata);
  }
}
