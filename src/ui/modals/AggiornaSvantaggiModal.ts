import { App, Modal, Notice, Setting } from 'obsidian';
import type { AzioneDeclaration, Campagna, FazioneConfig } from '../../types';
import { loadActionsForTurn, actionFilePath } from '../../vault/ActionLoader';
import { patchActionFrontmatter } from '../../vault/VaultManager';
import { patchCampagnaStato } from '../../vault/CampaignWriter';

export class AggiornaSvantaggiModal extends Modal {
  private selections: Map<string, string[]> = new Map();

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
    contentEl.createEl('h2', { text: 'Aggiorna svantaggi opposti' });
    contentEl.createEl('p', {
      text: 'Per ogni azione, seleziona gli svantaggi che gli avversari oppongono.',
    });

    for (const action of this.actions) {
      const section = contentEl.createDiv({ cls: 'bloc-action-section' });
      section.createEl('h3', { text: `${action.fazione}: ${action.azione}` });

      const opponents = this.campagna.fazioni.filter(f => f.id !== action.fazione);
      this.selections.set(action.fazione, []);

      for (const opponent of opponents) {
        section.createEl('p', { text: `Svantaggi da ${opponent.nome}:` });
        const svantaggio = opponent.svantaggio;
        const label = section.createEl('label', { cls: 'bloc-checkbox-label' });
        const checkbox = label.createEl('input', { type: 'checkbox' } as any);
        (checkbox as HTMLInputElement).addEventListener('change', (e) => {
          const checked = (e.target as HTMLInputElement).checked;
          const current = this.selections.get(action.fazione) ?? [];
          if (checked) {
            this.selections.set(action.fazione, [...current, svantaggio.id]);
          } else {
            this.selections.set(action.fazione, current.filter(id => id !== svantaggio.id));
          }
        });
        label.createEl('span', { text: ` ${svantaggio.label}` });
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
      const svantaggi = this.selections.get(action.fazione) ?? [];
      const filePath = actionFilePath(
        campagna.meta.slug,
        campagna.meta.turno_corrente,
        action.fazione,
      );
      await patchActionFrontmatter<AzioneDeclaration>(this.app, filePath, {
        svantaggi_opposti: svantaggi,
      } as any);
    }

    await patchCampagnaStato(this.app, campagna.meta.slug, 'contro_args');
    new Notice('Svantaggi aggiornati. Stato → contro_args.');
    this.onComplete();
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
