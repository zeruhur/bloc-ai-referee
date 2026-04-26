import type { App } from 'obsidian';
import { Notice, SuggestModal } from 'obsidian';
import type BlocPlugin from '../main';
import type { AzioneDeclaration, FazioneConfig } from '../types';
import { AzioneDeclarationSchema } from '../vault/schemas';
import { loadActiveCampagna } from './shared';
import { loadLatentAction } from '../vault/FactionLoader';
import { ensureTurnFolder, actionFilePath } from '../vault/VaultManager';
import { buildFileWithFrontmatter } from '../utils/yaml';
import { CAMPAGNE_FOLDER, FAZIONI_FOLDER, LATENT_SUFFIX } from '../constants';

type LatentEntry = { fazione: FazioneConfig; latent: unknown };

export async function cmdAttivaAzioneLatente(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  const { slug, turno_corrente } = campagna.meta;

  const results = await Promise.all(
    campagna.fazioni.map(async f => {
      const latent = await loadLatentAction(app, slug, f.id);
      return latent ? ({ fazione: f, latent } as LatentEntry) : null;
    }),
  );
  const conLatente = results.filter((x): x is LatentEntry => x !== null);

  if (conLatente.length === 0) {
    new Notice('Nessuna azione latente trovata per questa campagna.');
    return;
  }

  const scelta = await new Promise<LatentEntry | null>(resolve => {
    new LatentPickerModal(app, conLatente, resolve).open();
  });

  if (!scelta) return;

  const parsed = AzioneDeclarationSchema.safeParse(scelta.latent);
  if (!parsed.success) {
    new Notice(`Azione latente non valida per ${scelta.fazione.nome}: ${parsed.error.message}`);
    return;
  }

  const action = parsed.data as AzioneDeclaration;

  await ensureTurnFolder(app, slug, turno_corrente);
  const path = actionFilePath(slug, turno_corrente, action.fazione);
  const { dettaglio_narrativo, ...llmFields } = action;
  const frontmatterData = dettaglio_narrativo
    ? { ...llmFields, dettaglio_narrativo }
    : llmFields;
  await app.vault.adapter.write(path, buildFileWithFrontmatter(frontmatterData, ''));

  const latentPath = `${CAMPAGNE_FOLDER}/${slug}/${FAZIONI_FOLDER}/${action.fazione}${LATENT_SUFFIX}`;
  await app.vault.adapter.remove(latentPath);

  new Notice(`Azione latente di ${scelta.fazione.nome} attivata nel turno ${turno_corrente}.`);
}

class LatentPickerModal extends SuggestModal<LatentEntry> {
  constructor(
    app: App,
    private items: LatentEntry[],
    private resolve: (item: LatentEntry | null) => void,
  ) {
    super(app);
  }

  getSuggestions(query: string): LatentEntry[] {
    return this.items.filter(i =>
      i.fazione.nome.toLowerCase().includes(query.toLowerCase()) ||
      i.fazione.id.toLowerCase().includes(query.toLowerCase()),
    );
  }

  renderSuggestion(item: LatentEntry, el: HTMLElement): void {
    el.createEl('div', { text: `${item.fazione.nome} (${item.fazione.id})` });
  }

  onChooseSuggestion(item: LatentEntry): void {
    this.resolve(item);
  }

  onClose(): void {
    this.resolve(null);
  }
}
