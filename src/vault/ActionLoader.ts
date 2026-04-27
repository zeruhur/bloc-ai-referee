import type { App } from 'obsidian';
import type { AzioneDeclaration } from '../types';
import { parseFrontmatter } from '../utils/yaml';
import { AzioneDeclarationSchema } from './schemas';
import {
  CAMPAGNE_FOLDER,
  ACTION_FILE_PREFIX,
  SECRET_ACTION_SUFFIX,
} from '../constants';
import { turnFolderName } from '../utils/markdown';

export async function loadActionsForTurn(
  app: App,
  slug: string,
  turno: number,
): Promise<AzioneDeclaration[]> {
  const turnFolder = `${CAMPAGNE_FOLDER}/${slug}/${turnFolderName(turno)}`;
  const listing = await app.vault.adapter.list(turnFolder);
  const actionFiles = listing.files.filter((f: string) => {
    const name = f.split('/').pop() ?? '';
    return name.startsWith(ACTION_FILE_PREFIX);
  });

  const actions: AzioneDeclaration[] = [];
  for (const filePath of actionFiles) {
    const content = await app.vault.adapter.read(filePath);
    const frontmatter = parseFrontmatter<unknown>(content);
    if (frontmatter) {
      const parsed = AzioneDeclarationSchema.safeParse(frontmatter);
      if (parsed.success) {
        actions.push(parsed.data);
      }
    }
  }
  return actions;
}

export async function countActionsForTurn(
  app: App,
  slug: string,
  turno: number,
): Promise<number> {
  const turnFolder = `${CAMPAGNE_FOLDER}/${slug}/${turnFolderName(turno)}`;
  const exists = await app.vault.adapter.exists(turnFolder);
  if (!exists) return 0;
  const listing = await app.vault.adapter.list(turnFolder);
  return listing.files.filter((f: string) =>
    (f.split('/').pop() ?? '').startsWith(ACTION_FILE_PREFIX),
  ).length;
}

export function actionFilePath(slug: string, turno: number, fazioneId: string): string {
  return `${CAMPAGNE_FOLDER}/${slug}/${turnFolderName(turno)}/${ACTION_FILE_PREFIX}${fazioneId}.md`;
}

export function isSecretActionFile(filePath: string): boolean {
  const name = filePath.split('/').pop() ?? '';
  return name.endsWith(`${SECRET_ACTION_SUFFIX}.md`);
}
