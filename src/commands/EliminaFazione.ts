import { App, Notice } from 'obsidian';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { patchFazioneEliminata } from '../vault/CampaignWriter';
import { activeFazioni } from '../utils/factionUtils';
import { pickFazione } from '../ui/FazionePickerModal';

export async function cmdEliminaFazione(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  const candidati = activeFazioni(campagna.fazioni);
  if (candidati.length === 0) {
    new Notice('Nessuna fazione attiva da eliminare.');
    return;
  }

  const fazione = await pickFazione(app, candidati, 'Seleziona fazione da eliminare…');
  if (!fazione) return;

  const { slug } = campagna.meta;
  try {
    await patchFazioneEliminata(app, slug, fazione.id, true);
    new Notice(`Fazione "${fazione.nome}" eliminata. Usa "Ripristina fazione" per annullare.`);
  } catch (e) {
    new Notice(`Errore: ${(e as Error).message}`);
  }
}

export async function cmdRipristinaFazione(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  const candidati = campagna.fazioni.filter(f => f.eliminata);
  if (candidati.length === 0) {
    new Notice('Nessuna fazione eliminata da ripristinare.');
    return;
  }

  const fazione = await pickFazione(app, candidati, 'Seleziona fazione da ripristinare…');
  if (!fazione) return;

  const { slug } = campagna.meta;
  try {
    await patchFazioneEliminata(app, slug, fazione.id, false);
    new Notice(`Fazione "${fazione.nome}" ripristinata.`);
  } catch (e) {
    new Notice(`Errore: ${(e as Error).message}`);
  }
}
