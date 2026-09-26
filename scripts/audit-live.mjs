// Audits the LIVE site: every sitemap URL, crawler files, and Google PageSpeed scores.
// Writes audit-report.md and exits 1 when something needs attention, so the scheduled
// GitHub workflow can open an issue.
// Usage: node scripts/audit-live.mjs [https://your-domain]
import fs from "fs";
import path from "path";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const site = JSON.parse(fs.readFileSync(path.join(root, "content/site.json"), "utf8"));
const BASE = (process.argv[2] || site.url).replace(/\/$/, "");
const problems = [], notes = [];
const get = async (u, opts) => { try { const r = await fetch(u, { redirect: "follow", ...opts }); return { status: r.status, text: await r.text(), url: r.url, headers: r.headers }; } catch (e) { return { status: 0, text: "", error: e.message }; } };

// Crawler files
const robots = await get(BASE + "/robots.txt");
if (robots.status !== 200) problems.push(`robots.txt returned ${robots.status}`);
else if (/^Disallow:\s*\/\s*$/m.test(robots.text)) problems.push("robots.txt blocks the whole site");
for (const f of ["/llms.txt", "/llms-full.txt", `/${site.indexNowKey}.txt`, "/site.webmanifest"]) {
  const r = await get(BASE + f); if (r.status !== 200) problems.push(`${f} returned ${r.status}`);
}
const smr = await get(BASE + "/sitemap.xml");
if (smr.status !== 200) { problems.push(`sitemap.xml returned ${smr.status}`); }
const urls = [...(smr.text || "").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
notes.push(`Sitemap lists ${urls.length} URLs.`);

// Every page
for (const u of urls) {
  const r = await get(u);
  if (r.status !== 200) { problems.push(`${u} returned ${r.status}`); continue; }
  if (r.url.replace(/\/$/, "") !== u.replace(/\/$/, "")) problems.push(`${u} redirects to ${r.url}`);
  const can = (r.text.match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
  if (can !== u) problems.push(`${u} canonical is ${can || "missing"}`);
  if (/<meta name="robots" content="noindex/.test(r.text)) problems.push(`${u} is marked noindex`);
  if (!/application\/ld\+json/.test(r.text)) problems.push(`${u} has no structured data`);
  const xr = r.headers?.get?.("x-robots-tag"); if (xr && /noindex/i.test(xr)) problems.push(`${u} sends X-Robots-Tag: ${xr}`);
}

// Google PageSpeed Insights (mobile). Works without a key at low volume; set PSI_KEY for reliability.
const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(BASE + "/")}&strategy=mobile&category=performance&category=seo&category=accessibility&category=best-practices${process.env.PSI_KEY ? "&key=" + process.env.PSI_KEY : ""}`;
const psi = await get(psiUrl);
if (psi.status === 200) {
  const j = JSON.parse(psi.text), c = j.lighthouseResult?.categories || {};
  const scores = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Math.round((v.score || 0) * 100)]));
  notes.push(`PageSpeed (mobile, home page): ${Object.entries(scores).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  for (const [k, v] of Object.entries(scores)) if (v < (k === "performance" ? 85 : 95)) problems.push(`PageSpeed ${k} score is ${v}`);
  const lcp = j.lighthouseResult?.audits?.["largest-contentful-paint"]?.displayValue; if (lcp) notes.push(`Largest contentful paint: ${lcp}`);
} else notes.push(`PageSpeed Insights unavailable (HTTP ${psi.status}).`);

const report = `# Live site audit — ${new Date().toISOString().slice(0, 10)}\n\nSite: ${BASE}\n\n## Needs attention\n${problems.length ? problems.map((p) => "- " + p).join("\n") : "- Nothing. All checks passed."}\n\n## Notes\n${notes.map((n) => "- " + n).join("\n")}\n`;
fs.writeFileSync(path.join(root, "audit-report.md"), report);
console.log(report);
process.exit(problems.length ? 1 : 0);
