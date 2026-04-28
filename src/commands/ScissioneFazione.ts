import { App, Notice } from 'obsidian';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { pushNuovaFazione, patchFazioneVantaggi } from '../vault/CampaignWriter';
import { activeFazioni } from '../utils/factionUtils';
import { NuovaFazioneModal } from '../ui/modals/NuovaFazioneModal';
import { pickFazione } from '../ui/FazionePickerModal';

export async function cmdScissioneFazione(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  const candidati = activeFazioni(campagna.fazioni);
  if (candidati.length === 0) {
    new Notice('Nessuna fazione attiva da scindere.');
    return;
  }

  const sorgente = await pickFazione(app, candidati, 'Seleziona la fazione sorgente da scindere…');
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
