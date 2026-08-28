import { readFileSync, writeFileSync, copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { load } from '@asciidoctor/core';
import { OCF_ERROR_CODES_URL } from '../src/lib/validator-version.mjs';
import { renderDiagram } from '../src/lib/diagram.mjs';

// Replace asciidoctor literalblocks that hold a PlantUML source
// (<pre>@startuml…</pre>) with rendered inline SVG. Pure w.r.t. I/O: the
// renderer is injected so it is unit-testable without network.
export async function replacePlantumlBlocks(html, render = renderDiagram) {
  const blockRe =
    /<div class="literalblock">\s*<div class="content">\s*<pre>(@startuml[\s\S]*?)<\/pre>\s*<\/div>\s*<\/div>/g;
  const matches = [...html.matchAll(blockRe)];
  let out = html;
  for (const m of matches) {
    const source = decodeHtmlEntities(m[1]);
    const svg = await render('plantuml', source);
    out = out.replace(m[0], `<div class="diagram-svg">${svg}</div>`);
  }
  return out;
}

function decodeHtmlEntities(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#8217;/g, '’')
    .replace(/&amp;/g, '&');
}

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
    'toc!': '',
  },
});
const specHtmlRaw = await doc.convert();
const specHtml = await replacePlantumlBlocks(specHtmlRaw);
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

const errorCodesRes = await fetch(OCF_ERROR_CODES_URL);
if (!errorCodesRes.ok) {
  throw new Error(
    `Failed to fetch error-codes.json from ${OCF_ERROR_CODES_URL}: ${errorCodesRes.status} ${errorCodesRes.statusText}`
  );
}
const errorCodes = await errorCodesRes.json();
writeFileSync(path.join(outDir, 'error-codes.json'), JSON.stringify(errorCodes, null, 2), 'utf-8');

console.log(
  `Generated site/src/generated/spec.html, toc.json, schema.json, examples.json (${examples.length} examples), error-codes.json (${Object.keys(errorCodes).length} codes)`
);
