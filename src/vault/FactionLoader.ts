import type { App } from 'obsidian';
import type { FazioneConfig } from '../types';
import { parseFrontmatter } from '../utils/yaml';
import { CAMPAGNE_FOLDER, FAZIONI_FOLDER } from '../constants';

export async function loadFazioni(app: App, slug: string): Promise<FazioneConfig[]> {
  const folder = `${CAMPAGNE_FOLDER}/${slug}/${FAZIONI_FOLDER}`;
  const listing = await app.vault.adapter.list(folder);
  const mdFiles = listing.files.filter(
    (f: string) => f.endsWith('.md') && !f.endsWith('-latenti.yaml'),
  );

  const fazioni: FazioneConfig[] = [];
  for (const filePath of mdFiles) {
    const content = await app.vault.adapter.read(filePath);
    const fm = parseFrontmatter<FazioneConfig>(content);
    if (fm) fazioni.push(fm);
  }
  return fazioni;
}

export async function loadLatentAction(
  app: App,
  slug: string,
  fazioneId: string,
): Promise<unknown | null> {
  const path = `${CAMPAGNE_FOLDER}/${slug}/${FAZIONI_FOLDER}/${fazioneId}-latenti.yaml`;
  const exists = await app.vault.adapter.exists(path);
  if (!exists) return null;
  const { parseYaml } = await import('../utils/yaml');
  const content = await app.vault.adapter.read(path);
  return parseYaml(content);
}

export async function saveLatentAction(
  app: App,
  slug: string,
  fazioneId: string,
  action: unknown,
): Promise<void> {
  const path = `${CAMPAGNE_FOLDER}/${slug}/${FAZIONI_FOLDER}/${fazioneId}-latenti.yaml`;
  const { stringifyYaml } = await import('../utils/yaml');
  await app.vault.adapter.write(path, stringifyYaml(action));
}
