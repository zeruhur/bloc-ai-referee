import type {
  Campagna,
  EvaluationOutput,
  GameStateDelta,
  MatrixOutput,
  RollResult,
} from '../../types';
import { stringifyYaml } from '../../utils/yaml';

export function buildNarrativePrompt(
  campagna: Campagna,
  matrice: MatrixOutput,
  rolls: RollResult[],
  evaluations: EvaluationOutput[],
  compressedDeltas: GameStateDelta[],
  historySummary: string | null = null,
  accordiContext: string | null = null,
): { system: string; user: string } {
  const historySection = historySummary
    ? `\n\nSTORIA PREGRESSA (riassunto):\n${historySummary}`
    : '';
  const recentSection = compressedDeltas.length > 0
    ? `\n\nSTORIA RECENTE:\n${stringifyYaml(compressedDeltas)}`
    : '';
  const accordiSection = accordiContext ? `\n\n${accordiContext}` : '';
  const deltaContext = historySection + recentSection + accordiSection;

  const system = `Sei l'arbitro narratore di "${campagna.meta.titolo}".

PREMESSA:
${campagna.premessa}${deltaContext}

Il tuo compito è generare le conseguenze narrative di questo turno. Per ogni azione tieni conto dell'esito del dado, delle interazioni tra le azioni, e della coerenza narrativa. Calcola anche i delta di stato (modificatore coesione, territorio, ecc.). Rispondi SOLO con il JSON richiesto.`;

  const user = `MATRICE TURNO:
${stringifyYaml(matrice)}

VALUTAZIONI VANTAGGI:
${stringifyYaml(evaluations)}

RISULTATI TIRI:
${stringifyYaml(rolls)}

Per ogni azione genera:
1. La conseguenza narrativa coerente con l'esito
2. I delta di stato (mc_delta: -1/0/+1, territorio se cambia, note)

Poi indica gli eventi significativi del turno e un narrative_seed di 1-2 frasi per il prossimo turno (max 50 token).`;

  return { system, user };
}
