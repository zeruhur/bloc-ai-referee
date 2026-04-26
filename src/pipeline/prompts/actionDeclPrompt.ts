import type { Campagna, FazioneConfig, GameStateDelta } from '../../types';
import { stringifyYaml } from '../../utils/yaml';

export function buildActionDeclPrompt(
  campagna: Campagna,
  fazione: FazioneConfig,
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

Il tuo compito è generare la dichiarazione di azione per una fazione controllata dall'IA, coerente con il suo obiettivo, profilo e gli eventi recenti. Rispondi SOLO con il JSON richiesto.`;

  const user = `FAZIONE: ${fazione.nome} (ID: ${fazione.id})
OBIETTIVO: ${fazione.obiettivo}
PROFILO: ${fazione.profilo}

Genera la dichiarazione di azione per questa fazione al turno ${campagna.meta.turno_corrente}.
- "azione": descrizione sintetica dell'azione (max 80 caratteri)
- "metodo": come la fazione intende realizzarla (max 200 caratteri)
- "argomento_vantaggio": argomento in linguaggio naturale che motiva perché questa fazione ha le capacità e le condizioni per riuscire in questa azione specifica (sii specifico al contesto dell'azione, non generare un elenco di caratteristiche)`;

  return { system, user };
}
