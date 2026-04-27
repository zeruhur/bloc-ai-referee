import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { saveAccordoPubblico } from '../vault/VaultManager';
import { RegistraAccordoModal } from '../ui/modals/RegistraAccordoModal';

export async function cmdRegistraAccordoPubblico(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  const { slug, turno_corrente } = campagna.meta;

  new RegistraAccordoModal(
    app,
    campagna.fazioni,
    turno_corrente,
    async (accordo) => {
      await saveAccordoPubblico(app, slug, accordo);
      const fazioni = accordo.fazioni.join(', ');
      new Notice(`Accordo pubblico registrato tra ${fazioni}.`);
    },
    'Registra accordo pubblico',
  ).open();
}
