import type { AzioneDeclaration, Campagna, GameStateDelta, MatrixOutput } from '../../types';
import { stringifyYaml } from '../../utils/yaml';

export function buildCounterArgPrompt(
  campagna: Campagna,
  actions: AzioneDeclaration[],
  matrix: MatrixOutput,
  compressedDeltas: GameStateDelta[],
  historySummary: string | null = null,
): { system: string; user: string } {
  const historySection = historySummary
    ? `\n\nSTORIA PREGRESSA (riassunto):\n${historySummary}`
    : '';
  const recentSection = compressedDeltas.length > 0
    ? `\n\nSTORIA RECENTE (ultimi turni):\n${stringifyYaml(compressedDeltas)}`
    : '';
  const deltaContext = historySection + recentSection;

  const system = `Sei l'arbitro di una campagna di gioco di ruolo tattico chiamata "${campagna.meta.titolo}".

PREMESSA:
${campagna.premessa}${deltaContext}

Il tuo compito è determinare quali fazioni avversarie avrebbero buone ragioni contestuali per opporsi all'azione altrui, e quale argomento specifico produrrebbero. Rispondi SOLO con il JSON richiesto.`;

  const profiliFazioni = campagna.fazioni
    .map(f => `- ${f.id} (${f.nome}): ${f.profilo}`)
    .join('\n');

  // Strip narrative fields
  const llmActions = actions.map(({ dettaglio_narrativo: _dn, valutazione: _v, ...rest }) => rest);

  const user = `MATRICE DELLE AZIONI — Turno ${campagna.meta.turno_corrente}:
${stringifyYaml(matrix)}

DICHIARAZIONI COMPLETE:
${stringifyYaml(llmActions)}

PROFILI FAZIONI:
${profiliFazioni}

Per ciascuna azione (identificata da "fazione_target"), genera la lista degli argomenti contrari che le fazioni avversarie potrebbero razionalmente sollevare. Le regole:
- Ogni fazione avversaria può avere un argomento contro un'azione (o nessuno — argomento vuoto "")
- Gli argomenti devono essere specifici all'azione contestata, non generici
- Considera i conflitti rilevati nella matrice come indicatori prioritari di chi si oppone a chi
- Una fazione non può opporsi alla propria azione
- Includi una entry per ogni fazione target presente nelle dichiarazioni`;

  return { system, user };
}
