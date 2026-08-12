# Browser Renderer Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mobile-friendly, browser-only OCF renderer playground to the Astro specification website with local validation, live tactical-print rendering, PNG export, and opt-in GitHub Discussions feedback.

**Architecture:** The renderer repository produces a browser bundle at a pinned commit. The spec site's build script clones that exact commit, builds the browser bundle with Three.js included, and copies the result into generated site assets. A new Astro page reuses the existing validator browser bundle and site CSS, while small browser-side modules handle editor state, frame rendering, feedback bundle generation, clipboard opt-in, and Discussions navigation.

**Tech Stack:** Astro 7, TypeScript/Three.js, existing `ocf-validator` browser bundle, Vitest for pure helpers, Playwright for browser and mobile tests, GitHub Discussions links.

## Global Constraints

- The new page is `/playground/renderer` and the existing validator playground remains available and unchanged as a focused validation tool.
- The page must state: `Experimental renderer — this preview and its API are not final and may change.`
- JSON parsing, validation, rendering, PNG export, and feedback generation happen entirely in the browser.
- No localStorage, analytics payload, server endpoint, automatic persistence, account, upload, or automatic GitHub API creation is added.
- Rendering is enabled only for valid OCF documents; validation errors keep Render disabled.
- Clipboard copying is disabled by default and requires explicit opt-in; a no-copy feedback action must always exist.
- The page uses the Astro site's existing `Base` layout, CSS variables, typography, button styles, borders, and responsive conventions.
- The renderer and validator commit pins are explicit, visible in technical metadata, and build failures stop the site build.
- `coaching_animation` is not implemented and must not be presented as available.

---

### Task 1: Add a browser bundle target to ocf-renderer

**Files:**
- Modify: `/Users/oliver-marcuseder/01-vibe-coding/00-Basektball/open-coaching-format/ocf-renderer/package.json`
- Modify: `/Users/oliver-marcuseder/01-vibe-coding/00-Basektball/open-coaching-format/ocf-renderer/tsup.config.ts` or add it if the repository has no shared tsup config
- Test: renderer build command and existing renderer test suite

**Interfaces:**
- Produces an ESM browser bundle exposing the existing `OCFRenderer` API.
- The browser bundle must not require `three` from a runtime `node_modules` path.

- [ ] **Step 1: Write the failing build check**

Add a package script named `build:browser` that is expected to produce `dist/browser/index.js`, then run:

```bash
npm run build:browser
```

Expected: FAIL because no browser build target exists yet.

- [ ] **Step 2: Add the browser build configuration**

Configure a browser entry using the existing `src/index.ts` and bundle Three.js into the output. The build must preserve the package's existing ESM/CJS build and add a browser-only output. The resulting ESM module must export `OCFRenderer` and the document types' runtime exports without using Node globals.

Use an explicit browser target such as:

```json
"build:browser": "tsup src/index.ts --format esm --target es2020 --out-dir dist/browser --noExternal three"
```

If a shared config is introduced, keep the existing `build` script behavior unchanged and configure only `build:browser` to bundle `three`.

- [ ] **Step 3: Add a browser-bundle smoke test**

Create a small Node test or build verification script that reads `dist/browser/index.js` and asserts it does not contain a bare `from 'three'` import and that the build output exists. Keep the test independent of WebGL; it checks packaging only.

- [ ] **Step 4: Run focused and full renderer verification**

Run:

```bash
npm run build:browser
npm run build
npm run test
npx tsc --noEmit
```

Expected: both build targets pass, the browser bundle exists, and all existing renderer tests pass.

- [ ] **Step 5: Commit**

```bash
git add package.json tsup.config.ts scripts test
 git commit -m "feat: add bundled browser build for ocf-renderer"
```

Use only the files that actually exist; do not stage generated `dist/` artifacts unless the repository already tracks them.

---

### Task 2: Pin and build the renderer from the Astro site

**Files:**
- Create: `site/src/lib/renderer-version.mjs`
- Create: `site/scripts/build-renderer.mjs`
- Modify: `site/scripts/build-adoc.mjs` or `site/package.json` build scripts
- Modify: `site/package.json` to add `build:renderer` and `test:renderer-build` scripts
- Modify: `site/src/generated/` only through the existing generation process
- Test: `site/scripts/build-renderer.test.mjs` or a documented build smoke test

