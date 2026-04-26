import type { DicePool, DiceResult, Esito, IAConflictOutcome, MC, Modalita, ReactionResult, RollResult, TipoAzioneIA } from '../types';
import { ESITO_MAP, LEADER_AVAILABILITY_THRESHOLD } from '../constants';

// Mulberry32 seeded PRNG — deterministic, no external deps
function seededRandom(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function rollDie(seed: number): number {
  return Math.floor(seededRandom(seed) * 6) + 1;
}

export function tiraDadi(pool: DicePool, seed?: number): DiceResult {
  const usedSeed = seed ?? Date.now();
  const totale = Math.max(pool.positivi, pool.negativi, 1);
  const dadi: number[] = [];

  for (let i = 0; i < totale; i++) {
    dadi.push(rollDie(usedSeed + i));
  }

  let risultato: number;
  switch (pool.modalita as Modalita) {
    case 'alto':
      risultato = Math.max(...dadi.slice(0, Math.max(pool.positivi, 1)));
      break;
    case 'basso':
      risultato = Math.min(...dadi.slice(0, Math.max(pool.negativi, 1)));
      break;
    default:
      risultato = dadi[0];
  }

  risultato = Math.max(1, Math.min(6, risultato));

  return { seed: usedSeed, dadi, risultato, esito: mappaEsito(risultato) };
}

export function mappaEsito(n: number): Esito {
  return ESITO_MAP[n] ?? 'no_ma';
}

export function leaderAvailability(mc: MC, seed?: number): boolean {
  const usedSeed = seed ?? Date.now();
  const roll = rollDie(usedSeed);
  return roll + mc >= LEADER_AVAILABILITY_THRESHOLD;
}

const TIPO_AZIONE_IA_TABLE: TipoAzioneIA[] = [
  'Consolidamento', 'Espansione', 'Attacco Diretto', 'Difesa', 'Diplomatico/Politico', 'Evento Speciale',
];

export function rollTipoAzioneIA(seed?: number): { seed: number; dado: number; tipo: TipoAzioneIA } {
  const usedSeed = seed ?? Date.now();
  const dado = rollDie(usedSeed);
  return { seed: usedSeed, dado, tipo: TIPO_AZIONE_IA_TABLE[dado - 1] };
}

export function rollReactionTable(seed?: number): { seed: number; dado: number; risultato: ReactionResult } {
  const usedSeed = seed ?? Date.now();
  const dado = rollDie(usedSeed);
  const risultato: ReactionResult = dado <= 2 ? 'ostile' : dado <= 4 ? 'neutrale' : 'collaborativa';
  return { seed: usedSeed, dado, risultato };
}

export function rollIAConflictOutcome(seed?: number): { seed: number; dado: number; risultato: IAConflictOutcome } {
  const usedSeed = seed ?? Date.now();
  const dado = rollDie(usedSeed);
  const risultato: IAConflictOutcome = dado <= 2 ? 'vittoria_totale' : dado <= 4 ? 'vittoria_parziale' : 'stallo';
  return { seed: usedSeed, dado, risultato };
}

export interface DirectConflictResult {
  attacker: RollResult;
  defender: RollResult;
  winner: 'attacker' | 'defender' | 'draw';
}

export function resolveDirectConflict(
  attackerPool: DicePool,
  defenderPool: DicePool,
  attackerFazione: string,
  defenderFazione: string,
  seed: number,
): DirectConflictResult {
  const attackerRoll = tiraDadi(attackerPool, seed);
  const defenderRoll = tiraDadi(defenderPool, seed + 1000);

  let winner: 'attacker' | 'defender' | 'draw';
  if (attackerRoll.risultato > defenderRoll.risultato) {
    winner = 'attacker';
  } else if (defenderRoll.risultato > attackerRoll.risultato) {
    winner = 'defender';
  } else {
    winner = 'draw';
  }

  return {
    attacker: { ...attackerRoll, fazione: attackerFazione },
    defender: { ...defenderRoll, fazione: defenderFazione },
    winner,
  };
}
