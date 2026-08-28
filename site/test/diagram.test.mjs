import { test } from "node:test";
import assert from "node:assert/strict";
import { renderDiagram } from "../src/lib/diagram.mjs";

test("plantuml: posts source to Kroki and returns the SVG body", async () => {
  const calls = [];
  const fakeFetch = async (url, opts) => {
    calls.push({ url, body: opts.body, method: opts.method });
    return { ok: true, status: 200, text: async () => "<svg>ok</svg>" };
  };
  const svg = await renderDiagram("plantuml", "@startuml\nA -> B\n@enduml", { fetchImpl: fakeFetch });
  assert.equal(svg, "<svg>ok</svg>");
  assert.match(calls[0].url, /\/plantuml\/svg$/);
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].body, "@startuml\nA -> B\n@enduml");
});

test("plantuml: a non-OK Kroki response throws (build-fails-loud)", async () => {
  const fakeFetch = async () => ({ ok: false, status: 500, text: async () => "boom" });
  await assert.rejects(
    () => renderDiagram("plantuml", "@startuml\n@enduml", { fetchImpl: fakeFetch }),
    /kroki.*500/i,
  );
});

test("unknown diagram type throws", async () => {
  await assert.rejects(() => renderDiagram("nope", "x"), /unsupported diagram type/i);
});
