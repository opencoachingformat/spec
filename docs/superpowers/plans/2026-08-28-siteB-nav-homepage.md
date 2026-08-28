# Plan B — Navigation + Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute this plan. Work one task at a time, dispatch a subagent per task, and stop at each review checkpoint. Do not batch tasks.

## Goal

Ship the audience-first navigation and the non-technical story homepage of the
site redesign (Plan B of 4). Concretely:

1. Rework the top nav to **Home · Learn · Use · Build** (+ GitHub), reusing the
   existing data-driven `navItems` array and the existing mobile drawer.
2. Replace the current technical homepage (`site/src/pages/index.astro`) with a
   **non-technical, no-diagram story scroll** in this exact order:
   (1) The problem → (2) What OCF is → (3) Multi-sport (deliberately before
   structure) → (4) Rough structure → (5) Where next (Learn/Use/Build).
3. Add three **area landing hubs** — `learn/index.astro`, `use/index.astro`,
   `build/index.astro` — that link to the **existing** pages at their current
   URLs (no page moving/merging happens here; that is Plan C/D).
4. Extend the CI accessibility route list to cover `/learn/`, `/use/`, `/build/`.

Plan B is additive: existing pages (`docs/spec`, `docs/schema`, `docs/rulesets`,
`docs/features`, `examples`, `errors`, `ecosystem`, `playground`,
`playground/renderer`) stay exactly where they are and keep their URLs.

## Architecture

**Verified facts (2026-08-28):**

- `site/src/components/Nav.astro` is **data-driven**: a `navItems` array in the
  frontmatter is mapped into both the inline nav and the mobile drawer. Only the
  array changes; the drawer markup, CSS, and focus-trap `<script>` stay intact.
  The GitHub link is appended separately in both lists and must remain.
- `site/src/layouts/Base.astro` exists and is reused by every page. Props:
  `title` (string), `description` (string), optional `wide` (boolean), and a
  named `head` slot for per-page `<head>` content (used by the homepage's
  JSON-LD script). It renders `<Nav />` then `<main><slot /></main>`.
- `site/src/components/Card.astro` exists and is reused. Props: `title`,
  `description`, `href`, optional `status`. It renders an anchor card.
- Astro uses directory-style output (`astro.config.mjs` sets `outDir: ./dist`,
  default `build.format`). A page at `src/pages/learn/index.astro` builds to
  `dist/learn/index.html` and resolves at `/learn/`. The homepage builds to
  `dist/index.html`.
- The **a11y workflow** (`.github/workflows/a11y-check.yml`) already runs on
  `site/src/pages/**` PRs: it runs `npm run build`, starts `astro preview`, and
  runs `npx axe` against an explicit list of routes. New top-level routes must be
  added to that list.
- Sport data exists at `spec/sports/basketball-v1.json` (full) and
  `soccer|handball|hockey|futsal-v0.0.1.json` (reserved). The dedicated sport
  pages (`/learn/sports/*`) **do not exist yet** — Plan C builds them. So in
  Plan B every homepage sport card links to `/learn/` (the Learn hub), keeping
  all homepage links resolvable at build time. The card copy still tells the
  multi-sport story; the destination is upgraded to `/learn/sports/` in Plan C.

**Pages introduced by Plan B** (all use `Base` + `Card`, no diagrams, no client JS):

- `site/src/pages/index.astro` — rewritten homepage (5 sections, keeps JSON-LD).
- `site/src/pages/learn/index.astro` — Learn hub.
- `site/src/pages/use/index.astro` — Use hub.
- `site/src/pages/build/index.astro` — Build hub.

**Files changed:** `site/src/components/Nav.astro` (navItems only),
`.github/workflows/a11y-check.yml` (axe route list).

## Tech Stack

- Astro `^7.1.2` (static build to `site/dist/`).
- Node's built-in test runner is used for existing unit tests; the pages added
  here are pure content (no unit-testable logic), so they use **build-based
  verification**: `cd site && npm run build`, then `node -e "..."` assertions
  that grep the built HTML for required nav labels, section headings, and that
  every new top-level route produced an `index.html`.
