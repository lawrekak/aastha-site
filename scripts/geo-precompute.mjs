// Free (no Claude) GEO data collection for the SEO agent.
// Runs the vendored geo-seo-claude scripts against the live site and writes:
//   .wip/geo-data/<slug>.citability.json and <slug>.page.json   (raw output)
//   .wip/geo-data/summary.md                                     (compact table Claude reads)
// The agent reads summary.md instead of fetching and scoring pages itself, which saves many turns.
// Usage: node scripts/geo-precompute.mjs [site=https://advaasthavishwakarma.in] [maxPages=18]
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const site = (process.argv[2] || "https://advaasthavishwakarma.in").replace(/\/$/, "");
const maxPages = Number(process.argv[3] || 18);
const out = ".wip/geo-data";
const S = ".claude/skills/geo/scripts";
fs.mkdirSync(out, { recursive: true });

const py = (script, ...args) => {
  try { return JSON.parse(execFileSync("python3", ["-I", path.join(S, script), ...args], { encoding: "utf8", timeout: 90000, maxBuffer: 32 << 20 })); }
  catch (e) { return { error: String(e.message).slice(0, 300) }; }
};

// Pick pages: home, about, faq, contact, guides, every practice area, the 4 newest blog posts.
let urls = [];
try {
  const xml = await (await fetch(`${site}/sitemap.xml`)).text();
  // Keep each URL's lastmod so the newest blog posts can be picked.
  urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g)]
    .map((m) => ({ u: site + new URL(m[1]).pathname, d: m[2] || "" }))
    .filter((x) => !x.u.includes("/hi/"))
    .sort((a, b) => b.d.localeCompare(a.d))
    .map((x) => x.u);
} catch (e) { console.log("sitemap fetch failed:", e.message); }
const pick = (re) => urls.filter((u) => re.test(new URL(u).pathname));
const blog = pick(/^\/blog\/[^/]+\/$/).filter((u) => !/\/page\//.test(u)).slice(0, 4);
const chosen = [...new Set([site + "/", ...pick(/^\/(about|faq|contact|guides)\/$/), ...pick(/^\/practice-areas\/[^/]+\/$/), ...blog])].slice(0, maxPages);

const rows = [];
for (const u of chosen) {
  const slug = new URL(u).pathname.replace(/^\/|\/$/g, "").replace(/\//g, "_") || "home";
  const cit = py("citability_scorer.py", u);
  const pg = py("fetch_page.py", u, "page");
  fs.writeFileSync(path.join(out, `${slug}.citability.json`), JSON.stringify(cit, null, 1));
  fs.writeFileSync(path.join(out, `${slug}.page.json`), JSON.stringify({ ...pg, text_content: undefined }, null, 1));
  const types = (pg.structured_data || []).flatMap((s) => (s && s["@graph"]) || [s]).map((x) => [].concat(x?.["@type"] || []).join("/")).filter(Boolean);
  rows.push(`| ${new URL(u).pathname} | ${cit.average_citability_score ?? "–"} | ${cit.total_blocks_analyzed ?? "–"} | ${pg.word_count ?? "–"} | ${(pg.title || "").length} | ${(pg.description || "").length} | ${(pg.h1_tags || []).length} | ${(pg.images || []).filter((i) => !i.alt).length} | ${[...new Set(types)].join(", ")} |`);
  console.log("done", u);
}
const llms = py("llmstxt_generator.py", site);
let robots = "";
try { robots = await (await fetch(`${site}/robots.txt`)).text(); } catch {}

fs.writeFileSync(path.join(out, "summary.md"), `# GEO data for ${site} (collected ${new Date().toISOString().slice(0, 10)}, no Claude used)

| Page | Citability avg | Blocks | Words | Title len | Desc len | H1s | Imgs w/o alt | Schema types |
|---|---:|---:|---:|---:|---:|---:|---:|---|
${rows.join("\n")}

## llms.txt
exists=${llms.exists} valid=${llms.format_valid} sections=${llms.section_count} links=${llms.link_count}

## robots.txt (AI crawler lines)
${robots.split("\n").filter((l) => /user-agent|allow|disallow|sitemap/i.test(l)).join("\n")}

Raw per-page JSON is in this folder (\`*.citability.json\` has top passages and scores; \`*.page.json\` has headings, meta, links, structured data, headers).
`);
console.log(`Wrote ${out}/summary.md for ${rows.length} pages`);
