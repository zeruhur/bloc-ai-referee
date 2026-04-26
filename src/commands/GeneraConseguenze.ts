import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { createAdapter } from '../llm/LLMAdapter';
import { runStep3Narrative } from '../pipeline/Step3Narrative';
import { confirmOverwrite } from '../ui/modals/ConfirmOverwriteModal';
import { NARRATIVE_FILE } from '../constants';

export async function cmdGeneraConseguenze(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  if (campagna.meta.stato !== 'tiri') {
    new Notice(`Comando non disponibile in stato: ${campagna.meta.stato}`);
    return;
  }

  if (!plugin.lastRolls || plugin.lastRolls.length === 0) {
    new Notice('Nessun tiro trovato. Esegui prima "Esegui tiri".');
    return;
  }

  const adapter = await createAdapter(campagna.llm, app);
  const notice = new Notice('Generazione conseguenze in corso...', 0);

  try {
    await runStep3Narrative(app, campagna, adapter, plugin.lastRolls, () =>
      confirmOverwrite(app, NARRATIVE_FILE),
    );
    notice.hide();
    new Notice('Conseguenze generate. Revisiona narrativa.md prima di chiudere il turno.');
  } catch (e) {
    notice.hide();
    new Notice(`Errore: ${(e as Error).message}`);
  }
}