**Interfaces:**
- Produces `site/src/generated/renderer/index.js` and renderer metadata containing the pinned SHA.
- Exposes a site-importable browser module with `OCFRenderer`.

- [ ] **Step 1: Define the explicit renderer pin**

Create `site/src/lib/renderer-version.mjs` with the exact renderer commit used for the first integration. Keep the repository and SHA in one module:

```js
export const OCF_RENDERER_REPOSITORY = 'opencoachingformat/ocf-renderer';
export const OCF_RENDERER_COMMIT = '6509271d63a6c57a55d623a0e0d25cf66a13d1a9';
```

Use the exact commit SHA above; do not resolve a branch or tag at build time. Export a short SHA helper for display.

- [ ] **Step 2: Write the failing build smoke test**

Add a test that runs the renderer build helper in a temporary directory or verifies its generated output after `npm run build:renderer`. Assert that:

- `site/src/generated/renderer/index.js` exists;
- `site/src/generated/renderer/metadata.json` contains the configured SHA;
- the generated module is an ESM browser bundle.

Expected: FAIL because the helper and generated output do not exist.

- [ ] **Step 3: Implement the pinned clone/build/copy helper**

Create `site/scripts/build-renderer.mjs` that:

1. creates a temporary directory;
2. clones `https://github.com/${OCF_RENDERER_REPOSITORY}.git` at `OCF_RENDERER_COMMIT` with `git clone --no-checkout` plus `git checkout --detach`;
3. runs `npm ci` in the clone;
4. runs `npm run build:browser`;
5. copies `dist/browser/index.js` into `site/src/generated/renderer/index.js`;
6. writes `metadata.json` with repository, full commit, short commit, and build date;
7. deletes the temporary clone on success and failure;
8. exits non-zero for clone, checkout, install, or build failure.

Do not copy source files or `node_modules` into the site output. The page must import only the generated bundle.

- [ ] **Step 4: Wire the helper into the site build**

Update the site build sequence so renderer generation runs before Astro builds, just as `build:adoc` currently runs first:

```json
"build:renderer": "node scripts/build-renderer.mjs",
"build": "npm run build:adoc && npm run build:renderer && astro build"
```

Ensure `renderer-version.mjs` is imported by the page and metadata is available during Astro compilation.

- [ ] **Step 5: Run the site build and smoke test**

Run:

```bash
npm run build:renderer
npm run build
npm run test:renderer-build
```

Expected: the pinned renderer builds and Astro produces a complete site. Network/build failures must fail loudly instead of silently producing a page without a renderer.

- [ ] **Step 6: Commit**

```bash
git add site/package.json site/src/lib/renderer-version.mjs site/scripts/build-renderer.mjs site/scripts/build-renderer.test.mjs
 git commit -m "build: pin and bundle renderer for docs site"
```

---

### Task 3: Build the renderer playground page

**Files:**
- Create: `site/src/pages/playground/renderer.astro`
- Create: `site/src/lib/renderer-playground.mjs`
- Modify: `site/src/lib/renderer-version.mjs` only for exported display metadata
- Test: browser page smoke tests in Task 5

**Interfaces:**
- `renderer-playground.mjs` exports pure helpers for parsing, feedback state, frame clamping, and Markdown generation.
- The Astro page imports the generated renderer bundle and pinned validator browser URL.

- [ ] **Step 1: Write pure helper tests**

Create tests for these exact helpers:

```js
parseDocument(text)                  // { ok: true, value } | { ok: false, message }
clampFrameIndex(index, frameCount)   // integer in [0, frameCount - 1]
canRender(validationResult)           // boolean
buildFeedbackMarkdown(input)          // string
```

Cover valid JSON, invalid JSON, empty frame arrays, out-of-range frame indices, and Markdown containing JSON, selected frame, validator result, renderer SHA, and validator SHA.

- [ ] **Step 2: Implement the page state flow**

Use the existing `playground.astro` validator loading pattern. The page must:

- seed the editor with a generated OCF example;
- provide an example selector, `Validate`, `Render`, and `Reset` controls;
- parse JSON before validator invocation;
- render only after `validate(doc).valid` is true;
- instantiate `new OCFRenderer(doc)` and call `renderToCanvas(frameIndex, canvas)`;
- clear and rerender the canvas when the frame changes;
- display `frame N / total` and disable Previous/Next at boundaries;
- expose `Download PNG` only after a successful render;
- preserve editor contents after any error.

