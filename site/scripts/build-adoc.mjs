import { readFileSync, writeFileSync, copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { load } from '@asciidoctor/core';

const siteRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.dirname(siteRoot);
const outDir = path.join(siteRoot, 'src', 'generated');

mkdirSync(outDir, { recursive: true });

const adocSource = readFileSync(
  path.join(repoRoot, 'docs', 'specification-v1.adoc'),
  'utf-8'
);
const doc = await load(adocSource, {
  safe: 'safe',
  attributes: {
    'source-highlighter': '',
    showtitle: true,
  },
});
const specHtml = await doc.convert();
const toc = doc.getSections().map((section) => ({
  id: section.getId(),
  title: section.getTitle(),
}));

writeFileSync(path.join(outDir, 'spec.html'), specHtml, 'utf-8');
writeFileSync(path.join(outDir, 'toc.json'), JSON.stringify(toc, null, 2), 'utf-8');

copyFileSync(
  path.join(repoRoot, 'schema', 'v1.json'),
  path.join(outDir, 'schema.json')
);

const examplesDir = path.join(repoRoot, 'examples');
const exampleFiles = readdirSync(examplesDir)
  .filter((name) => name.endsWith('.ocf.json'))
  .sort();
const examples = exampleFiles.map((filename) => {
  const parsed = JSON.parse(readFileSync(path.join(examplesDir, filename), 'utf-8'));
  return {
    slug: filename.replace(/\.ocf\.json$/, ''),
    title: parsed.meta?.title ?? filename,
    description: parsed.meta?.description ?? '',
    json: JSON.stringify(parsed, null, 2),
  };
});

writeFileSync(path.join(outDir, 'examples.json'), JSON.stringify(examples, null, 2), 'utf-8');

console.log(
  `Generated site/src/generated/spec.html, toc.json, schema.json, examples.json (${examples.length} examples)`
);
