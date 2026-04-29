import type { App } from 'obsidian';
import { Modal, Notice, Setting } from 'obsidian';
import type { LeaderCheckResult } from '../types';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { leaderCheck } from '../dice/DiceEngine';
import { activeFazioni } from '../utils/factionUtils';
import { LEADER_CHECK_FILE } from '../constants';
import { turnPath, ensureTurnFolder } from '../vault/VaultManager';
import { stringifyYaml } from '../utils/yaml';

class LeaderModeModal extends Modal {
  private chosen: 'presenza_comando' | 'azione_leadership' | 'intervento_limitato' | null = null;

  constructor(
    app: App,
    private fazione: string,
    private resolve: (m: 'presenza_comando' | 'azione_leadership' | 'intervento_limitato' | null) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: `Modalità leader — ${this.fazione}` });
    contentEl.createEl('p', { text: 'Il leader è disponibile. Scegli la modalità per questo turno:' });

    const modes: Array<{ value: 'presenza_comando' | 'azione_leadership' | 'intervento_limitato'; label: string }> = [
      { value: 'presenza_comando', label: 'Presenza di Comando' },
      { value: 'azione_leadership', label: 'Azione di Leadership' },
      { value: 'intervento_limitato', label: 'Intervento Limitato' },
    ];

    new Setting(contentEl)
      .setName('Modalità')
      .addDropdown(d => {
        modes.forEach(m => d.addOption(m.value, m.label));
        d.onChange(v => {
          this.chosen = v as typeof this.chosen;
        });
        this.chosen = modes[0].value;
        d.setValue(modes[0].value);
      });

    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });
    btnRow.createEl('button', { text: 'Annulla' }).addEventListener('click', () => {
      this.chosen = null;
      this.close();
    });
    btnRow.createEl('button', { text: 'Conferma', cls: 'mod-cta' }).addEventListener('click', () => this.close());
  }

  onClose(): void {
    setTimeout(() => this.resolve(this.chosen), 0);
    this.contentEl.empty();
  }
}

async function writeLeaderCheckResults(
  app: App,
  slug: string,
  turno: number,
  results: LeaderCheckResult[],
): Promise<void> {
  await ensureTurnFolder(app, slug, turno);
  const path = `${turnPath(slug, turno)}/${LEADER_CHECK_FILE}`;
  const exists = await app.vault.adapter.exists(path);
  const yaml = stringifyYaml({ leader_checks: results });
  const content = `---\n${yaml}---\n`;
  if (exists) {
    const current = await app.vault.adapter.read(path);
    await app.vault.adapter.write(path, current + '\n' + content);
  } else {
    await app.vault.adapter.write(path, content);
  }
}

async function runCheckLeaderTurno(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  const { slug, turno_corrente } = campagna.meta;
  const fazioniConLeader = activeFazioni(campagna.fazioni).filter(f => f.leader?.presente === true);

  if (fazioniConLeader.length === 0) {
    new Notice('Nessuna fazione ha un leader presente.');
    return;
  }

  const results: LeaderCheckResult[] = [];
  const seed = Date.now();

  for (const fazione of fazioniConLeader) {
    const result = leaderCheck(fazione.mc, fazione.id, turno_corrente, seed + campagna.fazioni.indexOf(fazione));

    if (result.disponibile) {
      const mode = await new Promise<'presenza_comando' | 'azione_leadership' | 'intervento_limitato' | null>(
        resolve => new LeaderModeModal(app, fazione.nome, resolve).open(),
      );
      if (mode) result.mode = mode;
    }

    results.push(result);
  }

  try {
    await writeLeaderCheckResults(app, slug, turno_corrente, results);
  } catch (e) {
    new Notice(`Errore scrittura leader-check: ${(e as Error).message}`);
    return;
  }

  const disponibili = results.filter(r => r.disponibile).map(r => r.fazione);
  const msg = disponibili.length > 0
    ? `Leader disponibili: ${disponibili.join(', ')}`
    : 'Nessun leader disponibile questo turno.';
  new Notice(msg);
}

export async function cmdCheckLeaderTurno(app: App, plugin: BlocPlugin): Promise<void> {
  return runCheckLeaderTurno(app, plugin);
}

// Legacy alias — keeps existing shortcuts working
export async function cmdVerificaLeader(app: App, plugin: BlocPlugin): Promise<void> {
  return runCheckLeaderTurno(app, plugin);
}
