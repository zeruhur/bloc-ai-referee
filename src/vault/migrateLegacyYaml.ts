import type { App } from 'obsidian';
import { parseYaml, buildFileWithFrontmatter } from '../utils/yaml';
import { listCampaigns } from './CampaignLoader';
import {
  CAMPAGNE_FOLDER,
  FAZIONI_FOLDER,
  TURN_FOLDER_PREFIX,
} from '../constants';

async function migrateFile(app: App, oldPath: string, newPath: string): Promise<void> {
  if (!(await app.vault.adapter.exists(oldPath))) return;
  if (await app.vault.adapter.exists(newPath)) {
    await app.vault.adapter.remove(oldPath);
    return;
  }
  const content = await app.vault.adapter.read(oldPath);
  const newContent = content.startsWith('---\n')
    ? content
    : buildFileWithFrontmatter(parseYaml<unknown>(content) ?? {}, '');
  await app.vault.adapter.write(newPath, newContent);
  await app.vault.adapter.remove(oldPath);
}

export async function migrateVaultYaml(app: App): Promise<void> {
  let slugs: string[];
  try {
    slugs = await listCampaigns(app);
  } catch {
    return;
  }

  for (const slug of slugs) {
    const base = `${CAMPAGNE_FOLDER}/${slug}`;

    await migrateFile(app, `${base}/campagna.yaml`, `${base}/campagna.md`);
    await migrateFile(app, `${base}/campagna-privato.yaml`, `${base}/campagna-privato.md`);
    await migrateFile(
      app,
      `${base}/campagna-accordi-pubblici.yaml`,
      `${base}/campagna-accordi-pubblici.md`,
    );

    let listing: { folders: string[]; files: string[] };
    try {
      listing = await app.vault.adapter.list(base);
    } catch {
      continue;
    }

    for (const folder of listing.folders) {
      const folderName = folder.replace(`${base}/`, '');
      if (!folderName.startsWith(TURN_FOLDER_PREFIX)) continue;
      await migrateFile(
        app,
        `${folder}/run-state.yaml`,
        `${folder}/run-state.md`,
      );
    }

    const fazioniFolder = `${base}/${FAZIONI_FOLDER}`;
    let fazioniListing: { folders: string[]; files: string[] };
    try {
      fazioniListing = await app.vault.adapter.list(fazioniFolder);
    } catch {
      continue;
    }

    for (const filePath of fazioniListing.files) {
      if (!filePath.endsWith('-latenti.yaml')) continue;
      const newPath = filePath.replace('-latenti.yaml', '-latenti.md');
      await migrateFile(app, filePath, newPath);
    }
  }
}
