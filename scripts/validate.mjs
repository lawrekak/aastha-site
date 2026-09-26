// SEO and AI-search checks on the built site. Exits 1 on any error so a bad build never deploys.
// Usage: node scripts/validate.mjs [dist]
import fs from "fs";
import path from "path";

const DIST = path.resolve(process.argv[2] || "dist");
const site = JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), "../content/site.json"), "utf8"));
const BASE = site.url.replace(/\/$/, "");
const errors = [], warnings = [];
const err = (f, m) => errors.push(`${f}: ${m}`), warn = (f, m) => warnings.push(`${f}: ${m}`);
const BANNED = /\b(best|top[- ]rated|no\.?\s?1|number one|expert|specialist|guaranteed?|100% success|success rate|won(?![’'])|winning)\b/i;

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
  const solicit = text.match(/request a consultation|book (a|now|your|with)|free (consultation|first|meeting)|first meeting|no fee|affordable|get your case|why choose|hire us|consultation fee|contact us today|call us now|trusted (advocate|lawyer)/i);
  if (solicit) err(rel, `Rule 36 check: "${solicit[0]}" — no consultation offers, fees or calls to action`);
  if (/href="\/(fees|consultation)\//.test(h)) err(rel, "links to a removed fees or consultation page");
}


// Guides written by the weekly agent must have the expected shape
const ins = JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), "../content/insights.json"), "utf8"));
const slugs = new Set();
ins.forEach((a, n) => {
  const w = `content/insights.json[${n}]`;
  for (const k of ["t", "d", "p", "slug", "areas", "published", "desc"]) if (a[k] === undefined || a[k] === "") err(w, `missing "${k}"`);
  if (a.slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.slug)) err(w, "slug must be lowercase-hyphenated");
  if (slugs.has(a.slug)) err(w, `duplicate slug ${a.slug}`); slugs.add(a.slug);
  if (!Array.isArray(a.p) || a.p.length < 2) err(w, "needs at least 2 paragraphs");
  if (a.published && !/^\d{4}-\d{2}-\d{2}$/.test(a.published)) err(w, "published must be YYYY-MM-DD");
  if (a.hi && (!a.hi.t || !Array.isArray(a.hi.p) || !a.hi.p.length)) err(w, "hi needs t and p");
  if (Array.isArray(a.areas) && a.areas.some((x) => !Number.isInteger(x) || x < 0 || x > 7)) err(w, "areas must be practice-area index numbers 0–7");
});
// Blog posts (content/blog/*.json), written daily by the blog agent: shape, length and wording
const BLOG = path.join(path.dirname(new URL(import.meta.url).pathname), "../content/blog");
const areasN = JSON.parse(fs.readFileSync(path.join(BLOG, "../areas.json"), "utf8")).length;
const bslugs = new Set();
const wc = (t) => String(t).split(/\s+/).filter(Boolean).length;
for (const f of (fs.existsSync(BLOG) ? fs.readdirSync(BLOG) : []).filter((x) => x.endsWith(".json"))) {
  const w = `content/blog/${f}`; let a;
  try { a = JSON.parse(fs.readFileSync(path.join(BLOG, f), "utf8")); } catch (e) { err(w, "is not valid JSON: " + e.message); continue; }
  for (const k of ["title", "slug", "published", "area", "desc", "why", "keyPoints", "sections", "sources"]) if (a[k] === undefined || a[k] === "") err(w, `missing "${k}"`);
  if (a.slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.slug)) err(w, "slug must be lowercase-hyphenated");
  if (a.published && !/^\d{4}-\d{2}-\d{2}$/.test(a.published)) err(w, "published must be YYYY-MM-DD");
  if (a.published && !f.startsWith(a.published + "-")) err(w, "file name must start with the published date");
  if (bslugs.has(a.slug)) err(w, `duplicate slug ${a.slug}`); bslugs.add(a.slug);
  if (!Number.isInteger(a.area) || a.area < 0 || a.area >= areasN) err(w, `area must be a practice-area index 0–${areasN - 1}`);
  if (a.title && [...a.title].length > 70) err(w, "title longer than 70 characters");
  if (a.desc && ([...a.desc].length < 70 || [...a.desc].length > 160)) err(w, "desc must be 70–160 characters");
  if (!Array.isArray(a.keyPoints) || a.keyPoints.length < 3 || a.keyPoints.length > 4) err(w, "needs 3–4 key points");
  else a.keyPoints.forEach((k, i) => { if (wc(k) > 30) err(w, `key point ${i + 1} is over 30 words`); });
  if (!Array.isArray(a.sections) || !a.sections.length || a.sections.some((x) => !x.h || !Array.isArray(x.p) || !x.p.length)) err(w, "sections must be [{h, p: [...]}]");
  else {
    const total = wc([a.why, ...a.keyPoints, ...a.sections.flatMap((x) => [x.h, ...x.p]), ...(a.whatToDo || [])].join(" "));
    if (total < 200 || total > 600) err(w, `${total} words: keep posts between 200 and 600 words`);
    a.sections.flatMap((x) => x.p).forEach((para) => { if (wc(para) > 90) warn(w, "a paragraph is over 90 words; split it"); });
  }
  if (!Array.isArray(a.sources) || !a.sources.length || a.sources.some((x) => !x.title || !/^https:\/\//.test(x.url || ""))) err(w, "needs at least one source with title and https url");
  if (a.hi && (!a.hi.title || !Array.isArray(a.hi.keyPoints) || !a.hi.keyPoints.length)) err(w, "hi needs title and keyPoints");
  const txt = JSON.stringify(a);
  if (/\+91|880202|aastha\.vishi|tel:|mailto:|whatsapp/i.test(txt)) err(w, "posts must not carry contact details or a call to action");
}

// Target keywords: 50, unique, Rule 36-safe, each mapped to a real page
const KWF = path.join(path.dirname(new URL(import.meta.url).pathname), "../content/keywords.json");
if (fs.existsSync(KWF)) {
  const kws = JSON.parse(fs.readFileSync(KWF, "utf8")).keywords;
  if (kws.length !== 50) warn("content/keywords.json", `${kws.length} keywords (target 50)`);
  const seen = new Set();
  for (const x of kws) {
    if (seen.has(x.k)) err("content/keywords.json", `duplicate keyword "${x.k}"`); seen.add(x.k);
    if (/\b(best|top|fees?|free|cheap|affordable|expert|specialist|no\.?\s?1)\b/i.test(x.k)) err("content/keywords.json", `"${x.k}" breaks the Rule 36 wording rules`);
    if (!exists(x.page)) err("content/keywords.json", `"${x.k}" points to missing page ${x.page}`);
    if (!["local", "info"].includes(x.intent)) err("content/keywords.json", `"${x.k}" needs intent local or info`);
  }
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