Show the exact experimental notice near the page title:

```text
Experimental renderer — this preview and its API are not final and may change.
```

- [ ] **Step 3: Implement Astro-consistent responsive styling**

Use `Base` and existing site CSS variables. Desktop uses a two-column editor/preview workspace. At the site's responsive breakpoint it becomes a single-column flow: notice, controls, editor, validation, actions, preview, navigation. Use minimum 44px touch targets, no hover-only controls, responsive canvas sizing, and a full-viewport feedback dialog on narrow screens.

- [ ] **Step 4: Implement error states**

Render these states without throwing into the page:

- JSON parse error;
- validator invalid with errors/warnings;
- renderer runtime error;
- no frames or invalid frame index;
- successful render.

Do not show local file paths or internal stack traces.

- [ ] **Step 5: Run focused helper tests and site build**

Run:

```bash
npm run test:renderer-playground
npm run build:renderer
npm run build
```

Expected: helper tests pass and the page is included at `site/dist/playground/renderer/index.html`.

- [ ] **Step 6: Commit**

```bash
git add site/src/pages/playground/renderer.astro site/src/lib/renderer-playground.mjs site/src/lib/renderer-playground.test.mjs
 git commit -m "feat: add browser renderer playground page"
```

---

### Task 4: Add opt-in feedback and PNG export

**Files:**
- Create: `site/src/lib/discussions.mjs`
- Modify: `site/src/pages/playground/renderer.astro`
- Test: `site/src/lib/discussions.test.mjs`

**Interfaces:**
- `buildDiscussionUrl(module, categoryConfig)` returns a configured category URL or the general Discussions URL.
- `buildFeedbackMarkdown(input)` returns selectable Markdown without side effects.
- Clipboard and navigation are called only from explicit button handlers.

- [ ] **Step 1: Write failing feedback tests**

Cover:

```js
buildDiscussionUrl('renderer', { renderer: 'renderer-feedback' })
  // returns the category URL for opencoachingformat/spec
buildDiscussionUrl('editor', { editor: '' })
  // returns the general discussions URL
buildFeedbackMarkdown({ json, frameIndex, validation, rendererCommit, validatorCommit })
  // includes all fields and the JSON in a fenced block
```

Add a test that the default feedback state has `copyToClipboard === false`.

- [ ] **Step 2: Implement module/category configuration**

Create a central configuration for the `spec`, `validator`, `renderer`, and `editor` module targets. Empty/unavailable category slugs resolve to `https://github.com/opencoachingformat/spec/discussions`. Category URLs must be URL-encoded and never contain user JSON.

- [ ] **Step 3: Implement feedback dialog behavior**

The dialog must:

- show exactly what JSON, validation result, frame, and version metadata will be included;
- keep clipboard opt-in unchecked by default;
- provide `Copy feedback & open GitHub Discussions` only when checked;
- provide `Open GitHub Discussions without copying` regardless of checkbox state;
- call `navigator.clipboard.writeText(markdown)` only after the explicit copy action;
- leave the Markdown visible and selectable if Clipboard API is unavailable or rejects;
- navigate only after the user has chosen an action.

- [ ] **Step 4: Implement PNG export**

Use the successful preview canvas only:

```js
const link = document.createElement('a');
link.download = `ocf-frame-${frameIndex + 1}.png`;
link.href = canvas.toDataURL('image/png');
link.click();
```

Do not include the PNG in clipboard content or upload it automatically.

- [ ] **Step 5: Run focused tests and build**

Run:

```bash
npm run test:renderer-playground
npm run build
```

Expected: feedback helper tests pass and the page builds.

- [ ] **Step 6: Commit**

```bash
git add site/src/lib/discussions.mjs site/src/lib/discussions.test.mjs site/src/pages/playground/renderer.astro
 git commit -m "feat: add opt-in Discussions feedback and PNG export"
```

---

### Task 5: Add browser, mobile, and accessibility verification

**Files:**
- Create or modify: `site/playwright.config.ts`
- Create: `site/tests/renderer-playground.spec.ts`
- Modify: `.github/workflows/a11y-check.yml` only if the existing workflow does not cover the new page
- Test: `site/tests/renderer-playground.spec.ts`

