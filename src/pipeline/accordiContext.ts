import type { Accordo, AccordiPubblici, CampagnaPrivata } from '../types';

function formatTurni(accordo: Accordo): string {
  const inizio = accordo.turno_stipula;
  const fine = accordo.turno_scadenza !== undefined ? String(accordo.turno_scadenza) : '?';
  return `turno ${inizio}-${fine}`;
}

export function buildAccordiContext(
  pubblici: AccordiPubblici,
  privati: CampagnaPrivata,
): string | null {
  const attivi = pubblici.accordi.filter(a => a.stato === 'attivo');
  const privatiAttivi = privati.accordi.filter(a => a.stato === 'attivo');

  if (attivi.length === 0 && privatiAttivi.length === 0) return null;

  const lines: string[] = ['ACCORDI ATTIVI (turno corrente)'];

  for (const a of attivi) {
    const fazioni = a.fazioni.join(' / ');
    lines.push(`- ${fazioni} — ${a.tipo} (${formatTurni(a)}): "${a.termini}"`);
  }

  for (const a of privatiAttivi) {
    const fazioni = a.fazioni.join(' / ');
    lines.push(`- ${fazioni} — privato (${formatTurni(a)}): [RISERVATO — accordo privato tra ${fazioni}]`);
  }

  return lines.join('\n');
}
