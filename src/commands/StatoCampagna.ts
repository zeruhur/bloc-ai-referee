import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { StatusModal } from '../ui/modals/StatusModal';

export async function cmdStatoCampagna(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) {
    new Notice('Nessuna campagna attiva configurata nelle impostazioni.');
    return;
  }
  new StatusModal(app, campagna).open();
}