**Interfaces:**
- Browser tests use a built Astro site and do not require network access to GitHub Discussions.
- Clipboard behavior is tested with a Playwright permission grant and a denied-permission context.

- [ ] **Step 1: Write browser tests**

Add tests that verify:

1. `/playground/renderer` shows the experimental notice and an example.
2. A valid example validates, renders a canvas, and moves from frame 1 to frame 2.
3. Invalid JSON shows a parse error and keeps Render disabled.
4. A validator-invalid document shows errors and does not render.
5. Desktop has editor and preview in separate columns.
6. Mobile viewport has no horizontal overflow and all primary controls are visible/reachable.
7. Feedback dialog shows the Markdown bundle and starts with clipboard opt-in unchecked.
8. The no-copy action navigates to the configured Discussions fallback.
9. Clipboard copy occurs only after opt-in and explicit action.
10. Clipboard denial leaves manual-copy content visible.
11. PNG download is offered after rendering.

- [ ] **Step 2: Run site browser and accessibility tests**

Run:

```bash
npm run build
npx playwright test site/tests/renderer-playground.spec.ts
npx axe site/dist/playground/renderer/index.html
```

Expected: all desktop/mobile browser tests and the accessibility check pass.

- [ ] **Step 3: Manually review the live page**

Run: `npm run dev`

Check the page on a desktop viewport and a mobile viewport. Verify the Astro visual language, experimental notice, frame navigation, validation errors, feedback consent wording, and no-copy path.

- [ ] **Step 4: Commit**

```bash
git add site/playwright.config.ts site/tests/renderer-playground.spec.ts .github/workflows/a11y-check.yml
 git commit -m "test: verify renderer playground on desktop and mobile"
```

---

## Final verification checklist

- [ ] Renderer browser bundle builds from an explicit renderer commit.
- [ ] Site build fails when the renderer pin cannot be built.
- [ ] `/playground/renderer` uses Astro's existing layout and CSS system.
- [ ] Experimental/non-final notice is visible.
- [ ] Valid JSON validates and renders locally.
- [ ] Invalid JSON and invalid OCF cannot render.
- [ ] Frame navigation works on desktop and mobile.
- [ ] PNG export is local and explicit.
- [ ] Clipboard is opt-in and no-copy feedback is available.
- [ ] Feedback Markdown includes JSON, frame, validation result, and version pins.
- [ ] GitHub Discussions fallback works when category slugs are unavailable.
- [ ] Existing validator playground remains intact.
- [ ] Site build, unit tests, browser tests, and accessibility tests pass.

---

## Task 5 Report — clipboard-copy test fix

The `clipboard copy occurs only after opt-in and explicit action` test asserted `window.__openedUrls` (popup navigation), coupling clipboard behavior to popup navigation. The separate `no-copy action navigates to Discussions fallback` test already covers URL navigation. Removed only the popup URL assertions from the clipboard-copy test; preserved assertions that the button is disabled before opt-in, enabled after opt-in, and that clipboard content contains the generated feedback Markdown and JSON fence. No product code was modified.

### Commands and exact outputs

#### `npm ci`

```
added 302 packages, and audited 303 packages in 7s

86 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

#### `npm run test:renderer-playground`

```
> ocf-docs-site@0.0.0 test:renderer-playground
> node src/lib/renderer-playground.test.mjs

