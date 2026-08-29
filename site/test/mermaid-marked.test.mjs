import { test } from "node:test";
import assert from "node:assert/strict";
import { mermaidAwareMarked, buildArc42Index } from "../src/lib/mermaid-marked.mjs";

test("mermaidAwareMarked: a ```mermaid fence becomes <pre class=\"mermaid\">", () => {
  const md = "# Title\n\n```mermaid\ngraph TD\n  A --> B\n```\n";
  const html = mermaidAwareMarked(md);
  assert.match(html, /<pre class="mermaid">/);
  // The diagram source is preserved verbatim inside the pre (NOT wrapped in
  // <code>, NOT given a language-* class).
  assert.match(html, /graph TD/);
  assert.match(html, /A --> B/);
  assert.doesNotMatch(html, /language-mermaid/);
  // The <pre class="mermaid"> block holds no nested <code> element.
  const block = html.slice(html.indexOf('<pre class="mermaid">'));
  assert.doesNotMatch(block.slice(0, block.indexOf('</pre>')), /<code/);
});

test("mermaidAwareMarked: mermaid arrow chars are NOT HTML-escaped inside the pre", () => {
  // mermaid parses raw source; --> must stay literal, not &gt;/&amp;.
  const md = "```mermaid\nA --> B\nC -->|x & y| D\n```\n";
  const html = mermaidAwareMarked(md);
  assert.match(html, /A --> B/);
  assert.match(html, /-->\|x & y\| D/);
  assert.doesNotMatch(html, /&gt;/);
  assert.doesNotMatch(html, /&amp;/);
});

test("mermaidAwareMarked: renders ordinary markdown normally", () => {
  const html = mermaidAwareMarked("# Heading\n\nSome **bold** text.\n");
  assert.match(html, /<h1[ >]/);
  assert.match(html, /<strong>bold<\/strong>/);
});

test("mermaidAwareMarked: a non-mermaid code fence stays a normal <code> block, escaped", () => {
  const md = "```json\n{ \"a\": 1 < 2 }\n```\n";
  const html = mermaidAwareMarked(md);
  assert.match(html, /<code[^>]*>/);
  assert.doesNotMatch(html, /<pre class="mermaid">/);
  // Ordinary code fences keep marked's default HTML escaping.
  assert.match(html, /1 &lt; 2/);
});

test("mermaidAwareMarked: handles multiple mermaid blocks in one document", () => {
  const md = "```mermaid\ngraph LR\nA-->B\n```\n\ntext\n\n```mermaid\nsequenceDiagram\nA->>B: hi\n```\n";
  const html = mermaidAwareMarked(md);
  const count = (html.match(/<pre class="mermaid">/g) || []).length;
  assert.equal(count, 2);
  assert.match(html, /sequenceDiagram/);
});

test("buildArc42Index: derives slug + title, README first, then numeric order", () => {
  const files = [
    "12-glossary.md",
    "README.md",
    "01-introduction-and-goals.md",
    "06-runtime-view.md",
  ];
  const idx = buildArc42Index(files);
  assert.deepEqual(idx.map((e) => e.slug), [
    "readme",
    "01-introduction-and-goals",
    "06-runtime-view",
    "12-glossary",
  ]);
  const readme = idx.find((e) => e.slug === "readme");
  assert.equal(readme.title, "Overview");
  const intro = idx.find((e) => e.slug === "01-introduction-and-goals");
  assert.equal(intro.title, "1. Introduction and Goals");
  const runtime = idx.find((e) => e.slug === "06-runtime-view");
  assert.equal(runtime.title, "6. Runtime View");
  assert.equal(runtime.file, "06-runtime-view.md");
});

test("buildArc42Index: ignores non-markdown files", () => {
  const idx = buildArc42Index(["README.md", "images", "notes.txt"]);
  assert.deepEqual(idx.map((e) => e.slug), ["readme"]);
});
