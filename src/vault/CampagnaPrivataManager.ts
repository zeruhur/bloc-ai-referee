import { z } from 'zod';
import type { App } from 'obsidian';
import type { Accordo, CampagnaPrivata } from '../types';
import { CAMPAGNE_FOLDER, CAMPAGNA_PRIVATO_FILE } from '../constants';
import { parseYaml, stringifyYaml } from '../utils/yaml';
import { AccordoSchema } from './schemas';

const CampagnaPrivataSchema = z.object({
  accordi: z.array(AccordoSchema),
});

function privataPath(slug: string): string {
  return `${CAMPAGNE_FOLDER}/${slug}/${CAMPAGNA_PRIVATO_FILE}`;
}

export async function loadCampagnaPrivata(app: App, slug: string): Promise<CampagnaPrivata> {
  const path = privataPath(slug);
  const exists = await app.vault.adapter.exists(path);
  if (!exists) return { accordi: [] };
  const content = await app.vault.adapter.read(path);
  const raw = parseYaml<unknown>(content);
  return CampagnaPrivataSchema.parse(raw ?? { accordi: [] });
}

export async function saveAccordiPrivati(app: App, slug: string, privata: CampagnaPrivata): Promise<void> {
  await app.vault.adapter.write(privataPath(slug), stringifyYaml(privata));
}

export async function appendAccordoPrivato(app: App, slug: string, accordo: Accordo): Promise<void> {
  const privata = await loadCampagnaPrivata(app, slug);
  privata.accordi.push(accordo);
  await saveAccordiPrivati(app, slug, privata);
}
