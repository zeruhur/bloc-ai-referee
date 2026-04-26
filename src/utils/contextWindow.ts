import type { GameStateDelta, LLMProvider } from '../types';
import { MAX_GAME_STATE_DELTAS_FULL, MAX_GAME_STATE_DELTAS_OLLAMA } from '../constants';

export function compressGameState(
  deltas: GameStateDelta[],
  maxTurns: number,
): GameStateDelta[] {
  if (deltas.length <= maxTurns) return deltas;
  return deltas.slice(deltas.length - maxTurns);
}

export function maxTurnsForProvider(provider: LLMProvider): number {
  return provider === 'ollama' ? MAX_GAME_STATE_DELTAS_OLLAMA : MAX_GAME_STATE_DELTAS_FULL;
}

export function getCompressedDeltas(
  deltas: GameStateDelta[],
  provider: LLMProvider,
): GameStateDelta[] {
  return compressGameState(deltas, maxTurnsForProvider(provider));
}

/**
 * Returns a summary string built from the narrative_seed of deltas that fall
 * outside the context window, so the LLM retains a compressed memory of
 * turns older than maxTurns. Returns null when no compression occurs.
 */
export function getHistorySummary(
  deltas: GameStateDelta[],
  provider: LLMProvider,
): string | null {
  const maxTurns = maxTurnsForProvider(provider);
  if (deltas.length <= maxTurns) return null;
  const dropped = deltas.slice(0, deltas.length - maxTurns);
  const seeds = dropped
    .map(d => d.narrative_seed)
    .filter((s): s is string => !!s);
  if (seeds.length === 0) return null;
  return seeds.join(' | ');
}
