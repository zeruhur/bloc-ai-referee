import type { Campagna } from '../../types';
import { buildSystemPreamble } from './shared';

export function buildGeneraFazionePrompt(campagna: Campagna): { system: string; user: string } {
  const system =
    buildSystemPreamble(campagna, true) +
    '\n\nIl tuo compito è creare una nuova fazione per questa campagna. La fazione deve essere coerente con ' +
    "l'ambientazione, avere un obiettivo distinto dalle fazioni già presenti e un concetto originale. " +
    'Rispondi SOLO con il JSON richiesto.';

  const fazList = campagna.fazioni
    .filter(f => !f.eliminata && !f.sospesa)
    .map(f => `- ${f.nome}: ${f.obiettivo} (${f.concetto})`)
    .join('\n');

  const user =
    `FAZIONI ESISTENTI:\n${fazList || '(nessuna)'}\n\n` +
    'Genera una nuova fazione JSON:\n' +
    '- "nome": nome della fazione (coerente con l\'ambientazione)\n' +
    '- "obiettivo": obiettivo principale (1 frase)\n' +
    '- "concetto": identità e natura della fazione (1-2 frasi)\n' +
    '- "vantaggi": array di 2 vantaggi distinti (stringhe brevi)\n' +
    '- "svantaggi": array di 1 svantaggio (stringa breve)';

  return { system, user };
}
