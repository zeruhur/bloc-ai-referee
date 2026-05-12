import { describe, it, expect } from 'vitest';
import type { App } from 'obsidian';
import type { FazioneConfig, MatrixEntry } from '../src/types';
import {
  buildMatrixFileContent,
  readMatrixEntries,
  mergeMatrixEntries,
  writeMatrixFiles,
} from '../src/vault/MatrixWriter';
import { buildFileWithFrontmatter } from '../src/utils/yaml';

// ---- In-memory vault mock ----

function createMockApp(files: Record<string, string> = {}): { app: App; files: Record<string, string> } {
  const store = { ...files };
  const app = {
    vault: {
      adapter: {
        exists: (path: string) => Promise.resolve(path in store),
        read: (path: string) => Promise.resolve(store[path] ?? ''),
        write: (path: string, content: string) => {
          store[path] = content;
          return Promise.resolve();
        },
      },
    },
  } as unknown as App;
  return { app, files: store };
}

const fazioni: FazioneConfig[] = [
  { id: 'aquila-nord', nome: 'Aquila del Nord', mc: 0, concetto: 'test', vantaggi: [], svantaggi: [], obiettivo: 'test' },
  { id: 'lupo-grigio', nome: 'Lupo Grigio', mc: 0, concetto: 'test', vantaggi: [], svantaggi: [], obiettivo: 'test' },
];

const baseEntries: MatrixEntry[] = [
  {
    fazione: 'aquila-nord',
    risultato: 'Conquista territorio',
    azione: 'Militare',
    argomento_favorevole: 'Forza militare superiore',
    conflitti_con: ['lupo-grigio'],
  },
  {
    fazione: 'lupo-grigio',
    risultato: 'Difesa perimetrale',
    azione: 'Tattico',
    argomento_favorevole: 'Conoscenza del terreno',
    conflitti_con: [],
  },
];

function makeMatrixContent(entries: MatrixEntry[], isArbiter = false): string {
  const frontmatter: Record<string, unknown> = { azioni: entries };
  if (isArbiter) frontmatter._arbitro = true;
  return buildFileWithFrontmatter(frontmatter, '# test\n');
}

// ---- Tests ----

describe('buildMatrixFileContent', () => {
  it('uses faction nome in the markdown table, not id', () => {
    const content = buildMatrixFileContent(baseEntries, 1, false, fazioni);
    expect(content).toContain('Aquila del Nord');
    expect(content).toContain('Lupo Grigio');
    expect(content).not.toContain('| aquila-nord |');
    expect(content).not.toContain('| lupo-grigio |');
  });

  it('resolves conflitti_con ids to names in the table', () => {
    const content = buildMatrixFileContent(baseEntries, 1, false, fazioni);
    expect(content).toContain('Lupo Grigio');
  });

  it('keeps faction id in YAML frontmatter', () => {
    const content = buildMatrixFileContent(baseEntries, 1, false, fazioni);
    expect(content).toContain('fazione: aquila-nord');
  });

  it('adds _arbitro flag for arbiter version', () => {
    const content = buildMatrixFileContent(baseEntries, 1, true, fazioni);
    expect(content).toContain('_arbitro: true');
  });

  it('falls back to id when fazioni array is empty', () => {
    const content = buildMatrixFileContent(baseEntries, 1, false, []);
    expect(content).toContain('aquila-nord');
  });
});

describe('mergeMatrixEntries', () => {
  it('adds contro_argomentazione to matching entry', () => {
    const updates = [{ fazione: 'aquila-nord', contro_argomentazione: 'argomento test' }];
    const merged = mergeMatrixEntries(baseEntries, updates);
    expect(merged[0].contro_argomentazione).toBe('argomento test');
    expect(merged[1].contro_argomentazione).toBeUndefined();
  });

  it('adds valutazione to matching entry', () => {
    const updates = [{
      fazione: 'lupo-grigio',
      valutazione: { pool: { positivi: 2, negativi: 0, netto: 2, modalita: 'alto' as const }, motivazione: 'Buon argomento' },
    }];
    const merged = mergeMatrixEntries(baseEntries, updates);
    expect(merged[1].valutazione?.pool.positivi).toBe(2);
    expect(merged[1].valutazione?.motivazione).toBe('Buon argomento');
    expect(merged[0].valutazione).toBeUndefined();
  });

  it('adds esito_tiro to matching entry', () => {
    const updates = [{
      fazione: 'aquila-nord',
      esito_tiro: { dadi: [5], risultato: 5, esito: 'si' as const },
    }];
    const merged = mergeMatrixEntries(baseEntries, updates);
    expect(merged[0].esito_tiro?.esito).toBe('si');
    expect(merged[0].esito_tiro?.risultato).toBe(5);
  });

  it('leaves unmatched entries unchanged', () => {
    const updates = [{ fazione: 'inesistente', contro_argomentazione: 'test' }];
    const merged = mergeMatrixEntries(baseEntries, updates);
    expect(merged).toHaveLength(2);
    expect(merged[0].contro_argomentazione).toBeUndefined();
  });

  it('preserves all existing fields after merge', () => {
    const updates = [{ fazione: 'aquila-nord', contro_argomentazione: 'test' }];
    const merged = mergeMatrixEntries(baseEntries, updates);
    expect(merged[0].risultato).toBe('Conquista territorio');
    expect(merged[0].conflitti_con).toEqual(['lupo-grigio']);
  });
});

