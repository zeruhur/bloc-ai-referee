import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { incrementTurno } from '../vault/CampaignWriter';
import { ensureTurnFolder, loadAccordiPubblici, patchAccordoStato } from '../vault/VaultManager';
import { loadCampagnaPrivata, saveAccordiPrivati } from '../vault/CampagnaPrivataManager';

async function expireAccordi(app: App, slug: string, turnoCorrente: number): Promise<string[]> {
  const scaduti: string[] = [];

  const pubblici = await loadAccordiPubblici(app, slug);
  for (const accordo of pubblici.accordi) {
    if (
      accordo.stato === 'attivo' &&
      accordo.turno_scadenza !== undefined &&
      accordo.turno_scadenza <= turnoCorrente
    ) {
      await patchAccordoStato(app, slug, accordo.id, 'scaduto');
      scaduti.push(accordo.id);
    }
  }

  const privati = await loadCampagnaPrivata(app, slug);
  let privatiModified = false;
  for (const accordo of privati.accordi) {
    if (
      accordo.stato === 'attivo' &&
      accordo.turno_scadenza !== undefined &&
      accordo.turno_scadenza <= turnoCorrente
    ) {
      accordo.stato = 'scaduto';
      privatiModified = true;
      scaduti.push(accordo.id);
    }
  }
  if (privatiModified) {
    await saveAccordiPrivati(app, slug, privati);
  }

  return scaduti;
}

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

  const scaduti = await expireAccordi(app, campagna.meta.slug, campagna.meta.turno_corrente);
  if (scaduti.length > 0) {
    new Notice(`Accordi scaduti questo turno: ${scaduti.join(', ')}.`);
  }

  await incrementTurno(app, campagna);
  await ensureTurnFolder(app, campagna.meta.slug, nextTurno);
  plugin.lastRolls = [];

  new Notice(`Turno ${campagna.meta.turno_corrente} chiuso. Turno ${nextTurno} pronto.`);
}
