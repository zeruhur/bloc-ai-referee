import { App, Modal, Notice, Setting, SuggestModal } from 'obsidian';
import type { Accordo, FazioneConfig } from '../types';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { loadAccordiPubblici, patchAccordoStato } from '../vault/VaultManager';
import { loadCampagnaPrivata } from '../vault/CampagnaPrivataManager';
import { patchFazioneMC } from '../vault/CampaignWriter';

class TradimentoModal extends Modal {
  constructor(
    app: App,
    private accordi: Accordo[],
    private turnoCorrente: number,
    private onSubmit: (accordoId: string, fazione: string) => Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Dichiara tradimento' });

    if (this.accordi.length === 0) {
      contentEl.createEl('p', { text: 'Nessun accordo attivo.' });
      return;
    }

    let selectedAccordoId = this.accordi[0].id;
    let selectedFazione = this.accordi[0].fazioni[0];

    new Setting(contentEl)
      .setName('Accordo violato')
      .addDropdown(d => {
        this.accordi.forEach(a => {
          const label = `[${a.tipo}] ${a.fazioni.join(' / ')} — turno ${a.turno_stipula}`;
          d.addOption(a.id, label);
        });
        d.setValue(selectedAccordoId);
        d.onChange(v => {
          selectedAccordoId = v;
          const acc = this.accordi.find(a => a.id === v);
          selectedFazione = acc?.fazioni[0] ?? '';
        });
      });

    new Setting(contentEl)
      .setName('Fazione traditrice')
      .addText(t => {
        t.setValue(selectedFazione);
        t.onChange(v => { selectedFazione = v; });
      });

    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });
    btnRow.createEl('button', { text: 'Annulla' }).addEventListener('click', () => this.close());
    btnRow.createEl('button', { text: 'Conferma tradimento', cls: 'mod-warning' })
      .addEventListener('click', async () => {
        if (!selectedAccordoId || !selectedFazione) {
          new Notice('Seleziona accordo e fazione.');
          return;
        }
        await this.onSubmit(selectedAccordoId, selectedFazione);
        this.close();
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export async function cmdDichiaraTradimento(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  const { slug, turno_corrente } = campagna.meta;

  const [pubblici, privati] = await Promise.all([
    loadAccordiPubblici(app, slug),
    loadCampagnaPrivata(app, slug),
  ]);

  const attivi = [
    ...pubblici.accordi.filter(a => a.stato === 'attivo'),
    ...privati.accordi.filter(a => a.stato === 'attivo'),
  ];

  new TradimentoModal(app, attivi, turno_corrente, async (accordoId, fazione) => {
    await patchAccordoStato(app, slug, accordoId, 'violato', { turno: turno_corrente, fazione });
    await patchFazioneMC(app, slug, fazione, -1);
    new Notice(`Accordo ${accordoId} violato. MC di ${fazione} ridotto di 1.`);
  }).open();
}
