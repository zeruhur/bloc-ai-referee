import { describe, it, expect } from 'vitest';
import {
  loadAccordiPubblici,
  saveAccordoPubblico,
  patchAccordoStato,
} from '../src/vault/VaultManager';
import type { Accordo } from '../src/types';
import { stringifyYaml, buildFileWithFrontmatter } from '../src/utils/yaml';
import { buildAccordiContext } from '../src/pipeline/accordiContext';

function makeMockApp(initialFiles: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initialFiles };
  return {
    store,
    vault: {
      adapter: {
        exists: async (path: string) => path in store,
        read: async (path: string) => store[path] ?? '',
        write: async (path: string, content: string) => { store[path] = content; },
        list: async (path: string) => ({
          files: Object.keys(store).filter(k => {
            const prefix = path.endsWith('/') ? path : path + '/';
            return k.startsWith(prefix) && !k.slice(prefix.length).includes('/');
          }),
          folders: [],
        }),
      },
      getAbstractFileByPath: (_: string) => null,
      createFolder: async (_: string) => {},
    },
  };
}

const accordoFixture: Accordo = {
  id: 'accordo-test-1',
  fazioni: ['draghi', 'negromanti'],
  tipo: 'militare',
  termini: 'I draghi forniscono pattuglie aeree; i negromanti garantiscono guardie scheletro.',
  turno_stipula: 2,
  turno_scadenza: 5,
  stato: 'attivo',
  violazioni: [],
};

describe('loadAccordiPubblici', () => {
  it('returns empty accordi when file does not exist', async () => {
    const app = makeMockApp() as any;
    const result = await loadAccordiPubblici(app, 'test');
    expect(result.accordi).toHaveLength(0);
  });

  it('parses existing accordi file', async () => {
    const content = buildFileWithFrontmatter({ accordi: [accordoFixture] }, '');
    const app = makeMockApp({ 'campagne/test/campagna-accordi-pubblici.md': content }) as any;
    const result = await loadAccordiPubblici(app, 'test');
    expect(result.accordi).toHaveLength(1);
    expect(result.accordi[0].id).toBe('accordo-test-1');
    expect(result.accordi[0].tipo).toBe('militare');
  });

  it('retrocompatible with old schema (missing fields get defaults)', async () => {
    const oldFormat = { accordi: [{ fazioni: ['a', 'b'], termini: 'patto' }] };
    const app = makeMockApp({ 'campagne/test/campagna-accordi-pubblici.md': buildFileWithFrontmatter(oldFormat, '') }) as any;
    const result = await loadAccordiPubblici(app, 'test');
    expect(result.accordi[0].tipo).toBe('non_aggressione');
    expect(result.accordi[0].stato).toBe('attivo');
    expect(result.accordi[0].violazioni).toEqual([]);
  });
});

describe('saveAccordoPubblico', () => {
  it('creates the file when it does not exist', async () => {
    const app = makeMockApp() as any;
    await saveAccordoPubblico(app, 'test', accordoFixture);
    expect('campagne/test/campagna-accordi-pubblici.md' in app.store).toBe(true);
  });

  it('appends to existing accordi', async () => {
    const app = makeMockApp() as any;
    await saveAccordoPubblico(app, 'test', accordoFixture);
    const secondo: Accordo = { ...accordoFixture, id: 'accordo-test-2', fazioni: ['elfi', 'nani'] };
    await saveAccordoPubblico(app, 'test', secondo);
    const result = await loadAccordiPubblici(app, 'test');
    expect(result.accordi).toHaveLength(2);
  });
});

describe('patchAccordoStato', () => {
  it('changes stato to violato and records violazione', async () => {
    const app = makeMockApp() as any;
    await saveAccordoPubblico(app, 'test', accordoFixture);
    await patchAccordoStato(app, 'test', 'accordo-test-1', 'violato', { turno: 3, fazione: 'draghi' });
    const result = await loadAccordiPubblici(app, 'test');
    expect(result.accordi[0].stato).toBe('violato');
    expect(result.accordi[0].violazioni).toHaveLength(1);
    expect(result.accordi[0].violazioni[0].fazione).toBe('draghi');
  });

  it('changes stato to scaduto without violazione', async () => {
    const app = makeMockApp() as any;
    await saveAccordoPubblico(app, 'test', accordoFixture);
    await patchAccordoStato(app, 'test', 'accordo-test-1', 'scaduto');
    const result = await loadAccordiPubblici(app, 'test');
    expect(result.accordi[0].stato).toBe('scaduto');
    expect(result.accordi[0].violazioni).toHaveLength(0);
  });
});

describe('buildAccordiContext', () => {
  it('returns null when no active accordi', () => {
    const ctx = buildAccordiContext({ accordi: [] }, { accordi: [] });
    expect(ctx).toBeNull();
  });

  it('returns null when all accordi are not active', () => {
    const scaduto: Accordo = { ...accordoFixture, stato: 'scaduto' };
    const ctx = buildAccordiContext({ accordi: [scaduto] }, { accordi: [] });
    expect(ctx).toBeNull();
  });

  it('includes public accordo with termini', () => {
    const ctx = buildAccordiContext({ accordi: [accordoFixture] }, { accordi: [] });
    expect(ctx).not.toBeNull();
    expect(ctx).toContain('draghi / negromanti');
    expect(ctx).toContain('militare');
    expect(ctx).toContain('pattuglie aeree');
  });

  it('private accordo terms are RISERVATO, not exposed', () => {
    const privato: Accordo = { ...accordoFixture, id: 'priv-1', fazioni: ['conclave', 'mercenari'] };
    const ctx = buildAccordiContext({ accordi: [] }, { accordi: [privato] });
    expect(ctx).not.toBeNull();
    expect(ctx).toContain('RISERVATO');
    expect(ctx).not.toContain('pattuglie aeree');
  });

  it('shows both public and private entries', () => {
    const privato: Accordo = { ...accordoFixture, id: 'priv-1', fazioni: ['conclave', 'mercenari'] };
    const ctx = buildAccordiContext({ accordi: [accordoFixture] }, { accordi: [privato] });
    expect(ctx).toContain('draghi / negromanti');
    expect(ctx).toContain('conclave / mercenari');
    expect(ctx).toContain('RISERVATO');
  });

  it('includes turno range in output', () => {
    const ctx = buildAccordiContext({ accordi: [accordoFixture] }, { accordi: [] });
    expect(ctx).toContain('turno 2-5');
  });

  it('shows ? for permanent accordi (no turno_scadenza)', () => {
    const permanente: Accordo = { ...accordoFixture, turno_scadenza: undefined };
    const ctx = buildAccordiContext({ accordi: [permanente] }, { accordi: [] });
    expect(ctx).toContain('turno 2-?');
  });
});
