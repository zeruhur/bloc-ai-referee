import { describe, it, expect, vi } from 'vitest';
import { writeActionFile, secretActionFilePath, actionFilePath } from '../src/vault/VaultManager';
import { loadActionsForTurn } from '../src/vault/ActionLoader';
import type { AzioneDeclaration } from '../src/types';
import { buildFileWithFrontmatter } from '../src/utils/yaml';

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

const baseAction: AzioneDeclaration = {
  fazione: 'draghi',
  giocatore: 'p1',
  turno: 1,
  tipo_azione: 'principale',
  categoria_azione: 'standard',
  risultato: 'Attacca',
  azione: 'Assalto frontale',
  argomento_favorevole: 'Forza superiore',
  argomenti_contro: [],
};

describe('secretActionFilePath', () => {
  it('includes -segreta suffix', () => {
    const path = secretActionFilePath('test', 1, 'draghi');
    expect(path).toContain('-segreta');
    expect(path).toContain('draghi');
  });

  it('is different from actionFilePath', () => {
    expect(secretActionFilePath('test', 1, 'draghi')).not.toBe(actionFilePath('test', 1, 'draghi'));
  });
});

describe('writeActionFile — routing', () => {
  it('standard action writes to normal path', async () => {
    const app = makeMockApp() as any;
    await writeActionFile(app, 'test', 1, { ...baseAction, categoria_azione: 'standard' });
    const expected = actionFilePath('test', 1, 'draghi');
    expect(expected in app.store).toBe(true);
    expect(Object.keys(app.store).some(k => k.includes('-segreta'))).toBe(false);
  });

  it('segreta action writes to -segreta path', async () => {
    const app = makeMockApp() as any;
    await writeActionFile(app, 'test', 1, {
      ...baseAction,
      categoria_azione: 'segreta',
      costo_vantaggio: 'Mobilità aerea',
    });
    const expected = secretActionFilePath('test', 1, 'draghi');
    expect(expected in app.store).toBe(true);
    expect(Object.keys(app.store).some(k => k === actionFilePath('test', 1, 'draghi'))).toBe(false);
  });

  it('segreta path file contains costo_vantaggio in frontmatter', async () => {
    const app = makeMockApp() as any;
    await writeActionFile(app, 'test', 1, {
      ...baseAction,
      categoria_azione: 'segreta',
      costo_vantaggio: 'Mobilità aerea',
    });
    const path = secretActionFilePath('test', 1, 'draghi');
    expect(app.store[path]).toContain('costo_vantaggio');
    expect(app.store[path]).toContain('Mobilità aerea');
  });
});

describe('loadActionsForTurn — loads both normal and secret files', () => {
  it('loads a normal action file', async () => {
    const normalAction = { ...baseAction, categoria_azione: 'standard' as const };
    const files: Record<string, string> = {
      [actionFilePath('test', 1, 'draghi')]: buildFileWithFrontmatter(normalAction, ''),
    };
    const app = makeMockApp(files) as any;
    const actions = await loadActionsForTurn(app, 'test', 1);
    expect(actions).toHaveLength(1);
    expect(actions[0].fazione).toBe('draghi');
  });

  it('loads both normal and -segreta.md files', async () => {
    const normalAction = { ...baseAction, fazione: 'draghi', categoria_azione: 'standard' as const };
    const secretAction = {
      ...baseAction,
      fazione: 'negromanti',
      categoria_azione: 'segreta' as const,
      costo_vantaggio: 'Rete oscura',
    };
    const files: Record<string, string> = {
      [actionFilePath('test', 1, 'draghi')]: buildFileWithFrontmatter(normalAction, ''),
      [secretActionFilePath('test', 1, 'negromanti')]: buildFileWithFrontmatter(secretAction, ''),
    };
    const app = makeMockApp(files) as any;
    const actions = await loadActionsForTurn(app, 'test', 1);
    expect(actions).toHaveLength(2);
    expect(actions.map(a => a.fazione).sort()).toEqual(['draghi', 'negromanti']);
  });

  it('returns empty array when no action files exist', async () => {
    const app = makeMockApp({ 'campagne/test/turno-01/matrice.md': '# test' }) as any;
    const actions = await loadActionsForTurn(app, 'test', 1);
    expect(actions).toHaveLength(0);
  });
});
