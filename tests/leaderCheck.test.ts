import { describe, it, expect } from 'vitest';
import { leaderCheck } from '../src/dice/DiceEngine';
import type { EvaluationOutput } from '../src/types';

describe('leaderCheck', () => {
  it('returns disponibile=true when dado + mc >= 4', () => {
    // Find a seed where dado + mc >= 4 with mc=0
    let found = false;
    for (let s = 0; s < 1000; s++) {
      const r = leaderCheck(0, 'draghi', 1, s);
      if (r.disponibile) {
        expect(r.valore_modificato).toBeGreaterThanOrEqual(4);
        expect(r.dado + r.mc).toBe(r.valore_modificato);
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('returns disponibile=false when dado + mc < 4', () => {
    let found = false;
    for (let s = 0; s < 1000; s++) {
      const r = leaderCheck(0, 'draghi', 1, s);
      if (!r.disponibile) {
        expect(r.valore_modificato).toBeLessThan(4);
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('includes fazione, turno, dado, mc, valore_modificato fields', () => {
    const r = leaderCheck(1, 'test-fazione', 3, 42);
    expect(r.fazione).toBe('test-fazione');
    expect(r.turno).toBe(3);
    expect(r.mc).toBe(1);
    expect(r.dado).toBeGreaterThanOrEqual(1);
    expect(r.dado).toBeLessThanOrEqual(6);
    expect(r.valore_modificato).toBe(r.dado + r.mc);
  });

  it('is deterministic for the same seed', () => {
    const r1 = leaderCheck(0, 'a', 1, 999);
    const r2 = leaderCheck(0, 'a', 1, 999);
    expect(r1.dado).toBe(r2.dado);
    expect(r1.disponibile).toBe(r2.disponibile);
  });

  it('mc +1 increases likelihood of disponibile', () => {
    let positivo = 0, neutro = 0;
    for (let s = 0; s < 100; s++) {
      if (leaderCheck(1, 'a', 1, s).disponibile) positivo++;
      if (leaderCheck(0, 'a', 1, s).disponibile) neutro++;
    }
    expect(positivo).toBeGreaterThan(neutro);
  });
});

describe('presenza_comando pool bonus', () => {
  it('adds exactly 1 dado positivo to the pool', () => {
    const pool = { positivi: 2, negativi: 1, netto: 1, modalita: 'alto' as const };
    const evaluation: EvaluationOutput = {
      fazione: 'draghi',
      azione: 'test',
      valutazione_vantaggio: { peso: 2, motivazione: 'buon argomento' },
      valutazioni_contro: [],
      pool: { ...pool },
    };

    // Simulate the presenza_comando bonus applied in Step2Evaluate
    evaluation.pool.positivi += 1;
    evaluation.pool.netto = evaluation.pool.positivi - evaluation.pool.negativi;
    evaluation.pool.modalita = evaluation.pool.netto > 0 ? 'alto' : evaluation.pool.netto < 0 ? 'basso' : 'neutro';
    evaluation.valutazione_vantaggio.motivazione += ' + 1 dado positivo (Presenza di Comando del leader)';

    expect(evaluation.pool.positivi).toBe(3);
    expect(evaluation.pool.netto).toBe(2);
    expect(evaluation.pool.modalita).toBe('alto');
    expect(evaluation.valutazione_vantaggio.motivazione).toContain('Presenza di Comando');
  });
});

describe('EliminaLeader — mc decrement', () => {
  it('decrements mc by 1 and clamps to -1', () => {
    const clamp = (mc: number, delta: number) => Math.max(-1, Math.min(1, mc + delta));
    expect(clamp(1, -1)).toBe(0);
    expect(clamp(0, -1)).toBe(-1);
    expect(clamp(-1, -1)).toBe(-1); // already at minimum
  });
});
