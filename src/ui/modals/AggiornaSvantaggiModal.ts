import { App, Modal, Notice } from 'obsidian';
import type { AzioneDeclaration, Campagna } from '../../types';
import { actionFilePath } from '../../vault/ActionLoader';
import { patchActionFrontmatter } from '../../vault/VaultManager';
import { patchCampagnaStato } from '../../vault/CampaignWriter';

export class AggiornaSvantaggiModal extends Modal {
  private argomenti: Map<string, string> = new Map();

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
      text: 'Per ogni azione, inserisci le obiezioni contestuali (una per riga). Lascia vuoto se non ce ne sono.',
    });

    for (const action of this.actions) {
      const existing = (action.argomenti_contro ?? []).join('\n');
      this.argomenti.set(action.fazione, existing);

      const section = contentEl.createDiv({ cls: 'bloc-action-section' });
      section.createEl('h3', { text: `${action.fazione}: ${action.risultato}` });
      section.createEl('p', { text: 'Contro-argomentazioni (una per riga):', cls: 'setting-item-name' });

      const ta = section.createEl('textarea', {
        cls: 'bloc-argomento-textarea',
        attr: { rows: '4', style: 'width:100%;margin-bottom:8px' },
      });
      ta.value = existing;
      ta.addEventListener('input', () => {
        this.argomenti.set(action.fazione, ta.value);
      });
    }

    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });
    btnRow.createEl('button', { text: 'Annulla' }).addEventListener('click', () => this.close());
    btnRow.createEl('button', { text: 'Salva', cls: 'mod-cta' })
      .addEventListener('click', () => this.save());
  }

  private async save(): Promise<void> {
    const { campagna } = this;

    for (const action of this.actions) {
      const raw = this.argomenti.get(action.fazione) ?? '';
      const argomenti = raw.split('\n').map(s => s.trim()).filter(s => s !== '');
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
