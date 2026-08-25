import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  OCF_RENDERER_REPOSITORY,
  OCF_RENDERER_VERSION,
  OCF_RENDERER_BROWSER_URL,
} from '../src/lib/renderer-version.mjs';

const siteRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(siteRoot, 'src', 'generated', 'renderer');

try {
  console.log(`Fetching @opencoachingformat/renderer@${OCF_RENDERER_VERSION} browser bundle from ${OCF_RENDERER_BROWSER_URL}...`);

  const res = await fetch(OCF_RENDERER_BROWSER_URL);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} fetching ${OCF_RENDERER_BROWSER_URL}`);
  }
  const bundle = await res.text();

  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'index.js'), bundle, 'utf-8');

  const metadata = {
    repository: OCF_RENDERER_REPOSITORY,
    package: '@opencoachingformat/renderer',
    version: OCF_RENDERER_VERSION,
    buildDate: new Date().toISOString(),
  };
  writeFileSync(path.join(outDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');

  console.log(
    `Generated site/src/generated/renderer/index.js and metadata.json (@opencoachingformat/renderer@${OCF_RENDERER_VERSION})`
  );
} catch (err) {
  console.error(`build:renderer failed: ${err.message}`);
  process.exit(1);
}
