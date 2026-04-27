import type { Campagna, FazioneConfig } from '../../types';

export function buildGeneraLeaderPrompt(
  campagna: Campagna,
  fazione: FazioneConfig,
): { system: string; user: string } {
  const system = `Sei l'arbitro di "${campagna.meta.titolo}".

PREMESSA:
${campagna.premessa}

Il tuo compito è generare il profilo del leader di una fazione, coerente con il suo concetto, vantaggi, svantaggi e obiettivo. Rispondi SOLO con il JSON richiesto.`;

  const user = `FAZIONE: ${fazione.nome} (ID: ${fazione.id})
OBIETTIVO: ${fazione.obiettivo}
CONCETTO: ${fazione.concetto}
VANTAGGI: ${fazione.vantaggi.join(', ')}
SVANTAGGI: ${fazione.svantaggi.join(', ')}

Genera il profilo del leader di questa fazione:
- "nome": nome completo del leader (coerente con l'ambientazione)
- "descrizione": breve profilo narrativo del leader (2-3 frasi, max 300 caratteri) — include ruolo, carattere e motivazione principale`;

  return { system, user };
}
