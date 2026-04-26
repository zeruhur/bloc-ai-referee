import type { Campagna, FazioneConfig, GameStateDelta } from '../../types';
import { stringifyYaml } from '../../utils/yaml';

export function buildActionDeclPrompt(
  campagna: Campagna,
  fazione: FazioneConfig,
  compressedDeltas: GameStateDelta[],
): { system: string; user: string } {
  const deltaContext = compressedDeltas.length > 0
    ? `\n\nSTORIA RECENTE (ultimi turni):\n${stringifyYaml(compressedDeltas)}`
    : '';

  const system = `Sei l'arbitro di una campagna di gioco di ruolo tattico chiamata "${campagna.meta.titolo}".

PREMESSA:
${campagna.premessa}${deltaContext}

Il tuo compito è generare la dichiarazione di azione per una fazione controllata dall'IA in modo che sia coerente con il suo obiettivo e con gli eventi recenti. Rispondi SOLO con il JSON richiesto.`;

  const vantaggiList = fazione.vantaggi
    .map(v => `- ${v.id}: ${v.label}`)
    .join('\n');

  const user = `FAZIONE: ${fazione.nome} (ID: ${fazione.id})
OBIETTIVO: ${fazione.obiettivo}
VANTAGGI DISPONIBILI:
${vantaggiList}

Genera la dichiarazione di azione per questa fazione al turno ${campagna.meta.turno_corrente}.
- "azione": descrizione sintetica dell'azione (max 80 caratteri)
- "metodo": come la fazione intende realizzarla (max 200 caratteri)
- "vantaggi_usati": lista degli ID dei vantaggi che la fazione attiva (usa solo vantaggi presenti nella lista sopra, può essere vuota)`;

  return { system, user };
}
