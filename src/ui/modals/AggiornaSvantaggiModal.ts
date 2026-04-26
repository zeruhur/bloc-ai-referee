import { App, Modal, Notice } from 'obsidian';
import type { ArgomentoContro, AzioneDeclaration, Campagna } from '../../types';
import { actionFilePath } from '../../vault/ActionLoader';
import { patchActionFrontmatter } from '../../vault/VaultManager';
import { patchCampagnaStato } from '../../vault/CampaignWriter';

export class AggiornaSvantaggiModal extends Modal {
  // Map: fazione_target → list of {fazione, argomento} from each opponent
  private argomenti: Map<string, ArgomentoContro[]> = new Map();

  constructor(
    app: App,
    private campagna: Campagna,
    private actions: AzioneDeclaration[],
    private onComplete: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Contro-argomentazioni' });
    contentEl.createEl('p', {
      text: 'Per ogni azione, inserisci gli argomenti contrari delle fazioni avversarie (lascia vuoto se nessuno).',
    });

    for (const action of this.actions) {
      const opponents = this.campagna.fazioni.filter(f => f.id !== action.fazione);
      const entries: ArgomentoContro[] = opponents.map(f => ({ fazione: f.id, argomento: '' }));
      this.argomenti.set(action.fazione, entries);

      const section = contentEl.createDiv({ cls: 'bloc-action-section' });
      section.createEl('h3', { text: `${action.fazione}: ${action.azione}` });

      for (let i = 0; i < opponents.length; i++) {
        const opp = opponents[i];
        section.createEl('p', { text: `Argomento da ${opp.nome} (${opp.id}):`, cls: 'setting-item-name' });
        const ta = section.createEl('textarea', {
          cls: 'bloc-argomento-textarea',
          attr: { rows: '2', style: 'width:100%;margin-bottom:8px' },
        });
        ta.addEventListener('input', () => {
          entries[i].argomento = ta.value.trim();
        });
      }
    }

    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });
    btnRow.createEl('button', { text: 'Annulla' }).addEventListener('click', () => this.close());
    btnRow.createEl('button', { text: 'Salva', cls: 'mod-cta' })
      .addEventListener('click', () => this.save());
  }

  private async save(): Promise<void> {
    const { campagna } = this;

    for (const action of this.actions) {
      const entries = this.argomenti.get(action.fazione) ?? [];
      const argomenti = entries.filter(e => e.argomento !== '');
      const filePath = actionFilePath(
        campagna.meta.slug,
        campagna.meta.turno_corrente,
        action.fazione,
      );
      await patchActionFrontmatter<AzioneDeclaration>(this.app, filePath, {
        argomenti_contro: argomenti,
      } as any);
    }

    await patchCampagnaStato(this.app, campagna.meta.slug, 'contro_args');
    new Notice('Contro-argomentazioni aggiornate. Stato → contro_args.');
    this.onComplete();
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
