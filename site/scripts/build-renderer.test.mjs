import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { OCF_RENDERER_COMMIT } from '../src/lib/renderer-version.mjs';

const siteRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rendererDir = path.join(siteRoot, 'src', 'generated', 'renderer');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('build:renderer smoke test');

test('generated/renderer/index.js exists', () => {
  const bundlePath = path.join(rendererDir, 'index.js');
  assert.ok(existsSync(bundlePath), `${bundlePath} does not exist`);
});

test('generated/renderer/metadata.json exists and contains pinned SHA', () => {
  const metaPath = path.join(rendererDir, 'metadata.json');
  assert.ok(existsSync(metaPath), `${metaPath} does not exist`);
  const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
  assert.equal(meta.commit, OCF_RENDERER_COMMIT, 'metadata commit does not match pinned SHA');
  assert.equal(meta.shortCommit, OCF_RENDERER_COMMIT.slice(0, 7), 'short commit mismatch');
  assert.ok(meta.repository, 'repository missing from metadata');
  assert.ok(meta.buildDate, 'buildDate missing from metadata');
});

test('generated bundle is an ESM browser module', () => {
  const bundlePath = path.join(rendererDir, 'index.js');
  const source = readFileSync(bundlePath, 'utf-8');
  assert.ok(source.length > 0, 'bundle is empty');
  assert.ok(!source.includes("from 'three'"), 'bundle contains bare three import');
  assert.ok(source.includes('OCFRenderer'), 'bundle does not export OCFRenderer');
});

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}

console.log(`\n${passed} test(s) passed`);
