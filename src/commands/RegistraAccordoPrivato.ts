import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { appendAccordoPrivato } from '../vault/CampagnaPrivataManager';
import { RegistraAccordoModal } from '../ui/modals/RegistraAccordoModal';

export async function cmdRegistraAccordoPrivato(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  const { slug } = campagna.meta;

  new RegistraAccordoModal(app, campagna.fazioni, async (accordo) => {
    await appendAccordoPrivato(app, slug, accordo);
    new Notice('Accordo privato registrato.');
  }).open();
}
