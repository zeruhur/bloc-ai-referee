import type { Campagna, GameStateDelta } from '../../types';
import { stringifyYaml } from '../../utils/yaml';
import { buildSystemPreamble } from './shared';

export function buildEpiloguePrompt(
  campagna: Campagna,
  allDeltas: GameStateDelta[],
): { system: string; user: string } {
  const system = `${buildSystemPreamble(campagna, true)}

Sei chiamato a scrivere l'epilogo conclusivo di questa campagna. Tieni conto di tutto l'arco narrativo: premessa, svolgimento dei turni e stato finale delle fazioni. Rispondi SOLO con il JSON richiesto.`;

  const deltaSection = allDeltas.length > 0
    ? `STORIA DELLA CAMPAGNA (tutti i turni):\n${stringifyYaml(allDeltas)}`
    : 'La campagna non ha ancora turni registrati.';

  const factionSummary = campagna.fazioni
    .filter(f => !f.eliminata)
    .map(f => `- ${f.nome}: MC ${f.mc > 0 ? '+' : ''}${f.mc}`)
    .join('\n');

  const user = `${deltaSection}

STATO FINALE FAZIONI:
${factionSummary}

Scrivi un epilogo narrativo della campagna di 2-4 paragrafi che:
- Riepiloghi l'arco narrativo complessivo
- Descriva il destino delle principali fazioni in base al loro MC finale
- Chiuda la storia in modo soddisfacente

Restituisci il testo nell'campo "epilogo".`;

  return { system, user };
}
