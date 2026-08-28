import { test } from "node:test";
import assert from "node:assert/strict";
import { replacePlantumlBlocks } from "../scripts/build-adoc.mjs";

test("replaces a literalblock whose pre starts with @startuml", async () => {
  const html =
    `<h3>x</h3>\n<div class="literalblock">\n<div class="content">\n` +
    `<pre>@startuml\nA -> B\n@enduml</pre>\n</div>\n</div>\n<p>after</p>`;
  const fakeRender = async (type, src) => {
    assert.equal(type, "plantuml");
    assert.match(src, /@startuml/);
    return "<svg>DIAGRAM</svg>";
  };
  const out = await replacePlantumlBlocks(html, fakeRender);
  assert.match(out, /<svg>DIAGRAM<\/svg>/);
  assert.doesNotMatch(out, /@startuml/);
  assert.match(out, /<p>after<\/p>/); // surrounding content preserved
  assert.match(out, /diagram-svg/); // wrapped for styling
});

test("leaves non-diagram literalblocks untouched", async () => {
  const html = `<div class="literalblock"><div class="content"><pre>just text</pre></div></div>`;
  const out = await replacePlantumlBlocks(html, async () => "<svg>NO</svg>");
  assert.equal(out, html);
});
