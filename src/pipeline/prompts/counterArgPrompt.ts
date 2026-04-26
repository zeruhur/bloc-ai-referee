import type { AzioneDeclaration, Campagna, GameStateDelta, MatrixOutput } from '../../types';
import { stringifyYaml } from '../../utils/yaml';

export function buildCounterArgPrompt(
  campagna: Campagna,
  actions: AzioneDeclaration[],
  matrix: MatrixOutput,
  compressedDeltas: GameStateDelta[],
): { system: string; user: string } {
  const deltaContext = compressedDeltas.length > 0
    ? `\n\nSTORIA RECENTE (ultimi turni):\n${stringifyYaml(compressedDeltas)}`
    : '';

  const system = `Sei l'arbitro di una campagna di gioco di ruolo tattico chiamata "${campagna.meta.titolo}".

PREMESSA:
${campagna.premessa}${deltaContext}

Il tuo compito è determinare quali fazioni opporrebbero razionalmente il proprio svantaggio alle azioni altrui, tenendo conto dei conflitti emersi nella matrice. Rispondi SOLO con il JSON richiesto.`;

  const svantaggiPerFazione = campagna.fazioni
    .map(f => `- ${f.id} (${f.nome}): svantaggio "${f.svantaggio.id}" — ${f.svantaggio.label}`)
    .join('\n');

  // Strip narrative fields from action context
  const llmActions = actions.map(({ dettaglio_narrativo: _dn, valutazione: _v, ...rest }) => rest);

  const user = `MATRICE DELLE AZIONI — Turno ${campagna.meta.turno_corrente}:
${stringifyYaml(matrix)}

DICHIARAZIONI COMPLETE:
${stringifyYaml(llmActions)}

SVANTAGGI DISPONIBILI PER FAZIONE:
${svantaggiPerFazione}

Per ciascuna azione dichiarata (identificata da "fazione_target"), indica quali fazioni avversarie opporrebbero il proprio svantaggio in modo razionale. Considera i conflitti rilevati nella matrice.
- Una fazione può opporre il proprio svantaggio a più azioni
- Una fazione può anche non opporsi a nessuna azione (lista vuota)
- Una fazione non può opporsi alla propria azione
- Includi una entry per ogni fazione presente nelle dichiarazioni`;

  return { system, user };
}
