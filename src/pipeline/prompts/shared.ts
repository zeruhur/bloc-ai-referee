import type { Campagna } from '../../types';

export function buildSystemPreamble(campagna: Campagna, full = false): string {
  const premessa = full
    ? campagna.premessa
    : campagna.premessa.split('\n').slice(0, 5).join('\n') + '\n[...]';
  return `Sei l'arbitro della campagna "${campagna.meta.titolo}".\n\nPREMESSA:\n${premessa}`;
}
