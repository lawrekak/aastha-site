// Pulls Google Search Console data for the site and writes gsc-report.md.
// Needs a service account that has been added as a user on the Search Console property:
//   env GSC_SERVICE_ACCOUNT_JSON = the full JSON key of the service account
//   env GSC_PROPERTY             = "sc-domain:advaasthavishwakarma.in" (default)
// Usage: node scripts/gsc-report.mjs [days=28]
// Without credentials it writes a short "not configured" note and exits 0, so workflows keep running.
import fs from "fs";
import crypto from "crypto";

const days = Number(process.argv[2] || 28);
const out = "gsc-report.md";
const property = process.env.GSC_PROPERTY || "sc-domain:advaasthavishwakarma.in";
const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;

if (!raw) {
  fs.writeFileSync(out, `# Search Console\n\nNot configured: add the GSC_SERVICE_ACCOUNT_JSON repository secret (see SETUP.md) to include clicks, impressions and queries.\n`);
  console.log("Search Console not configured; wrote placeholder.");
  process.exit(0);
}

const b64url = (b) => Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
export function signJwt(sa, now = Math.floor(Date.now() / 1000)) {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/webmasters.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sig = crypto.sign("RSA-SHA256", Buffer.from(`${header}.${claim}`), sa.private_key);
  return `${header}.${claim}.${b64url(sig)}`;
}

const sa = JSON.parse(raw);
const tokRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: signJwt(sa) })
});
if (!tokRes.ok) { fs.writeFileSync(out, `# Search Console\n\nCould not authenticate (HTTP ${tokRes.status}). Check the service account key and that it is added as a user on the property.\n`); process.exit(0); }
const { access_token } = await tokRes.json();

const ymd = (d) => d.toISOString().slice(0, 10);
const end = new Date(Date.now() - 2 * 864e5), start = new Date(end.getTime() - (days - 1) * 864e5);
async function query(dimensions, rowLimit = 25) {
  const r = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`, {
    method: "POST", headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ startDate: ymd(start), endDate: ymd(end), dimensions, rowLimit })
  });
  if (!r.ok) throw new Error(`Search Console API ${r.status}: ${await r.text()}`);
  return (await r.json()).rows || [];
}
const fmt = (n, d = 0) => Number(n || 0).toFixed(d);
const table = (rows, label) => rows.length
  ? `| ${label} | Clicks | Impressions | CTR | Avg. position |\n|---|---:|---:|---:|---:|\n` + rows.map((r) => `| ${String(r.keys[0]).replace(/\|/g, "/")} | ${r.clicks} | ${r.impressions} | ${fmt(r.ctr * 100, 1)}% | ${fmt(r.position, 1)} |`).join("\n")
  : "_No data yet — new sites usually take a few weeks to collect impressions._";

try {
  const [total] = await query([], 1);
  const queries = await query(["query"]);
  const pages = await query(["page"], 25);
  const t = total || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  fs.writeFileSync(out, `# Search Console — last ${days} days (${ymd(start)} to ${ymd(end)})\n\nProperty: ${property}\n\n**Totals:** ${t.clicks} clicks · ${t.impressions} impressions · ${fmt(t.ctr * 100, 1)}% CTR · average position ${fmt(t.position, 1)}\n\n## Top queries\n\n${table(queries, "Query")}\n\n## Top pages\n\n${table(pages, "Page")}\n`);
  console.log(`Wrote ${out}`);
} catch (e) {
  fs.writeFileSync(out, `# Search Console\n\nQuery failed: ${e.message}\n`);
  console.log(e.message);
}
