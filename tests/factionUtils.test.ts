import { describe, it, expect } from 'vitest';
import type { FazioneConfig } from '../src/types';
import { resolveFactionName, buildFactionNameMap, replaceFactionIds } from '../src/utils/factionUtils';

const fazioni: FazioneConfig[] = [
  { id: 'aquila-nord', nome: 'Aquila del Nord', mc: 0, concetto: '', vantaggi: [], svantaggi: [], obiettivo: '' },
  { id: 'lupo-grigio', nome: 'Lupo Grigio', mc: 0, concetto: '', vantaggi: [], svantaggi: [], obiettivo: '' },
];

describe('resolveFactionName', () => {
  it('returns nome for known faction id', () => {
    expect(resolveFactionName('aquila-nord', fazioni)).toBe('Aquila del Nord');
    expect(resolveFactionName('lupo-grigio', fazioni)).toBe('Lupo Grigio');
  });

  it('returns the id unchanged when faction is not found', () => {
    expect(resolveFactionName('sconosciuta', fazioni)).toBe('sconosciuta');
  });

  it('handles empty fazioni array', () => {
    expect(resolveFactionName('aquila-nord', [])).toBe('aquila-nord');
  });
});

describe('buildFactionNameMap', () => {
  it('builds a map of id → nome', () => {
    const map = buildFactionNameMap(fazioni);
    expect(map['aquila-nord']).toBe('Aquila del Nord');
    expect(map['lupo-grigio']).toBe('Lupo Grigio');
  });

  it('returns empty object for empty fazioni', () => {
    expect(buildFactionNameMap([])).toEqual({});
  });
});

describe('replaceFactionIds', () => {
  it('replaces faction ids with names in text', () => {
    const nameMap = buildFactionNameMap(fazioni);
    const text = "L'aquila-nord ha sconfitto il lupo-grigio nel nord.";
    const result = replaceFactionIds(text, nameMap);
    expect(result).toContain('Aquila del Nord');
    expect(result).toContain('Lupo Grigio');
    expect(result).not.toContain('aquila-nord');
    expect(result).not.toContain('lupo-grigio');
  });

  it('replaces multiple occurrences', () => {
    const nameMap = { 'fazione-a': 'Fazione Alpha' };
    const text = 'fazione-a attacca fazione-a ancora.';
    expect(replaceFactionIds(text, nameMap)).toBe('Fazione Alpha attacca Fazione Alpha ancora.');
  });

  it('leaves text unchanged when no ids match', () => {
    const nameMap = buildFactionNameMap(fazioni);
    const text = 'Nessuna fazione menzionata qui.';
    expect(replaceFactionIds(text, nameMap)).toBe(text);
  });
});
