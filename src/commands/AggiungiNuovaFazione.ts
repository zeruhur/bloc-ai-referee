import { App, Notice } from 'obsidian';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { pushNuovaFazione } from '../vault/CampaignWriter';
import { NuovaFazioneModal } from '../ui/modals/NuovaFazioneModal';

export async function cmdAggiungiNuovaFazione(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  await new Promise<void>((resolve) => {
    const modal = new NuovaFazioneModal(
      app,
      { title: 'Aggiungi nuova fazione' },
      async (fazione) => {
        try {
          await pushNuovaFazione(app, campagna.meta.slug, fazione);
          new Notice(`Fazione "${fazione.nome}" aggiunta alla campagna.`);
        } catch (e) {
          new Notice(`Errore: ${(e as Error).message}`);
        }
        resolve();
      },
    );
    modal.onClose = () => resolve();
    modal.open();
  });
}
