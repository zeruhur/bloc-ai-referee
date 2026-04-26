import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import { DichiaraAzioneModal } from '../ui/modals/DichiaraAzioneModal';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';

export async function cmdDichiaraAzione(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  if (campagna.meta.stato !== 'raccolta') {
    new Notice(`Comando non disponibile in stato: ${campagna.meta.stato}`);
    return;
  }

  new DichiaraAzioneModal(app, campagna, () => {}).open();
}
