import { App, Modal } from 'obsidian';
import type { Campagna } from '../../types';
import { ESITO_LABELS } from '../../constants';

export class StatusModal extends Modal {
  constructor(
    app: App,
    private campagna: Campagna,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    const c = this.campagna;

    contentEl.createEl('h2', { text: `Campagna: ${c.meta.titolo}` });

    const info = contentEl.createEl('table');
    const rows: [string, string][] = [
      ['Slug', c.meta.slug],
      ['Turno', `${c.meta.turno_corrente} / ${c.meta.turno_totale}`],
      ['Stato', c.meta.stato],
      ['Provider LLM', `${c.llm.provider} (${c.llm.model})`],
    ];

    for (const [label, value] of rows) {
      const tr = info.createEl('tr');
      tr.createEl('td', { text: label, cls: 'bloc-label' });
      tr.createEl('td', { text: value });
    }

    contentEl.createEl('h3', { text: 'Fazioni' });
    for (const f of c.fazioni) {
      const div = contentEl.createDiv({ cls: 'bloc-faction' });
      div.createEl('strong', { text: f.nome });
      div.createEl('span', { text: ` — MC: ${f.mc > 0 ? '+' : ''}${f.mc}` });
      div.createEl('span', {
        text: ` | Leader: ${f.leader.presente ? 'presente' : 'assente'}`,
      });
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
