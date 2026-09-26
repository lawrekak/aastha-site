// SEO and AI-search checks on the built site. Exits 1 on any error so a bad build never deploys.
// Usage: node scripts/validate.mjs [dist]
import fs from "fs";
import path from "path";

const DIST = path.resolve(process.argv[2] || "dist");
const site = JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), "../content/site.json"), "utf8"));
const BASE = site.url.replace(/\/$/, "");
const errors = [], warnings = [];
const err = (f, m) => errors.push(`${f}: ${m}`), warn = (f, m) => warnings.push(`${f}: ${m}`);
const BANNED = /\b(best|top[- ]rated|no\.?\s?1|number one|expert|specialist|guaranteed?|100% success|success rate|won\b|winning)\b/i;

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(DIST);
const html = files.filter((f) => f.endsWith(".html"));
const urlOf = (f) => { const r = "/" + path.relative(DIST, f).replace(/\\/g, "/"); return r.endsWith("index.html") ? r.slice(0, -10) : r; };
const exists = (p) => { const clean = decodeURIComponent(p.split(/[?#]/)[0]); const f = path.join(DIST, clean); return fs.existsSync(f) && fs.statSync(f).isFile() || fs.existsSync(path.join(f, "index.html")); };

const titles = new Map(), descs = new Map(), canon = new Map();
for (const f of html) {
  const rel = urlOf(f), h = fs.readFileSync(f, "utf8");
  const is404 = rel.endsWith("404.html");
  const title = (h.match(/<title>([^<]*)<\/title>/) || [])[1];
  const desc = (h.match(/<meta name="description" content="([^"]*)"/) || [])[1];
  const can = (h.match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
  const h1s = (h.match(/<h1[\s>]/g) || []).length;
  if (!/<html lang="[a-z]{2}(-[A-Z]{2})?"/.test(h)) err(rel, "missing lang on <html>");
  if (!title) err(rel, "missing <title>"); else {
    const len = [...title].length;
    if (len > 65) warn(rel, `title is ${len} characters (aim for 60 or fewer)`);
    if (titles.has(title)) err(rel, `duplicate title with ${titles.get(title)}`); titles.set(title, rel);
  }
  if (!desc) err(rel, "missing meta description"); else {
    const len = [...desc].length;
    if (len < 50 || len > 165) warn(rel, `meta description is ${len} characters (aim for 70–160)`);
    if (!is404) { if (descs.has(desc)) err(rel, `duplicate description with ${descs.get(desc)}`); descs.set(desc, rel); }
  }
  if (h1s !== 1) err(rel, `has ${h1s} <h1> elements (need exactly 1)`);
  if (!is404) {
    if (!can) err(rel, "missing canonical"); else if (can !== BASE + rel) err(rel, `canonical ${can} does not match ${BASE + rel}`);
    if (can) canon.set(can, rel);
    if (!/property="og:image"/.test(h)) err(rel, "missing og:image");
  }
  // JSON-LD
  const blocks = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (!is404 && !blocks.length) err(rel, "no JSON-LD structured data");
  for (const b of blocks) {
    try {
      const g = JSON.parse(b[1]); const types = (g["@graph"] || [g]).flatMap((n) => [].concat(n["@type"]));
      for (const need of ["WebSite", "LegalService", "Person"]) if (!types.includes(need)) err(rel, `JSON-LD missing ${need}`);
      (g["@graph"] || []).filter((n) => [].concat(n["@type"]).includes("FAQPage")).forEach((n) => { if (!n.mainEntity?.length) err(rel, "FAQPage without questions"); });
    } catch (e) { err(rel, "JSON-LD does not parse: " + e.message); }
  }
  // hreflang reciprocity
  for (const m of h.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)) {
    const target = m[2].replace(BASE, "");
    if (!exists(target)) err(rel, `hreflang ${m[1]} points to missing page ${target}`);
    else if (m[1] !== "x-default") {
      const th = fs.readFileSync(path.join(DIST, target.endsWith("/") ? target + "index.html" : target), "utf8");
      if (!th.includes(`href="${BASE + rel}"`)) err(rel, `hreflang to ${target} is not returned by that page`);
    }
  }
  // links, images, wording
  for (const m of h.matchAll(/(?:href|src)="(\/[^"/][^"]*|\/)"/g)) if (!exists(m[1])) err(rel, `broken internal link ${m[1]}`);
  for (const m of h.matchAll(/<img\b[^>]*>/g)) if (!/\salt="/.test(m[0])) err(rel, "image without alt text");
  for (const m of h.matchAll(/<a [^>]*target="_blank"[^>]*>/g)) if (!/rel="[^"]*noopener/.test(m[0])) warn(rel, "external link without rel=noopener");
  const text = h.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/to the best of my knowledge/gi, "");
  const bad = text.match(BANNED); if (bad) err(rel, `Rule 36 wording check: "${bad[0]}" — rephrase factually`);
  const caseRef = text.match(/reported judgments?|counsel team|appeared for|case (study|studies)/i);
  if (caseRef) err(rel, `Rule 36 check: "${caseRef[0]}" — the site must not publicise her cases`);
  const solicit = text.match(/request a consultation|book (a|now|your|with)|free (consultation|first|meeting)|first meeting|no fee|affordable|get your case|why choose|hire us|consultation fee/i);
  if (solicit) err(rel, `Rule 36 check: "${solicit[0]}" — no consultation offers, fees or calls to action`);
  if (/href="\/(fees|consultation)\//.test(h)) err(rel, "links to a removed fees or consultation page");
}

// sitemap covers every indexable page and nothing else
const sm = fs.readFileSync(path.join(DIST, "sitemap.xml"), "utf8");
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
for (const c of canon.keys()) if (!locs.includes(c)) err("sitemap.xml", `missing ${c}`);
for (const l of locs) if (!canon.has(l)) err("sitemap.xml", `lists ${l} which has no page`);
// robots, llms, key
const robots = fs.readFileSync(path.join(DIST, "robots.txt"), "utf8");
if (!robots.includes(`Sitemap: ${BASE}/sitemap.xml`)) err("robots.txt", "missing Sitemap line");
if (/Disallow:\s*\/\s*$/m.test(robots)) err("robots.txt", "blocks the whole site");
for (const bot of ["GPTBot", "OAI-SearchBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]) if (!robots.includes(bot)) warn("robots.txt", `${bot} not listed`);
const llms = fs.readFileSync(path.join(DIST, "llms.txt"), "utf8");
if (!/^# .+\n\n> .+/m.test(llms)) err("llms.txt", "does not follow the llms.txt format (# title, > summary)");
if (!fs.existsSync(path.join(DIST, site.indexNowKey + ".txt"))) err("indexnow", "key file missing");

for (const [k, v] of [["email", site.email], ["enrolment", site.enrolment.barCouncil], ["qualifications", site.qualifications.length]]) if (!v) warn("site.json", `${k} not filled in yet`);

console.log(`Checked ${html.length} HTML files, ${locs.length} sitemap URLs.`);
warnings.forEach((w) => console.log("WARN  " + w));
errors.forEach((e) => console.log("ERROR " + e));
console.log(errors.length ? `\n${errors.length} error(s). Fix before deploying.` : "\nNo errors.");
process.exit(errors.length ? 1 : 0);
