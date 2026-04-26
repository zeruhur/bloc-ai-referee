import type { AzioneDeclaration, Campagna, GameStateDelta, MatrixOutput } from '../../types';
import { stringifyYaml } from '../../utils/yaml';

export function buildEvaluatePrompt(
  campagna: Campagna,
  matrice: MatrixOutput,
  action: AzioneDeclaration,
  compressedDeltas: GameStateDelta[],
): { system: string; user: string } {
  const deltaContext = compressedDeltas.length > 0
    ? `\n\nSTORIA RECENTE:\n${stringifyYaml(compressedDeltas)}`
    : '';

  const system = `Sei l'arbitro di "${campagna.meta.titolo}".

PREMESSA:
${campagna.premessa}${deltaContext}

MATRICE TURNO CORRENTE:
${stringifyYaml(matrice)}

Il tuo compito è valutare la rilevanza contestuale dei vantaggi dichiarati per una singola azione. Per ogni vantaggio: confermalo, riducilo o negalo con motivazione narrativa concreta. Calcola il pool di dadi risultante seguendo le regole BLOC. Rispondi SOLO con il JSON richiesto.`;

  // Strip dettaglio_narrativo from LLM context
  const { dettaglio_narrativo: _dn, valutazione: _v, ...llmAction } = action;

  const user = `AZIONE DA VALUTARE:
${stringifyYaml(llmAction)}

Valuta ogni vantaggio dichiarato rispetto al metodo e al contesto. Determina quali svantaggi propri si attivano. Calcola:
- positivi: numero di vantaggi confermati + aiuti alleati
- negativi: numero di svantaggi attivati (propri + opposti)
- netto: positivi - negativi
- modalita: "alto" se netto > 0, "basso" se netto < 0, "neutro" se netto == 0`;

  return { system, user };
}
