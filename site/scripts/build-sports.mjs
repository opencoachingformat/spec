import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

function titleCase(slug) {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

// Pure transform: [{ filename, data }] -> normalized, sorted sport entries.
// Basketball is pinned first; the remaining sports are alphabetical.
export function buildSportsIndex(files) {
  const entries = files.map(({ data }) => ({
    sport: data.sport,
    label: titleCase(data.sport),
    version: data.version ?? '',
    status: data.status ?? 'provisional',
    statusLabel: data.status === 'defined' ? 'Full' : 'Reserved',
    reserved: data.status !== 'defined',
    action_types: Array.isArray(data.action_types) ? data.action_types : [],
    variants:
      data.variants && typeof data.variants === 'object' && !Array.isArray(data.variants)
        ? data.variants
        : {},
    outcomes: Array.isArray(data.outcomes) ? data.outcomes : [],
    rulesets: Array.isArray(data.rulesets) ? data.rulesets : [],
  }));
  entries.sort((a, b) => {
    if (a.sport === 'basketball') return -1;
    if (b.sport === 'basketball') return 1;
    return a.sport.localeCompare(b.sport);
  });
  return entries;
}

// Only run the filesystem side effects when executed directly, not on import
// (keeps the module unit-testable).
const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  const siteRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const repoRoot = path.dirname(siteRoot);
  const outDir = path.join(siteRoot, 'src', 'generated');
  const sportsDir = path.join(repoRoot, 'sports');

  mkdirSync(outDir, { recursive: true });

  const files = readdirSync(sportsDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((filename) => ({
      filename,
      data: JSON.parse(readFileSync(path.join(sportsDir, filename), 'utf-8')),
    }));

  const index = buildSportsIndex(files);
  writeFileSync(path.join(outDir, 'sports.json'), JSON.stringify(index, null, 2), 'utf-8');
  console.log(`Generated site/src/generated/sports.json (${index.length} sports)`);
}
