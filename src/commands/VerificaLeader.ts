import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { leaderAvailability } from '../dice/DiceEngine';
import { patchFazioneLeader } from '../vault/CampaignWriter';

export async function cmdVerificaLeader(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  const { slug } = campagna.meta;
  const fazioniConLeader = campagna.fazioni.filter(f => f.leader !== undefined);

  if (fazioniConLeader.length === 0) {
    new Notice('Nessuna fazione ha un leader configurato.');
    return;
  }

  const disponibili: string[] = [];
  const seed = Date.now();

  for (const fazione of fazioniConLeader) {
    const avail = leaderAvailability(fazione.mc, seed + campagna.fazioni.indexOf(fazione));
    await patchFazioneLeader(app, slug, fazione.id, avail);
    if (avail) disponibili.push(fazione.nome);
  }

  const msg = disponibili.length > 0
    ? `Leader disponibili: ${disponibili.join(', ')}`
    : 'Nessun leader disponibile questo turno.';
  new Notice(msg);
}
