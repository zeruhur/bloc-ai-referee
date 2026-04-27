import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { createAdapter } from '../llm/LLMAdapter';
import { runStep1Matrix } from '../pipeline/Step1Matrix';
import { confirmOverwrite, confirmDialog } from '../ui/modals/ConfirmOverwriteModal';
import { loadRunState } from '../vault/RunStateManager';
import { countActionsForTurn } from '../vault/ActionLoader';
import { MATRIX_FILE } from '../constants';

const STEP_NAME = 'Step1Matrix';

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

  // ---- Run state check ----
  const { slug, turno_corrente } = campagna.meta;
  const runState = await loadRunState(app, slug, turno_corrente);
  if (runState?.status === 'failed' && runState.current_step === STEP_NAME) {
    const retry = await confirmDialog(
      app,
      'Esecuzione precedente fallita',
      `Il passaggio ${STEP_NAME} è fallito: ${runState.last_error ?? 'errore sconosciuto'}. Ripetere?`,
      'Riprova',
    );
    if (!retry) return;
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
