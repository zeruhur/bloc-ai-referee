import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { createAdapter } from '../llm/LLMAdapter';
import { runStepCounterArg } from '../pipeline/StepCounterArg';

export async function cmdAutoControArgomentazione(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  if (campagna.meta.stato !== 'matrice_generata') {
    new Notice(`Comando non disponibile in stato: ${campagna.meta.stato}`);
    return;
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
