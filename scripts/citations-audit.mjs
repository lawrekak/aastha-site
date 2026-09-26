// Monthly check of every live listing in content/citations.json: is the page reachable, and does it
// show the same name, phone and website as the site? Writes citations-report.md. It never logs in,
// submits, posts or edits anything; it only reads public pages.
// Usage: node scripts/citations-audit.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const S = JSON.parse(fs.readFileSync(path.join(ROOT, "content/site.json"), "utf8"));
const C = JSON.parse(fs.readFileSync(path.join(ROOT, "content/citations.json"), "utf8"));
const digits = S.phone.replace(/\D/g, "").slice(-10);
const host = new URL(S.url).host;
const checks = [
  ["Name", (t) => /aastha\s+vishwakarma/i.test(t)],
  ["Phone", (t) => t.replace(/\D/g, "").includes(digits)],
  ["Website", (t) => t.toLowerCase().includes(host)]
];

const rows = [];
for (const c of C.filter((x) => x.status === "live" && x.url)) {
  let status = "", found = [];
  try {
    const r = await fetch(c.url, { headers: { "user-agent": "Mozilla/5.0 (citation check for " + host + ")", "accept-language": "en-IN,en" }, redirect: "follow", signal: AbortSignal.timeout(20000) });
    status = String(r.status);
    const text = (await r.text()).replace(/<[^>]+>/g, " ");
    found = checks.map(([n, f]) => `${n}: ${f(text) ? "yes" : "not found"}`);
    if (r.status >= 400) found = ["the page could not be read (sign-in wall or bot block): check by hand"];
  } catch (e) { status = "error"; found = [e.name === "TimeoutError" ? "timed out" : e.message]; }
  rows.push(`| ${c.platform} | ${status} | ${found.join("; ")} |`);
}

const todo = C.filter((x) => x.status !== "live" && x.status !== "avoid");
const avoid = C.filter((x) => x.status === "avoid");
const md = `## Listings and citations

These must match everywhere:
- Name: ${S.name}, Advocate (${S.firm})
- Phone: ${S.phoneDisplay}
- Website: ${S.url}

| Listing | HTTP status | Name, phone and website shown |
|---|---|---|
${rows.join("\n") || "| (none marked live) | | |"}

"Not found" can also mean the platform hides details from automated readers. Open the page to confirm.

**Still to do (by hand):**
${todo.map((x) => `- ${x.platform}: ${x.notes}`).join("\n") || "- nothing"}

**Kept off on purpose (Rule 36):**
${avoid.map((x) => `- ${x.platform}`).join("\n")}
`;
fs.writeFileSync(path.join(ROOT, "citations-report.md"), md);
console.log(md);
