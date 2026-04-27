import type { FazioneConfig } from '../types';

export function resolveFactionName(factionId: string, fazioni: FazioneConfig[]): string {
  return fazioni.find(f => f.id === factionId)?.nome ?? factionId;
}

export function buildFactionNameMap(fazioni: FazioneConfig[]): Record<string, string> {
  return Object.fromEntries(fazioni.map(f => [f.id, f.nome]));
}

export function replaceFactionIds(text: string, nameMap: Record<string, string>): string {
  let result = text;
  for (const [id, nome] of Object.entries(nameMap)) {
    result = result.split(id).join(nome);
  }
  return result;
}
