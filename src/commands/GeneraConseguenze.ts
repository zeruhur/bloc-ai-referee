import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { createAdapter } from '../llm/LLMAdapter';
import { runStep3Narrative } from '../pipeline/Step3Narrative';
import { confirmOverwrite } from '../ui/modals/ConfirmOverwriteModal';
import { NARRATIVE_FILE } from '../constants';
import { readMatrixEntries } from '../vault/MatrixWriter';
import type { RollResult } from '../types';

export async function cmdGeneraConseguenze(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  if (campagna.meta.stato !== 'tiri') {
    new Notice(`Comando non disponibile in stato: ${campagna.meta.stato}`);
    return;
  }

  // Fallback: recover rolls from matrix file if lastRolls was lost on plugin reload
  let rolls: RollResult[] = plugin.lastRolls ?? [];
  if (rolls.length === 0) {
    const { allEntries } = await readMatrixEntries(app, campagna.meta.slug, campagna.meta.turno_corrente);
    rolls = allEntries
      .filter(e => e.esito_tiro)
      .map(e => ({
        fazione: e.fazione,
        seed: 0,
        dadi: e.esito_tiro!.dadi,
        risultato: e.esito_tiro!.risultato,
        esito: e.esito_tiro!.esito,
      }));
  }

  if (rolls.length === 0) {
    new Notice('Nessun tiro trovato. Esegui prima "Esegui tiri".');
    return;
  }

  const adapter = await createAdapter(campagna.llm, app);
  const notice = new Notice('Generazione conseguenze in corso...', 0);

  try {
    await runStep3Narrative(app, campagna, adapter, rolls, () =>
      confirmOverwrite(app, NARRATIVE_FILE),
    );
    notice.hide();
    new Notice('Conseguenze generate. Revisiona narrativa.md prima di chiudere il turno.');
  } catch (e) {
    notice.hide();
    new Notice(`Errore: ${(e as Error).message}`);
  }
}