describe('readMatrixEntries', () => {
  it('reads public entries from matrice.md', async () => {
    const content = makeMatrixContent(baseEntries);
    const { app } = createMockApp({ 'campagne/test/turno-01/matrice.md': content });
    const { publicEntries } = await readMatrixEntries(app, 'test', 1);
    expect(publicEntries).toHaveLength(2);
    expect(publicEntries[0].fazione).toBe('aquila-nord');
  });

  it('reads all entries from matrice-arbitro.md when present', async () => {
    const secretEntry: MatrixEntry = {
      fazione: 'ombra-segreta',
      risultato: 'Sabotaggio',
      azione: 'Infiltrazione',
      argomento_favorevole: 'Invisibilità',
      conflitti_con: [],
    };
    const files = {
      'campagne/test/turno-01/matrice.md': makeMatrixContent(baseEntries),
      'campagne/test/turno-01/matrice-arbitro.md': makeMatrixContent([...baseEntries, secretEntry], true),
    };
    const { app } = createMockApp(files);
    const { publicEntries, allEntries } = await readMatrixEntries(app, 'test', 1);
    expect(publicEntries).toHaveLength(2);
    expect(allEntries).toHaveLength(3);
  });

  it('returns same array for public and all when no arbiter file', async () => {
    const content = makeMatrixContent(baseEntries);
    const { app } = createMockApp({ 'campagne/test/turno-01/matrice.md': content });
    const { publicEntries, allEntries } = await readMatrixEntries(app, 'test', 1);
    expect(allEntries).toEqual(publicEntries);
  });
});

describe('writeMatrixFiles', () => {
  it('writes matrice.md with updated entries', async () => {
    const content = makeMatrixContent(baseEntries);
    const { app, files } = createMockApp({ 'campagne/test/turno-01/matrice.md': content });
    const updated = mergeMatrixEntries(baseEntries, [
      { fazione: 'aquila-nord', contro_argomentazione: 'test arg' },
    ]);
    await writeMatrixFiles(app, 'test', 1, updated, updated, fazioni);
    expect(files['campagne/test/turno-01/matrice.md']).toContain('contro_argomentazione');
  });

  it('secret entries appear only in matrice-arbitro.md, not matrice.md', async () => {
    const secretEntry: MatrixEntry = {
      fazione: 'ombra-segreta',
      risultato: 'Sabotaggio',
      azione: 'Infiltrazione',
      argomento_favorevole: 'Invisibilità',
      conflitti_con: [],
    };
    const { app, files } = createMockApp({
      'campagne/test/turno-01/matrice.md': makeMatrixContent(baseEntries),
      'campagne/test/turno-01/matrice-arbitro.md': makeMatrixContent([...baseEntries, secretEntry], true),
    });
    await writeMatrixFiles(app, 'test', 1, baseEntries, [...baseEntries, secretEntry], fazioni);
    expect(files['campagne/test/turno-01/matrice.md']).not.toContain('ombra-segreta');
    expect(files['campagne/test/turno-01/matrice-arbitro.md']).toContain('ombra-segreta');
  });

  it('does not write matrice-arbitro.md when it did not exist and no secret entries', async () => {
    const content = makeMatrixContent(baseEntries);
    const { app, files } = createMockApp({ 'campagne/test/turno-01/matrice.md': content });
    await writeMatrixFiles(app, 'test', 1, baseEntries, baseEntries, fazioni);
    expect('campagne/test/turno-01/matrice-arbitro.md' in files).toBe(false);
  });
});
