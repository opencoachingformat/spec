import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

function titleCase(slug) {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

// Pure transform: [{ dirName, data }] -> normalized, sorted sport entries.
// `data` is a parsed sports/<sport>/sport.json manifest. Basketball is
// pinned first; the remaining sports are alphabetical. Output shape is
// unchanged from before the sports/<sport>/ bundle restructure — this
// keeps every consuming Astro page (which reads action_types/variants/
// outcomes/rulesets directly) working without their own changes.
export function buildSportsIndex(bundles) {
  const entries = bundles.map(({ data }) => ({
    sport: data.sport,
    label: titleCase(data.sport),
    version: data.version ?? '',
    status: data.status ?? 'provisional',
    statusLabel: data.status === 'defined' ? 'Full' : 'Reserved',
    reserved: data.status !== 'defined',
    action_types: Array.isArray(data.actions?.types) ? data.actions.types : [],
    variants:
      data.actions?.variants && typeof data.actions.variants === 'object' && !Array.isArray(data.actions.variants)
        ? data.actions.variants
        : {},
    outcomes: Array.isArray(data.actions?.outcomes) ? data.actions.outcomes : [],
    rulesets: data.court_profiles && typeof data.court_profiles === 'object' ? Object.keys(data.court_profiles) : [],
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

  const bundles = readdirSync(sportsDir)
    .filter((name) => statSync(path.join(sportsDir, name)).isDirectory())
    .sort()
    .map((dirName) => ({
      dirName,
      data: JSON.parse(readFileSync(path.join(sportsDir, dirName, 'sport.json'), 'utf-8')),
    }));

  const index = buildSportsIndex(bundles);
  writeFileSync(path.join(outDir, 'sports.json'), JSON.stringify(index, null, 2), 'utf-8');
  console.log(`Generated site/src/generated/sports.json (${index.length} sports)`);
}
