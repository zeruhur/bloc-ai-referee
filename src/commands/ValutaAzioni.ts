import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { createAdapter } from '../llm/LLMAdapter';
import { runStep2Evaluate } from '../pipeline/Step2Evaluate';

export async function cmdValutaAzioni(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  if (campagna.meta.stato !== 'contro_args') {
    new Notice(`Comando non disponibile in stato: ${campagna.meta.stato}`);
    return;
  }

  const adapter = await createAdapter(campagna.llm, app);
  let progressNotice = new Notice('Valutando azioni: 0/...', 0);

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
