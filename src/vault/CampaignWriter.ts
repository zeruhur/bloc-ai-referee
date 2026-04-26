import type { App } from 'obsidian';
import type { Campagna, CampagnaStato, GameStateDelta } from '../types';
import { parseYaml, stringifyYaml } from '../utils/yaml';
import { CAMPAGNE_FOLDER, CAMPAGNA_FILE } from '../constants';

async function readRaw(app: App, slug: string): Promise<Record<string, unknown>> {
  const path = `${CAMPAGNE_FOLDER}/${slug}/${CAMPAGNA_FILE}`;
  const content = await app.vault.adapter.read(path);
  return parseYaml<Record<string, unknown>>(content);
}

async function writeRaw(app: App, slug: string, data: Record<string, unknown>): Promise<void> {
  const path = `${CAMPAGNE_FOLDER}/${slug}/${CAMPAGNA_FILE}`;
  await app.vault.adapter.write(path, stringifyYaml(data));
}

export async function patchCampagnaStato(
  app: App,
  slug: string,
  stato: CampagnaStato,
): Promise<void> {
  const data = await readRaw(app, slug);
  const meta = data['meta'] as Record<string, unknown>;
  meta['stato'] = stato;
  await writeRaw(app, slug, data);
}

export async function appendGameStateDelta(
  app: App,
  slug: string,
  delta: GameStateDelta,
): Promise<void> {
  const data = await readRaw(app, slug);
  const deltas = (data['game_state_delta'] as GameStateDelta[]) ?? [];
  deltas.push(delta);
  data['game_state_delta'] = deltas;
  await writeRaw(app, slug, data);
}

export async function patchFazioneLeader(
  app: App,
  slug: string,
  fazioneId: string,
  presente: boolean,
): Promise<void> {
  const data = await readRaw(app, slug);
  const fazioni = data['fazioni'] as Array<Record<string, unknown>>;
  const fazione = fazioni.find(f => f['id'] === fazioneId);
  if (fazione) {
    (fazione['leader'] as Record<string, unknown>)['presente'] = presente;
  }
  await writeRaw(app, slug, data);
}

export async function patchFazioneMC(
  app: App,
  slug: string,
  fazioneId: string,
  mcDelta: number,
): Promise<void> {
  const data = await readRaw(app, slug);
  const fazioni = data['fazioni'] as Array<Record<string, unknown>>;
  const fazione = fazioni.find(f => f['id'] === fazioneId);
  if (fazione) {
    const currentMc = (fazione['mc'] as number) ?? 0;
    fazione['mc'] = Math.max(-1, Math.min(1, currentMc + mcDelta));
  }
  await writeRaw(app, slug, data);
}

export async function incrementTurno(app: App, campagna: Campagna): Promise<void> {
  const data = await readRaw(app, campagna.meta.slug);
  const meta = data['meta'] as Record<string, unknown>;
  meta['turno_corrente'] = campagna.meta.turno_corrente + 1;
  meta['stato'] = 'raccolta';
  await writeRaw(app, campagna.meta.slug, data);
}
