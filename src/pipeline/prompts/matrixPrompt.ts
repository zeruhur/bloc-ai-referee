import type { AzioneDeclaration, Campagna, GameStateDelta } from '../../types';
import { stringifyYaml } from '../../utils/yaml';

export function buildMatrixPrompt(
  campagna: Campagna,
  actions: AzioneDeclaration[],
  compressedDeltas: GameStateDelta[],
  historySummary: string | null = null,
  accordiContext: string | null = null,
  spyDiscoveries: Record<string, boolean> = {},
): { system: string; user: string } {
  const historySection = historySummary
    ? `\n\nSTORIA PREGRESSA (riassunto):\n${historySummary}`
    : '';
  const recentSection = compressedDeltas.length > 0
    ? `\n\nSTORIA RECENTE (ultimi turni):\n${stringifyYaml(compressedDeltas)}`
    : '';
  const accordiSection = accordiContext ? `\n\n${accordiContext}` : '';
  const deltaContext = historySection + recentSection + accordiSection;

  const hasSecrets = actions.some(a => a.categoria_azione === 'segreta');

  const secretInstructions = hasSecrets
    ? `\nFog of War:
- Le azioni marcate [SEGRETO] NON devono apparire nel blocco "azioni" (matrice pubblica).
- Le azioni marcate [SCOPERTA] compaiono in entrambi i blocchi.
- Il blocco "matrice_arbitro" deve contenere TUTTE le azioni (pubbliche + segrete), ciascuna marcata [SEGRETO] o [SCOPERTA] o [PUBBLICA].`
    : '';

  const system = `Sei l'arbitro di una campagna di gioco di ruolo tattico chiamata "${campagna.meta.titolo}".

PREMESSA:
${campagna.premessa}${deltaContext}

Il tuo compito è analizzare le dichiarazioni di azione delle fazioni e produrre una matrice strutturata che mostri chiaramente le interazioni tra le azioni.${secretInstructions} Rispondi SOLO con il JSON richiesto.`;

  // Strip private fields; annotate secrets
  const llmActions = actions
    .filter(a => a.categoria_azione !== 'spionaggio')
    .map(({ dettaglio_narrativo: _dn, valutazione: _v, ...rest }) => {
      if (rest.categoria_azione === 'segreta') {
        const discovered = rest.target_fazione
          ? spyDiscoveries[rest.fazione] ?? false
          : false;
        return { ...rest, _fog: discovered ? '[SCOPERTA]' : '[SEGRETO]' };
      }
      return rest;
    });

  const user = `DICHIARAZIONI DI AZIONE — Turno ${campagna.meta.turno_corrente}:

${stringifyYaml(llmActions)}

PROFILI FAZIONI:
${campagna.fazioni.map(f => `- ${f.id} (${f.nome}):\n  Concetto: ${f.concetto}\n  Vantaggi: ${f.vantaggi.join(', ')}\n  Svantaggi: ${f.svantaggi.join(', ')}`).join('\n')}

Genera la matrice delle azioni. Per ogni fazione indica:
- azione dichiarata e metodo sintetico
- argomento_vantaggio: sintesi dell'argomento di vantaggio dichiarato dalla fazione (copialo fedelmente dalla dichiarazione)
- conflitti_con: lista degli ID fazione con cui c'è sovrapposizione o conflitto diretto (vuota se nessuna)`;

  return { system, user };
}