- `python3` for the YAML workflow edit (editing `.github/workflows/*.yml`
  triggers a security hook, so the workflow is patched via a `python3` heredoc
  and validated with `python3 -c "import yaml; ..."`).

---

## Task 1: Rework the top nav to Home · Learn · Use · Build

**Files:**
- `site/src/components/Nav.astro` (edit frontmatter `navItems` only)

Steps:

1. Verify the current state so the build assertion below is meaningful. Run:
   ```
   cd site && npm run build
   node -e "const fs=require('fs');const h=fs.readFileSync('dist/index.html','utf8');const bad=['>Docs<','>Playground<','>Renderer<','>Error Codes<'].filter(s=>h.includes(s));if(bad.length===0){console.error('EXPECTED old labels present before edit, found none');process.exit(1)}console.log('pre-edit old labels present:',bad.join(', '))"
   ```
   Expect it to print the old labels (they exist before the edit). This is the
   run-expect-fail analogue: it confirms the nav currently shows the old labels.

2. Implement: replace **only** the `navItems` array in the frontmatter of
   `site/src/components/Nav.astro`. Leave lines 12–228 (all markup, `<style>`,
   and `<script>`) unchanged. The GitHub `<li>` stays appended separately in both
   the inline nav and the drawer. New frontmatter (lines 1–11):

   ```astro
   ---
   const navItems = [
     { href: '/', label: 'Home' },
     { href: '/learn/', label: 'Learn' },
     { href: '/use/', label: 'Use' },
     { href: '/build/', label: 'Build' },
   ];
   ---
   ```

