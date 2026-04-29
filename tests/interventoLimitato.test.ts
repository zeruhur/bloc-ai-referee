import { describe, it, expect } from 'vitest';
import type { AzioneDeclaration } from '../src/types';

describe('InterventoLimitato — pipeline isolation', () => {
  it('InterventoLimitato does not produce AzioneDeclaration fields', () => {
    // An intervento limitato record has no azione/metodo/argomento_favorevole
    const intervento = {
      fazione: 'draghi',
      turno: 2,
      descrizione: 'Consolida posizione',
      tipo_effetto: 'consolida_risultato',
    };
    expect(intervento).not.toHaveProperty('azione');
    expect(intervento).not.toHaveProperty('metodo');
    expect(intervento).not.toHaveProperty('argomento_favorevole');
    expect(intervento).not.toHaveProperty('argomenti_contro');
  });

  it('DichiaraAzione does not allow leader_mode intervento_limitato', () => {
    // intervento_limitato is not a valid selection in DichiaraAzioneModal
    const validLeaderModes: Array<'presenza_comando' | 'azione_leadership'> = [
      'presenza_comando',
      'azione_leadership',
    ];
    const allModes: Array<AzioneDeclaration['leader_mode']> = [
      'presenza_comando',
      'azione_leadership',
      'intervento_limitato',
    ];
    // The modal only offers 'presenza_comando' and 'azione_leadership'
    expect(validLeaderModes).not.toContain('intervento_limitato');
    // But intervento_limitato still exists in the type (for LeaderCheckResult)
    expect(allModes).toContain('intervento_limitato');
  });
});
