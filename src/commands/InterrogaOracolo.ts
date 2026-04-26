import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import type BlocPlugin from '../main';
import { loadActiveCampagna } from './shared';
import { askYesNo } from '../oracle/OracleEngine';
import { OracleModal } from '../ui/modals/OracleModal';
import { CAMPAGNE_FOLDER, ORACLE_FILE } from '../constants';

const ORACLE_LABELS: Record<string, string> = {
  no: 'No',
  si_ma: 'Sì, ma...',
  si: 'Sì',
};

export async function cmdInterrogaOracolo(app: App, plugin: BlocPlugin): Promise<void> {
  const campagna = await loadActiveCampagna(app, plugin);
  if (!campagna) return;

  const { slug, turno_corrente } = campagna.meta;

  new OracleModal(app, async (domanda, modificatore) => {
    const result = askYesNo(domanda, modificatore, turno_corrente);
    const label = ORACLE_LABELS[result.esito];
    const modStr = result.modificatore >= 0 ? `+${result.modificatore}` : `${result.modificatore}`;

    const entry = [
      `## Turno ${turno_corrente} — ${domanda}`,
      `- Dado: ${result.dado} | Modificatore: ${modStr} | Valore: ${result.valore_modificato}`,
      `- **Esito: ${label}**`,
      '',
    ].join('\n');

    const oracoloPath = `${CAMPAGNE_FOLDER}/${slug}/${ORACLE_FILE}`;
    const exists = await app.vault.adapter.exists(oracoloPath);
    const current = exists ? await app.vault.adapter.read(oracoloPath) : `# Oracolo — ${campagna.meta.titolo}\n\n`;
    await app.vault.adapter.write(oracoloPath, current + entry);

    new Notice(`Oracolo: ${label}`);
  }).open();
}
