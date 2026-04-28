import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { loadActionsForTurn } from '../vault/ActionLoader';
import { tiraDadi, resolveDirectConflict, rollIAConflictOutcome, mappaEsito } from '../dice/DiceEngine';
import { detectDirectConflicts } from '../pipeline/Step2Evaluate';
import { appendToRollsFile, matrixFilePath, rollsFilePath } from '../vault/VaultManager';
import { readMatrixEntries, mergeMatrixEntries, writeMatrixFiles } from '../vault/MatrixWriter';
import { markStepStarted, markStepCompleted, markRunFailed, loadRunState } from '../vault/RunStateManager';
import { confirmDialog } from '../ui/modals/ConfirmOverwriteModal';
import { parseFrontmatter } from '../utils/yaml';
import { patchCampagnaStato } from '../vault/CampaignWriter';
import { resolveFactionName } from '../utils/factionUtils';
import { ESITO_LABELS } from '../constants';
import { refereeEventBus } from '../ui/RefereeEventBus';
import type { MatrixEntry, MatrixOutput, RollResult, DiceResult } from '../types';

const STEP_NAME = 'EseguiTiri';

export async function cmdEseguiTiri(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  if (campagna.meta.stato !== 'valutazione') {
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
        `Il passaggio ${STEP_NAME} è già stato completato. Rieseguire i tiri?`,
        'Riesegui',
      );
      if (!rerun) return;
    }
  }

  const actions = await loadActionsForTurn(app, slug, turno_corrente);

  const matrixContent = await app.vault.adapter.read(matrixFilePath(slug, turno_corrente));
  const matrice = parseFrontmatter<MatrixOutput>(matrixContent);

  const directConflicts = matrice ? detectDirectConflicts(matrice) : [];
  const directConflictFazioni = new Set(
    directConflicts.flatMap(c => [c.fazione_a, c.fazione_b]),
  );

  const rolls: RollResult[] = [];
  let logContent = `# Tiri — Turno ${turno_corrente}\n\n`;

  const seed = Date.now();

  await markStepStarted(app, slug, turno_corrente, STEP_NAME);
  refereeEventBus.emit({ type: 'step-start', step: STEP_NAME, message: 'Esecuzione tiri…', timestamp: new Date() });

  try {
    // Handle direct conflicts first
    for (const conflict of directConflicts) {
      const actionA = actions.find(a => a.fazione === conflict.fazione_a);
      const actionB = actions.find(a => a.fazione === conflict.fazione_b);

      if (!actionA?.valutazione || !actionB?.valutazione) continue;

      const fazioneA = campagna.fazioni.find(f => f.id === conflict.fazione_a);
      const fazioneB = campagna.fazioni.find(f => f.id === conflict.fazione_b);
      const nomeA = resolveFactionName(conflict.fazione_a, campagna.fazioni);
      const nomeB = resolveFactionName(conflict.fazione_b, campagna.fazioni);
      const isIAvsIA = fazioneA?.tipo === 'ia' && fazioneB?.tipo === 'ia';

      if (isIAvsIA) {
        const outcome = rollIAConflictOutcome(seed + rolls.length);
        let attackerRisultato: number;
        let defenderRisultato: number;
        if (outcome.risultato === 'vittoria_totale') {
          attackerRisultato = 6; defenderRisultato = 1;
        } else if (outcome.risultato === 'vittoria_parziale') {
          attackerRisultato = 4; defenderRisultato = 3;
        } else {
          attackerRisultato = 3; defenderRisultato = 3;
        }
        const attackerResult: RollResult = { fazione: conflict.fazione_a, seed: outcome.seed, dadi: [attackerRisultato], risultato: attackerRisultato, esito: mappaEsito(attackerRisultato) };
        const defenderResult: RollResult = { fazione: conflict.fazione_b, seed: outcome.seed, dadi: [defenderRisultato], risultato: defenderRisultato, esito: mappaEsito(defenderRisultato) };
        rolls.push(attackerResult);
        rolls.push(defenderResult);

        logContent += `## Conflitto IA-vs-IA: ${nomeA} vs ${nomeB}\n`;
        logContent += `- Seed: ${outcome.seed} | Dado: ${outcome.dado} | Esito tabella: ${outcome.risultato}\n`;
        logContent += `- ${nomeA}: ${attackerRisultato} (${ESITO_LABELS[attackerResult.esito]})\n`;
        logContent += `- ${nomeB}: ${defenderRisultato} (${ESITO_LABELS[defenderResult.esito]})\n\n`;
      } else {
        const result = resolveDirectConflict(
          actionA.valutazione.pool,
          actionB.valutazione.pool,
          conflict.fazione_a,
          conflict.fazione_b,
          seed,
        );

        rolls.push({ ...result.attacker });
        rolls.push({ ...result.defender });

        logContent += `## Conflitto diretto: ${nomeA} vs ${nomeB}\n`;
        logContent += `- Seed: ${seed}\n`;
        logContent += `- ${nomeA}: dadi ${result.attacker.dadi.join(', ')} → ${result.attacker.risultato} (${ESITO_LABELS[result.attacker.esito]})\n`;
        logContent += `- ${nomeB}: dadi ${result.defender.dadi.join(', ')} → ${result.defender.risultato} (${ESITO_LABELS[result.defender.esito]})\n`;
        const winner = result.winner === 'draw' ? 'pareggio'
          : result.winner === 'attacker' ? nomeA
          : nomeB;
        logContent += `- Vincitore: ${winner}\n\n`;
      }
    }

    // Individual rolls for non-conflict actions
    for (const action of actions) {
      if (directConflictFazioni.has(action.fazione)) continue;
      if (!action.valutazione) continue;

      const roll = tiraDadi(action.valutazione.pool, seed + rolls.length);
      const withFazione: RollResult = { ...roll, fazione: action.fazione };
      rolls.push(withFazione);

      const nome = resolveFactionName(action.fazione, campagna.fazioni);
      logContent += `## ${nome}: ${action.azione}\n`;
      logContent += `- Seed: ${seed + rolls.length - 1}\n`;
      logContent += `- Pool: +${action.valutazione.pool.positivi} / -${action.valutazione.pool.negativi} (${action.valutazione.pool.modalita})\n`;
      logContent += `- Dadi: ${roll.dadi.join(', ')} → ${roll.risultato} (${ESITO_LABELS[roll.esito]})\n\n`;
    }

    const rollsPath = rollsFilePath(slug, turno_corrente);
    await app.vault.adapter.write(rollsPath, logContent);

    // ---- Update matrix with esito_tiro ----
    const { publicEntries, allEntries } = await readMatrixEntries(app, slug, turno_corrente);
    const updates: Partial<MatrixEntry>[] = rolls.map(r => ({
      fazione: r.fazione,
      esito_tiro: { dadi: r.dadi, risultato: r.risultato, esito: r.esito },
    }));
    const updatedPublic = mergeMatrixEntries(publicEntries, updates);
    const updatedAll = mergeMatrixEntries(allEntries, updates);
    await writeMatrixFiles(app, slug, turno_corrente, updatedPublic, updatedAll, campagna.fazioni);

    await patchCampagnaStato(app, slug, 'tiri');
    await markStepCompleted(app, slug, turno_corrente, STEP_NAME, [rollsPath]);

    // Store rolls for Step3 via plugin state
    plugin.lastRolls = rolls;

    refereeEventBus.emit({ type: 'step-done', step: STEP_NAME, message: `Tiri completati: ${rolls.length} azioni.`, timestamp: new Date() });
    new Notice(`Tiri eseguiti: ${rolls.length} azioni. Stato → tiri.`);
  } catch (err) {
    refereeEventBus.emit({ type: 'error', step: STEP_NAME, message: `Errore tiri: ${(err as Error).message}`, timestamp: new Date() });
    await markRunFailed(app, slug, turno_corrente, STEP_NAME, (err as Error).message);
    new Notice(`Errore tiri: ${(err as Error).message}`);
  }
}
