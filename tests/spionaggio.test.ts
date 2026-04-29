import { describe, it, expect } from 'vitest';
import { resolveSpionaggio } from '../src/dice/DiceEngine';
import type { AzioneDeclaration, Campagna } from '../src/types';

const campagnaFixture: Campagna = {
  meta: { titolo: 'Test', slug: 'test', turno_corrente: 1, turno_totale: 5, stato: 'raccolta' },
  premessa: '',
  llm: { provider: 'google_ai_studio', model: 'm', temperature_mechanical: 0.2, temperature_narrative: 0.7 },
  fazioni: [
    { id: 'spia', nome: 'Spia', mc: 1, obiettivo: '', concetto: '', vantaggi: [], svantaggi: [] },
    { id: 'target', nome: 'Target', mc: 0, obiettivo: '', concetto: '', vantaggi: [], svantaggi: [] },
    { id: 'weak', nome: 'Weak', mc: -1, obiettivo: '', concetto: '', vantaggi: [], svantaggi: [] },
  ],
  game_state_delta: [],
};

const spiaAction: AzioneDeclaration = {
  fazione: 'spia',
  giocatore: 'p',
  turno: 1,
  tipo_azione: 'principale',
  categoria_azione: 'spionaggio',
  azione: 'Infiltra',
  metodo: 'Agente segreto',
  argomento_favorevole: 'Rete di spie sviluppata',
  argomenti_contro: [],
  target_fazione: 'target',
};

describe('resolveSpionaggio — determinism', () => {
  it('produces the same result for the same seed', () => {
    const r1 = resolveSpionaggio(spiaAction, campagnaFixture, 42);
    const r2 = resolveSpionaggio(spiaAction, campagnaFixture, 42);
    expect(r1.dado).toBe(r2.dado);
    expect(r1.risultato).toBe(r2.risultato);
    expect(r1.scoperta).toBe(r2.scoperta);
  });

  it('records the seed used', () => {
    const r = resolveSpionaggio(spiaAction, campagnaFixture, 999);
    expect(r.seed).toBe(999);
  });
});

describe('resolveSpionaggio — dice mechanics', () => {
  it('dado is always in [1,6]', () => {
    for (let s = 0; s < 100; s++) {
      const r = resolveSpionaggio(spiaAction, campagnaFixture, s);
      expect(r.dado).toBeGreaterThanOrEqual(1);
      expect(r.dado).toBeLessThanOrEqual(6);
    }
  });

  it('risultato is clamped to [1,6]', () => {
    for (let s = 0; s < 100; s++) {
      const r = resolveSpionaggio(spiaAction, campagnaFixture, s);
      expect(r.risultato).toBeGreaterThanOrEqual(1);
      expect(r.risultato).toBeLessThanOrEqual(6);
    }
  });

  it('scoperta = true when risultato >= 4', () => {
    for (let s = 0; s < 200; s++) {
      const r = resolveSpionaggio(spiaAction, campagnaFixture, s);
      if (r.risultato >= 4) expect(r.scoperta).toBe(true);
      else expect(r.scoperta).toBe(false);
    }
  });

  it('modificatore = MC_spia - MC_target', () => {
    // spia MC=+1, target MC=0 → modificatore=+1
    const r = resolveSpionaggio(spiaAction, campagnaFixture, 1);
    expect(r.modificatore).toBe(1);
  });

  it('modificatore reflects MC difference against strong target', () => {
    // spia MC=+1, weak target MC=-1 → modificatore=+2
    const action = { ...spiaAction, target_fazione: 'weak' };
    const r = resolveSpionaggio(action, campagnaFixture, 1);
    expect(r.modificatore).toBe(2);
  });

  it('positive MC advantage increases discovery rate', () => {
    let found = 0;
    for (let s = 0; s < 200; s++) {
      if (resolveSpionaggio(spiaAction, campagnaFixture, s).scoperta) found++;
    }
    // With MC+1 advantage the discovery rate should be above 50%
    expect(found).toBeGreaterThan(80);
  });
});
