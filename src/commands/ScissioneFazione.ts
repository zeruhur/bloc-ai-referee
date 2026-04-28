import { App, Notice, SuggestModal } from 'obsidian';
import type { FazioneConfig } from '../types';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { pushNuovaFazione, patchFazioneVantaggi } from '../vault/CampaignWriter';
import { activeFazioni } from '../utils/factionUtils';
import { NuovaFazioneModal } from '../ui/modals/NuovaFazioneModal';

class FazionePickerModal extends SuggestModal<FazioneConfig> {
  constructor(
    app: App,
    private fazioni: FazioneConfig[],
    private resolve: (f: FazioneConfig) => void,
  ) {
    super(app);
  }

  getSuggestions(query: string): FazioneConfig[] {
    return this.fazioni.filter(f => f.nome.toLowerCase().includes(query.toLowerCase()));
  }

  renderSuggestion(fazione: FazioneConfig, el: HTMLElement): void {
    el.createEl('div', { text: fazione.nome });
  }

  onChooseSuggestion(fazione: FazioneConfig): void {
    this.resolve(fazione);
  }
}

export async function cmdScissioneFazione(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  const candidati = activeFazioni(campagna.fazioni);
  if (candidati.length === 0) {
    new Notice('Nessuna fazione attiva da scindere.');
    return;
  }

  const sorgente = await new Promise<FazioneConfig | null>((resolve) => {
    const modal = new FazionePickerModal(app, candidati, resolve);
    modal.setPlaceholder('Seleziona la fazione sorgente da scindere…');
    modal.onClose = () => resolve(null);
    modal.open();
  });

  if (!sorgente) return;

  await new Promise<void>((resolve) => {
    const modal = new NuovaFazioneModal(
      app,
      {
        title: `Scissione da "${sorgente.nome}"`,
        defaults: { nome: `${sorgente.nome} — Ala dissidente`, mc: sorgente.mc },
        vantaggiSorgente: sorgente.vantaggi,
        svantaggiSorgente: sorgente.svantaggi,
      },
      async (nuovaFazione, vantaggiTrasferiti, svantaggiTrasferiti) => {
        try {
          await pushNuovaFazione(app, campagna.meta.slug, nuovaFazione);

          // Aggiorna la fazione sorgente rimuovendo i vantaggi trasferiti
          if (vantaggiTrasferiti.length > 0 || svantaggiTrasferiti.length > 0) {
            const vantaggiRimasti = sorgente.vantaggi.filter(v => !vantaggiTrasferiti.includes(v));
            const svantaggiRimasti = sorgente.svantaggi.filter(v => !svantaggiTrasferiti.includes(v));
            await patchFazioneVantaggi(
              app, campagna.meta.slug, sorgente.id, vantaggiRimasti, svantaggiRimasti,
            );
          }

          new Notice(`"${nuovaFazione.nome}" creata per scissione da "${sorgente.nome}".`);
        } catch (e) {
          new Notice(`Errore: ${(e as Error).message}`);
        }
        resolve();
      },
    );
    modal.onClose = () => resolve();
    modal.open();
  });
}
