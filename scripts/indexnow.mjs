// Tells Bing, Yandex, Seznam, Naver and other IndexNow engines which URLs changed.
// Bing's index also feeds several AI assistants' web search. Google does not use IndexNow;
// it reads the sitemap submitted once in Search Console.
// Usage: node scripts/indexnow.mjs            -> every URL in dist/sitemap.xml
//        node scripts/indexnow.mjs /faq/ /     -> only these paths
import fs from "fs";
import path from "path";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const site = JSON.parse(fs.readFileSync(path.join(root, "content/site.json"), "utf8"));
const BASE = site.url.replace(/\/$/, "");
const host = new URL(BASE).host;
const args = process.argv.slice(2);
const urls = args.length
  ? args.map((p) => BASE + p)
  : [...fs.readFileSync(path.join(root, "dist/sitemap.xml"), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const body = { host, key: site.indexNowKey, keyLocation: `${BASE}/${site.indexNowKey}.txt`, urlList: urls.slice(0, 10000) };
const res = await fetch("https://api.indexnow.org/indexnow", { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) });
console.log(`IndexNow: submitted ${urls.length} URL(s), HTTP ${res.status}`);
if (res.status >= 400 && res.status !== 429) process.exit(1);
