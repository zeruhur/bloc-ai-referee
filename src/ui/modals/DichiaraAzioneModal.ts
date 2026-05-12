import { App, Modal, Notice, Setting } from 'obsidian';
import type { AzioneDeclaration, Campagna, CategoriaAzione, FazioneConfig } from '../../types';
import { writeActionFile, turnPath, fileExists } from '../../vault/VaultManager';
import { appendToRollsFile } from '../../vault/VaultManager';
import { declaringFazioni } from '../../utils/factionUtils';
import { LEADER_CHECK_FILE } from '../../constants';
import { parseFrontmatter } from '../../utils/yaml';
import type { LeaderCheckResult } from '../../types';

type LeaderMode = 'presenza_comando' | 'azione_leadership';

type DeclSection = Partial<AzioneDeclaration> & { categoria_azione: CategoriaAzione };

function emptySection(): DeclSection {
  return { argomenti_contro: [], tipo_azione: 'principale', categoria_azione: 'standard' };
}

async function loadLeaderCheck(app: App, slug: string, turno: number, fazioneId: string): Promise<LeaderCheckResult | null> {
  const path = `${turnPath(slug, turno)}/${LEADER_CHECK_FILE}`;
  const exists = await app.vault.adapter.exists(path);
  if (!exists) return null;
  const content = await app.vault.adapter.read(path);
  const data = parseFrontmatter<{ leader_checks: LeaderCheckResult[] }>(content);
  return data?.leader_checks?.find(r => r.fazione === fazioneId) ?? null;
}

export class DichiaraAzioneModal extends Modal {
  private decl: DeclSection = emptySection();
  private selectedFazione: FazioneConfig | null = null;
  private giocatore = '';
  private leaderMode: LeaderMode | '' = '';
  private leaderCheck: LeaderCheckResult | null = null;

  constructor(
    app: App,
    private campagna: Campagna,
    private onComplete: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.renderForm();
  }

  private async loadLeaderCheckForFazione(): Promise<void> {
    if (!this.selectedFazione?.leader?.presente || !this.decl.fazione) {
      this.leaderCheck = null;
      return;
    }
    const { slug, turno_corrente } = this.campagna.meta;
    this.leaderCheck = await loadLeaderCheck(this.app, slug, turno_corrente, this.decl.fazione);
  }

