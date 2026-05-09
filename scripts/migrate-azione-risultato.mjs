/**
 * Migration script: rename azione→risultato and metodo→azione in vault files.
 *
 * Run from the Obsidian vault root:
 *   node /path/to/scripts/migrate-azione-risultato.mjs [--write]
 *
 * Without --write: dry-run only (prints what would change).
 * With --write:    applies changes in place.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

const DRY_RUN = !process.argv.includes('--write');

if (DRY_RUN) {
  console.log('DRY RUN — pass --write to apply changes\n');
}

// ---- Helpers ----

function walkFiles(dir, predicate, results = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walkFiles(full, predicate, results);
    } else if (predicate(name)) {
      results.push(full);
    }
  }
  return results;
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { data: null, body: content };
  return {
    data: yaml.load(match[1]),
    body: content.slice(match[0].length),
    raw: match[1],
  };
}

function serializeFrontmatter(data, body) {
  const fm = yaml.dump(data, { lineWidth: -1, quotingType: '"', forceQuotes: false });
  return `---\n${fm}---${body}`;
}

// ---- Transformers ----

/**
 * Rename azione→risultato and metodo→azione in an AzioneDeclaration object.
 * Leaves valutazione.azione untouched (it's an EvaluationOutput field).
 */
function migrateActionDecl(obj) {
  if (!obj || typeof obj !== 'object') return { obj, changed: false };
  let changed = false;

  if ('azione' in obj && !('risultato' in obj)) {
    obj.risultato = obj.azione;
    delete obj.azione;
    changed = true;
  }
  if ('metodo' in obj) {
    obj.azione = obj.metodo;
    delete obj.metodo;
    changed = true;
  }
  return { obj, changed };
}

/**
 * Rename azione→risultato and metodo→azione inside each MatrixEntry in an array.
 * Each entry may also have a nested valutazione — leave that alone.
 */
function migrateMatrixEntries(entries) {
  if (!Array.isArray(entries)) return false;
  let changed = false;
  for (const entry of entries) {
    const { changed: c } = migrateActionDecl(entry);
    if (c) changed = true;
  }
  return changed;
}

// ---- File processors ----

function processActionFile(path) {
  const content = readFileSync(path, 'utf8');
  const { data, body } = parseFrontmatter(content);
  if (!data) return false;

  const { changed } = migrateActionDecl(data);
  if (!changed) return false;

  console.log(`  [azione] ${path}`);
  if (!DRY_RUN) {
    writeFileSync(path, serializeFrontmatter(data, body), 'utf8');
  }
  return true;
}

function processMatrixFile(path) {
  const content = readFileSync(path, 'utf8');
  const { data, body } = parseFrontmatter(content);
  if (!data) return false;

  let changed = false;
  if (data.azioni) changed = migrateMatrixEntries(data.azioni) || changed;
  if (data.matrice_arbitro) changed = migrateMatrixEntries(data.matrice_arbitro) || changed;

  if (!changed) return false;

  console.log(`  [matrice] ${path}`);
  if (!DRY_RUN) {
    writeFileSync(path, serializeFrontmatter(data, body), 'utf8');
  }
  return true;
}

function processLatentFile(path) {
  const content = readFileSync(path, 'utf8');
  const { data, body } = parseFrontmatter(content);
  if (!data) return false;

  let changed = false;
  if (Array.isArray(data.azioni_latenti)) {
    for (const entry of data.azioni_latenti) {
      const { changed: c } = migrateActionDecl(entry);
      if (c) changed = true;
    }
  }
  if (!changed) return false;

  console.log(`  [latenti] ${path}`);
  if (!DRY_RUN) {
    writeFileSync(path, serializeFrontmatter(data, body), 'utf8');
  }
  return true;
}

// ---- Main ----

const CAMPAGNE_ROOT = 'campagne';

let total = 0;

const actionFiles = walkFiles(
  CAMPAGNE_ROOT,
  name => name.startsWith('azione-') && name.endsWith('.md'),
);

const matrixFiles = walkFiles(
  CAMPAGNE_ROOT,
  name => name === 'matrice.md' || name === 'matrice-arbitro.md',
);

const latentFiles = walkFiles(
  CAMPAGNE_ROOT,
  name => name.endsWith('-latenti.md'),
);

console.log(`Found: ${actionFiles.length} action files, ${matrixFiles.length} matrix files, ${latentFiles.length} latent files\n`);

for (const f of actionFiles) if (processActionFile(f)) total++;
for (const f of matrixFiles) if (processMatrixFile(f)) total++;
for (const f of latentFiles) if (processLatentFile(f)) total++;

console.log(`\n${total} file${total !== 1 ? 's' : ''} ${DRY_RUN ? 'would be modified' : 'modified'}.`);
if (DRY_RUN && total > 0) {
  console.log('Run with --write to apply.');
}
