import { ItemView, WorkspaceLeaf } from 'obsidian';
import type BlocPlugin from '../main';
import type { Campagna, CampagnaStato } from '../types';
import type { RunState } from '../vault/RunStateManager';
import { loadCampagna } from '../vault/CampaignLoader';
import { loadRunState } from '../vault/RunStateManager';
import { STATO_TRANSITIONS, STATO_LABELS, STATO_ACTION_MAP, STATELESS_ACTIONS } from '../constants';
import { refereeEventBus } from './RefereeEventBus';
import type { RefereeEvent } from './RefereeEventBus';

export const VIEW_TYPE_REFEREE = 'bloc-referee-sidebar';

export class RefereeView extends ItemView {
  private messages: RefereeEvent[] = [];
  private unsubscribeBus?: () => void;
  private messagesContainer: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: BlocPlugin) {
    super(leaf);
  }

  getViewType(): string { return VIEW_TYPE_REFEREE; }
  getDisplayText(): string { return 'BLOC Referee'; }
  getIcon(): string { return 'shield'; }

  onload(): void {
    this.registerEvent(
      this.app.vault.on('modify', file => {
        if (file.path.endsWith('campagna.yaml') || file.path.endsWith('run-state.yaml')) {
          void this.refresh();
        }
      }),
    );
    this.unsubscribeBus = refereeEventBus.on(event => {
      this.messages.push(event);
      if (this.messages.length > 50) this.messages.shift();
      this.refreshMessages();
    });
  }

  onunload(): void {
    this.unsubscribeBus?.();
  }

  async onOpen(): Promise<void> {
    await this.refresh();
  }

  async onClose(): Promise<void> {
    // cleanup handled by onunload
  }

  private async loadActiveCampaign(): Promise<Campagna | null> {
    const slug = this.plugin.settings.defaultCampaignSlug;
    if (!slug) return null;
    try {
      return await loadCampagna(this.app, slug);
    } catch {
      return null;
    }
  }

  async refresh(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.style.padding = '12px';

    const campagna = await this.loadActiveCampaign();
    const runState = campagna
      ? await loadRunState(this.app, campagna.meta.slug, campagna.meta.turno_corrente)
      : null;

    this.renderTurnInfo(container, campagna);
    if (campagna) {
      this.renderFlowState(container, campagna.meta.stato, runState);
      this.messagesContainer = this.renderMessagesSection(container);
      this.renderActions(container, campagna.meta.stato, runState);
      this.renderStatelessActions(container);
    }
  }

  private renderTurnInfo(container: HTMLElement, campagna: Campagna | null): void {
    const section = container.createEl('div', { cls: 'bloc-section' });
    section.createEl('h4', { text: 'Turno corrente' });

    if (!campagna) {
      section.createEl('p', {
        text: 'Nessuna campagna attiva. Configura uno slug nelle impostazioni.',
        cls: 'bloc-muted',
      });
      return;
    }

    const grid = section.createEl('div', { cls: 'bloc-info-grid' });
    this.infoRow(grid, 'Campagna', campagna.meta.titolo);
    this.infoRow(grid, 'Turno', String(campagna.meta.turno_corrente));
    this.infoRow(grid, 'Fazioni', String(campagna.fazioni.length));
    this.infoRow(grid, 'Modello', campagna.llm.model);
  }

  private infoRow(grid: HTMLElement, label: string, value: string): void {
    grid.createEl('span', { text: label, cls: 'bloc-info-label' });
    grid.createEl('span', { text: value, cls: 'bloc-info-value' });
  }

  private renderFlowState(
    container: HTMLElement,
    statoCorrente: CampagnaStato,
    runState: RunState | null,
  ): void {
    const section = container.createEl('div', { cls: 'bloc-section' });
    section.createEl('h4', { text: 'Flusso turno' });

    const steps = Object.keys(STATO_TRANSITIONS) as CampagnaStato[];
    const currentIndex = steps.indexOf(statoCorrente);

    steps.forEach((step, i) => {
      const row = section.createEl('div', { cls: 'bloc-flow-row' });
      const isFailed = runState?.status === 'failed' && runState?.current_step === step;

      if (isFailed) {
        row.addClass('bloc-flow-error');
        row.createEl('span', { text: '✗', cls: 'bloc-flow-icon' });
      } else if (i < currentIndex) {
        row.addClass('bloc-flow-done');
        row.createEl('span', { text: '✓', cls: 'bloc-flow-icon' });
      } else if (i === currentIndex) {
        row.addClass('bloc-flow-active');
        row.createEl('span', { text: '›', cls: 'bloc-flow-icon' });
      } else {
        row.addClass('bloc-flow-pending');
        row.createEl('span', { text: '·', cls: 'bloc-flow-icon' });
      }

      row.createEl('span', { text: STATO_LABELS[step], cls: 'bloc-flow-label' });
    });
  }

  private renderMessagesSection(container: HTMLElement): HTMLElement {
    const section = container.createEl('div', { cls: 'bloc-section' });
    section.createEl('h4', { text: 'Log pipeline' });
    const list = section.createEl('div', { cls: 'bloc-messages' });
    this.renderMessagesList(list);
    return list;
  }

  private renderMessagesList(list: HTMLElement): void {
    list.empty();
    if (this.messages.length === 0) {
      list.createEl('div', { text: '—', cls: 'bloc-msg bloc-msg-progress' });
      return;
    }
    for (const msg of this.messages) {
      const cls = msg.type === 'error' ? 'bloc-msg-error'
        : msg.type === 'step-done' ? 'bloc-msg-step-done'
        : 'bloc-msg-progress';
      const time = msg.timestamp.toLocaleTimeString('it-IT', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
      list.createEl('div', { text: `${time} ${msg.message}`, cls: `bloc-msg ${cls}` });
    }
    list.scrollTop = list.scrollHeight;
  }

  private refreshMessages(): void {
    if (this.messagesContainer) {
      this.renderMessagesList(this.messagesContainer);
    }
  }

  private renderActions(
    container: HTMLElement,
    stato: CampagnaStato,
    runState: RunState | null,
  ): void {
    const section = container.createEl('div', { cls: 'bloc-section' });
    section.createEl('h4', { text: 'Azioni' });

    const actions = STATO_ACTION_MAP[stato] ?? [];
    const [first, ...rest] = actions;

    if (runState?.status === 'failed' && first) {
      const btn = section.createEl('button', {
        text: `↩ Riprendi: ${runState.current_step}`,
        cls: 'bloc-btn bloc-btn-error',
      });
      btn.addEventListener('click', () =>
        (this.app as any).commands.executeCommandById(first.commandId),
      );
    } else if (first) {
      const btn = section.createEl('button', {
        text: first.label,
        cls: 'bloc-btn bloc-btn-primary',
      });
      btn.addEventListener('click', () =>
        (this.app as any).commands.executeCommandById(first.commandId),
      );
      for (const action of rest) {
        const secondary = section.createEl('button', {
          text: action.label,
          cls: 'bloc-btn bloc-btn-secondary',
        });
        secondary.addEventListener('click', () =>
          (this.app as any).commands.executeCommandById(action.commandId),
        );
      }
    }

  }

  private renderStatelessActions(container: HTMLElement): void {
    const section = container.createEl('div', { cls: 'bloc-section' });
    section.createEl('h4', { text: 'Comandi' });

    for (const group of STATELESS_ACTIONS) {
      const details = section.createEl('details', { cls: 'bloc-group' });
      details.createEl('summary', { text: group.title, cls: 'bloc-group-title' });
      const grid = details.createEl('div', { cls: 'bloc-cmd-grid' });
      for (const action of group.actions) {
        const btn = grid.createEl('button', { text: action.label, cls: 'bloc-btn bloc-btn-cmd' });
        btn.addEventListener('click', () =>
          (this.app as any).commands.executeCommandById(action.commandId),
        );
      }
    }
  }
}
