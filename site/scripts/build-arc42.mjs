import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { OCF_ARC42_BASE_URL } from '../src/lib/validator-version.mjs';
import { mermaidAwareMarked, buildArc42Index } from '../src/lib/mermaid-marked.mjs';

// The 13 arc42 files in opencoachingformat/ocf-validator at docs/arc42/.
// Fixed list (no CDN directory listing): README + the 12 numbered sections.
// NOTE: filenames match the actual files at the pinned commit (verified via
// jsDelivr's package-listing API). Two differ from the plan's assumed names:
// the intro section is `01-introduction-goals.md` (no "and") and the risks
// section is `11-risks-technical-debt.md` (no "and").
const ARC42_FILES = [
  'README.md',
  '01-introduction-goals.md',
  '02-architecture-constraints.md',
  '03-system-scope-context.md',
  '04-solution-strategy.md',
  '05-building-block-view.md',
  '06-runtime-view.md',
  '07-deployment-view.md',
  '08-crosscutting-concepts.md',
  '09-architecture-decisions.md',
  '10-quality-requirements.md',
  '11-risks-technical-debt.md',
  '12-glossary.md',
];

async function fetchArc42File(file) {
  const url = `${OCF_ARC42_BASE_URL}/${file}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch arc42 ${file} from ${url}: ${res.status} ${res.statusText}`
    );
  }
  return await res.text();
}

const siteRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(siteRoot, 'src', 'generated', 'arc42');

mkdirSync(outDir, { recursive: true });

const index = buildArc42Index(ARC42_FILES);

let mermaidSections = 0;
for (const entry of index) {
  const markdown = await fetchArc42File(entry.file);
  const html = mermaidAwareMarked(markdown);
  if (html.includes('<pre class="mermaid">')) mermaidSections += 1;
  writeFileSync(path.join(outDir, `${entry.slug}.html`), html, 'utf-8');
}

writeFileSync(
  path.join(outDir, 'index.json'),
  JSON.stringify(index, null, 2),
  'utf-8'
);

console.log(
  `Generated site/src/generated/arc42/ (${index.length} sections, ${mermaidSections} with mermaid diagrams)`
);
