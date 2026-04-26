import type { App } from 'obsidian';
import { Notice, SuggestModal } from 'obsidian';
import type { Campagna } from '../types';
import { loadCampagna, listCampaigns, campaignExists } from '../vault/CampaignLoader';
import type BlocPlugin from '../main';

export async function loadActiveCampagna(app: App, plugin: BlocPlugin): Promise<Campagna | null> {
  let slug = plugin.settings.defaultCampaignSlug;

  if (!slug) {
    slug = await pickCampaignSlug(app);
    if (!slug) {
      new Notice('Nessuna campagna selezionata.');
      return null;
    }
  }

  if (!(await campaignExists(app, slug))) {
    new Notice(`Campagna "${slug}" non trovata nella vault.`);
    return null;
  }

  try {
    return await loadCampagna(app, slug);
  } catch (e) {
    new Notice(`Errore caricamento campagna: ${(e as Error).message}`);
    return null;
  }
}

async function pickCampaignSlug(app: App): Promise<string> {
  const campaigns = await listCampaigns(app);
  if (campaigns.length === 0) return '';
  if (campaigns.length === 1) return campaigns[0];

  return new Promise((resolve) => {
    new CampaignPickerModal(app, campaigns, resolve).open();
  });
}

class CampaignPickerModal extends SuggestModal<string> {
  constructor(
    app: App,
    private campaigns: string[],
    private resolve: (slug: string) => void,
  ) {
    super(app);
  }

  getSuggestions(query: string): string[] {
    return this.campaigns.filter(c => c.includes(query.toLowerCase()));
  }

  renderSuggestion(slug: string, el: HTMLElement): void {
    el.createEl('div', { text: slug });
  }

  onChooseSuggestion(slug: string): void {
    this.resolve(slug);
  }
}
