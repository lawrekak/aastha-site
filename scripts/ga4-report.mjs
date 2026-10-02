// Daily Google Analytics 4 report for the website. Writes ga4-report.md.
// Needs:
//   content/site.json  ga4PropertyId  = numeric GA4 property ID (Admin → Property details)
//   env GA4_SERVICE_ACCOUNT_JSON (or GSC_SERVICE_ACCOUNT_JSON) = JSON key of a Google Cloud service
//       account that has the "Google Analytics Data API" enabled in its project and has been added
//       as a Viewer on the GA4 property (Admin → Property access management).
// Without either, it writes a "not configured" note and sets configured=no, so the workflow
// skips posting. No Claude or other paid API is used.
import fs from "fs";
import crypto from "crypto";

const out = "ga4-report.md";
const site = JSON.parse(fs.readFileSync(new URL("../content/site.json", import.meta.url), "utf8"));
const propertyId = process.env.GA4_PROPERTY_ID || site.ga4PropertyId;
const raw = process.env.GA4_SERVICE_ACCOUNT_JSON || process.env.GSC_SERVICE_ACCOUNT_JSON;
const setOutput = (k, v) => process.env.GITHUB_OUTPUT && fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`);

if (!propertyId || !raw) {
  const missing = [!propertyId && "ga4PropertyId in content/site.json", !raw && "the GA4_SERVICE_ACCOUNT_JSON secret"].filter(Boolean).join(" and ");
  fs.writeFileSync(out, `# Google Analytics\n\nNot configured: add ${missing} (see SETUP.md, step 14).\n`);
  console.log(`GA4 report not configured (${missing}).`);
  setOutput("configured", "no");
  process.exit(0);
}
setOutput("configured", "yes");

const b64url = (b) => Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
function signJwt(sa, now = Math.floor(Date.now() / 1000)) {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/analytics.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  return `${header}.${claim}.${b64url(crypto.sign("RSA-SHA256", Buffer.from(`${header}.${claim}`), sa.private_key))}`;
}

const fail = (msg) => { fs.writeFileSync(out, `# Google Analytics\n\n⚠️ ${msg}\n`); console.log(msg); process.exit(0); };

let sa;
try { sa = JSON.parse(raw); } catch { fail("The service account secret is not valid JSON."); }
const tok = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: signJwt(sa) })
});
if (!tok.ok) fail(`Could not sign in to Google (HTTP ${tok.status}). Check the service account key.`);
const { access_token } = await tok.json();

async function run(body) {
  const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: "POST", headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  if (!r.ok) {
    const t = await r.text();
    if (r.status === 403) fail(`Google Analytics refused access (403). Add ${sa.client_email} as a Viewer on GA4 property ${propertyId}, and enable the Google Analytics Data API in its Cloud project.\n\n${t.slice(0, 400)}`);
    throw new Error(`GA4 Data API ${r.status}: ${t.slice(0, 400)}`);
  }
  return r.json();
}

const M = ["activeUsers", "newUsers", "sessions", "engagedSessions", "screenPageViews", "userEngagementDuration"];
const R = {
  y: { startDate: "yesterday", endDate: "yesterday" },
  d2: { startDate: "2daysAgo", endDate: "2daysAgo" },
  w1: { startDate: "8daysAgo", endDate: "8daysAgo" },
  l7: { startDate: "7daysAgo", endDate: "yesterday" },
  p7: { startDate: "14daysAgo", endDate: "8daysAgo" },
  l28: { startDate: "28daysAgo", endDate: "yesterday" }
};
async function totals(range) {
  const j = await run({ dateRanges: [range], metrics: M.map((name) => ({ name })) });
  const v = j.rows?.[0]?.metricValues?.map((x) => Number(x.value)) || M.map(() => 0);
  return Object.fromEntries(M.map((m, i) => [m, v[i]]));
}
async function top(range, dims, metric, limit = 10, filter) {
  const j = await run({ dateRanges: [range], dimensions: dims.map((name) => ({ name })), metrics: [{ name: metric }], orderBys: [{ metric: { metricName: metric }, desc: true }], limit, ...(filter ? { dimensionFilter: filter } : {}) });
  return (j.rows || []).map((r) => [...r.dimensionValues.map((d) => d.value), Number(r.metricValues[0].value)]);
}

const [y, d2, w1, l7, p7, l28] = await Promise.all([R.y, R.d2, R.w1, R.l7, R.p7, R.l28].map(totals));
const contactFilter = { filter: { fieldName: "eventName", stringFilter: { matchType: "BEGINS_WITH", value: "contact_" } } };
const [pagesY, pages7, channels7, sources7, cities7, devices7, contacts7, contactsY, landing7, blog28] = await Promise.all([
  top(R.y, ["pagePath"], "screenPageViews", 10),
  top(R.l7, ["pagePath"], "screenPageViews", 15),
  top(R.l7, ["sessionDefaultChannelGroup"], "sessions", 10),
  top(R.l7, ["sessionSource", "sessionMedium"], "sessions", 10),
  top(R.l7, ["city"], "activeUsers", 10),
  top(R.l7, ["deviceCategory"], "activeUsers", 5),
  top(R.l7, ["eventName"], "eventCount", 10, contactFilter),
  top(R.y, ["eventName"], "eventCount", 10, contactFilter),
  top(R.l7, ["landingPage"], "sessions", 10),
  top(R.l28, ["pagePath"], "screenPageViews", 10, { filter: { fieldName: "pagePath", stringFilter: { matchType: "BEGINS_WITH", value: "/blog/" } } })
]);

