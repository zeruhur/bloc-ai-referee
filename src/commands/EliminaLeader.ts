import { App, Notice, SuggestModal } from 'obsidian';
import type { FazioneConfig } from '../types';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { patchFazioneLeader, patchFazioneMC } from '../vault/CampaignWriter';
import { appendToRollsFile } from '../vault/VaultManager';
import { activeFazioni } from '../utils/factionUtils';

class LeaderPickerModal extends SuggestModal<FazioneConfig> {
  private chosen: FazioneConfig | null = null;

  constructor(
    app: App,
    private fazioni: FazioneConfig[],
    private resolve: (f: FazioneConfig | null) => void,
  ) {
    super(app);
  }

  getSuggestions(query: string): FazioneConfig[] {
    return this.fazioni.filter(f => f.nome.toLowerCase().includes(query.toLowerCase()));
  }

  renderSuggestion(fazione: FazioneConfig, el: HTMLElement): void {
    el.createEl('div', { text: `${fazione.nome} (leader: ${fazione.leader?.nome ?? 'senza nome'})` });
  }

  onChooseSuggestion(fazione: FazioneConfig): void {
    this.chosen = fazione;
  }

  onClose(): void {
    setTimeout(() => this.resolve(this.chosen), 0);
  }
}

export async function cmdEliminaLeader(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  const candidati = activeFazioni(campagna.fazioni).filter(f => f.leader?.presente === true);
  if (candidati.length === 0) {
    new Notice('Nessun leader attualmente presente.');
    return;
  }

  const fazione = await new Promise<FazioneConfig | null>(resolve =>
    new LeaderPickerModal(app, candidati, resolve).open(),
  );
  if (!fazione) return;

  const { slug, turno_corrente } = campagna.meta;
  try {
    await patchFazioneLeader(app, slug, fazione.id, false);
    await patchFazioneMC(app, slug, fazione.id, -1);

    const nomeLeader = fazione.leader?.nome ?? 'Il leader';
    const nota = `## Perdita del Leader\n${nomeLeader} è stato eliminato. La fazione ${fazione.nome} subisce MC -1 e uno svantaggio narrativo da definire.\n`;
    await appendToRollsFile(app, slug, turno_corrente, nota);

    new Notice(`Leader eliminato. MC -1 per ${fazione.nome}.`);
  } catch (e) {
    new Notice(`Errore: ${(e as Error).message}`);
  }
}
