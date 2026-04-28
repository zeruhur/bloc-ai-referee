import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { leaderAvailability } from '../dice/DiceEngine';
import { patchFazioneLeader } from '../vault/CampaignWriter';
import { activeFazioni } from '../utils/factionUtils';

export async function cmdVerificaLeader(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  const { slug } = campagna.meta;
  const fazioniConLeader = activeFazioni(campagna.fazioni).filter(f => f.leader !== undefined);

  if (fazioniConLeader.length === 0) {
    new Notice('Nessuna fazione ha un leader configurato.');
    return;
  }

  const disponibili: string[] = [];
  const seed = Date.now();

  try {
    for (const fazione of fazioniConLeader) {
      const avail = leaderAvailability(fazione.mc, seed + campagna.fazioni.indexOf(fazione));
      await patchFazioneLeader(app, slug, fazione.id, avail);
      if (avail) disponibili.push(fazione.nome);
    }
  } catch (e) {
    new Notice(`Errore: ${(e as Error).message}`);
    return;
  }

  const msg = disponibili.length > 0
    ? `Leader disponibili: ${disponibili.join(', ')}`
    : 'Nessun leader disponibile questo turno.';
  new Notice(msg);
}
