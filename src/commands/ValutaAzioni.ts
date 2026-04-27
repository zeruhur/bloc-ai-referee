import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { createAdapter } from '../llm/LLMAdapter';
import { runStep2Evaluate } from '../pipeline/Step2Evaluate';
import { confirmDialog } from '../ui/modals/ConfirmOverwriteModal';
import { loadRunState } from '../vault/RunStateManager';

const STEP_NAME = 'Step2Evaluate';

export async function cmdValutaAzioni(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  if (campagna.meta.stato !== 'contro_args') {
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
        `La valutazione è già stata completata. Rivalutare tutte le azioni?`,
        'Rivaluta',
      );
      if (!rerun) return;
    }
  }

  const adapter = await createAdapter(campagna.llm, app);
  const progressNotice = new Notice('Valutando azioni: 0/...', 0);

  try {
    await runStep2Evaluate(app, campagna, adapter, (current, total) => {
      progressNotice.setMessage(`Valutando azioni: ${current}/${total}`);
    });
    progressNotice.hide();
    new Notice('Valutazione completata. Pool di dadi calcolati.');
  } catch (e) {
    progressNotice.hide();
    new Notice(`Errore: ${(e as Error).message}`);
  }
}
