import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { createAdapter } from '../llm/LLMAdapter';
import { runStep1Matrix } from '../pipeline/Step1Matrix';
import { confirmOverwrite } from '../ui/modals/ConfirmOverwriteModal';
import { countActionsForTurn } from '../vault/ActionLoader';
import { MATRIX_FILE } from '../constants';

export async function cmdGeneraMatrice(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  if (campagna.meta.stato !== 'raccolta') {
    new Notice(`Comando non disponibile in stato: ${campagna.meta.stato}`);
    return;
  }

  const actionCount = await countActionsForTurn(app, campagna.meta.slug, campagna.meta.turno_corrente);
  if (actionCount === 0) {
    new Notice('Nessuna azione dichiarata per questo turno.');
    return;
  }

  const adapter = await createAdapter(campagna.llm, app);
  const notice = new Notice('Generazione matrice in corso...', 0);

  try {
    await runStep1Matrix(app, campagna, adapter, () =>
      confirmOverwrite(app, MATRIX_FILE),
    );
    notice.hide();
    new Notice('Matrice generata. Condividila con i giocatori per le contro-argomentazioni.');
  } catch (e) {
    notice.hide();
    new Notice(`Errore: ${(e as Error).message}`);
  }
}