  private renderForm(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: `Dichiara azione — Turno ${this.campagna.meta.turno_corrente}` });

    const fazionUmane = declaringFazioni(this.campagna.fazioni).filter(f => f.tipo !== 'ia');

    new Setting(contentEl)
      .setName('Fazione')
      .addDropdown(d => {
        fazionUmane.forEach(f => d.addOption(f.id, f.nome));
        d.onChange(async v => {
          this.selectedFazione = this.campagna.fazioni.find(f => f.id === v) ?? null;
          this.decl.fazione = v;
          this.leaderMode = '';
          await this.loadLeaderCheckForFazione();
          this.renderForm();
        });
        const firstId = fazionUmane[0]?.id;
        if (firstId) {
          d.setValue(this.decl.fazione ?? firstId);
          if (!this.decl.fazione) {
            this.selectedFazione = fazionUmane[0];
            this.decl.fazione = firstId;
          }
        }
      });

    new Setting(contentEl)
      .setName('Giocatore')
      .addText(t => {
        t.setValue(this.giocatore);
        t.onChange(v => { this.giocatore = v; });
      });

    contentEl.createEl('h3', { text: 'Azione' });
    this.renderActionSection(contentEl);

    // ---- Leader mode (visible only if leader.presente && leaderCheck.disponibile) ----
    const leaderPresente = this.selectedFazione?.leader?.presente === true;
    const leaderDisponibile = this.leaderCheck?.disponibile === true;

    if (leaderPresente && leaderDisponibile) {
      const leaderNome = this.selectedFazione?.leader?.nome;
      new Setting(contentEl)
        .setName(`Modalità leader${leaderNome ? ` — ${leaderNome}` : ''}`)
        .setDesc('Augmenta o sostituisce l\'azione ordinaria.')
        .addDropdown(d => {
          d.addOption('', 'Nessuna');
          d.addOption('presenza_comando', 'Presenza di Comando');
          d.addOption('azione_leadership', 'Azione di Leadership');
          d.setValue(this.leaderMode);
          d.onChange(v => { this.leaderMode = v as LeaderMode | ''; });
        });
    }

    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });
    btnRow.createEl('button', { text: 'Annulla' }).addEventListener('click', () => this.close());
    btnRow.createEl('button', { text: 'Dichiara', cls: 'mod-cta' })
      .addEventListener('click', () => {
        this.submit().catch(e => new Notice(`Errore nella dichiarazione: ${(e as Error).message}`));
      });
  }

  private renderActionSection(container: HTMLElement): void {
    new Setting(container)
      .setName('Categoria azione')
      .addDropdown(d => d
        .addOption('standard', 'Standard')
        .addOption('latente', 'Latente')
        .addOption('difesa', 'Difesa')
        .addOption('segreta', 'Segreta')
        .addOption('spionaggio', 'Spionaggio')
        .setValue(this.decl.categoria_azione)
        .onChange(v => {
          this.decl.categoria_azione = v as CategoriaAzione;
          this.decl.costo_vantaggio = undefined;
          this.decl.target_fazione = undefined;
          this.renderForm();
        }));

    if (this.decl.categoria_azione === 'segreta') {
      const fazione = this.campagna.fazioni.find(f => f.id === this.decl.fazione);
      container.createEl('p', {
        text: 'Le azioni segrete richiedono il sacrificio di un vantaggio.',
        cls: 'setting-item-description',
      });
      new Setting(container)
        .setName('Vantaggio sacrificato')
        .addDropdown(d => {
          d.addOption('', '— seleziona —');
          (fazione?.vantaggi ?? []).forEach(v => d.addOption(v, v));
          if (this.decl.costo_vantaggio) d.setValue(this.decl.costo_vantaggio);
          d.onChange(v => { this.decl.costo_vantaggio = v || undefined; });
        });
    }

    if (this.decl.categoria_azione === 'spionaggio') {
      const altreFazioni = this.campagna.fazioni.filter(f => f.id !== this.decl.fazione);
      container.createEl('p', {
        text: 'Dado scoperta pre-pipeline (1d6 + MC_spia − MC_target, soglia 4).',
        cls: 'setting-item-description',
      });
      new Setting(container)
        .setName('Fazione bersaglio')
        .addDropdown(d => {
          altreFazioni.forEach(f => d.addOption(f.id, f.nome));
          if (altreFazioni[0]) {
            d.setValue(this.decl.target_fazione ?? altreFazioni[0].id);
            this.decl.target_fazione = this.decl.target_fazione ?? altreFazioni[0].id;
          }
          d.onChange(v => { this.decl.target_fazione = v; });
        });
    }

    if (this.decl.categoria_azione === 'latente') {
      container.createEl('p', {
        text: 'Azione latente: salvata fuori dal turno corrente. Attivare con "Attiva azione latente".',
        cls: 'setting-item-description',
      });
    }

    new Setting(container)
      .setName('Risultato')
      .setDesc('Cosa vuole ottenere la fazione.')
      .addText(t => {
        t.setValue(this.decl.risultato ?? '');
        t.onChange(v => { this.decl.risultato = v; });
      });

    new Setting(container)
      .setName('Azione')
      .setDesc('Come la fazione intende realizzarlo.')
      .addTextArea(t => {
        t.setValue(this.decl.azione ?? '');
        t.onChange(v => { this.decl.azione = v.slice(0, 200); });
      });

    new Setting(container)
      .setName('Argomento favorevole')
      .setDesc('Perché questa fazione ha le capacità per riuscire in questa azione.')
      .addTextArea(t => {
        t.setValue(this.decl.argomento_favorevole ?? '');
        t.onChange(v => { this.decl.argomento_favorevole = v; });
      });

    new Setting(container)
      .setName('Dettaglio narrativo (opzionale)')
      .setDesc('Solo layer umano, non inviato all\'LLM')
      .addTextArea(t => {
        t.setValue(this.decl.dettaglio_narrativo ?? '');
        t.onChange(v => { this.decl.dettaglio_narrativo = v; });
      });
  }

  private async submit(): Promise<void> {
    const { campagna, decl, giocatore } = this;

    if (!decl.fazione || !decl.risultato || !decl.azione || !decl.argomento_favorevole) {
      new Notice('Compila tutti i campi obbligatori.');
      return;
    }
    if (decl.categoria_azione === 'segreta' && !decl.costo_vantaggio) {
      new Notice('Seleziona il vantaggio sacrificato per l\'azione segreta.');
      return;
    }
    if (decl.categoria_azione === 'spionaggio' && !decl.target_fazione) {
      new Notice('Seleziona la fazione bersaglio.');
      return;
    }

    const { slug, turno_corrente } = campagna.meta;
    const giocatoreVal = giocatore || 'Arbitro';

    const fullDecl: AzioneDeclaration = {
      fazione: decl.fazione!,
      giocatore: giocatoreVal,
      turno: turno_corrente,
      tipo_azione: 'principale',
      categoria_azione: decl.categoria_azione,
      risultato: decl.risultato!,
      azione: decl.azione!,
      argomento_favorevole: decl.argomento_favorevole!,
      argomenti_contro: [],
      leader_mode: this.leaderMode || undefined,
      costo_vantaggio: decl.costo_vantaggio,
      target_fazione: decl.target_fazione,
      dettaglio_narrativo: decl.dettaglio_narrativo,
    };

    await writeActionFile(this.app, slug, turno_corrente, fullDecl);

    if (decl.categoria_azione === 'latente') {
      new Notice(`Azione latente salvata per ${decl.fazione} (fazioni/${decl.fazione}-latenti.md). Usare "Attiva azione latente" per inserirla nel turno.`);
    } else {
      new Notice(`Azione dichiarata per ${decl.fazione}.`);
    }

    this.onComplete();
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