const n = (x) => Math.round(x).toLocaleString("en-IN");
const pct = (a, b) => (b ? `${a >= b ? "▲" : "▼"} ${Math.abs(Math.round(((a - b) / b) * 100))}%` : a ? "new" : "–");
const secs = (t) => { const s = Math.round(t); return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`; };
const avgEng = (t) => (t.activeUsers ? secs(t.userEngagementDuration / t.activeUsers) : "–");
const rate = (t) => (t.sessions ? `${Math.round((t.engagedSessions / t.sessions) * 100)}%` : "–");
const sum = (rows) => rows.reduce((a, r) => a + r[r.length - 1], 0);
const label = { contact_phone: "Phone number selected", contact_email: "Email address selected", contact_map: "Map link selected", contact_whatsapp: "WhatsApp selected" };
const tbl = (head, rows, fmtRow) => rows.length ? `| ${head.join(" | ")} |\n|${head.map((_, i) => (i ? "---:" : "---")).join("|")}|\n${rows.map((r) => `| ${fmtRow(r).join(" | ")} |`).join("\n")}` : "_No data._";
const esc = (s) => String(s).replace(/\|/g, "/");

const ist = new Date(Date.now() + 5.5 * 3600e3);
ist.setUTCDate(ist.getUTCDate() - 1);
const day = ist.toISOString().slice(0, 10);
const weekday = ist.toLocaleDateString("en-IN", { weekday: "long", timeZone: "UTC" });

const highlights = [];
if (!l28.activeUsers) highlights.push("No visits recorded in the last 28 days. If the tag was added recently, data starts the day after the first visit.");
else {
  highlights.push(`${n(y.activeUsers)} visitor${y.activeUsers === 1 ? "" : "s"} yesterday (${pct(y.activeUsers, w1.activeUsers)} on the same day last week); ${n(l7.activeUsers)} in the last 7 days (${pct(l7.activeUsers, p7.activeUsers)} on the previous 7).`);
  if (sum(contactsY)) highlights.push(`Contact details selected ${n(sum(contactsY))} time${sum(contactsY) === 1 ? "" : "s"} yesterday.`);
  const org = channels7.find((r) => r[0] === "Organic Search");
  if (org && l7.sessions) highlights.push(`Google and other search engines brought ${Math.round((org[1] / l7.sessions) * 100)}% of visits this week.`);
  if (blog28[0]) highlights.push(`Most-read blog post (28 days): ${blog28[0][0]} (${n(blog28[0][1])} views).`);
}

const md = `# Google Analytics — ${weekday}, ${day}

${highlights.map((h) => `- ${h}`).join("\n")}

## Yesterday

| | Yesterday | Day before | Same day last week |
|---|---:|---:|---:|
| Visitors | ${n(y.activeUsers)} | ${n(d2.activeUsers)} | ${n(w1.activeUsers)} |
| New visitors | ${n(y.newUsers)} | ${n(d2.newUsers)} | ${n(w1.newUsers)} |
| Visits (sessions) | ${n(y.sessions)} | ${n(d2.sessions)} | ${n(w1.sessions)} |
| Engaged visits | ${rate(y)} | ${rate(d2)} | ${rate(w1)} |
| Pages viewed | ${n(y.screenPageViews)} | ${n(d2.screenPageViews)} | ${n(w1.screenPageViews)} |
| Avg. time per visitor | ${avgEng(y)} | ${avgEng(d2)} | ${avgEng(w1)} |

**Pages viewed yesterday**

${tbl(["Page", "Views"], pagesY, (r) => [esc(r[0]), n(r[1])])}

## Last 7 days

| | Last 7 days | Previous 7 days | Change |
|---|---:|---:|---:|
| Visitors | ${n(l7.activeUsers)} | ${n(p7.activeUsers)} | ${pct(l7.activeUsers, p7.activeUsers)} |
| Visits | ${n(l7.sessions)} | ${n(p7.sessions)} | ${pct(l7.sessions, p7.sessions)} |
| Pages viewed | ${n(l7.screenPageViews)} | ${n(p7.screenPageViews)} | ${pct(l7.screenPageViews, p7.screenPageViews)} |
| Engaged visits | ${rate(l7)} | ${rate(p7)} | |

**How people arrived**

${tbl(["Channel", "Visits"], channels7, (r) => [esc(r[0]), n(r[1])])}

**Sources**

${tbl(["Source / medium", "Visits"], sources7, (r) => [esc(`${r[0]} / ${r[1]}`), n(r[2])])}

**First page seen (landing pages)**

${tbl(["Page", "Visits"], landing7, (r) => [esc(r[0]), n(r[1])])}

**Most viewed pages**

${tbl(["Page", "Views"], pages7, (r) => [esc(r[0]), n(r[1])])}

**Contact details selected**

${tbl(["Action", "Times"], contacts7, (r) => [label[r[0]] || esc(r[0]), n(r[1])])}

**Cities**

${tbl(["City", "Visitors"], cities7, (r) => [esc(r[0]), n(r[1])])}

**Devices**

${tbl(["Device", "Visitors"], devices7, (r) => [esc(r[0]), n(r[1])])}

## Blog — last 28 days

${tbl(["Post", "Views"], blog28, (r) => [esc(r[0]), n(r[1])])}

<sub>GA4 property ${propertyId}. Visits are counted only after a visitor accepts the disclaimer, so the figures are lower than total traffic. Yesterday's numbers can still change slightly for up to 48 hours.</sub>
`;
fs.writeFileSync(out, md);
console.log(`Wrote ${out}`);
