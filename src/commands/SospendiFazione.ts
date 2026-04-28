import { App, Notice } from 'obsidian';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { patchFazioneSospesa } from '../vault/CampaignWriter';
import { activeFazioni } from '../utils/factionUtils';
import { pickFazione } from '../ui/FazionePickerModal';

export async function cmdSospendiFazione(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  const candidati = activeFazioni(campagna.fazioni).filter(f => !f.sospesa);
  if (candidati.length === 0) {
    new Notice('Nessuna fazione attiva da sospendere.');
    return;
  }

  const fazione = await pickFazione(app, candidati, 'Seleziona fazione da sospendere…');
  if (!fazione) return;

  try {
    await patchFazioneSospesa(app, campagna.meta.slug, fazione.id, true);
    new Notice(`"${fazione.nome}" sospesa. Non parteciperà al prossimo Dichiara azione.`);
  } catch (e) {
    new Notice(`Errore: ${(e as Error).message}`);
  }
}

export async function cmdRiattivaSospesa(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  const candidati = campagna.fazioni.filter(f => f.sospesa && !f.eliminata);
  if (candidati.length === 0) {
    new Notice('Nessuna fazione sospesa da riattivare.');
    return;
  }

  const fazione = await pickFazione(app, candidati, 'Seleziona fazione da riattivare…');
  if (!fazione) return;

  try {
    await patchFazioneSospesa(app, campagna.meta.slug, fazione.id, false);
    new Notice(`"${fazione.nome}" riattivata.`);
  } catch (e) {
    new Notice(`Errore: ${(e as Error).message}`);
  }
}
