import { ItemView, WorkspaceLeaf } from 'obsidian';
import type BlocPlugin from '../main';
import type { Campagna, CampagnaStato } from '../types';
import type { RunState } from '../vault/RunStateManager';
import { loadCampagna, listCampaigns } from '../vault/CampaignLoader';
import { loadRunState } from '../vault/RunStateManager';
import { patchCampagnaLLM } from '../vault/CampaignWriter';
import { STATO_TRANSITIONS, STATO_LABELS, STATO_ACTION_MAP, STATELESS_ACTIONS, PROVIDER_LABELS } from '../constants';
import type { LLMProvider } from '../types';

const PROVIDER_ORDER: LLMProvider[] = ['google_ai_studio', 'anthropic', 'openai', 'openrouter', 'ollama'];
import { refereeEventBus } from './RefereeEventBus';
import type { RefereeEvent } from './RefereeEventBus';

export const VIEW_TYPE_REFEREE = 'bloc-referee-sidebar';

export class RefereeView extends ItemView {
  private messages: RefereeEvent[] = [];
  private unsubscribeBus?: () => void;
  private messagesContainer: HTMLElement | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: BlocPlugin) {
    super(leaf);
  }

  getViewType(): string { return VIEW_TYPE_REFEREE; }
  getDisplayText(): string { return 'BLOC Referee'; }
  getIcon(): string { return 'shield'; }

  private scheduleRefresh(): void {
    if (this.refreshTimer !== null) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      void this.refresh();
    }, 150);
  }

  onload(): void {
    this.registerEvent(
      this.app.vault.on('modify', file => {
        if (file.path.endsWith('campagna.md') || file.path.endsWith('run-state.md')) {
          this.scheduleRefresh();
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

    await this.renderSwitchers(container, campagna);
    this.renderTurnInfo(container, campagna);
    if (campagna) {
      this.renderFlowState(container, campagna.meta.stato, runState);
      this.messagesContainer = this.renderMessagesSection(container);
      this.renderActions(container, campagna.meta.stato, runState);
    }
    this.renderStatelessActions(container);
  }

  private async renderSwitchers(container: HTMLElement, campagna: Campagna | null): Promise<void> {
    const section = container.createEl('div', { cls: 'bloc-section' });
    section.createEl('h4', { text: 'Configurazione' });

    let slugs: string[] = [];
    try { slugs = await listCampaigns(this.app); } catch { /* vault not ready */ }

    const campaignRow = section.createEl('div', { cls: 'bloc-switcher-row' });
    campaignRow.createEl('span', { text: 'Campagna', cls: 'bloc-info-label' });
    const campaignSel = campaignRow.createEl('select', { cls: 'dropdown bloc-switcher-select' });
    if (slugs.length === 0) {
      campaignSel.createEl('option', { text: '— nessuna campagna —', value: '' });
    } else {
      for (const s of slugs) {
        const opt = campaignSel.createEl('option', { text: s, value: s });
        if (s === this.plugin.settings.defaultCampaignSlug) opt.selected = true;
      }
    }
    campaignSel.addEventListener('change', async () => {
      this.plugin.settings.defaultCampaignSlug = campaignSel.value;
      await this.plugin.saveSettings();
      await this.refresh();
    });

    if (!campagna) return;

    const slug = campagna.meta.slug;

    const providerRow = section.createEl('div', { cls: 'bloc-switcher-row' });
    providerRow.createEl('span', { text: 'Provider', cls: 'bloc-info-label' });
    const providerSel = providerRow.createEl('select', { cls: 'dropdown bloc-switcher-select' });
    for (const p of PROVIDER_ORDER) {
      const opt = providerSel.createEl('option', { text: PROVIDER_LABELS[p], value: p });
      if (p === campagna.llm.provider) opt.selected = true;
    }
    providerSel.addEventListener('change', async () => {
      const newProvider = providerSel.value as LLMProvider;
      const firstModel = this.plugin.settings.cachedModels?.[newProvider]?.[0];
      await patchCampagnaLLM(this.app, slug, {
        provider: newProvider,
        ...(firstModel ? { model: firstModel } : {}),
      });
      await this.refresh();
    });

    const cachedModels = this.plugin.settings.cachedModels?.[campagna.llm.provider] ?? [];
    const modelRow = section.createEl('div', { cls: 'bloc-switcher-row' });
    modelRow.createEl('span', { text: 'Modello', cls: 'bloc-info-label' });
    if (cachedModels.length > 0) {
      const modelSel = modelRow.createEl('select', { cls: 'dropdown bloc-switcher-select' });
      for (const m of cachedModels) {
        const opt = modelSel.createEl('option', { text: m, value: m });
        if (m === campagna.llm.model) opt.selected = true;
      }
      modelSel.addEventListener('change', async () => {
        await patchCampagnaLLM(this.app, slug, { model: modelSel.value });
      });
    } else {
      const modelInput = modelRow.createEl('input', {
        cls: 'bloc-switcher-input',
        type: 'text',
        value: campagna.llm.model,
      } as any);
      modelInput.addEventListener('change', async () => {
        await patchCampagnaLLM(this.app, slug, { model: modelInput.value.trim() });
      });
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
