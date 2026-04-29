import { App, Modal, Notice, Setting } from 'obsidian';
import type { Campagna, FazioneConfig } from '../types';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { activeFazioni } from '../utils/factionUtils';
import { INTERVENTO_FILE } from '../constants';
import { turnPath, ensureTurnFolder } from '../vault/VaultManager';
import { stringifyYaml } from '../utils/yaml';

type TipoEffetto =
  | 'consolida_risultato'
  | 'contiene_complicazione'
  | 'sostiene_alleato'
  | 'protegge_coesione';

const TIPO_EFFETTO_LABELS: Record<TipoEffetto, string> = {
  consolida_risultato:   'Consolida un risultato già ottenuto',
  contiene_complicazione: 'Contiene una complicazione già emersa',
  sostiene_alleato:      'Sostiene un alleato già coinvolto nell\'esito',
  protegge_coesione:     'Protegge la coesione della fazione',
};

class InterventoLimitatoModal extends Modal {
  private fazioneId = '';
  private descrizione = '';
  private tipoEffetto: TipoEffetto = 'consolida_risultato';
  private confermato = false;

  constructor(
    app: App,
    private campagna: Campagna,
    private fazioni: FazioneConfig[],
    private resolve: (result: Record<string, unknown> | null) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Intervento Limitato' });

    if (this.fazioni.length > 0) {
      this.fazioneId = this.fazioni[0].id;
    }

    new Setting(contentEl)
      .setName('Fazione che interviene')
      .addDropdown(d => {
        this.fazioni.forEach(f => d.addOption(f.id, f.nome));
        if (this.fazioni[0]) d.setValue(this.fazioni[0].id);
        d.onChange(v => { this.fazioneId = v; });
      });

    new Setting(contentEl)
      .setName('Descrizione dell\'intervento')
      .addTextArea(t => {
        t.setPlaceholder('Descrivi l\'intervento limitato…');
        t.onChange(v => { this.descrizione = v; });
      });

    new Setting(contentEl)
      .setName('Tipo di effetto')
      .addDropdown(d => {
        (Object.entries(TIPO_EFFETTO_LABELS) as Array<[TipoEffetto, string]>).forEach(([k, v]) => d.addOption(k, v));
        d.setValue(this.tipoEffetto);
        d.onChange(v => { this.tipoEffetto = v as TipoEffetto; });
      });

    // Guardrail checklist
    const guardrailEl = contentEl.createDiv();
    guardrailEl.createEl('h3', { text: 'Verifica guardrail' });
    guardrailEl.createEl('p', {
      text: 'Verificare che l\'intervento NON:',
      cls: 'setting-item-description',
    });
    const items = [
      'richieda una dichiarazione strutturata',
      'generi opposizione significativa',
      'produca un tiro di dadi',
      'possa avviare un conflitto diretto',
    ];
    items.forEach(item => {
      guardrailEl.createEl('p', { text: `□ ${item}`, cls: 'setting-item-description' });
    });
    guardrailEl.createEl('p', {
      text: 'Se anche solo una di queste condizioni è vera, rimandare al turno successivo.',
      cls: 'setting-item-description',
    });

    new Setting(contentEl)
      .setName('Confermo: questo è un Intervento Limitato valido')
      .addToggle(t => {
        t.setValue(false);
        t.onChange(v => { this.confermato = v; });
      });

    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });
    btnRow.createEl('button', { text: 'Annulla' }).addEventListener('click', () => {
      this.resolve(null);
      this.close();
    });
    btnRow.createEl('button', { text: 'Registra', cls: 'mod-cta' }).addEventListener('click', () => {
      if (!this.fazioneId || !this.descrizione.trim()) {
        new Notice('Seleziona una fazione e inserisci la descrizione.');
        return;
      }
      if (!this.confermato) {
        new Notice('Devi confermare che questo è un Intervento Limitato valido.');
        return;
      }
      this.resolve({
        fazione: this.fazioneId,
        turno: this.campagna.meta.turno_corrente,
        descrizione: this.descrizione.trim(),
        tipo_effetto: this.tipoEffetto,
      });
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export async function cmdInterventoLimitato(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  if (campagna.meta.stato !== 'review') {
    new Notice(`Intervento Limitato disponibile solo in fase review. Stato corrente: ${campagna.meta.stato}`);
    return;
  }

  const fazioni = activeFazioni(campagna.fazioni);
  const { slug, turno_corrente } = campagna.meta;

  const result = await new Promise<Record<string, unknown> | null>(resolve =>
    new InterventoLimitatoModal(app, campagna, fazioni, resolve).open(),
  );
  if (!result) return;

  try {
    await ensureTurnFolder(app, slug, turno_corrente);
    const path = `${turnPath(slug, turno_corrente)}/${INTERVENTO_FILE}`;
    const exists = await app.vault.adapter.exists(path);
    const entry = stringifyYaml(result);
    if (exists) {
      const current = await app.vault.adapter.read(path);
      await app.vault.adapter.write(path, current + '\n---\n' + entry);
    } else {
      await app.vault.adapter.write(path, entry);
    }
    new Notice(`Intervento limitato registrato per ${result['fazione']}.`);
  } catch (e) {
    new Notice(`Errore: ${(e as Error).message}`);
  }
}
