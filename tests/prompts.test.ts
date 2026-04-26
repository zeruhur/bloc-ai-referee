import { describe, it, expect } from 'vitest';
import { buildMatrixPrompt } from '../src/pipeline/prompts/matrixPrompt';
import { buildEvaluatePrompt } from '../src/pipeline/prompts/evaluatePrompt';
import { buildNarrativePrompt } from '../src/pipeline/prompts/narrativePrompt';
import type { AzioneDeclaration, Campagna, EvaluationOutput, MatrixOutput, RollResult } from '../src/types';

const campagnaFixture: Campagna = {
  meta: { titolo: 'Test Campaign', slug: 'test', turno_corrente: 2, turno_totale: 10, stato: 'raccolta' },
  premessa: 'Una campagna di test per verificare i prompt.',
  llm: {
    provider: 'google_ai_studio',
    model: 'gemini-2.5-flash',
    api_key_env: 'GEMINI_API_KEY',
    temperature_mechanical: 0.2,
    temperature_narrative: 0.7,
  },
  fazioni: [
    {
      id: 'draghi',
      nome: 'Draghi delle Montagne',
      mc: 0,
      vantaggi: [{ id: 'mobilita_aerea', label: 'Mobilità aerea' }],
      svantaggio: { id: 'isolamento', label: 'Isolamento diplomatico' },
      obiettivo: 'Proteggere le montagne',
      leader: { presente: true },
    },
  ],
  game_state_delta: [
    {
      turno: 1,
      eventi_chiave: ['I Draghi hanno difeso il passo nord'],
      stato_fazioni: { draghi: { mc: 0, territorio: 'montagne_nord' } },
      narrative_seed: 'Le tensioni aumentano al confine settentrionale.',
    },
  ],
};

const actionFixture: AzioneDeclaration = {
  fazione: 'draghi',
  giocatore: '@player1',
  turno: 2,
  tipo_azione: 'principale',
  azione: 'Attaccare il rituale nemico',
  metodo: 'Assalto aereo dalla vetta nord con supporto valanghe',
  vantaggi_usati: ['mobilita_aerea'],
  svantaggi_opposti: [],
  svantaggi_propri_attivati: [],
  aiuti_alleati: [],
  dettaglio_narrativo: 'QUESTO NON DEVE APPARIRE NEL PROMPT LLM',
};

const matrixFixture: MatrixOutput = {
  azioni: [{
    fazione: 'draghi',
    azione: 'Attaccare il rituale nemico',
    metodo: 'Assalto aereo',
    vantaggi: ['mobilita_aerea'],
    conflitti_con: [],
  }],
};

describe('buildMatrixPrompt', () => {
  it('includes campaign title in system prompt', () => {
    const { system } = buildMatrixPrompt(campagnaFixture, [actionFixture], campagnaFixture.game_state_delta);
    expect(system).toContain('Test Campaign');
  });

  it('includes premessa in system prompt', () => {
    const { system } = buildMatrixPrompt(campagnaFixture, [actionFixture], campagnaFixture.game_state_delta);
    expect(system).toContain('campagna di test');
  });

  it('includes action data in user prompt', () => {
    const { user } = buildMatrixPrompt(campagnaFixture, [actionFixture], campagnaFixture.game_state_delta);
    expect(user).toContain('draghi');
    expect(user).toContain('Attaccare il rituale nemico');
  });

  it('does NOT include dettaglio_narrativo in prompts', () => {
    const { system, user } = buildMatrixPrompt(campagnaFixture, [actionFixture], campagnaFixture.game_state_delta);
    expect(system).not.toContain('QUESTO NON DEVE APPARIRE NEL PROMPT LLM');
    expect(user).not.toContain('QUESTO NON DEVE APPARIRE NEL PROMPT LLM');
  });

  it('includes game state delta when provided', () => {
    const { system } = buildMatrixPrompt(campagnaFixture, [actionFixture], campagnaFixture.game_state_delta);
    expect(system).toContain('tensioni aumentano');
  });

  it('works with empty game state delta', () => {
    const { system } = buildMatrixPrompt(campagnaFixture, [actionFixture], []);
    expect(system).not.toContain('STORIA RECENTE');
  });
});

describe('buildEvaluatePrompt', () => {
  it('includes the matrix in system context', () => {
    const { system } = buildEvaluatePrompt(campagnaFixture, matrixFixture, actionFixture, []);
    expect(system).toContain('draghi');
  });

  it('includes the action in user prompt', () => {
    const { user } = buildEvaluatePrompt(campagnaFixture, matrixFixture, actionFixture, []);
    expect(user).toContain('mobilita_aerea');
  });

  it('does NOT include dettaglio_narrativo', () => {
    const { system, user } = buildEvaluatePrompt(campagnaFixture, matrixFixture, actionFixture, []);
    expect(system).not.toContain('QUESTO NON DEVE APPARIRE NEL PROMPT LLM');
    expect(user).not.toContain('QUESTO NON DEVE APPARIRE NEL PROMPT LLM');
  });
});

describe('buildNarrativePrompt', () => {
  const evalFixture: EvaluationOutput = {
    fazione: 'draghi',
    azione: 'Attaccare il rituale nemico',
    vantaggi_confermati: ['mobilita_aerea'],
    vantaggi_ridotti: [],
    vantaggi_negati: [],
    svantaggi_attivati: [],
    pool: { positivi: 1, negativi: 0, netto: 1, modalita: 'alto' },
  };

  const rollFixture: RollResult = {
    fazione: 'draghi',
    seed: 12345,
    dadi: [5],
    risultato: 5,
    esito: 'si',
  };

  it('includes esito in user prompt', () => {
    const { user } = buildNarrativePrompt(campagnaFixture, matrixFixture, [rollFixture], [evalFixture], []);
    expect(user).toContain('si');
  });

  it('includes evaluation data', () => {
    const { user } = buildNarrativePrompt(campagnaFixture, matrixFixture, [rollFixture], [evalFixture], []);
    expect(user).toContain('mobilita_aerea');
  });
});
