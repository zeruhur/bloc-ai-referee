import { App, Notice } from 'obsidian';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { loadCampagna } from '../vault/CampaignLoader';
import { createAdapter } from '../llm/LLMAdapter';
import { declaringFazioni } from '../utils/factionUtils';
import { autoGenAzioneIA } from '../pipeline/AutoGenAzioneIA';
import { actionFilePath, fileExists } from '../vault/VaultManager';
import { runStep1Matrix } from '../pipeline/Step1Matrix';
import { runStepCounterArg } from '../pipeline/StepCounterArg';
import { runStep2Evaluate } from '../pipeline/Step2Evaluate';
import { runStep3Narrative } from '../pipeline/Step3Narrative';
import { cmdEseguiTiri } from './EseguiTiri';
import { cmdChiudiTurno } from './ChiudiTurno';

export async function cmdSimulaTurno(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  if (campagna.meta.stato !== 'raccolta') {
    new Notice(`Simula Turno disponibile solo in stato raccolta (attuale: ${campagna.meta.stato})`);
    return;
  }

  const attive = declaringFazioni(campagna.fazioni);
  if (attive.some(f => f.tipo !== 'ia')) {
    new Notice('Simula Turno è disponibile solo se tutte le fazioni attive sono controllate da IA.');
    return;
  }

  const { slug, turno_corrente } = campagna.meta;
  const notice = new Notice('Simulazione turno (1/6): generazione azioni IA…', 0);

  try {
    const adapter = await createAdapter(campagna.llm, app);

    for (const f of attive) {
      if (!(await fileExists(app, actionFilePath(slug, turno_corrente, f.id)))) {
        await autoGenAzioneIA(app, campagna, f, adapter);
      }
    }

    notice.setMessage('Simulazione turno (2/6): generazione matrice…');
    let c = await loadCampagna(app, slug);
    await runStep1Matrix(app, c, adapter, () => Promise.resolve(true));

    notice.setMessage('Simulazione turno (3/6): contro-argomentazioni…');
    c = await loadCampagna(app, slug);
    await runStepCounterArg(app, c, adapter);

    notice.setMessage('Simulazione turno (4/6): valutazione azioni…');
    c = await loadCampagna(app, slug);
    await runStep2Evaluate(app, c, adapter, (i, tot) => {
      notice.setMessage(`Simulazione turno (4/6): valutazione ${i}/${tot}…`);
    });

    notice.setMessage('Simulazione turno (5/6): esecuzione tiri…');
    await cmdEseguiTiri(app, plugin);

    notice.setMessage('Simulazione turno (6/6): generazione conseguenze…');
    c = await loadCampagna(app, slug);
    await runStep3Narrative(app, c, adapter, plugin.lastRolls, () => Promise.resolve(true));

    await cmdChiudiTurno(app, plugin);

    notice.hide();
    new Notice(`Turno ${turno_corrente} simulato con successo.`);
  } catch (e) {
    notice.hide();
    new Notice(`Errore Simula Turno: ${(e as Error).message}`);
  }
}
