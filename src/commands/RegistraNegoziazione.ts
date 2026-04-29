import { App, Modal, Notice, Setting } from 'obsidian';
import type { Campagna } from '../types';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { appendAccordoPrivato } from '../vault/CampagnaPrivataManager';
import { saveAccordoPubblico } from '../vault/VaultManager';
import { RegistraAccordoModal } from '../ui/modals/RegistraAccordoModal';
import { turnPath, ensureTurnFolder } from '../vault/VaultManager';
import { stringifyYaml } from '../utils/yaml';

class RegistraNegoziazioneModal extends Modal {
  private tipo: 'accordo_formale' | 'nota_negoziazione' = 'accordo_formale';
  private visibilita: 'privato' | 'pubblico' = 'privato';
  private nota = '';

  constructor(
    app: App,
    private campagna: Campagna,
    private resolve: (tipo: 'accordo_formale_privato' | 'accordo_formale_pubblico' | 'nota' | null, nota?: string) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Registra negoziazione' });

    new Setting(contentEl)
      .setName('Tipo registrazione')
      .addDropdown(d => {
        d.addOption('accordo_formale', 'Accordo formale');
        d.addOption('nota_negoziazione', 'Nota negoziazione');
        d.setValue(this.tipo);
        d.onChange(v => {
          this.tipo = v as typeof this.tipo;
          this.renderDynamic(contentEl);
        });
      });

    this.renderDynamic(contentEl);

    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });
    btnRow.createEl('button', { text: 'Annulla' }).addEventListener('click', () => {
      this.resolve(null);
      this.close();
    });
    btnRow.createEl('button', { text: 'Continua', cls: 'mod-cta' }).addEventListener('click', () => {
      if (this.tipo === 'accordo_formale') {
        this.resolve(this.visibilita === 'privato' ? 'accordo_formale_privato' : 'accordo_formale_pubblico');
      } else {
        if (!this.nota.trim()) {
          new Notice('Inserisci la nota di negoziazione.');
          return;
        }
        this.resolve('nota', this.nota.trim());
      }
      this.close();
    });
  }

  private renderDynamic(contentEl: HTMLElement): void {
    const existing = contentEl.querySelector('.negoziazione-dynamic');
    if (existing) existing.remove();

    const dynamic = contentEl.createDiv({ cls: 'negoziazione-dynamic' });

    if (this.tipo === 'accordo_formale') {
      new Setting(dynamic)
        .setName('Visibilità accordo')
        .addDropdown(d => {
          d.addOption('privato', 'Privato');
          d.addOption('pubblico', 'Pubblico');
          d.setValue(this.visibilita);
          d.onChange(v => { this.visibilita = v as 'privato' | 'pubblico'; });
        });
    } else {
      new Setting(dynamic)
        .setName('Nota negoziazione')
        .addTextArea(t => {
          t.setPlaceholder('Descrivi la coordinazione informale…');
          t.onChange(v => { this.nota = v; });
        });
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export async function cmdRegistraNegoziazione(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  if (campagna.meta.stato !== 'raccolta') {
    new Notice(`Comando non disponibile in stato: ${campagna.meta.stato}`);
    return;
  }

  const { slug, turno_corrente } = campagna.meta;

  const scelta = await new Promise<{ tipo: 'accordo_formale_privato' | 'accordo_formale_pubblico' | 'nota' | null; nota?: string }>(
    resolve => new RegistraNegoziazioneModal(app, campagna, (tipo, nota) => resolve({ tipo, nota })).open(),
  );
  if (!scelta.tipo) return;

  if (scelta.tipo === 'accordo_formale_privato') {
    new RegistraAccordoModal(app, campagna.fazioni, turno_corrente, async (accordo) => {
      await appendAccordoPrivato(app, slug, accordo);
      new Notice('Accordo privato registrato.');
    }).open();
  } else if (scelta.tipo === 'accordo_formale_pubblico') {
    new RegistraAccordoModal(app, campagna.fazioni, turno_corrente, async (accordo) => {
      await saveAccordoPubblico(app, slug, accordo);
      new Notice('Accordo pubblico registrato.');
    }).open();
  } else if (scelta.tipo === 'nota' && scelta.nota) {
    try {
      await ensureTurnFolder(app, slug, turno_corrente);
      const path = `${turnPath(slug, turno_corrente)}/negoziazione.md`;
      const exists = await app.vault.adapter.exists(path);
      const entry = `## Nota negoziazione — Turno ${turno_corrente}\n${scelta.nota}\n`;
      if (exists) {
        const current = await app.vault.adapter.read(path);
        await app.vault.adapter.write(path, current + '\n' + entry);
      } else {
        await app.vault.adapter.write(path, entry);
      }
      new Notice('Nota negoziazione registrata.');
    } catch (e) {
      new Notice(`Errore: ${(e as Error).message}`);
    }
  }
}
