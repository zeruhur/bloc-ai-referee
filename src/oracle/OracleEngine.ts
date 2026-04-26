import type { OracleEsito, OracleResult } from '../types';

function seededRandom(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function rollDie(seed: number): number {
  return Math.floor(seededRandom(seed) * 6) + 1;
}

export function askYesNo(
  domanda: string,
  modificatore: -1 | 0 | 1,
  turno: number,
  seed?: number,
): OracleResult {
  const usedSeed = seed ?? Date.now();
  const dado = rollDie(usedSeed);
  const valore_modificato = Math.max(1, Math.min(6, dado + modificatore));
  const esito: OracleEsito = valore_modificato <= 2 ? 'no' : valore_modificato <= 4 ? 'si_ma' : 'si';
  return { domanda, modificatore, seed: usedSeed, dado, valore_modificato, esito, turno };
}
