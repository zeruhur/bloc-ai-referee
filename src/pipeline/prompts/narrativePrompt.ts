import type {
  Campagna,
  EvaluationOutput,
  GameStateDelta,
  MatrixOutput,
  RollResult,
} from '../../types';
import { stringifyYaml } from '../../utils/yaml';
import { buildSystemPreamble } from './shared';
import { buildFactionNameMap } from '../../utils/factionUtils';

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

  const nameMap = buildFactionNameMap(campagna.fazioni);
  const factionRef = campagna.fazioni
    .map(f => `- ${f.id} → "${f.nome}"`)
    .join('\n');

  const system = `${buildSystemPreamble(campagna)}${deltaContext}

MAPPA IDENTIFICATORI FAZIONE (usa sempre l'id tecnico nel campo JSON "fazione", usa il nome leggibile nei testi narrativi):
${factionRef}

Il tuo compito è generare le conseguenze narrative di questo turno. Per ogni azione tieni conto dell'esito del dado, delle interazioni tra le azioni, e della coerenza narrativa. Calcola anche i delta di stato (modificatore coesione, territorio, ecc.). Rispondi SOLO con il JSON richiesto.`;

  const user = `MATRICE TURNO:
${stringifyYaml(matrice)}

VALUTAZIONI VANTAGGI:
${stringifyYaml(evaluations)}

RISULTATI TIRI:
${stringifyYaml(rolls)}

Per ogni azione genera:
1. La conseguenza narrativa coerente con l'esito. Usa i nomi leggibili delle fazioni nel testo (es. "${campagna.fazioni[0]?.nome ?? 'nome fazione'}"), non gli id tecnici.
2. I delta di stato (mc_delta: -1/0/+1, territorio se cambia, note)

Poi indica gli eventi significativi del turno e un narrative_seed di 1-2 frasi per il prossimo turno (max 50 token).
ATTENZIONE: nel campo JSON "fazione" di ogni conseguenza usa sempre l'id tecnico (es. "${campagna.fazioni[0]?.id ?? 'id-fazione'}").`;

  return { system, user };
}
