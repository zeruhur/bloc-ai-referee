import { App, Modal, Notice, Setting } from 'obsidian';
import type { Campagna, FazioneConfig, InterventoReattivo, TipoReazione } from '../types';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { activeFazioni } from '../utils/factionUtils';
import { INTERVENTO_REATTIVO_FILE } from '../constants';
import { turnPath, ensureTurnFolder } from '../vault/VaultManager';
import { parseYaml, stringifyYaml } from '../utils/yaml';

const TIPO_REAZIONE_LABELS: Record<TipoReazione, string> = {
  aiuto:     'Aiuto (+1 dado positivo alla fazione target)',
  svantaggio: 'Svantaggio (contro-argomento alla fazione target)',
};

class InterventoReattivoModal extends Modal {
  private fazioneInterveniente = '';
  private fazioneTarget = '';
  private tipo: TipoReazione = 'aiuto';
  private argomento = '';
  private risorsaUsata = '';

  constructor(
    app: App,
    private campagna: Campagna,
    private fazioni: FazioneConfig[],
    private resolve: (result: InterventoReattivo | null) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Dichiara Intervento Reattivo' });
    contentEl.createEl('p', {
      text: 'Gli interventi reattivi vengono dichiarati dopo la pubblicazione della matrice e prima delle contro-argomentazioni.',
      cls: 'setting-item-description',
    });

    if (this.fazioni.length > 0) {
      this.fazioneInterveniente = this.fazioni[0].id;
      this.fazioneTarget = this.fazioni.length > 1 ? this.fazioni[1].id : this.fazioni[0].id;
    }

    new Setting(contentEl)
      .setName('Fazione interveniente')
      .addDropdown(d => {
        this.fazioni.forEach(f => d.addOption(f.id, f.nome));
        if (this.fazioni[0]) d.setValue(this.fazioni[0].id);
        d.onChange(v => { this.fazioneInterveniente = v; });
      });

    new Setting(contentEl)
      .setName('Fazione target')
      .setDesc('La fazione che riceve l\'effetto dell\'intervento')
      .addDropdown(d => {
        this.fazioni.forEach(f => d.addOption(f.id, f.nome));
        const defaultTarget = this.fazioni.length > 1 ? this.fazioni[1].id : this.fazioni[0]?.id ?? '';
        d.setValue(defaultTarget);
        this.fazioneTarget = defaultTarget;
        d.onChange(v => { this.fazioneTarget = v; });
      });

    new Setting(contentEl)
      .setName('Tipo di intervento')
      .addDropdown(d => {
        (Object.entries(TIPO_REAZIONE_LABELS) as Array<[TipoReazione, string]>).forEach(([k, v]) =>
          d.addOption(k, v),
        );
        d.setValue(this.tipo);
        d.onChange(v => { this.tipo = v as TipoReazione; });
      });

    new Setting(contentEl)
      .setName('Argomento')
      .setDesc('Descrivi la natura dell\'intervento e perché è rilevante')
      .addTextArea(t => {
        t.setPlaceholder('Es. La fazione X mette a disposizione le sue rotte commerciali…');
        t.onChange(v => { this.argomento = v; });
      });

    new Setting(contentEl)
      .setName('Risorsa usata (opzionale)')
      .setDesc('Vantaggio o risorsa che la fazione impegna per questo intervento')
      .addText(t => {
        t.setPlaceholder('Es. Alleanza navale, scorte di grano…');
        t.onChange(v => { this.risorsaUsata = v; });
      });

    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });
    btnRow.createEl('button', { text: 'Annulla' }).addEventListener('click', () => {
      this.resolve(null);
      this.close();
    });
    btnRow.createEl('button', { text: 'Registra', cls: 'mod-cta' }).addEventListener('click', () => {
      if (!this.fazioneInterveniente || !this.fazioneTarget) {
        new Notice('Seleziona entrambe le fazioni.');
        return;
      }
      if (!this.argomento.trim()) {
        new Notice('Inserisci la descrizione dell\'argomento.');
        return;
      }
      const entry: InterventoReattivo = {
        fazione_interveniente: this.fazioneInterveniente,
        fazione_target: this.fazioneTarget,
        tipo: this.tipo,
        argomento: this.argomento.trim(),
        turno: this.campagna.meta.turno_corrente,
        ...(this.risorsaUsata.trim() ? { risorsa_usata: this.risorsaUsata.trim() } : {}),
      };
      this.resolve(entry);
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export async function cmdInterventoReattivo(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  if (campagna.meta.stato !== 'matrice_generata') {
    new Notice(`Intervento Reattivo disponibile solo dopo la generazione della matrice. Stato: ${campagna.meta.stato}`);
    return;
  }

  const fazioni = activeFazioni(campagna.fazioni);
  const { slug, turno_corrente } = campagna.meta;

  const result = await new Promise<InterventoReattivo | null>(resolve =>
    new InterventoReattivoModal(app, campagna, fazioni, resolve).open(),
  );
  if (!result) return;

  try {
    await ensureTurnFolder(app, slug, turno_corrente);
    const path = `${turnPath(slug, turno_corrente)}/${INTERVENTO_REATTIVO_FILE}`;
    const exists = await app.vault.adapter.exists(path);

    let interventi: InterventoReattivo[] = [];
    if (exists) {
      const content = await app.vault.adapter.read(path);
      const data = parseYaml<{ interventi: InterventoReattivo[] }>(content);
      interventi = data?.interventi ?? [];
    }
    interventi.push(result);
    await app.vault.adapter.write(path, stringifyYaml({ interventi }));

    const tipoLabel = result.tipo === 'aiuto' ? 'aiuto' : 'svantaggio';
    new Notice(`Intervento reattivo (${tipoLabel}) registrato: ${result.fazione_interveniente} → ${result.fazione_target}.`);
  } catch (e) {
    new Notice(`Errore: ${(e as Error).message}`);
  }
}
