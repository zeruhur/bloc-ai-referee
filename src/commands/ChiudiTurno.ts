import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { incrementTurno } from '../vault/CampaignWriter';
import { ensureTurnFolder } from '../vault/VaultManager';

export async function cmdChiudiTurno(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  if (campagna.meta.stato !== 'review') {
    new Notice(`Comando non disponibile in stato: ${campagna.meta.stato}`);
    return;
  }

  const nextTurno = campagna.meta.turno_corrente + 1;
  if (nextTurno > campagna.meta.turno_totale) {
    new Notice('Campagna completata! Tutti i turni sono stati giocati.');
    return;
  }

  await incrementTurno(app, campagna);
  await ensureTurnFolder(app, campagna.meta.slug, nextTurno);
  plugin.lastRolls = [];

  new Notice(`Turno ${campagna.meta.turno_corrente} chiuso. Turno ${nextTurno} pronto.`);
}
