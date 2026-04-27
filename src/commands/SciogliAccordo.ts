import { App, Modal, Notice, Setting } from 'obsidian';
import type { Accordo } from '../types';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { loadAccordiPubblici, patchAccordoStato } from '../vault/VaultManager';
import { loadCampagnaPrivata } from '../vault/CampagnaPrivataManager';

class SciogliModal extends Modal {
  constructor(
    app: App,
    private accordi: Accordo[],
    private onSubmit: (accordoId: string) => Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Sciogli accordo' });

    if (this.accordi.length === 0) {
      contentEl.createEl('p', { text: 'Nessun accordo attivo.' });
      return;
    }

    let selectedId = this.accordi[0].id;

    new Setting(contentEl)
      .setName('Accordo da sciogliere')
      .addDropdown(d => {
        this.accordi.forEach(a => {
          const label = `[${a.tipo}] ${a.fazioni.join(' / ')} — turno ${a.turno_stipula}`;
          d.addOption(a.id, label);
        });
        d.setValue(selectedId);
        d.onChange(v => { selectedId = v; });
      });

    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });
    btnRow.createEl('button', { text: 'Annulla' }).addEventListener('click', () => this.close());
    btnRow.createEl('button', { text: 'Sciogli', cls: 'mod-cta' })
      .addEventListener('click', async () => {
        await this.onSubmit(selectedId);
        this.close();
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export async function cmdSciogliAccordo(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  const { slug } = campagna.meta;

  const [pubblici, privati] = await Promise.all([
    loadAccordiPubblici(app, slug),
    loadCampagnaPrivata(app, slug),
  ]);

  const attivi = [
    ...pubblici.accordi.filter(a => a.stato === 'attivo'),
    ...privati.accordi.filter(a => a.stato === 'attivo'),
  ];

  new SciogliModal(app, attivi, async (accordoId) => {
    await patchAccordoStato(app, slug, accordoId, 'risolto');
    new Notice(`Accordo ${accordoId} sciolto.`);
  }).open();
}