renderer-playground helper tests
  PASS: parseDocument: valid JSON with frames
  PASS: parseDocument: invalid JSON returns error
  PASS: parseDocument: empty string returns error
  PASS: parseDocument: JSON array returns error
  PASS: parseDocument: null returns error
  PASS: parseDocument: object without frames returns error
  PASS: parseDocument: empty frames array is valid
  PASS: clampFrameIndex: zero index with normal count
  PASS: clampFrameIndex: middle index
  PASS: clampFrameIndex: last valid index
  PASS: clampFrameIndex: out of range high clamps to max
  PASS: clampFrameIndex: negative clamps to 0
  PASS: clampFrameIndex: NaN clamps to 0
  PASS: clampFrameIndex: zero frame count returns 0
  PASS: clampFrameIndex: negative frame count returns 0
  PASS: clampFrameIndex: single frame
  PASS: clampFrameIndex: float index truncated
  PASS: canRender: valid result returns true
  PASS: canRender: invalid result returns false
  PASS: canRender: null returns false
  PASS: canRender: undefined returns false
  PASS: canRender: valid with warnings still true
  PASS: canRender: missing valid property returns false
  PASS: sanitizeErrorMessage: strips absolute Unix paths
  PASS: sanitizeErrorMessage: strips Windows paths
  PASS: sanitizeErrorMessage: strips file:// URIs
  PASS: sanitizeErrorMessage: strips stack trace lines
  PASS: sanitizeErrorMessage: caps at 300 characters
  PASS: sanitizeErrorMessage: accepts Error objects
  PASS: sanitizeErrorMessage: handles null/undefined gracefully
  PASS: sanitizeErrorMessage: handles non-string non-object input
  PASS: sanitizeErrorMessage: preserves clean short messages
  PASS: buildFeedbackMarkdown: includes JSON in fenced block
  PASS: buildFeedbackMarkdown: includes frame index
  PASS: buildFeedbackMarkdown: includes renderer SHA
  PASS: buildFeedbackMarkdown: includes validator SHA
  PASS: buildFeedbackMarkdown: includes validation result
  PASS: buildFeedbackMarkdown: uses pinned commits by default

38 test(s) passed
```

#### `npm run test:renderer-build`

```
> ocf-docs-site@0.0.0 test:renderer-build
> node scripts/build-renderer.test.mjs

build:renderer smoke test
  PASS: generated/renderer/index.js exists
  PASS: generated/renderer/metadata.json exists and contains pinned SHA
  PASS: generated bundle is an ESM browser module

3 test(s) passed
```

#### `npm run build`

```
> ocf-docs-site@0.0.0 build
> npm run build:adoc && npm run build:renderer && astro build


> ocf-docs-site@0.0.0 build:adoc
> node scripts/build-adoc.mjs

Generated site/src/generated/spec.html, toc.json, schema.json, examples.json (4 examples), error-codes.json (16 codes)

> ocf-docs-site@0.0.0 build:renderer
> node scripts/build-renderer.mjs

Cloning opencoachingformat/ocf-renderer@18f4992 into /var/folders/7d/2z4dyhsj5qvgjctp3665_5280000gn/T/ocf-renderer-build-1786572513498...
Installing dependencies...
Building browser bundle...
Generated site/src/generated/renderer/index.js and metadata.json (opencoachingformat/ocf-renderer@18f4992)
00:08:42 [types] Generated 76ms
00:08:42 [build] output: "static"
00:08:42 [build] mode: "static"
00:08:42 [build] directory: /Users/oliver-marcuseder/01-vibe-coding/00-Basektball/open-coaching-format/ocf-repo/.worktrees/browser-renderer-playground/site/dist/
00:08:42 [build] Collecting build info...
00:08:42 [build] ✓ Completed in 113ms.
00:08:42 [build] Building static entrypoints...
00:08:42 [vite] ✓ built in 641ms
00:08:42 [vite] ✓ built in 20ms
00:08:42 [build] Rearranging server assets...

 generating static routes
00:08:42   ├─ /docs/features/index.html (+8ms)
00:08:42   ├─ /docs/rulesets/index.html (+4ms)
00:08:42   ├─ /docs/schema/index.html (+9ms)
00:08:42   ├─ /docs/spec/index.html (+5ms)
00:08:42   ├─ /docs/index.html (+6ms)
00:08:42   ├─ /ecosystem/index.html (+3ms)
00:08:42   ├─ /errors/index.html (+3ms)
00:08:42   ├─ /examples/index.html (+3ms)
00:08:42   ├─ /playground/renderer/index.html (+7ms)
00:08:42   ├─ /playground/index.html (+3ms)
00:08:42   ├─ /schema/index.html (+1ms)
00:08:43   ├─ /spec/index.html (+2ms)
00:08:43   ├─ /index.html (+4ms)
00:08:43 ✓ Completed in 69ms.

