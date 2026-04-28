import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { createAdapter } from '../llm/LLMAdapter';
import { narrativeFilePath } from '../vault/VaultManager';
import { CAMPAGNE_FOLDER, CAMPAGNA_FILE } from '../constants';
import { buildEpiloguePrompt } from '../pipeline/prompts/epiloguePrompt';
import { epilogueOutputSchema, EpilogueOutputZod } from '../pipeline/schemas/epilogueSchema';
import { LLMValidationError } from '../llm/LLMAdapter';
import { markdownSection } from '../utils/markdown';
import { refereeEventBus } from '../ui/RefereeEventBus';

const CONCLUSIONE_FILE = 'conclusione.md';

export async function cmdChiudiCampagna(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  const adapter = await createAdapter(campagna.llm, app);
  const notice = new Notice('Generazione epilogo campagna…', 0);
  refereeEventBus.emit({ type: 'step-start', step: 'ChiudiCampagna', message: 'Generazione epilogo campagna…', timestamp: new Date() });

  try {
    const { system, user } = buildEpiloguePrompt(campagna, campagna.game_state_delta);

    const response = await adapter.complete({
      system,
      user,
      output_schema: epilogueOutputSchema,
      temperature: campagna.llm.temperature_narrative,
    });

    const validation = EpilogueOutputZod.safeParse(response.parsed);
    if (!validation.success) {
      throw new LLMValidationError(
        `Output epilogo non valido: ${validation.success}`,
        response.content,
      );
    }

    const { epilogo } = validation.data;

    // Append to current turn's narrativa.md if it exists, otherwise write standalone file
    const { slug, turno_corrente } = campagna.meta;
    const narrativaPath = narrativeFilePath(slug, turno_corrente);
    const narrativaExists = await app.vault.adapter.exists(narrativaPath);

    const epilogoSection = markdownSection('Epilogo — Fine Campagna', 2, epilogo);

    if (narrativaExists) {
      const existing = await app.vault.adapter.read(narrativaPath);
      await app.vault.adapter.write(narrativaPath, existing.trimEnd() + '\n\n' + epilogoSection);
    } else {
      const conclusionePath = `${CAMPAGNE_FOLDER}/${slug}/${CONCLUSIONE_FILE}`;
      const header = markdownSection(`${campagna.meta.titolo} — Conclusione`, 1, epilogoSection);
      await app.vault.adapter.write(conclusionePath, header);
    }

    notice.hide();
    refereeEventBus.emit({ type: 'step-done', step: 'ChiudiCampagna', message: 'Epilogo generato.', timestamp: new Date() });
    new Notice(narrativaExists
      ? 'Epilogo aggiunto a narrativa.md del turno corrente.'
      : `Epilogo scritto in ${CONCLUSIONE_FILE}.`);
  } catch (e) {
    notice.hide();
    refereeEventBus.emit({ type: 'error', step: 'ChiudiCampagna', message: `Errore epilogo: ${(e as Error).message}`, timestamp: new Date() });
    new Notice(`Errore: ${(e as Error).message}`);
  }
}
