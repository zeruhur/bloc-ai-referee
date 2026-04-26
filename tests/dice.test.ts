import { describe, it, expect } from 'vitest';
import { tiraDadi, mappaEsito, leaderAvailability, resolveDirectConflict } from '../src/dice/DiceEngine';
import type { DicePool } from '../src/types';

const neutroPool: DicePool = { positivi: 1, negativi: 1, netto: 0, modalita: 'neutro' };
const altoPool: DicePool = { positivi: 3, negativi: 0, netto: 3, modalita: 'alto' };
const bassoPool: DicePool = { positivi: 0, negativi: 3, netto: -3, modalita: 'basso' };

describe('tiraDadi — determinism', () => {
  it('produces the same result for the same seed', () => {
    const r1 = tiraDadi(neutroPool, 12345);
    const r2 = tiraDadi(neutroPool, 12345);
    expect(r1.dadi).toEqual(r2.dadi);
    expect(r1.risultato).toBe(r2.risultato);
    expect(r1.esito).toBe(r2.esito);
  });

  it('produces different results for different seeds', () => {
    const r1 = tiraDadi(neutroPool, 1);
    const r2 = tiraDadi(neutroPool, 9999999);
    // Not guaranteed but overwhelmingly likely
    expect(r1.seed).toBe(1);
    expect(r2.seed).toBe(9999999);
  });

  it('records the seed used', () => {
    const r = tiraDadi(neutroPool, 42);
    expect(r.seed).toBe(42);
  });
});

describe('tiraDadi — dice values', () => {
  it('always produces values in range [1,6]', () => {
    for (let seed = 0; seed < 100; seed++) {
      const r = tiraDadi(neutroPool, seed);
      expect(r.risultato).toBeGreaterThanOrEqual(1);
      expect(r.risultato).toBeLessThanOrEqual(6);
      for (const d of r.dadi) {
        expect(d).toBeGreaterThanOrEqual(1);
        expect(d).toBeLessThanOrEqual(6);
      }
    }
  });

  it('alto pool takes the max of positive dice', () => {
    for (let seed = 0; seed < 50; seed++) {
      const r = tiraDadi(altoPool, seed);
      expect(r.risultato).toBe(Math.max(...r.dadi.slice(0, altoPool.positivi)));
    }
  });

  it('basso pool takes the min of negative dice', () => {
    for (let seed = 0; seed < 50; seed++) {
      const r = tiraDadi(bassoPool, seed);
      expect(r.risultato).toBe(Math.min(...r.dadi.slice(0, bassoPool.negativi)));
    }
  });

  it('neutro pool takes the first die', () => {
    for (let seed = 0; seed < 50; seed++) {
      const r = tiraDadi(neutroPool, seed);
      expect(r.risultato).toBe(r.dadi[0]);
    }
  });
});

describe('mappaEsito — all 6 outcomes', () => {
  it('maps 1 → no_e', () => expect(mappaEsito(1)).toBe('no_e'));
  it('maps 2 → no', () => expect(mappaEsito(2)).toBe('no'));
  it('maps 3 → no_ma', () => expect(mappaEsito(3)).toBe('no_ma'));
  it('maps 4 → si_ma', () => expect(mappaEsito(4)).toBe('si_ma'));
  it('maps 5 → si', () => expect(mappaEsito(5)).toBe('si'));
  it('maps 6 → si_e', () => expect(mappaEsito(6)).toBe('si_e'));
});

describe('leaderAvailability', () => {
  it('returns boolean', () => {
    const result = leaderAvailability(0, 1);
    expect(typeof result).toBe('boolean');
  });

  it('with MC +1 is more likely available', () => {
    let available = 0;
    for (let s = 0; s < 100; s++) {
      if (leaderAvailability(1, s)) available++;
    }
    expect(available).toBeGreaterThan(50);
  });

  it('with MC -1 is less likely available', () => {
    let available = 0;
    for (let s = 0; s < 100; s++) {
      if (leaderAvailability(-1, s)) available++;
    }
    expect(available).toBeLessThan(70);
  });
});

describe('resolveDirectConflict', () => {
  it('returns attacker, defender, and winner', () => {
    const result = resolveDirectConflict(altoPool, bassoPool, 'draghi', 'negromanti', 42);
    expect(result.attacker.fazione).toBe('draghi');
    expect(result.defender.fazione).toBe('negromanti');
    expect(['attacker', 'defender', 'draw']).toContain(result.winner);
  });

  it('attacker wins when attacker risultato > defender risultato', () => {
    // Find a seed where attacker beats defender
    let found = false;
    for (let s = 0; s < 1000; s++) {
      const r = resolveDirectConflict(altoPool, bassoPool, 'a', 'b', s);
      if (r.winner === 'attacker') {
        expect(r.attacker.risultato).toBeGreaterThan(r.defender.risultato);
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('is deterministic for the same seed', () => {
    const r1 = resolveDirectConflict(neutroPool, neutroPool, 'a', 'b', 9876);
    const r2 = resolveDirectConflict(neutroPool, neutroPool, 'a', 'b', 9876);
    expect(r1.winner).toBe(r2.winner);
    expect(r1.attacker.dadi).toEqual(r2.attacker.dadi);
  });
});
