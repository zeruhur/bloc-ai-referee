import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import { DichiaraAzioneModal } from '../ui/modals/DichiaraAzioneModal';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { createAdapter } from '../llm/LLMAdapter';
import { autoGenAzioneIA } from '../pipeline/AutoGenAzioneIA';
import { actionFilePath, fileExists } from '../vault/VaultManager';
import { declaringFazioni } from '../utils/factionUtils';

export async function cmdDichiaraAzione(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  if (campagna.meta.stato !== 'raccolta') {
    new Notice(`Comando non disponibile in stato: ${campagna.meta.stato}`);
    return;
  }

  const fazioni = declaringFazioni(campagna.fazioni);
  const fazionIA = fazioni.filter(f => f.tipo === 'ia');
  const fazionUmane = fazioni.filter(f => f.tipo !== 'ia');

  if (fazionIA.length > 0) {
    const pendenti = [];
    for (const f of fazionIA) {
      const path = actionFilePath(campagna.meta.slug, campagna.meta.turno_corrente, f.id);
      if (!(await fileExists(app, path))) {
        pendenti.push(f);
      }
    }

    if (pendenti.length > 0) {
      const notice = new Notice(`Auto-gen azioni IA: 0/${pendenti.length}…`, 0);
      try {
        const adapter = await createAdapter(campagna.llm, app);
        for (let i = 0; i < pendenti.length; i++) {
          notice.setMessage(`Auto-gen azioni IA: ${i + 1}/${pendenti.length}…`);
          await autoGenAzioneIA(app, campagna, pendenti[i], adapter);
        }
        notice.hide();
      } catch (e) {
        notice.hide();
        new Notice(`Errore auto-gen fazione IA: ${(e as Error).message}`);
        return;
      }
    }
  }

  if (fazionUmane.length === 0) {
    new Notice('Tutte le fazioni sono IA: azioni generate automaticamente.');
    return;
  }

  new DichiaraAzioneModal(app, campagna, () => {}).open();
}
