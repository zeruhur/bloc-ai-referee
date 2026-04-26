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
