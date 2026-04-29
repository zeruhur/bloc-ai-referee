import { App, Notice } from 'obsidian';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { createAdapter } from '../llm/LLMAdapter';
import { LLMValidationError } from '../llm/LLMAdapter';
import { buildGeneraFazionePrompt } from '../pipeline/prompts/generaFazionePrompt';
import { generaFazioneOutputSchema, GeneraFazioneOutputZod } from '../pipeline/schemas/generaFazioneSchema';
import { pushNuovaFazione } from '../vault/CampaignWriter';
import { NuovaFazioneModal } from '../ui/modals/NuovaFazioneModal';

export async function cmdGeneraFazione(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  const notice = new Notice('Generazione fazione in corso…', 0);

  try {
    const adapter = await createAdapter(campagna.llm, app);
    const { system, user } = buildGeneraFazionePrompt(campagna);
    const response = await adapter.complete({
      system,
      user,
      output_schema: generaFazioneOutputSchema,
      temperature: campagna.llm.temperature_narrative,
    });

    const validation = GeneraFazioneOutputZod.safeParse(response.parsed);
    if (!validation.success) {
      throw new LLMValidationError(
        `Output genera-fazione non valido: ${validation.error.message}`,
        response.content,
      );
    }

    notice.hide();
    const { nome, obiettivo, concetto, vantaggi, svantaggi } = validation.data;

    await new Promise<void>((resolve) => {
      const modal = new NuovaFazioneModal(
        app,
        {
          title: 'Fazione generata — rivedi e conferma',
          defaults: {
            nome,
            obiettivo,
            concetto,
            vantaggio1: vantaggi[0] ?? '',
            vantaggio2: vantaggi[1] ?? '',
            svantaggio1: svantaggi[0] ?? '',
            tipo: 'ia',
          },
        },
        async (fazione) => {
          try {
            await pushNuovaFazione(app, campagna.meta.slug, fazione);
            new Notice(`Fazione "${fazione.nome}" aggiunta alla campagna.`);
          } catch (e) {
            new Notice(`Errore: ${(e as Error).message}`);
          }
          resolve();
        },
      );
      modal.onClose = () => resolve();
      modal.open();
    });
  } catch (e) {
    notice.hide();
    new Notice(`Errore genera-fazione: ${(e as Error).message}`);
  }
}
