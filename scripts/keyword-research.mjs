// Weekly keyword research. For every seed in content/keywords.json it collects Google India
// autocomplete suggestions (English and Hindi), adds Search Console queries if gsc-queries.json
// exists, removes anything that breaks Rule 36 or is off-target, scores what is left and writes
// keyword-candidates.json and keyword-report.md. It changes nothing on the site; the weekly agent
// (skill: keyword-refresh) decides what to swap and opens a pull request.
// Usage: node scripts/keyword-research.mjs [--fixture file.json]
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const KWF = path.join(ROOT, "content/keywords.json");
const doc = JSON.parse(fs.readFileSync(KWF, "utf8"));
const current = new Map(doc.keywords.map((x) => [x.k.toLowerCase(), x]));
const fixtureArg = process.argv.indexOf("--fixture");
const fixture = fixtureArg > 0 ? JSON.parse(fs.readFileSync(process.argv[fixtureArg + 1], "utf8")) : null;

const RULE36 = /\b(best|top|top-rated|fees?|free|cheap|affordable|expert|specialist|no\.?\s?1|number one|reviews?|rating|consultation|hire)\b|बेस्ट|फीस|सस्ता|टॉप/i;
const OFF = /\b(mumbai|delhi ncr|gurgaon|gurugram|noida|faridabad|ghaziabad|bangalore|bengaluru|hyderabad|chennai|kolkata|pune|ahmedabad|indore|jaipur|lucknow|allahabad|prayagraj|chandigarh|bhopal|patna|lahore|karachi|islamabad|uk|usa|us|canada|australia|south africa|saflii|salary|kaise bane|job|vacancy|recruitment|exam|taxi|distance|hotel|pin code|judge name|mbbs|bond|selection|pdf|near me within|open now|contact number|phone number|mobile number)\b|दिल्ली|जयपुर|इंदौर|फरीदाबाद|योजना/i;
const PERSON = /\badvocate\s+[a-z]+\s+[a-z]+\s+(haldwani|nainital)\b|\b(adv\.?|advocate)\s+[a-z]+\s+(haldwani|nainital)\b/i;
const RELEVANT = /haldwani|nainital|uttarakhand|kumaon|kathgodam|lalkuan|high court|family court|district court|lawyer|advocate|vakil|वकील|अधिवक्ता|case|petition|appeal|act|procedure|process|time limit|status|kya|hindi|divorce|talaq|तलाक|maintenance|भरण|custody|cheque|138|bail|writ|226|quash|corruption|property|land|dakhil|khatauni|nazul|nclat|ibc|insolvency|tribunal|\bcat\b|service|pension|arrears/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function suggest(q, hl) {
  if (fixture) return fixture[q] || [];
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=${hl}&gl=in&q=${encodeURIComponent(q)}`;
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (keyword research for advaasthavishwakarma.in)" }, signal: AbortSignal.timeout(15000) });
      if (r.ok) { const j = JSON.parse(new TextDecoder("utf-8").decode(await r.arrayBuffer())); return (j[1] || []).map(String); }
    } catch {}
    await sleep(1500);
  }
  return [];
}

const cand = new Map(); // keyword -> {k, pages:Set, hits, sources:Set, gsc}
const add = (k, page, source, n = 1) => {
  k = k.toLowerCase().replace(/\s+/g, " ").trim();
  if (!k || k.length > 70) return;
  const c = cand.get(k) || { k, pages: new Set(), hits: 0, sources: new Set(), impressions: 0, clicks: 0, position: null };
  c.pages.add(page); c.hits += n; c.sources.add(source); cand.set(k, c);
};

let calls = 0, empty = 0;
for (const [page, seeds] of Object.entries(doc.seeds || {})) {
  for (const seed of seeds) {
    for (const hl of /[ऀ-ॿ]/.test(seed) ? ["hi"] : ["en", "hi"]) {
      const list = await suggest(seed, hl); calls++; if (!list.length) empty++;
      list.forEach((s, i) => add(s, page, "autocomplete", Math.max(1, 3 - Math.floor(i / 3))));
      if (!fixture) await sleep(400);
    }
  }
}

// Search Console: real queries the site already appears for
const gscFile = path.join(ROOT, "gsc-queries.json");
let gscRows = [];
if (fs.existsSync(gscFile)) {
  gscRows = JSON.parse(fs.readFileSync(gscFile, "utf8"));
  const base = JSON.parse(fs.readFileSync(path.join(ROOT, "content/site.json"), "utf8")).url.replace(/\/$/, "");
  for (const r of gscRows) {
    const page = r.page.replace(base, "") || "/";
    add(r.query, page, "search-console", 2);
    const c = cand.get(r.query.toLowerCase().trim());
    if (c) { c.impressions += r.impressions; c.clicks += r.clicks; c.position = r.position; }
  }
}

const rows = [...cand.values()].map((c) => {
  const reasons = [];
  if (RULE36.test(c.k)) reasons.push("Rule 36 wording");
  if (OFF.test(c.k)) reasons.push("off-target place or intent");
  if (PERSON.test(c.k)) reasons.push("names another advocate");
  if (!RELEVANT.test(c.k)) reasons.push("not about her practice");
  const intent = /procedure|process|time limit|status|kya|kaise|hindi|meaning|format|limitation|what is|how to|कैसे|क्या/i.test(c.k) ? "info" : "local";
  const score = c.hits + (c.impressions ? Math.log10(1 + c.impressions) * 5 : 0) + (/haldwani|nainital|uttarakhand|kumaon|हल्द्वानी|नैनीताल|उत्तराखंड/i.test(c.k) ? 3 : 0);
  return { k: c.k, pages: [...c.pages], sources: [...c.sources], hits: c.hits, impressions: c.impressions, clicks: c.clicks, position: c.position, intent, score: Math.round(score * 10) / 10, excluded: reasons, current: current.has(c.k) };
}).sort((a, b) => b.score - a.score);

const ok = rows.filter((r) => !r.excluded.length);
const seenNow = new Set(rows.map((r) => r.k));
const stale = doc.keywords.filter((x) => !seenNow.has(x.k.toLowerCase()));
const newIdeas = ok.filter((r) => !r.current).slice(0, 60);

fs.writeFileSync(path.join(ROOT, "keyword-candidates.json"), JSON.stringify({ generated: new Date().toISOString(), calls, emptyResponses: empty, gscRows: gscRows.length, candidates: ok, excluded: rows.filter((r) => r.excluded.length).slice(0, 80), stale: stale.map((x) => x.k) }, null, 1));

const md = `## Keyword research — ${new Date().toISOString().slice(0, 10)}

- Autocomplete calls: ${calls} (${empty} returned nothing)${calls && empty / calls > 0.8 ? " — **most calls failed; treat this week's data as unreliable**" : ""}
- Search Console rows: ${gscRows.length || "not connected"}
- Usable candidates: ${ok.length}; excluded: ${rows.length - ok.length}

### Current keywords not seen this week (${stale.length})
${stale.map((x) => `- ${x.k} (${x.page})`).join("\n") || "- none"}

### Top new candidates
| Keyword | Page | Intent | Score | Source |
|---|---|---|---:|---|
${newIdeas.slice(0, 30).map((r) => `| ${r.k} | ${r.pages[0]} | ${r.intent} | ${r.score} | ${r.sources.join(", ")}${r.impressions ? ` (${r.impressions} impr.)` : ""} |`).join("\n") || "| none | | | | |"}
`;
fs.writeFileSync(path.join(ROOT, "keyword-report.md"), md);
console.log(md);
