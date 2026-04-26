import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { loadActionsForTurn } from '../vault/ActionLoader';
import { AggiornaSvantaggiModal } from '../ui/modals/AggiornaSvantaggiModal';

export async function cmdAggiornaSvantaggi(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  if (campagna.meta.stato !== 'matrice_generata') {
    new Notice(`Comando non disponibile in stato: ${campagna.meta.stato}`);
    return;
  }

  const actions = await loadActionsForTurn(app, campagna.meta.slug, campagna.meta.turno_corrente);
  if (actions.length === 0) {
    new Notice('Nessuna azione trovata per questo turno.');
    return;
  }

  new AggiornaSvantaggiModal(app, campagna, actions, () => {}).open();
}
