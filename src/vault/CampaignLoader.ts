import type { App } from 'obsidian';
import type { Campagna } from '../types';
import { parseYaml } from '../utils/yaml';
import { CampagnaSchema } from './schemas';
import {
  CAMPAGNE_FOLDER,
  CAMPAGNA_FILE,
} from '../constants';

// NOTE: campagna-privato.yaml is intentionally excluded and must never be loaded here.
// It contains fog-of-war data (secret agreements, hidden notes) that must never reach the LLM.
export async function loadCampagna(app: App, slug: string): Promise<Campagna> {
  const path = `${CAMPAGNE_FOLDER}/${slug}/${CAMPAGNA_FILE}`;
  const content = await app.vault.adapter.read(path);
  const raw = parseYaml<unknown>(content);
  return CampagnaSchema.parse(raw);
}

export async function listCampaigns(app: App): Promise<string[]> {
  const base = app.vault.adapter;
  const result = await base.list(CAMPAGNE_FOLDER);
  return result.folders.map((f: string) => f.replace(`${CAMPAGNE_FOLDER}/`, ''));
}

export async function campaignExists(app: App, slug: string): Promise<boolean> {
  const path = `${CAMPAGNE_FOLDER}/${slug}/${CAMPAGNA_FILE}`;
  return app.vault.adapter.exists(path);
}
