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

PROFILI FAZIONI:
${campagna.fazioni.map(f => `- ${f.id} (${f.nome}): ${f.profilo}`).join('\n')}

Il tuo compito è valutare la forza degli argomenti dichiarati per questa azione e calcolare il pool di dadi risultante. Rispondi SOLO con il JSON richiesto.`;

  // Strip dettaglio_narrativo and valutazione from LLM context
  const { dettaglio_narrativo: _dn, valutazione: _v, ...llmAction } = action;

  const user = `AZIONE DA VALUTARE:
${stringifyYaml(llmAction)}

REGOLE DI VALUTAZIONE:
- "valutazione_vantaggio.peso" (0-3): quanti dadi positivi merita l'argomento di vantaggio della fazione, in base alla sua forza, pertinenza contestuale e coerenza con il profilo fazione. 0 = argomento invalido o irrilevante, 3 = argomento eccellente e decisivo.
- Per ogni contro-argomento in "argomenti_contro", valuta "peso" (0-1): 0 = contro-argomento non valido o già confutato dall'azione, 1 = contro-argomento valido che aggiunge un dado negativo.
- "pool.positivi" = valutazione_vantaggio.peso
- "pool.negativi" = somma dei pesi di valutazioni_contro
- "pool.netto" = positivi - negativi
- "pool.modalita" = "alto" se netto > 0, "basso" se netto < 0, "neutro" se netto == 0
- Includi una motivazione narrativa concreta per ogni valutazione.`;

  return { system, user };
}