3. Run the build and assert the new nav labels are present and the old
   **nav-only** labels are gone, in **both** the inline nav and the drawer (both
   are rendered into every page's HTML). Note: this task runs before Task 2, so
   the old homepage body still exists — the stale check therefore only targets
   labels that were unique to the nav (`>Renderer<`, `>Error Codes<`), not words
   like "Docs"/"Examples"/"Ecosystem" that also appear as homepage body content
   until Task 2. Run:
   ```
   cd site && npm run build
   node -e "const fs=require('fs');const h=fs.readFileSync('dist/index.html','utf8');const need=['>Home<','>Learn<','>Use<','>Build<','>GitHub<'];const gone=['>Renderer<','>Error Codes<'];const miss=need.filter(s=>!h.includes(s));const stale=gone.filter(s=>h.includes(s));if(miss.length){console.error('MISSING nav labels:',miss.join(', '));process.exit(1)}if(stale.length){console.error('STALE nav labels still present:',stale.join(', '));process.exit(1)}const learnCount=(h.match(/href=\"\/learn\/\"/g)||[]).length;if(learnCount<2){console.error('Expected /learn/ link in both inline nav and drawer, saw',learnCount);process.exit(1)}console.log('nav OK: new labels present in inline+drawer, old nav labels gone')"
   ```
   Expect success. (The `/learn/` link appearing at least twice confirms both the
   inline nav and the drawer render from the same `navItems`.)

4. Commit: `nav: audience-first top nav (Home · Learn · Use · Build)`.

---

## Task 2: Rewrite the homepage as a non-technical story scroll

**Files:**
- `site/src/pages/index.astro` (full rewrite)

Steps:

1. Add a build-based failing check first. Run:
   ```
   cd site && npm run build
   node -e "const fs=require('fs');const h=fs.readFileSync('dist/index.html','utf8');const need=['Locked in proprietary apps','What OCF is','One format, every sport','How an OCF document is shaped','Where to go next'];const miss=need.filter(s=>!h.includes(s));if(miss.length===0){console.error('EXPECTED new story headings absent before rewrite, but all present');process.exit(1)}console.log('pre-rewrite: story headings absent as expected ->',miss.join(' | '))"
   ```
   Expect it to report the new headings are absent (the old homepage is still in
   place). This is the run-expect-fail step.

2. Implement: replace the entire contents of `site/src/pages/index.astro` with
   the file below. It keeps the `jsonLd` script and `Base` usage; drops the code
   example, the "Explore" cards, and the validator section (those belong under
   Use/Build now). No diagram. Sections appear in the required order:
   (1) problem → (2) what OCF is → (3) multi-sport → (4) rough structure →
   (5) where next. Sport cards and the "where next" cards reuse `Card`.

   ```astro
   ---
   import Base from '../layouts/Base.astro';
   import Card from '../components/Card.astro';

   const sports = [
     {
       title: 'Basketball',
       description:
         'Full vocabulary today: actions, rulesets, named positions, and worked example drills.',
       status: 'Full',
     },
     {
       title: 'Soccer',
       description:
         'Reserved. A provisional vocabulary is stubbed and waiting for sport experts to shape it.',
       status: 'Reserved',
     },
     {
       title: 'Handball',
       description:
         'Reserved. Court, entities, and frames carry over; the action list is open for contribution.',
       status: 'Reserved',
     },
     {
       title: 'Hockey',
       description:
         'Reserved. The shared structure applies; a hockey-specific action set is yet to be defined.',
       status: 'Reserved',
     },
     {
       title: 'Futsal',
       description:
         'Reserved. Same document shape, awaiting a futsal vocabulary from the community.',
       status: 'Reserved',
     },
   ];

   const jsonLd = {
     '@context': 'https://schema.org',
     '@type': 'SoftwareSourceCode',
     name: 'Open Coaching Format',
     description:
       'An open standard for representing sports coaching diagrams, drill animations, and playbooks as structured data.',
     codeRepository: 'https://github.com/opencoachingformat/spec',
     license: 'https://creativecommons.org/licenses/by/4.0/',
     programmingLanguage: 'JSON Schema',
   };
   ---
   <Base
     title="Home"
     description="An open standard for representing sports coaching diagrams, drill animations, and playbooks as structured data."
   >
     <Fragment slot="head">
       <script type="application/ld+json" set:html={JSON.stringify(jsonLd)} />
     </Fragment>

     <section class="hero">
       <h1>Open Coaching Format</h1>
       <p class="tagline">
         An open standard for sports coaching diagrams, drill animations, and
         playbooks — written as plain, readable data instead of pictures.
       </p>
     </section>

     <section>
       <h2>Locked in proprietary apps</h2>
       <p>
         Coaches draw plays every day, but the diagrams live inside closed tools —
         the FIBA Europe Coaching App, FastDraw, Sportplan.net, and dozens of
         others. Each one stores plays in its own private format and lets you
         export only a flat image: a PNG or a PDF.
       </p>
       <p>
         An image can be viewed, but it cannot be understood by another program.
         You cannot search it, replay the movement, translate the labels, restyle
         it for a handout, or move a play from one app to another. The moment a
         drill leaves the app that drew it, it stops being data and becomes a
         picture.
       </p>
     </section>

     <section>
       <h2>What OCF is</h2>
       <p>
         The Open Coaching Format is an open standard that stores a coaching
         diagram — or a whole animated drill — as readable JSON. JSON is a simple,
         text-based way of describing information that both people and software can
         read. Because an OCF play is data rather than an image, any tool can open
         it, render it, animate it, or convert it.
       </p>
       <p>
         The same file can drive a static diagram for a printed playbook and a
         frame-by-frame animation on screen. Nothing is locked to one vendor: the
         format is public, and anyone can build a reader, an editor, or a renderer
         on top of it.
       </p>
     </section>

     <section>
       <h2>One format, every sport</h2>
       <p>
         OCF is not basketball-only. A play in any team sport is the same kind of
         thing: players positioned on a marked surface, moving and passing over
         time. OCF captures that shared shape once, then lets each sport add its
         own vocabulary of actions on top.
       </p>
       <p>
         Basketball is fully specified today. The other sports are reserved:
         the structure already fits them, and their action vocabularies are open
         for the people who know each game best.
       </p>
       <div class="card-grid">
         {sports.map((sport) => (
           <Card
             title={sport.title}
             description={sport.description}
             href="/learn/"
             status={sport.status}
           />
         ))}
       </div>
     </section>

     <section>
       <h2>How an OCF document is shaped</h2>
       <p>
         You do not need to read JSON to get the idea. An OCF play is built from a
         few plain parts:
       </p>
       <ul class="structure-list">
         <li>
           <strong>Court coordinates.</strong> A chosen ruleset fixes the size and
           markings of the playing surface, so every position is measured in real
           units — a spot on the floor means the same thing to every tool.
         </li>
         <li>
           <strong>Entities and actions.</strong> Players, defenders, and balls are
           the entities. What they do — pass, cut, screen, dribble — are the
           actions, drawn from a sport's vocabulary.
         </li>
         <li>
           <strong>Frames and animation.</strong> A play is a sequence of frames.
           Each frame lists the actions that happen and where everything ends up,
           which is what turns a static diagram into a replayable animation.
         </li>
       </ul>
     </section>

     <section>
       <h2>Where to go next</h2>
       <div class="card-grid">
         <Card
           title="Learn"
           description="Understand the concepts and browse the format sport by sport."
           href="/learn/"
         />
         <Card
           title="Use"
           description="Validate and render your own OCF documents, and see the supported rulesets."
           href="/use/"
         />
         <Card
           title="Build"
           description="The specification, JSON Schema, error codes, and the tools built on OCF."
           href="/build/"
         />
       </div>
     </section>
   </Base>

   <style>
     .hero {
       margin-bottom: 2.5rem;
     }
     .tagline {
       font-size: 1.15rem;
       color: var(--text-muted);
     }
     .card-grid {
       display: grid;
       grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
       gap: 1rem;
       margin-top: 1rem;
     }
     .structure-list {
       margin-top: 0.5rem;
       padding-left: 1.25rem;
       display: flex;
       flex-direction: column;
       gap: 0.75rem;
     }
   </style>
   ```

3. Run the build and assert the story sections exist in order, the JSON-LD is
   still emitted, and the old technical bits are gone. Run:
   ```
   cd site && npm run build
   node -e "const fs=require('fs');const h=fs.readFileSync('dist/index.html','utf8');const order=['Locked in proprietary apps','What OCF is','One format, every sport','How an OCF document is shaped','Where to go next'];let last=-1;for(const s of order){const i=h.indexOf(s);if(i===-1){console.error('MISSING section:',s);process.exit(1)}if(i<last){console.error('OUT OF ORDER:',s);process.exit(1)}last=i}if(!h.includes('application/ld+json')){console.error('MISSING JSON-LD');process.exit(1)}if(!h.includes('SoftwareSourceCode')){console.error('MISSING JSON-LD payload');process.exit(1)}const stale=['Quick example','Using the Validator','git clone'].filter(s=>h.includes(s));if(stale.length){console.error('STALE homepage content:',stale.join(', '));process.exit(1)}const oi=h.indexOf('One format, every sport');const si=h.indexOf('How an OCF document is shaped');if(!(oi<si)){console.error('Multi-sport must come before structure');process.exit(1)}console.log('homepage OK: 5 sections in order, JSON-LD kept, old content removed, multi-sport before structure')"
   ```
   Expect success.

4. Commit: `home: non-technical story homepage (problem → OCF → sports → structure → next)`.

---

## Task 3: Add the Learn area hub

**Files:**
- `site/src/pages/learn/index.astro` (new)

Steps:

1. Failing build check first. Run:
   ```
   cd site && npm run build
   node -e "const fs=require('fs');if(fs.existsSync('dist/learn/index.html')){console.error('EXPECTED /learn/ to not exist yet');process.exit(1)}console.log('pre-add: /learn/ absent as expected')"
   ```
   Expect it to report `/learn/` is absent.

2. Implement `site/src/pages/learn/index.astro` as a simple hub. It links to the
   **existing** pages at their current URLs (`/docs/`, `/docs/features/`,
   `/examples/`). No page moving happens here.

   ```astro
   ---
   import Base from '../../layouts/Base.astro';
   import Card from '../../components/Card.astro';
   ---
   <Base
     title="Learn"
     description="Understand the Open Coaching Format: the core concepts, key features, and worked example drills."
   >
     <section class="hero">
       <h1>Learn</h1>
       <p class="tagline">
         Start here to understand what OCF describes and how a play is put
         together, then see it applied in real drills.
       </p>
     </section>

     <section>
       <div class="card-grid">
         <Card
           title="Documentation"
           description="The concepts behind OCF: the document model, court, entities, actions, and frames."
           href="/docs/"
         />
         <Card
           title="Key features"
           description="The ideas that make OCF expressive — named positions, coordinates, and animation."
           href="/docs/features/"
         />
         <Card
           title="Examples"
           description="Worked OCF drills: pick and roll, three-man weave, transition offense, and more."
           href="/examples/"
         />
       </div>
     </section>
   </Base>

   <style>
     .hero {
       margin-bottom: 2rem;
     }
     .tagline {
       font-size: 1.15rem;
       color: var(--text-muted);
     }
     .card-grid {
       display: grid;
       grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
       gap: 1rem;
     }
   </style>
   ```

3. Run the build and assert the route resolved and its links point at existing
   pages. Run:
   ```
   cd site && npm run build
   node -e "const fs=require('fs');if(!fs.existsSync('dist/learn/index.html')){console.error('MISSING dist/learn/index.html');process.exit(1)}const h=fs.readFileSync('dist/learn/index.html','utf8');const need=['<h1>Learn</h1>','href=\"/docs/\"','href=\"/docs/features/\"','href=\"/examples/\"'];const miss=need.filter(s=>!h.includes(s));if(miss.length){console.error('MISSING on /learn/:',miss.join(', '));process.exit(1)}console.log('learn hub OK')"
   ```
   Expect success.

4. Commit: `learn: area hub linking docs, features, examples`.

---

## Task 4: Add the Use area hub

**Files:**
- `site/src/pages/use/index.astro` (new)

Steps:

1. Failing build check first. Run:
   ```
   cd site && npm run build
   node -e "const fs=require('fs');if(fs.existsSync('dist/use/index.html')){console.error('EXPECTED /use/ to not exist yet');process.exit(1)}console.log('pre-add: /use/ absent as expected')"
   ```
   Expect it to report `/use/` is absent.

2. Implement `site/src/pages/use/index.astro`. It links to the **existing**
   playground, renderer, rulesets, and error-codes pages at their current URLs.

   ```astro
   ---
   import Base from '../../layouts/Base.astro';
   import Card from '../../components/Card.astro';
   ---
   <Base
     title="Use"
     description="Put OCF to work: validate and render your own documents in the browser, and see the supported rulesets."
   >
     <section class="hero">
       <h1>Use</h1>
       <p class="tagline">
         Try OCF on your own documents. Validation and rendering run in your
         browser — nothing is uploaded.
       </p>
     </section>

     <section>
       <div class="card-grid">
         <Card
           title="Playground"
           description="Paste or edit an OCF document and validate it instantly against the reference validator."
           href="/playground/"
         />
         <Card
           title="Renderer"
           description="See an OCF document drawn as a diagram, straight from the JSON."
           href="/playground/renderer/"
         />
         <Card
           title="Rulesets"
           description="The playing surfaces OCF supports, with their coordinate systems and markings."
           href="/docs/rulesets/"
         />
         <Card
           title="Error codes"
           description="What each validation error and warning means, so you can fix a document quickly."
           href="/errors/"
         />
       </div>
     </section>
   </Base>

   <style>
     .hero {
       margin-bottom: 2rem;
     }
     .tagline {
       font-size: 1.15rem;
       color: var(--text-muted);
     }
     .card-grid {
       display: grid;
       grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
       gap: 1rem;
     }
   </style>
   ```

3. Run the build and assert the route resolved with links to existing pages. Run:
   ```
   cd site && npm run build
   node -e "const fs=require('fs');if(!fs.existsSync('dist/use/index.html')){console.error('MISSING dist/use/index.html');process.exit(1)}const h=fs.readFileSync('dist/use/index.html','utf8');const need=['<h1>Use</h1>','href=\"/playground/\"','href=\"/playground/renderer/\"','href=\"/docs/rulesets/\"','href=\"/errors/\"'];const miss=need.filter(s=>!h.includes(s));if(miss.length){console.error('MISSING on /use/:',miss.join(', '));process.exit(1)}console.log('use hub OK')"
   ```
   Expect success.

4. Commit: `use: area hub linking playground, renderer, rulesets, error codes`.

---

## Task 5: Add the Build area hub

**Files:**
- `site/src/pages/build/index.astro` (new)

Steps:

1. Failing build check first. Run:
   ```
   cd site && npm run build
   node -e "const fs=require('fs');if(fs.existsSync('dist/build/index.html')){console.error('EXPECTED /build/ to not exist yet');process.exit(1)}console.log('pre-add: /build/ absent as expected')"
   ```
   Expect it to report `/build/` is absent.

2. Implement `site/src/pages/build/index.astro`. It links to the **existing**
   spec, schema, error-codes, and ecosystem pages at their current URLs.
   (Architecture/arc42 arrives in Plan D and is intentionally not linked yet.)

   ```astro
   ---
   import Base from '../../layouts/Base.astro';
   import Card from '../../components/Card.astro';
   ---
   <Base
     title="Build"
     description="Build on OCF: the full specification, the JSON Schema, the error-code catalogue, and the surrounding ecosystem of tools."
   >
     <section class="hero">
       <h1>Build</h1>
       <p class="tagline">
         Everything you need to implement OCF or build a tool on top of it: the
         normative spec, the schema, and the ecosystem.
       </p>
     </section>

     <section>
       <div class="card-grid">
         <Card
           title="Specification"
           description="The full, normative Open Coaching Format specification."
           href="/docs/spec/"
         />
         <Card
           title="JSON Schema"
           description="The machine-readable JSON Schema you validate documents against."
           href="/docs/schema/"
         />
         <Card
           title="Error codes"
           description="The catalogue of validation error and warning codes with their meanings."
           href="/errors/"
         />
         <Card
           title="Ecosystem"
           description="Validator, renderer, and editor projects built on OCF, plus the roadmap."
           href="/ecosystem/"
         />
       </div>
     </section>
   </Base>

   <style>
     .hero {
       margin-bottom: 2rem;
     }
     .tagline {
       font-size: 1.15rem;
       color: var(--text-muted);
     }
     .card-grid {
       display: grid;
       grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
       gap: 1rem;
     }
   </style>
   ```

3. Run the build and assert the route resolved with links to existing pages. Run:
   ```
   cd site && npm run build
   node -e "const fs=require('fs');if(!fs.existsSync('dist/build/index.html')){console.error('MISSING dist/build/index.html');process.exit(1)}const h=fs.readFileSync('dist/build/index.html','utf8');const need=['<h1>Build</h1>','href=\"/docs/spec/\"','href=\"/docs/schema/\"','href=\"/errors/\"','href=\"/ecosystem/\"'];const miss=need.filter(s=>!h.includes(s));if(miss.length){console.error('MISSING on /build/:',miss.join(', '));process.exit(1)}console.log('build hub OK')"
   ```
   Expect success.

4. Commit: `build: area hub linking spec, schema, error codes, ecosystem`.

---

## Task 6: Add the new routes to the a11y axe route list

**Files:**
- `.github/workflows/a11y-check.yml` (edit the axe route list)

> Editing `.github/workflows/*.yml` triggers a security hook, so do **not** use
> the Edit tool. Patch the file with the `python3` heredoc below and validate the
> result as YAML.

Steps:

1. Failing check first — confirm the new routes are not yet listed. Run:
   ```
   python3 - <<'PY'
   import sys
   text = open('.github/workflows/a11y-check.yml').read()
   missing = [r for r in ('localhost:4321/learn/', 'localhost:4321/use/', 'localhost:4321/build/') if r not in text]
   if not missing:
       print('EXPECTED new axe routes absent, but all present'); sys.exit(1)
   print('pre-edit: axe routes missing as expected ->', ', '.join(missing))
   PY
   ```
   Expect it to report the three routes are absent.

2. Implement the patch. Insert the three new routes into the axe invocation,
   immediately after the homepage route line, preserving the trailing
   backslash-newline continuation style. Run:
   ```
   python3 - <<'PY'
   path = '.github/workflows/a11y-check.yml'
   text = open(path).read()
   anchor = '          npx axe http://localhost:4321/ \\\n'
   assert anchor in text, 'axe homepage route anchor not found; inspect the workflow before patching'
   assert 'localhost:4321/learn/' not in text, 'learn route already present; aborting to avoid duplication'
   insertion = (
       '            http://localhost:4321/learn/ \\\n'
       '            http://localhost:4321/use/ \\\n'
       '            http://localhost:4321/build/ \\\n'
   )
   text = text.replace(anchor, anchor + insertion, 1)
   open(path, 'w').write(text)
   print('patched a11y-check.yml with /learn/, /use/, /build/')
   PY
   ```

3. Validate the file is still well-formed YAML and now contains all three routes.
   Run:
   ```
   python3 -c "import yaml; d=yaml.safe_load(open('.github/workflows/a11y-check.yml')); assert d['name']=='Accessibility Check'; print('YAML valid; workflow name:', d['name'])"
   python3 - <<'PY'
   import sys
   text = open('.github/workflows/a11y-check.yml').read()
   missing = [r for r in ('localhost:4321/learn/', 'localhost:4321/use/', 'localhost:4321/build/') if r not in text]
   if missing:
       print('MISSING axe routes after patch:', ', '.join(missing)); sys.exit(1)
   print('axe route list OK: /learn/, /use/, /build/ present')
   PY
   ```
   Expect both to succeed.

4. Commit: `ci(a11y): add /learn/, /use/, /build/ to axe route list`.

---

## Task 7: Full-site verification, CI note, and open a PR (do not merge)

**Files:**
- (none changed — verification and PR only)

Steps:

1. Run a clean full build and assert every top-level route resolves and the nav
   is consistent across the new hubs. This is the end-to-end gate. Run:
   ```
   cd site && rm -rf dist && npm run build
   node -e "const fs=require('fs');const routes=['index.html','learn/index.html','use/index.html','build/index.html','docs/index.html','docs/spec/index.html','docs/schema/index.html','docs/features/index.html','docs/rulesets/index.html','examples/index.html','errors/index.html','ecosystem/index.html','playground/index.html','playground/renderer/index.html'];const miss=routes.filter(r=>!fs.existsSync('dist/'+r));if(miss.length){console.error('MISSING built routes:',miss.join(', '));process.exit(1)}for(const r of ['index.html','learn/index.html','use/index.html','build/index.html']){const h=fs.readFileSync('dist/'+r,'utf8');for(const l of ['>Home<','>Learn<','>Use<','>Build<','>GitHub<']){if(!h.includes(l)){console.error('nav label',l,'missing on',r);process.exit(1)}}}console.log('full-site OK: all '+routes.length+' routes built, nav consistent on hubs')"
   ```
   Expect success.

2. CI note: the `.github/workflows/a11y-check.yml` workflow runs automatically on
   this PR because it touches `site/src/pages/**` and `site/src/components/**`.
   It will `npm run build`, start `astro preview`, and run `axe` against the route
   list — which now includes `/learn/`, `/use/`, `/build/`. No manual CI trigger
   is needed; confirm the checks go green on the PR before handoff.

3. Push the branch and open a PR **without merging** (the maintainer merges). Run:
   ```
   gh pr create --repo opencoachingformat/spec --base main \
     --title "Plan B: audience-first nav + non-technical homepage + area hubs" \
     --body "Plan B of the site redesign (see docs/superpowers/specs/2026-08-28-site-redesign-design.md and docs/superpowers/plans/2026-08-28-siteB-nav-homepage.md).

   - Top nav reworked to Home · Learn · Use · Build (+ GitHub), reusing the data-driven navItems array and the existing mobile drawer.
   - Homepage rewritten as a non-technical, no-diagram story scroll: the problem → what OCF is → multi-sport (before structure) → rough structure → where next.
   - New area hubs at /learn/, /use/, /build/ linking to the existing pages at their current URLs. No page moving/merging (that is Plan C/D).
   - a11y axe route list extended with /learn/, /use/, /build/.

   Do not merge — leaving for the maintainer to review and merge.

   🤖 Generated with [Claude Code](https://claude.com/claude-code)"
   ```
   Do **not** merge the PR. Report the PR URL and leave it open for the maintainer.