00:08:43 [build] ✓ Completed in 763ms.
00:08:43 [@astrojs/sitemap] `sitemap-index.xml` created at `dist`
00:08:43 [build] 11 page(s) built in 894ms
00:08:43 [build] Complete!
```

#### `npx playwright test tests/renderer-playground.spec.ts`

```
Running 22 tests using 2 workers

  ✓   2 [chromium-desktop] › tests/renderer-playground.spec.ts:37:3 › renderer playground › shows experimental notice and seeded example (895ms)
  ✓   1 [chromium-mobile] › tests/renderer-playground.spec.ts:37:3 › renderer playground › shows experimental notice and seeded example (874ms)
  ✓   3 [chromium-desktop] › tests/renderer-playground.spec.ts:46:3 › renderer playground › valid example validates, renders, and navigates frames (3.6s)
  ✓   4 [chromium-mobile] › tests/renderer-playground.spec.ts:46:3 › renderer playground › valid example validates, renders, and navigates frames (3.6s)
  ✓   5 [chromium-desktop] › tests/renderer-playground.spec.ts:71:3 › renderer playground › invalid JSON shows parse error and keeps Render disabled (700ms)
  ✓   6 [chromium-mobile] › tests/renderer-playground.spec.ts:71:3 › renderer playground › invalid JSON shows parse error and keeps Render disabled (679ms)
  ✓   7 [chromium-desktop] › tests/renderer-playground.spec.ts:81:3 › renderer playground › validator-invalid document shows errors and does not render (1.5s)
  ✓   8 [chromium-mobile] › tests/renderer-playground.spec.ts:81:3 › renderer playground › validator-invalid document shows errors and does not render (1.5s)
  ✓   9 [chromium-desktop] › tests/renderer-playground.spec.ts:90:3 › renderer playground › desktop layout has editor and preview in separate columns (719ms)
  -  10 [chromium-mobile] › tests/renderer-playground.spec.ts:90:3 › renderer playground › desktop layout has editor and preview in separate columns
  ✓  11 [chromium-mobile] › tests/renderer-playground.spec.ts:104:3 › renderer playground › mobile viewport has no horizontal overflow and controls are reachable (644ms)
  -  12 [chromium-desktop] › tests/renderer-playground.spec.ts:104:3 › renderer playground › mobile viewport has no horizontal overflow and controls are reachable
  ✓  13 [chromium-mobile] › tests/renderer-playground.spec.ts:118:3 › renderer playground › feedback dialog shows Markdown bundle with clipboard unchecked (707ms)
  ✓  14 [chromium-desktop] › tests/renderer-playground.spec.ts:118:3 › renderer playground › feedback dialog shows Markdown bundle with clipboard unchecked (722ms)
  ✓  15 [chromium-mobile] › tests/renderer-playground.spec.ts:138:3 › renderer playground › no-copy action navigates to Discussions fallback (753ms)
  ✓  16 [chromium-desktop] › tests/renderer-playground.spec.ts:138:3 › renderer playground › no-copy action navigates to Discussions fallback (806ms)
  ✓  17 [chromium-mobile] › tests/renderer-playground.spec.ts:162:3 › renderer playground › clipboard copy occurs only after opt-in and explicit action (803ms)
  ✓  18 [chromium-desktop] › tests/renderer-playground.spec.ts:162:3 › renderer playground › clipboard copy occurs only after opt-in and explicit action (825ms)
  ✓  19 [chromium-mobile] › tests/renderer-playground.spec.ts:191:3 › renderer playground › clipboard denial leaves manual-copy content visible (823ms)
  ✓  20 [chromium-desktop] › tests/renderer-playground.spec.ts:191:3 › renderer playground › clipboard denial leaves manual-copy content visible (826ms)
  ✓  21 [chromium-mobile] › tests/renderer-playground.spec.ts:216:3 › renderer playground › PNG download is offered after rendering (1.9s)
  ✓  22 [chromium-desktop] › tests/renderer-playground.spec.ts:216:3 › renderer playground › PNG download is offered after rendering (1.9s)

  2 skipped
  20 passed (15.4s)
```

#### `npx axe dist/playground/renderer/index.html`

```
Running axe-core 4.13.0 in chrome-headless

Testing file:///Users/oliver-marcuseder/01-vibe-coding/00-Basektball/open-coaching-format/ocf-repo/.worktrees/browser-renderer-playground/site/dist/playground/renderer/index.html ... please wait, this may take a minute.
  0 violations found!
Testing complete of 1 pages

Please note that only 20% to 50% of all accessibility issues can automatically be detected.
Manual testing is always required. For more information see:
https://dequeuniversity.com/class/testing
```
