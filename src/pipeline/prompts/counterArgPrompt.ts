import type { AzioneDeclaration, Campagna, GameStateDelta, MatrixOutput } from '../../types';
import { stringifyYaml } from '../../utils/yaml';
import { buildSystemPreamble } from './shared';
import { activeFazioni } from '../../utils/factionUtils';

export function buildCounterArgPrompt(
  campagna: Campagna,
  actions: AzioneDeclaration[],
  matrix: MatrixOutput,
  compressedDeltas: GameStateDelta[],
  historySummary: string | null = null,
  accordiContext: string | null = null,
): { system: string; user: string } {
  const historySection = historySummary
    ? `\n\nSTORIA PREGRESSA (riassunto):\n${historySummary}`
    : '';
  const recentSection = compressedDeltas.length > 0
    ? `\n\nSTORIA RECENTE (ultimi turni):\n${stringifyYaml(compressedDeltas)}`
    : '';
  const accordiSection = accordiContext ? `\n\n${accordiContext}` : '';
  const deltaContext = historySection + recentSection + accordiSection;

  const system = `${buildSystemPreamble(campagna)}${deltaContext}

Il tuo compito è quello dell'arbitro di un Matrix Game: valuta ogni azione dichiarata e, per ciascuna fazione avversaria che ha ragioni contestuali per opporsi, formula una contro-argomentazione logica sul contesto di gioco.

Le contro-argomentazioni NON sono dichiarazioni in-character delle fazioni. Sono valutazioni arbitrali di plausibilità: perché l'azione potrebbe non riuscire, quali ostacoli concreti o fattori contestuali ne indeboliscono l'argomento favorevole, perché le condizioni dichiarate non sono sufficienti o realistiche nel contesto della campagna. Scrivi in terza persona, come un arbitro che analizza la situazione, non come un personaggio che parla.

Rispondi SOLO con il JSON richiesto.`;

  const profiliFazioni = activeFazioni(campagna.fazioni)
    .map(f => `- ${f.id} (${f.nome}): ${f.concetto}`)
    .join('\n');

  // Strip narrative fields
  const llmActions = actions.map(({ dettaglio_narrativo: _dn, valutazione: _v, ...rest }) => rest);

  const user = `MATRICE DELLE AZIONI — Turno ${campagna.meta.turno_corrente}:
${stringifyYaml(matrix)}

DICHIARAZIONI COMPLETE:
${stringifyYaml(llmActions)}

PROFILI FAZIONI:
${profiliFazioni}

Per ciascuna azione (identificata da "fazione_target"), genera la lista di tutte le contro-argomentazioni plausibili — quante ce ne sono, anche zero. Le regole:
- Ogni "argomenti" è un array di stringhe: ciascuna è una contro-argomentazione logica sul perché l'azione potrebbe non riuscire
- Non attribuire gli argomenti a fazioni specifiche: sono valutazioni arbitrali sul contesto di gioco, non dichiarazioni in-character
- Scrivi in terza persona arbitrale ("L'azione presuppone X, ma...", "Il contesto non supporta Y perché...", "L'argomento favorevole trascura Z...")
- Considera ostacoli concreti, condizioni contestuali sfavorevoli, debolezze nell'argomento favorevole, conflitti rilevati nella matrice
- Se non ci sono obiezioni valide, restituisci "argomenti": []
- Includi una entry per ogni fazione target presente nelle dichiarazioni`;

  return { system, user };
}
