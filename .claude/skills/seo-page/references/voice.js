// Collect only human-readable PROSE from a guide.
// Excludes label fields (name, heading, columns, rows) — they are fragments without
// terminal punctuation, so they glue onto the next sentence and corrupt the counts.
const TEXT = new Set(["standfirst", "caption", "note", "detail", "intro", "q", "a"]);
function collect(node, out, key) {
  if (typeof node === "string") { if (TEXT.has(key)) out.push(node.trim()); return; }
  if (Array.isArray(node)) { node.forEach(n => collect(n, out, key)); return; }
  if (node && typeof node === "object") {
    for (const k of Object.keys(node)) {
      if (k === "body" || k === "items") collect(node[k], out, "detail");
      else if (k === "rows" || k === "columns" || k === "heading" || k === "name") continue;
      else collect(node[k], out, k);
    }
  }
}
module.exports = function (g) {
  const out = [];
  if (g.standfirst) out.push(g.standfirst);
  collect(g.sections, out, null);
  collect(g.faq, out, null);
  if (g.heroImage && g.heroImage.caption) out.push(g.heroImage.caption);
  // Terminate every block so fragments cannot merge across boundaries.
  return out.map(s => (/[.!?]$/.test(s) ? s : s + ".")).join(" ");
};
