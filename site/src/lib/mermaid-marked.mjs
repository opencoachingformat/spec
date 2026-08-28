// Pure, offline-testable helpers for the arc42 build:
//   - mermaidAwareMarked(markdown): Markdown -> HTML, but a ```mermaid fenced
//     block becomes <pre class="mermaid">SOURCE</pre> (raw diagram source,
//     NOT escaped, NOT wrapped in <code>) so mermaid@11 renders it in the
//     browser. All other Markdown uses marked's defaults.
//   - buildArc42Index(files): arc42 filenames -> sorted TOC entries.
// No network, no filesystem, no side effects.

import { marked, Marked } from 'marked';

// A fresh Marked instance carrying a custom `code` renderer, so the global
// `marked` singleton is never mutated (keeps other callers, e.g. tests,
// isolated). marked passes fenced-code tokens to `renderer.code`; when the
// info string is `mermaid` we emit a client-render <pre class="mermaid">
// with the raw source; otherwise we defer to marked's built-in escaping.
function makeMermaidMarked() {
  const instance = new Marked();
  instance.use({
    renderer: {
      code(codeOrToken, infoString) {
        // marked v5+ passes a token object; older signatures pass (code, lang).
        const token =
          typeof codeOrToken === 'object' && codeOrToken !== null
            ? codeOrToken
            : { text: codeOrToken, lang: infoString };
        const lang = (token.lang || '').trim().split(/\s+/)[0];
        if (lang === 'mermaid') {
          // Raw diagram source — mermaid parses it as-is. Do NOT HTML-escape.
          return `<pre class="mermaid">${token.text}</pre>\n`;
        }
        // Non-mermaid fence: fall back to marked's default escaped code block.
        return false;
      },
    },
  });
  return instance;
}

const mermaidMarked = makeMermaidMarked();

export function mermaidAwareMarked(markdown) {
  return mermaidMarked.parse(markdown ?? '');
}

// "06-runtime-view.md" -> "6. Runtime View"; "README.md" -> "Overview".
function titleFor(file) {
  if (/^readme\.md$/i.test(file)) return 'Overview';
  const base = file.replace(/\.md$/i, '');
  const m = base.match(/^(\d+)-(.+)$/);
  if (!m) {
    return base
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  const num = String(Number(m[1]));
  const words = m[2]
    .split('-')
    .map((w) =>
      ['and', 'of', 'the'].includes(w)
        ? w
        : w.charAt(0).toUpperCase() + w.slice(1)
    )
    .join(' ');
  return `${num}. ${words}`;
}

// Pure transform: arc42 filenames -> [{ file, slug, title }].
// README first, then ascending numeric prefix. Non-.md files are dropped.
export function buildArc42Index(files) {
  const entries = files
    .filter((file) => /\.md$/i.test(file))
    .map((file) => ({
      file,
      slug: file.replace(/\.md$/i, '').toLowerCase(),
      title: titleFor(file),
    }));
  entries.sort((a, b) => {
    const aReadme = a.slug === 'readme';
    const bReadme = b.slug === 'readme';
    if (aReadme && !bReadme) return -1;
    if (bReadme && !aReadme) return 1;
    const an = parseInt(a.slug, 10);
    const bn = parseInt(b.slug, 10);
    if (Number.isNaN(an) && Number.isNaN(bn)) return a.slug.localeCompare(b.slug);
    if (Number.isNaN(an)) return 1;
    if (Number.isNaN(bn)) return -1;
    return an - bn;
  });
  return entries;
}

// Re-export the default marked singleton for callers who want plain rendering.
export { marked };
