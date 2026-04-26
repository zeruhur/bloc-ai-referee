import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { loadActionsForTurn } from '../vault/ActionLoader';
import { tiraDadi, resolveDirectConflict, rollIAConflictOutcome, mappaEsito } from '../dice/DiceEngine';
import { detectDirectConflicts } from '../pipeline/Step2Evaluate';
import { appendToRollsFile, matrixFilePath, rollsFilePath } from '../vault/VaultManager';
import { parseFrontmatter } from '../utils/yaml';
import { patchCampagnaStato } from '../vault/CampaignWriter';
import { ESITO_LABELS } from '../constants';
import type { MatrixOutput, RollResult, DiceResult } from '../types';

export async function cmdEseguiTiri(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  if (campagna.meta.stato !== 'valutazione') {
    new Notice(`Comando non disponibile in stato: ${campagna.meta.stato}`);
    return;
  }

  const { slug, turno_corrente } = campagna.meta;
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

  // Handle direct conflicts first
  for (const conflict of directConflicts) {
    const actionA = actions.find(a => a.fazione === conflict.fazione_a);
    const actionB = actions.find(a => a.fazione === conflict.fazione_b);

    if (!actionA?.valutazione || !actionB?.valutazione) continue;

    const fazioneA = campagna.fazioni.find(f => f.id === conflict.fazione_a);
    const fazioneB = campagna.fazioni.find(f => f.id === conflict.fazione_b);
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

      logContent += `## Conflitto IA-vs-IA: ${conflict.fazione_a} vs ${conflict.fazione_b}\n`;
      logContent += `- Seed: ${outcome.seed} | Dado: ${outcome.dado} | Esito tabella: ${outcome.risultato}\n`;
      logContent += `- ${conflict.fazione_a}: ${attackerRisultato} (${ESITO_LABELS[attackerResult.esito]})\n`;
      logContent += `- ${conflict.fazione_b}: ${defenderRisultato} (${ESITO_LABELS[defenderResult.esito]})\n\n`;
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

      logContent += `## Conflitto diretto: ${conflict.fazione_a} vs ${conflict.fazione_b}\n`;
      logContent += `- Seed: ${seed}\n`;
      logContent += `- ${conflict.fazione_a}: dadi ${result.attacker.dadi.join(', ')} → ${result.attacker.risultato} (${ESITO_LABELS[result.attacker.esito]})\n`;
      logContent += `- ${conflict.fazione_b}: dadi ${result.defender.dadi.join(', ')} → ${result.defender.risultato} (${ESITO_LABELS[result.defender.esito]})\n`;
      logContent += `- Vincitore: ${result.winner === 'draw' ? 'pareggio' : result.winner === 'attacker' ? conflict.fazione_a : conflict.fazione_b}\n\n`;
    }
  }

  // Individual rolls for non-conflict actions
  for (const action of actions) {
    if (directConflictFazioni.has(action.fazione)) continue;
    if (!action.valutazione) continue;

    const roll = tiraDadi(action.valutazione.pool, seed + rolls.length);
    const withFazione: RollResult = { ...roll, fazione: action.fazione };
    rolls.push(withFazione);

    logContent += `## ${action.fazione}: ${action.azione}\n`;
    logContent += `- Seed: ${seed + rolls.length - 1}\n`;
    logContent += `- Pool: +${action.valutazione.pool.positivi} / -${action.valutazione.pool.negativi} (${action.valutazione.pool.modalita})\n`;
    logContent += `- Dadi: ${roll.dadi.join(', ')} → ${roll.risultato} (${ESITO_LABELS[roll.esito]})\n\n`;
  }

  await app.vault.adapter.write(rollsFilePath(slug, turno_corrente), logContent);
  await patchCampagnaStato(app, slug, 'tiri');

  // Store rolls for Step3 via a temp file
  plugin.lastRolls = rolls;

  new Notice(`Tiri eseguiti: ${rolls.length} azioni. Stato → tiri.`);
}
