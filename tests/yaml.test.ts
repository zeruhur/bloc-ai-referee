import { describe, it, expect } from 'vitest';
import {
  parseYaml,
  stringifyYaml,
  extractFrontmatter,
  buildFileWithFrontmatter,
  parseFrontmatter,
  patchFrontmatter,
} from '../src/utils/yaml';

describe('parseYaml / stringifyYaml round-trip', () => {
  it('round-trips a simple object', () => {
    const obj = { meta: { titolo: 'Test', slug: 'test', turno_corrente: 1 } };
    const yaml = stringifyYaml(obj);
    const back = parseYaml<typeof obj>(yaml);
    expect(back).toEqual(obj);
  });

  it('round-trips arrays', () => {
    const obj = { fazioni: ['draghi', 'negromanti'], numeri: [1, 2, 3] };
    expect(parseYaml(stringifyYaml(obj))).toEqual(obj);
  });

  it('round-trips nested objects', () => {
    const obj = {
      llm: { provider: 'google_ai_studio', model: 'gemini-2.5-flash', temperature_mechanical: 0.2 },
    };
    expect(parseYaml(stringifyYaml(obj))).toEqual(obj);
  });
});

describe('extractFrontmatter', () => {
  it('extracts frontmatter from a valid file', () => {
    const file = `---\ntitolo: Test\nslug: test\n---\n\nCorpo del file.`;
    const result = extractFrontmatter(file);
    expect(result).not.toBeNull();
    expect(result?.frontmatter).toContain('titolo: Test');
    expect(result?.body).toContain('Corpo del file.');
  });

  it('returns null for file without frontmatter', () => {
    const file = `Questo file non ha frontmatter.`;
    expect(extractFrontmatter(file)).toBeNull();
  });

  it('handles empty body', () => {
    const file = `---\ntitolo: Test\n---\n`;
    const result = extractFrontmatter(file);
    expect(result).not.toBeNull();
  });
});

describe('buildFileWithFrontmatter', () => {
  it('produces a file with --- delimiters', () => {
    const content = buildFileWithFrontmatter({ fazione: 'draghi' }, 'Corpo');
    expect(content).toMatch(/^---\n/);
    expect(content).toContain('fazione: draghi');
    expect(content).toContain('Corpo');
  });
});

describe('parseFrontmatter', () => {
  it('parses frontmatter from a file', () => {
    const file = `---\nfazione: draghi\nturno: 4\n---\n\nTesto.`;
    const result = parseFrontmatter<{ fazione: string; turno: number }>(file);
    expect(result?.fazione).toBe('draghi');
    expect(result?.turno).toBe(4);
  });

  it('returns null for file without frontmatter', () => {
    expect(parseFrontmatter('No frontmatter here')).toBeNull();
  });
});

describe('patchFrontmatter', () => {
  it('patches an existing key', () => {
    const file = `---\nfazione: draghi\nstato: raccolta\n---\n\nCorpo.`;
    const patched = patchFrontmatter(file, { stato: 'matrice_generata' });
    const result = parseFrontmatter<{ fazione: string; stato: string }>(patched);
    expect(result?.fazione).toBe('draghi');
    expect(result?.stato).toBe('matrice_generata');
  });

  it('adds a new key', () => {
    const file = `---\nfazione: draghi\n---\n\nCorpo.`;
    const patched = patchFrontmatter(file, { turno: 5 });
    const result = parseFrontmatter<{ fazione: string; turno: number }>(patched);
    expect(result?.turno).toBe(5);
  });

  it('preserves the body', () => {
    const file = `---\nfazione: draghi\n---\n\nCorpo del file qui.`;
    const patched = patchFrontmatter(file, { turno: 1 });
    expect(patched).toContain('Corpo del file qui.');
  });

  it('handles file without frontmatter by creating it', () => {
    const patched = patchFrontmatter('Testo senza frontmatter', { chiave: 'valore' });
    const result = parseFrontmatter<{ chiave: string }>(patched);
    expect(result?.chiave).toBe('valore');
  });
});
