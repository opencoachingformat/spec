// Build-time diagram rendering. One façade, dispatch by type.
// PlantUML -> Kroki (public kroki.io renders PlantUML fine).
// Mermaid  -> added in Plan D (local mmdc; kroki.io 500s on Mermaid).
export const KROKI_BASE = "https://kroki.io";

async function renderPlantumlViaKroki(source, fetchImpl) {
  const doFetch = fetchImpl ?? fetch;
  const res = await doFetch(`${KROKI_BASE}/plantuml/svg`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: source,
  });
  if (!res.ok) {
    throw new Error(`Kroki PlantUML render failed: ${res.status}`);
  }
  return await res.text();
}

export async function renderDiagram(type, source, opts = {}) {
  if (type === "plantuml") return renderPlantumlViaKroki(source, opts.fetchImpl);
  throw new Error(`Unsupported diagram type: ${type}`);
}
