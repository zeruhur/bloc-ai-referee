import { App, Modal, Notice, Setting } from 'obsidian';
import type { AzioneDeclaration, Campagna, CategoriaAzione, FazioneConfig } from '../../types';
import { writeActionFile, leaderActionFilePath, fileExists } from '../../vault/VaultManager';
import { leaderAvailability } from '../../dice/DiceEngine';
import { appendToRollsFile } from '../../vault/VaultManager';
import { declaringFazioni } from '../../utils/factionUtils';

type DeclSection = Partial<AzioneDeclaration> & { categoria_azione: CategoriaAzione };

function emptySection(tipo: 'principale' | 'leader'): DeclSection {
  return { argomenti_contro: [], tipo_azione: tipo, categoria_azione: 'standard' };
}

export class DichiaraAzioneModal extends Modal {
  private principal: DeclSection = emptySection('principale');
  private leader: DeclSection = emptySection('leader');
  private selectedFazione: FazioneConfig | null = null;
  private giocatore = '';

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

  private renderForm(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: `Dichiara azione — Turno ${this.campagna.meta.turno_corrente}` });

    const fazionUmane = declaringFazioni(this.campagna.fazioni).filter(f => f.tipo !== 'ia');

    // ---- Fazione + giocatore ----
    new Setting(contentEl)
      .setName('Fazione')
      .addDropdown(d => {
        fazionUmane.forEach(f => d.addOption(f.id, f.nome));
        d.onChange(v => {
          this.selectedFazione = this.campagna.fazioni.find(f => f.id === v) ?? null;
          this.principal.fazione = v;
          this.leader.fazione = v;
          this.renderForm();
        });
        const firstId = fazionUmane[0]?.id;
        if (firstId) {
          d.setValue(this.principal.fazione ?? firstId);
          if (!this.principal.fazione) {
            this.selectedFazione = fazionUmane[0];
            this.principal.fazione = firstId;
            this.leader.fazione = firstId;
          }
        }
      });

    new Setting(contentEl)
      .setName('Giocatore')
      .addText(t => {
        t.setValue(this.giocatore);
        t.onChange(v => { this.giocatore = v; });
      });

    // ---- Azione principale ----
    contentEl.createEl('h3', { text: 'Azione principale' });
    this.renderActionSection(contentEl, this.principal, () => this.renderForm());

    // ---- Azione leader (collassabile) ----
    const leaderNome = this.selectedFazione?.leader?.nome;
    const details = contentEl.createEl('details');
    const summary = details.createEl('summary');
    summary.createEl('strong', {
      text: leaderNome ? `Azione leader — ${leaderNome}` : 'Azione leader',
    });
    summary.createEl('span', {
      text: ' (opzionale)',
      cls: 'setting-item-description',
    });
    this.renderActionSection(details, this.leader, () => this.renderForm());

    // ---- Bottoni ----
    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });
    btnRow.createEl('button', { text: 'Annulla' }).addEventListener('click', () => this.close());
    btnRow.createEl('button', { text: 'Dichiara', cls: 'mod-cta' })
      .addEventListener('click', () => this.submit());
  }

  private renderActionSection(
    container: HTMLElement,
    decl: DeclSection,
    onRerender: () => void,
  ): void {
    new Setting(container)
      .setName('Categoria azione')
      .addDropdown(d => d
        .addOption('standard', 'Standard')
        .addOption('latente', 'Latente')
        .addOption('difesa', 'Difesa')
        .addOption('aiuto', 'Aiuto')
        .addOption('segreta', 'Segreta')
        .addOption('spionaggio', 'Spionaggio')
        .setValue(decl.categoria_azione)
        .onChange(v => {
          decl.categoria_azione = v as CategoriaAzione;
          decl.costo_vantaggio = undefined;
          decl.target_fazione = undefined;
          decl.fazione_aiutata = undefined;
          onRerender();
        }));

    if (decl.categoria_azione === 'aiuto') {
      const altreFazioni = this.campagna.fazioni.filter(f => f.id !== decl.fazione);
      new Setting(container)
        .setName('Fazione aiutata')
        .addDropdown(d => {
          altreFazioni.forEach(f => d.addOption(f.id, f.nome));
          if (altreFazioni[0]) {
            d.setValue(decl.fazione_aiutata ?? altreFazioni[0].id);
            decl.fazione_aiutata = decl.fazione_aiutata ?? altreFazioni[0].id;
          }
          d.onChange(v => { decl.fazione_aiutata = v; });
        });
    }

    if (decl.categoria_azione === 'segreta') {
      const fazione = this.campagna.fazioni.find(f => f.id === decl.fazione);
      container.createEl('p', {
        text: 'Le azioni segrete richiedono il sacrificio di un vantaggio.',
        cls: 'setting-item-description',
      });
      new Setting(container)
        .setName('Vantaggio sacrificato')
        .addDropdown(d => {
          d.addOption('', '— seleziona —');
          (fazione?.vantaggi ?? []).forEach(v => d.addOption(v, v));
          d.onChange(v => { decl.costo_vantaggio = v || undefined; });
        });
    }

    if (decl.categoria_azione === 'spionaggio') {
      const altreFazioni = this.campagna.fazioni.filter(f => f.id !== decl.fazione);
      container.createEl('p', {
        text: 'Dado scoperta pre-pipeline (1d6 + MC_spia − MC_target, soglia 4).',
        cls: 'setting-item-description',
      });
      new Setting(container)
        .setName('Fazione bersaglio')
        .addDropdown(d => {
          altreFazioni.forEach(f => d.addOption(f.id, f.nome));
          if (altreFazioni[0]) {
            d.setValue(decl.target_fazione ?? altreFazioni[0].id);
            decl.target_fazione = decl.target_fazione ?? altreFazioni[0].id;
          }
          d.onChange(v => { decl.target_fazione = v; });
        });
    }

    if (decl.categoria_azione === 'latente') {
      container.createEl('p', {
        text: 'Azione latente: salvata fuori dal turno corrente. Attivare con "Attiva azione latente".',
        cls: 'setting-item-description',
      });
    }

    new Setting(container)
      .setName('Azione (max 80 car.)')
      .addText(t => {
        t.setValue(decl.azione ?? '');
        t.onChange(v => { decl.azione = v.slice(0, 80); });
      });

    new Setting(container)
      .setName('Metodo (max 200 car.)')
      .addTextArea(t => {
        t.setValue(decl.metodo ?? '');
        t.onChange(v => { decl.metodo = v.slice(0, 200); });
      });

    new Setting(container)
      .setName('Argomento di vantaggio')
      .setDesc('Perché questa fazione ha le capacità per riuscire in questa azione.')
      .addTextArea(t => {
        t.setValue(decl.argomento_vantaggio ?? '');
        t.onChange(v => { decl.argomento_vantaggio = v; });
      });

    new Setting(container)
      .setName('Dettaglio narrativo (opzionale)')
      .setDesc('Solo layer umano, non inviato all\'LLM')
      .addTextArea(t => {
        t.setValue(decl.dettaglio_narrativo ?? '');
        t.onChange(v => { decl.dettaglio_narrativo = v; });
      });
  }

  private async submit(): Promise<void> {
    const { campagna, principal, leader, giocatore } = this;

    if (!principal.fazione || !principal.azione || !principal.metodo || !principal.argomento_vantaggio) {
      new Notice('Compila tutti i campi obbligatori dell\'azione principale.');
      return;
    }
    if (principal.categoria_azione === 'aiuto' && !principal.fazione_aiutata) {
      new Notice('Seleziona la fazione aiutata.');
      return;
    }
    if (principal.categoria_azione === 'segreta' && !principal.costo_vantaggio) {
      new Notice('Seleziona il vantaggio sacrificato per l\'azione segreta.');
      return;
    }
    if (principal.categoria_azione === 'spionaggio' && !principal.target_fazione) {
      new Notice('Seleziona la fazione bersaglio.');
      return;
    }

    const { slug, turno_corrente } = campagna.meta;
    const giocatoreVal = giocatore || 'Arbitro';

    const fullPrincipal: AzioneDeclaration = {
      fazione: principal.fazione!,
      giocatore: giocatoreVal,
      turno: turno_corrente,
      tipo_azione: 'principale',
      categoria_azione: principal.categoria_azione,
      azione: principal.azione!,
      metodo: principal.metodo!,
      argomento_vantaggio: principal.argomento_vantaggio!,
      argomenti_contro: [],
      fazione_aiutata: principal.fazione_aiutata,
      costo_vantaggio: principal.costo_vantaggio,
      target_fazione: principal.target_fazione,
      dettaglio_narrativo: principal.dettaglio_narrativo,
    };

    await writeActionFile(this.app, slug, turno_corrente, fullPrincipal);

    // ---- Azione leader (opzionale: solo se compilata) ----
    if (leader.azione?.trim()) {
      if (leader.categoria_azione === 'aiuto' && !leader.fazione_aiutata) {
        new Notice('Seleziona la fazione aiutata per l\'azione leader.');
        return;
      }
      if (leader.categoria_azione === 'segreta' && !leader.costo_vantaggio) {
        new Notice('Seleziona il vantaggio sacrificato per l\'azione leader segreta.');
        return;
      }
      if (leader.categoria_azione === 'spionaggio' && !leader.target_fazione) {
        new Notice('Seleziona la fazione bersaglio per l\'azione leader.');
        return;
      }

      const fazione = campagna.fazioni.find(f => f.id === leader.fazione);
      const available = leaderAvailability(fazione?.mc ?? 0);

      if (!available) {
        await appendToRollsFile(
          this.app, slug, turno_corrente,
          `## Leader ${leader.fazione} — Turno ${turno_corrente}\nLeader NON disponibile questo turno.\n`,
        );
        new Notice(`Azione principale dichiarata. Leader di ${principal.fazione} non disponibile questo turno.`);
        this.onComplete();
        this.close();
        return;
      }

      const fullLeader: AzioneDeclaration = {
        fazione: leader.fazione ?? principal.fazione!,
        giocatore: giocatoreVal,
        turno: turno_corrente,
        tipo_azione: 'leader',
        categoria_azione: leader.categoria_azione,
        azione: leader.azione!,
        metodo: leader.metodo ?? '',
        argomento_vantaggio: leader.argomento_vantaggio ?? '',
        argomenti_contro: [],
        fazione_aiutata: leader.fazione_aiutata,
        costo_vantaggio: leader.costo_vantaggio,
        target_fazione: leader.target_fazione,
        dettaglio_narrativo: leader.dettaglio_narrativo,
      };

      await writeActionFile(this.app, slug, turno_corrente, fullLeader);
      new Notice(`Azione principale + azione leader dichiarate per ${principal.fazione}.`);
    } else {
      new Notice(`Azione dichiarata per ${principal.fazione}.`);
    }

    this.onComplete();
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
