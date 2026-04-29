import { App, Modal, Notice, Setting } from 'obsidian';
import type { Campagna, FazioneConfig, MovimentoTurno } from '../types';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { activeFazioni } from '../utils/factionUtils';
import { MOVIMENTO_FILE } from '../constants';
import { turnPath, ensureTurnFolder } from '../vault/VaultManager';
import { stringifyYaml } from '../utils/yaml';

class MovimentoTurnoModal extends Modal {
  private fazioneId = '';
  private descrizione = '';
  private territori = '';

  constructor(
    app: App,
    private campagna: Campagna,
    private fazioni: FazioneConfig[],
    private resolve: (result: MovimentoTurno | null) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: `Movimento del turno — Turno ${this.campagna.meta.turno_corrente}` });

    if (this.fazioni.length > 0) {
      this.fazioneId = this.fazioni[0].id;
    }

    new Setting(contentEl)
      .setName('Fazione')
      .addDropdown(d => {
        this.fazioni.forEach(f => d.addOption(f.id, f.nome));
        if (this.fazioni[0]) d.setValue(this.fazioni[0].id);
        d.onChange(v => { this.fazioneId = v; });
      });

    new Setting(contentEl)
      .setName('Descrizione movimento')
      .addTextArea(t => {
        t.setPlaceholder('Descrivi il movimento…');
        t.onChange(v => { this.descrizione = v; });
      });

    new Setting(contentEl)
      .setName('Territori coinvolti (opzionale)')
      .setDesc('Separati da virgola')
      .addText(t => {
        t.setPlaceholder('es. Nord, Centro');
        t.onChange(v => { this.territori = v; });
      });

    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });
    btnRow.createEl('button', { text: 'Annulla' }).addEventListener('click', () => {
      this.resolve(null);
      this.close();
    });
    btnRow.createEl('button', { text: 'Registra', cls: 'mod-cta' }).addEventListener('click', () => {
      if (!this.fazioneId || !this.descrizione.trim()) {
        new Notice('Seleziona una fazione e inserisci la descrizione del movimento.');
        return;
      }
      const result: MovimentoTurno = {
        fazione: this.fazioneId,
        turno: this.campagna.meta.turno_corrente,
        descrizione: this.descrizione.trim(),
      };
      if (this.territori.trim()) {
        result.territori_coinvolti = this.territori.split(',').map(t => t.trim()).filter(Boolean);
      }
      this.resolve(result);
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export async function cmdMovimentoTurno(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  if (!campagna.meta.usa_mappa) {
    new Notice('La campagna non usa una mappa.');
    return;
  }

  if (campagna.meta.stato !== 'raccolta') {
    new Notice(`Comando non disponibile in stato: ${campagna.meta.stato}`);
    return;
  }

  const fazioni = activeFazioni(campagna.fazioni);
  const { slug, turno_corrente } = campagna.meta;

  const movimento = await new Promise<MovimentoTurno | null>(resolve =>
    new MovimentoTurnoModal(app, campagna, fazioni, resolve).open(),
  );
  if (!movimento) return;

  try {
    await ensureTurnFolder(app, slug, turno_corrente);
    const path = `${turnPath(slug, turno_corrente)}/${MOVIMENTO_FILE}`;
    const exists = await app.vault.adapter.exists(path);
    const entry = stringifyYaml(movimento);
    if (exists) {
      const current = await app.vault.adapter.read(path);
      await app.vault.adapter.write(path, current + '\n---\n' + entry);
    } else {
      await app.vault.adapter.write(path, entry);
    }
    new Notice(`Movimento registrato per ${movimento.fazione}.`);
  } catch (e) {
    new Notice(`Errore: ${(e as Error).message}`);
  }
}
