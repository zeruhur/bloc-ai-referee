// Called by `npm version <patch|minor|major>` after bumping package.json.
// Syncs the new version into manifest.json so both files always match.
// Must also `git add manifest.json` so npm includes it in the version commit.
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));

manifest.version = pkg.version;
writeFileSync('manifest.json', JSON.stringify(manifest, null, 2) + '\n');

execSync('git add manifest.json');

console.log(`Bumped manifest.json to ${pkg.version}`);
