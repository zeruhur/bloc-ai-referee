import { z } from 'zod';
import type { App } from 'obsidian';
import type { AccordoPrivato, CampagnaPrivata } from '../types';
import { CAMPAGNE_FOLDER, CAMPAGNA_PRIVATO_FILE } from '../constants';
import { parseYaml, stringifyYaml } from '../utils/yaml';

const AccordoPrivatoSchema = z.object({
  fazioni: z.array(z.string()),
  termini: z.string(),
  turno_scadenza: z.number().optional(),
});

const CampagnaPrivataSchema = z.object({
  accordi: z.array(AccordoPrivatoSchema),
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
  return CampagnaPrivataSchema.parse(raw);
}

export async function appendAccordoPrivato(app: App, slug: string, accordo: AccordoPrivato): Promise<void> {
  const privata = await loadCampagnaPrivata(app, slug);
  privata.accordi.push(accordo);
  await app.vault.adapter.write(privataPath(slug), stringifyYaml(privata));
}
