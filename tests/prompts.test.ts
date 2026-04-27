import { describe, it, expect } from 'vitest';
import { buildMatrixPrompt } from '../src/pipeline/prompts/matrixPrompt';
import { buildEvaluatePrompt } from '../src/pipeline/prompts/evaluatePrompt';
import { buildNarrativePrompt } from '../src/pipeline/prompts/narrativePrompt';
import { buildCounterArgPrompt } from '../src/pipeline/prompts/counterArgPrompt';
import type { AzioneDeclaration, Accordo, AccordiPubblici, CampagnaPrivata, Campagna, EvaluationOutput, MatrixOutput, RollResult } from '../src/types';
import { buildAccordiContext } from '../src/pipeline/accordiContext';

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
      concetto: 'Antichi guardiani alati delle vette settentrionali',
      vantaggi: ['Mobilità aerea', 'Resistenza al fuoco'],
      svantaggi: ['Isolamento diplomatico'],
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
  categoria_azione: 'standard',
  azione: 'Attaccare il rituale nemico',
  metodo: 'Assalto aereo dalla vetta nord con supporto valanghe',
  argomento_vantaggio: 'I draghi possono raggiungere il sito del rituale con un attacco aereo fulmineo sfruttando la mobilità aerea superiore',
  argomenti_contro: [],
  dettaglio_narrativo: 'QUESTO NON DEVE APPARIRE NEL PROMPT LLM',
};

const matrixFixture: MatrixOutput = {
  azioni: [{
    fazione: 'draghi',
    azione: 'Attaccare il rituale nemico',
    metodo: 'Assalto aereo',
    argomento_vantaggio: 'Mobilità aerea superiore consente attacco fulmineo',
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

  it('includes faction concetto and vantaggi in user prompt', () => {
    const { user } = buildMatrixPrompt(campagnaFixture, [actionFixture], []);
    expect(user).toContain('Mobilità aerea');
    expect(user).toContain('Isolamento diplomatico');
    expect(user).toContain('Antichi guardiani');
  });
});

describe('buildEvaluatePrompt', () => {
  it('includes the matrix in system context', () => {
    const { system } = buildEvaluatePrompt(campagnaFixture, matrixFixture, actionFixture, []);
    expect(system).toContain('draghi');
  });

  it('includes the argomento_vantaggio in user prompt', () => {
    const { user } = buildEvaluatePrompt(campagnaFixture, matrixFixture, actionFixture, []);
    expect(user).toContain('mobilità aerea superiore');
  });

  it('does NOT include dettaglio_narrativo', () => {
    const { system, user } = buildEvaluatePrompt(campagnaFixture, matrixFixture, actionFixture, []);
    expect(system).not.toContain('QUESTO NON DEVE APPARIRE NEL PROMPT LLM');
    expect(user).not.toContain('QUESTO NON DEVE APPARIRE NEL PROMPT LLM');
  });

  it('includes LINEE GUIDA ARBITRO in system prompt', () => {
    const { system } = buildEvaluatePrompt(campagnaFixture, matrixFixture, actionFixture, []);
    expect(system).toContain('LINEE GUIDA ARBITRO');
    expect(system).toContain('Plausibilità narrativa');
  });
});

const accordoAttivo: Accordo = {
  id: 'acc-1',
  fazioni: ['draghi', 'elfi'],
  tipo: 'militare',
  termini: 'Alleanza difensiva alle vette.',
  turno_stipula: 1,
  turno_scadenza: 4,
  stato: 'attivo',
  violazioni: [],
};

describe('buildMatrixPrompt — accordi injection', () => {
  it('injects ACCORDI ATTIVI when accordiContext is provided', () => {
    const ctx = buildAccordiContext({ accordi: [accordoAttivo] }, { accordi: [] });
    const { system } = buildMatrixPrompt(campagnaFixture, [actionFixture], [], null, ctx);
    expect(system).toContain('ACCORDI ATTIVI');
    expect(system).toContain('draghi / elfi');
    expect(system).toContain('militare');
  });

  it('does NOT include ACCORDI ATTIVI when no accordiContext', () => {
    const { system } = buildMatrixPrompt(campagnaFixture, [actionFixture], []);
    expect(system).not.toContain('ACCORDI ATTIVI');
  });

  it('does not expose private accordo termini', () => {
    const privato: Accordo = { ...accordoAttivo, id: 'priv-1', fazioni: ['conclave', 'imp'] };
    const ctx = buildAccordiContext({ accordi: [] }, { accordi: [privato] });
    const { system } = buildMatrixPrompt(campagnaFixture, [actionFixture], [], null, ctx);
    expect(system).toContain('RISERVATO');
    expect(system).not.toContain('Alleanza difensiva alle vette');
  });

  it('filters out spionaggio actions from user prompt', () => {
    const spyAction: AzioneDeclaration = {
      ...actionFixture,
      fazione: 'elfi',
      categoria_azione: 'spionaggio',
      target_fazione: 'draghi',
    };
    const { user } = buildMatrixPrompt(campagnaFixture, [actionFixture, spyAction], []);
    // spy action itself should not appear in the matrix actions list
    expect(user).not.toContain('spionaggio');
  });
});

describe('buildEvaluatePrompt — accordi and tradimento', () => {
  it('injects ACCORDI ATTIVI when accordiContext provided', () => {
    const ctx = buildAccordiContext({ accordi: [accordoAttivo] }, { accordi: [] });
    const { system } = buildEvaluatePrompt(campagnaFixture, matrixFixture, actionFixture, [], null, ctx);
    expect(system).toContain('ACCORDI ATTIVI');
  });

  it('injects TRADIMENTO RECENTE flag when tradimentoRecente=true', () => {
    const { system } = buildEvaluatePrompt(
      campagnaFixture, matrixFixture, actionFixture, [], null, null, true,
    );
    expect(system).toContain('TRADIMENTO RECENTE');
    expect(system).toContain('scetticismo narrativo');
  });

  it('does NOT include TRADIMENTO RECENTE when flag is false', () => {
    const { system } = buildEvaluatePrompt(campagnaFixture, matrixFixture, actionFixture, []);
    expect(system).not.toContain('TRADIMENTO RECENTE');
  });
});

describe('buildCounterArgPrompt — accordi injection', () => {
  it('injects ACCORDI ATTIVI when accordiContext provided', () => {
    const ctx = buildAccordiContext({ accordi: [accordoAttivo] }, { accordi: [] });
    const { system } = buildCounterArgPrompt(campagnaFixture, [actionFixture], matrixFixture, [], null, ctx);
    expect(system).toContain('ACCORDI ATTIVI');
  });
});

describe('buildNarrativePrompt', () => {
  const evalFixture: EvaluationOutput = {
    fazione: 'draghi',
    azione: 'Attaccare il rituale nemico',
    valutazione_vantaggio: { peso: 2, motivazione: 'Mobilità aerea pertinente e ben argomentata' },
    valutazioni_contro: [],
    pool: { positivi: 2, negativi: 0, netto: 2, modalita: 'alto' },
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
    expect(user).toContain('draghi');
  });
});
