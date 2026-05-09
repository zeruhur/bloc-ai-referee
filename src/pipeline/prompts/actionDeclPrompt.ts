import type { Campagna, FazioneConfig, GameStateDelta, TipoAzioneIA } from '../../types';
import { stringifyYaml } from '../../utils/yaml';

export function buildActionDeclPrompt(
  campagna: Campagna,
  fazione: FazioneConfig,
  compressedDeltas: GameStateDelta[],
  historySummary: string | null = null,
  tipoAzioneSuggerito?: TipoAzioneIA,
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

  const tipoSection = tipoAzioneSuggerito
    ? `\nTipo di azione: ${tipoAzioneSuggerito} — orienta l'azione verso questa categoria tematica.`
    : '';

  const user = `FAZIONE: ${fazione.nome} (ID: ${fazione.id})
OBIETTIVO: ${fazione.obiettivo}
CONCETTO: ${fazione.concetto}
VANTAGGI: ${fazione.vantaggi.join(', ')}
SVANTAGGI: ${fazione.svantaggi.join(', ')}

Genera la dichiarazione di azione per questa fazione al turno ${campagna.meta.turno_corrente}.${tipoSection}
- "risultato": risultato che la fazione vuole ottenere — descrizione sintetica (max 80 caratteri)
- "azione": come la fazione intende realizzarlo — una frase secca, massimo 120 caratteri
- "argomento_favorevole": argomento in linguaggio naturale che motiva perché questa fazione ha le capacità e le condizioni per riuscire in questa azione specifica (sii specifico al contesto dell'azione, non generare un elenco di caratteristiche)`;

  return { system, user };
}
