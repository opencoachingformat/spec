import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { convert } from '@asciidoctor/core';

const siteRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.dirname(siteRoot);
const outDir = path.join(siteRoot, 'src', 'generated');

mkdirSync(outDir, { recursive: true });

const adocSource = readFileSync(
  path.join(repoRoot, 'docs', 'specification-v1.adoc'),
  'utf-8'
);
const specHtml = await convert(adocSource, {
  safe: 'safe',
  to_file: false,
  attributes: {
    'source-highlighter': '',
    toc: 'macro',
    showtitle: true,
  },
});

writeFileSync(path.join(outDir, 'spec.html'), specHtml, 'utf-8');
copyFileSync(
  path.join(repoRoot, 'schema', 'v1.json'),
  path.join(outDir, 'schema.json')
);

console.log('Generated site/src/generated/spec.html and schema.json');
