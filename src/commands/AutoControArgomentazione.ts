import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { createAdapter } from '../llm/LLMAdapter';
import { runStepCounterArg } from '../pipeline/StepCounterArg';
import { confirmDialog } from '../ui/modals/ConfirmOverwriteModal';
import { loadRunState } from '../vault/RunStateManager';

const STEP_NAME = 'StepCounterArg';

export async function cmdAutoControArgomentazione(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  if (campagna.meta.stato !== 'matrice_generata') {
    new Notice(`Comando non disponibile in stato: ${campagna.meta.stato}`);
    return;
  }

  const { slug, turno_corrente } = campagna.meta;

  // ---- Run state check ----
  const runState = await loadRunState(app, slug, turno_corrente);
  if (runState) {
    if (runState.status === 'failed' && runState.current_step === STEP_NAME) {
      const retry = await confirmDialog(
        app,
        'Esecuzione precedente fallita',
        `Il passaggio ${STEP_NAME} è fallito: ${runState.last_error ?? 'errore sconosciuto'}. Ripetere?`,
        'Riprova',
      );
      if (!retry) return;
    } else if (runState.completed_steps.includes(STEP_NAME)) {
      const rerun = await confirmDialog(
        app,
        'Passaggio già completato',
        `Le contro-argomentazioni sono già state generate. Rigenerare?`,
        'Rigenera',
      );
      if (!rerun) return;
    }
  }

  const notice = new Notice('Generazione contro-argomentazioni in corso…', 0);
  try {
    const adapter = await createAdapter(campagna.llm, app);
    await runStepCounterArg(app, campagna, adapter);
    notice.hide();
    new Notice('Contro-argomentazioni generate. Stato → contro_args.');
  } catch (e) {
    notice.hide();
    new Notice(`Errore contro-argomentazione: ${(e as Error).message}`);
  }
}
