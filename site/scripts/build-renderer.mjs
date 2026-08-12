import { mkdirSync, writeFileSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { OCF_RENDERER_REPOSITORY, OCF_RENDERER_COMMIT } from '../src/lib/renderer-version.mjs';

const siteRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(siteRoot, 'src', 'generated', 'renderer');

let tmpDir = null;

function cleanup() {
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

try {
  tmpDir = path.join(os.tmpdir(), `ocf-renderer-build-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  const cloneUrl = `https://github.com/${OCF_RENDERER_REPOSITORY}.git`;
  console.log(`Cloning ${OCF_RENDERER_REPOSITORY}@${OCF_RENDERER_COMMIT.slice(0, 7)} into ${tmpDir}...`);

  execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
  execSync(`git remote add origin ${cloneUrl}`, { cwd: tmpDir, stdio: 'pipe' });
  execSync(`git fetch --depth 1 origin ${OCF_RENDERER_COMMIT}`, {
    cwd: tmpDir,
    stdio: 'pipe',
  });
  execSync('git checkout FETCH_HEAD', {
    cwd: tmpDir,
    stdio: 'pipe',
  });

  console.log('Installing dependencies...');
  execSync('npm install', {
    cwd: tmpDir,
    stdio: 'pipe',
  });

  console.log('Building browser bundle...');
  execSync('npm run build:browser', {
    cwd: tmpDir,
    stdio: 'pipe',
  });

  const bundleSrc = path.join(tmpDir, 'dist', 'browser', 'index.js');
  if (!existsSync(bundleSrc)) {
    throw new Error(`Expected browser bundle at ${bundleSrc} but it does not exist`);
  }

  mkdirSync(outDir, { recursive: true });
  copyFileSync(bundleSrc, path.join(outDir, 'index.js'));

  const metadata = {
    repository: OCF_RENDERER_REPOSITORY,
    commit: OCF_RENDERER_COMMIT,
    shortCommit: OCF_RENDERER_COMMIT.slice(0, 7),
    buildDate: new Date().toISOString(),
  };
  writeFileSync(path.join(outDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');

  console.log(
    `Generated site/src/generated/renderer/index.js and metadata.json (${OCF_RENDERER_REPOSITORY}@${metadata.shortCommit})`
  );
} catch (err) {
  console.error(`build:renderer failed: ${err.message}`);
  if (err.stderr) {
    console.error(err.stderr.toString());
  }
  cleanup();
  process.exit(1);
}

cleanup();
