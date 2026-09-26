// Static site build for Aastha Vishwakarma, Advocate.
// Usage: node build.mjs            -> dist/   (production, absolute links)
//        node build.mjs --preview  -> preview/ (relative links, opens from any folder)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, "content", f), "utf8"));
const BLOG_DIR = path.join(ROOT, "content", "blog");
// Blog posts: one JSON file per post in content/blog/, newest first. Written by the daily blog agent.
const POSTS = (fs.existsSync(BLOG_DIR) ? fs.readdirSync(BLOG_DIR) : []).filter((f) => f.endsWith(".json")).map((f) => ({ file: f, ...JSON.parse(fs.readFileSync(path.join(BLOG_DIR, f), "utf8")) })).sort((a, b) => b.published.localeCompare(a.published) || a.slug.localeCompare(b.slug));
const CITES = fs.existsSync(path.join(ROOT, "content", "citations.json")) ? JSON.parse(fs.readFileSync(path.join(ROOT, "content", "citations.json"), "utf8")) : [];
const S = read("site.json"), AREAS = read("areas.json"),
  FAQ = read("faq.json"), INSIGHTS = read("insights.json"), GUIDE = read("guide.json"), HI = read("hi.json");
const PREVIEW = process.argv.includes("--preview");
const OUT = path.join(ROOT, PREVIEW ? "preview" : "dist");
const ICONS = fs.readFileSync(path.join(ROOT, "src/icons.svg"), "utf8");
const ver = (f) => crypto.createHash("sha1").update(fs.readFileSync(path.join(ROOT, "src/assets", f))).digest("hex").slice(0, 8);
const V_CSS = ver("site.css"), V_JS = ver("site.js");
const UPDATED = S.contentUpdated || "2026-09-26";
const BASE = S.url.replace(/\/$/, "");
// sameAs: every live profile in content/citations.json plus any in site.json
const SAME_AS = [...new Set([...S.sameAs, ...CITES.filter((c) => c.status === "live" && c.url).map((c) => c.url)])];
const U = (p) => BASE + p;

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ico = (n, c = "i sm") => `<svg class="${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const fullAddress = `${S.address.street}, ${S.address.locality}, ${S.address.region} ${S.address.postalCode}`;
const TEL = "tel:" + S.phone.replace(/[^+\d]/g, "");
const NEWTAB = `<span class="sr"> (opens in a new tab)</span>`;
const ext = (url, label, cls = "") => `<a href="${esc(url)}" target="_blank" rel="noopener"${cls ? ` class="${cls}"` : ""}>${label}${ico("ext")}${NEWTAB}</a>`;
const areaUrl = (a) => `/practice-areas/${a.slug}/`;
const insightUrl = (a) => `/guides/${a.slug}/`;
const postUrl = (a) => `/blog/${a.slug}/`;
const words = (t) => String(t).split(/\s+/).filter(Boolean).length;
const postWords = (a) => words([a.why, ...a.keyPoints, ...a.sections.flatMap((x) => [x.h, ...x.p]), ...(a.whatToDo || [])].join(" "));
const GUIDE_URL = `/guides/${GUIDE.slug}/`;
const fit = (t, ...suffixes) => { for (const x of suffixes) if ([...(t + x)].length <= 60) return t + x; return t; };
const fmtDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

/* ---------------- Structured data ---------------- */
const ID = { site: U("/#website"), firm: U("/#firm"), person: U("/#aastha") };
const postal = { "@type": "PostalAddress", streetAddress: S.address.street, addressLocality: S.address.locality, addressRegion: S.address.region, postalCode: S.address.postalCode, addressCountry: S.address.country };
const firmNode = {
  "@type": ["LegalService", "LocalBusiness"], "@id": ID.firm, name: S.firm, url: U("/"), telephone: S.phone, ...(S.email ? { email: S.email } : {}),
  address: postal, ...(S.geo ? { geo: { "@type": "GeoCoordinates", latitude: S.geo.lat, longitude: S.geo.lng } } : {}),
  hasMap: S.mapsUrl, image: U(S.ogImage), logo: U("/assets/icon-512.png"),
  openingHoursSpecification: [{ "@type": "OpeningHoursSpecification", dayOfWeek: S.hours.days, opens: S.hours.opens, closes: S.hours.closes }],
  areaServed: S.areaServed.map((n) => ({ "@type": "Place", name: n })), knowsLanguage: ["hi", "en"], employee: { "@id": ID.person }
};
const personNode = {
  "@type": "Person", "@id": ID.person, name: S.name, alternateName: HI.name, jobTitle: "Advocate", url: U("/about/"), image: U("/assets/og.png"),
  worksFor: { "@id": ID.firm }, telephone: S.phone, ...(S.email ? { email: S.email } : {}), address: postal, knowsLanguage: ["hi", "en"],
  knowsAbout: AREAS.map((a) => a.t).concat(["Divorce and matrimonial law", "Maintenance", "Child custody and guardianship", "Domestic violence law", "Article 226 writ petitions", "Prevention of Corruption Act", "Insolvency and Bankruptcy Code", "High Court of Uttarakhand practice"]),
  ...(SAME_AS.length ? { sameAs: SAME_AS } : {}),
  ...(S.qualifications.length ? { hasCredential: S.qualifications.map((q) => ({ "@type": "EducationalOccupationalCredential", name: q, credentialCategory: "degree" })), alumniOf: { "@type": "CollegeOrUniversity", name: "Campus Law Centre, Faculty of Law, University of Delhi", parentOrganization: { "@type": "CollegeOrUniversity", name: "University of Delhi" } } } : {}),
  ...(S.enrolment.barCouncil ? { memberOf: { "@type": "Organization", name: S.enrolment.barCouncil, url: "https://www.barcouncilofuttarakhand.org/" }, identifier: { "@type": "PropertyValue", propertyID: "Bar Council enrolment number", value: S.enrolment.number }, hasOccupation: { "@type": "Occupation", name: "Advocate", occupationalCategory: "23-1011" } } : {})
};
const siteNode = { "@type": "WebSite", "@id": ID.site, url: U("/"), name: `${S.name}, Advocate`, inLanguage: ["en-IN", "hi-IN"], publisher: { "@id": ID.firm } };

function graph(p) {
  const url = U(p.path);
  const nodes = [siteNode, firmNode, personNode];
  const crumbs = p.crumbs || [];
  const webpage = {
    "@type": p.pageType || "WebPage", "@id": url + "#webpage", url, name: p.title, description: p.desc, inLanguage: p.lang === "hi" ? "hi-IN" : "en-IN",
    isPartOf: { "@id": ID.site }, about: { "@id": p.aboutId || ID.person }, dateModified: p.updated || UPDATED,
    primaryImageOfPage: { "@type": "ImageObject", url: U(S.ogImage) }
  };
  if (crumbs.length) {
    webpage.breadcrumb = { "@id": url + "#breadcrumb" };
    nodes.push({ "@type": "BreadcrumbList", "@id": url + "#breadcrumb", itemListElement: [["Home", "/"], ...crumbs].map(([n, u], i) => ({ "@type": "ListItem", position: i + 1, name: n, item: U(u) })) });
  }
  nodes.push(webpage);
  (p.extraLd || []).forEach((n) => nodes.push(n));
  return JSON.stringify({ "@context": "https://schema.org", "@graph": nodes }).replace(/</g, "\\u003c");
}

/* ---------------- Layout ---------------- */
const NAV_EN = [["/about/", "About"], ["/practice-areas/", "Practice"], ["/guides/", "Guides"], ["/blog/", "Blog"], ["/faq/", "FAQ"], ["/contact/", "Contact"]];
const NAV_HI = [["/about/", HI.nav.about], ["/practice-areas/", HI.nav.practice], ["/guides/", HI.nav.judgments], ["/blog/", "ब्लॉग"], ["/hi/faq/", HI.nav.faq], ["/hi/contact/", HI.nav.contact]];
const current = (p, href) => (href !== "/" && p.path.startsWith(href)) || p.path === href;

function header(p) {
  const hi = p.lang === "hi";
  const nav = hi ? NAV_HI : NAV_EN;
  const links = nav.map(([h, l]) => `<a href="${h}"${current(p, h) ? ' aria-current="page"' : ""}>${esc(l)}</a>`).join("");
  const other = hi ? (p.alt?.en || "/") : (p.alt?.hi || "/hi/");
  const langLink = hi ? `<a class="lang" href="${other}" hreflang="en" lang="en">English</a>` : `<a class="lang deva" href="${other}" hreflang="hi" lang="hi">हिन्दी</a>`;
  return `<a class="skip" href="#main">${hi ? "मुख्य सामग्री पर जाएँ" : "Skip to content"}</a>
<header class="top"><div class="wrap">
  <a class="brand" href="${hi ? "/hi/" : "/"}" aria-label="${esc(S.name)}, Advocate — ${hi ? "मुख्य पृष्ठ" : "home"}"><span class="mono-mark" aria-hidden="true">AV</span><span><b>${hi ? HI.name : esc(S.name)}</b><span class="sub">${hi ? "अधिवक्ता · उत्तराखंड उच्च न्यायालय · दिल्ली उच्च न्यायालय" : "Advocate · High Court of Uttarakhand · Delhi High Court"}</span></span></a>
  <nav class="main" aria-label="${hi ? "मुख्य" : "Main"}">${links}${langLink}</nav>
  <div class="row-wrap" style="gap:8px">
    <a href="${hi ? "/hi/contact/" : "/contact/"}" class="btn btn-primary cta-desk">${ico("pin")}${hi ? HI.nav.contact : "Contact details"}</a>
    <button class="menu-btn" id="menu-btn" type="button" aria-expanded="false" aria-controls="sheet" aria-label="${hi ? "मेन्यू खोलें" : "Open menu"}">${ico("menu", "i")}</button>
  </div>
</div></header>
<div class="sheet" id="sheet">${links}${langLink}</div>`;
}

function footer(p) {
  const hi = p.lang === "hi";
  const enrol = S.enrolment.barCouncil ? (hi ? `बार काउंसिल ऑफ़ उत्तराखंड · नामांकन सं. <span class="mono">${esc(S.enrolment.number)}</span>` : `${esc(S.enrolment.barCouncil)} · Enrolment no. <span class="mono">${esc(S.enrolment.number)}</span>`) : `Enrolment details to be added`;
  return `<footer><div class="wrap">
  <div class="foot">
    <div class="stack" style="gap:10px">
      <div class="brand"><span class="mono-mark" aria-hidden="true">AV</span><span><b>${hi ? HI.name : esc(S.name)}</b><span class="sub">${hi ? "अधिवक्ता" : "Advocate"}</span></span></div>
      <address style="font-style:normal">${hi ? HI.firm : esc(S.firm)}<br>${hi ? HI.address : esc(fullAddress)}</address>
      <p>${hi ? "फ़ोन" : "Phone"}: <a href="${TEL}" class="mono" style="display:inline;min-height:0;color:var(--ink)">${esc(S.phoneDisplay)}</a></p>
      ${S.email ? `<p>${hi ? "ईमेल" : "Email"}: <a href="mailto:${esc(S.email)}" style="display:inline;min-height:0;color:var(--ink)">${esc(S.email)}</a></p>` : ""}
      <p>${hi ? HI.hours : esc(S.hours.display)} · ${ext(S.mapsUrl, hi ? "रास्ता" : "Directions")}</p>
      <p class="muted" style="font-size:.82rem">${enrol}</p>
    </div>
    <div><h2 class="foot-h">${hi ? "पृष्ठ" : "Pages"}</h2><ul>${[["/about/", "About"], ["/practice-areas/", "Practice areas"], ["/guides/", "Guides"], [GUIDE_URL, "Uttarakhand High Court guide"], ["/blog/", hi ? "ब्लॉग" : "Blog"], ["/faq/", "FAQ"]].map(([h, l]) => `<li><a href="${h}">${l}</a></li>`).join("")}</ul></div>
    <div><h2 class="foot-h">${hi ? "ब्लॉग" : "Blog"}</h2><ul>${POSTS.slice(0, 3).map((x) => `<li><a href="${postUrl(x)}">${esc(x.title)}</a></li>`).join("")}<li><a href="/blog/">${hi ? "सभी पोस्ट" : "All blog posts"}</a></li></ul></div>
    <div><h2 class="foot-h">${hi ? "संपर्क" : "Contact"}</h2><ul>${[["/contact/", "Office and contact details"], ["/hi/", "हिन्दी"], ["/disclaimer/", "Disclaimer"], ["/privacy/", "Privacy notice"]].map(([h, l]) => `<li><a href="${h}">${l}</a></li>`).join("")}</ul></div>
  </div>
  <p class="fine">${hi ? HI.footerNote : "As per the rules of the Bar Council of India, this website does not advertise or solicit work. The information here is provided at the visitor's request and is not legal advice. Contacting the office does not create an advocate–client relationship. The information on this website is true and accurate to the best of my knowledge."}</p>
</div></footer>`;
}

function gate(p) {
  const hi = p.lang === "hi";
  const d = hi ? HI.disclaimer : { h: "Before you continue", p: 'The Bar Council of India does not permit advocates to advertise or solicit work. By selecting "I agree" you confirm that:', items: [`you are seeking information about ${S.name}, Advocate, of your own accord;`, "there has been no advertisement, personal communication, solicitation or inducement of any kind;", "the information on this site is not legal advice, and using it does not create an advocate–client relationship."], agree: "I agree" };
  return `<div class="gate" id="gate" role="dialog" aria-modal="true" aria-labelledby="gate-h" aria-describedby="gate-d" hidden>
  <div class="card box"${hi ? ' lang="hi"' : ""}>
    <span class="eyebrow">${ico("shield")}${hi ? "अस्वीकरण" : "Disclaimer"}</span>
    <h2 id="gate-h">${esc(d.h)}</h2>
    <p id="gate-d" class="muted">${esc(d.p)}</p>
    <ul>${d.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
    <button class="btn btn-primary" id="agree" type="button">${esc(d.agree)}</button>
    <a href="/disclaimer/" class="muted" style="font-size:.85rem">${hi ? "पूरा अस्वीकरण पढ़ें" : "Read the full disclaimer"}</a>
  </div></div>`;
}

function crumbsHtml(p) {
  if (!p.crumbs?.length) return "";
  const all = [["Home", "/"], ...p.crumbs];
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${all.map(([n, u], i) => i === all.length - 1 ? `<li aria-current="page">${esc(n)}</li>` : `<li><a href="${u}">${esc(n)}</a></li>`).join("")}</ol></nav>`;
}

function layout(p) {
  const url = U(p.path);
  const alts = p.alt ? [["en-IN", p.alt.en || p.path], ["hi-IN", p.alt.hi], ["x-default", p.alt.en || p.path]].filter((x) => x[1]) : [];
  return `<!doctype html>
<html lang="${p.lang === "hi" ? "hi-IN" : "en-IN"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.desc)}">
<link rel="canonical" href="${url}">
${alts.map(([l, h]) => `<link rel="alternate" hreflang="${l}" href="${U(h)}">`).join("\n")}
<meta name="robots" content="${p.noindex ? "noindex, follow" : "index, follow, max-snippet:-1, max-image-preview:large"}">
<meta name="author" content="${esc(S.name)}">
<meta name="theme-color" content="#1E3A8A">
<meta name="geo.region" content="IN-UT">
<meta name="geo.placename" content="Haldwani">
<meta property="og:type" content="${p.ogType || "website"}">
<meta property="og:site_name" content="${esc(S.name)}, Advocate">
<meta property="og:title" content="${esc(p.ogTitle || p.title)}">
<meta property="og:description" content="${esc(p.desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${U(S.ogImage)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="${p.lang === "hi" ? "hi_IN" : "en_IN"}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="alternate" type="text/plain" href="/llms.txt" title="LLM summary">
<link rel="alternate" type="application/rss+xml" href="/blog/feed.xml" title="${esc(S.name)}, Advocate — Blog">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600&family=Lato:wght@400;700&family=IBM+Plex+Mono:wght@400;500&family=Tiro+Devanagari+Hindi&display=swap">
<link rel="stylesheet" href="/assets/site.css?v=${V_CSS}">
<script type="application/ld+json">${graph(p)}</script>
<script src="/assets/site.js?v=${V_JS}" defer></script>
</head>
<body>
${ICONS}
${header(p)}
<main id="main" tabindex="-1"><div class="wrap">
${crumbsHtml(p)}
${p.body}
</div></main>
${footer(p)}
${gate(p)}
</body>
</html>
`;
}

/* ---------------- Reusable blocks ---------------- */
const officeCard = (hi = false) => `<div class="card office">
  <span class="eyebrow">${ico("pin")}${hi ? HI.home.officeH : "Office"}</span>
  <h2 class="h3">${hi ? HI.firm : esc(S.firm)}</h2>
  <address style="font-style:normal">${hi ? HI.address : esc(S.address.street) + "<br>" + esc(`${S.address.locality}, ${S.address.region} ${S.address.postalCode}`)}</address>
  <table class="hours"><caption class="sr">${hi ? "समय" : "Office hours"}</caption><tr><th scope="row">${hi ? "प्रतिदिन" : "Monday – Sunday"}</th><td>${hi ? "सुबह 9 – शाम 5" : "9:00 AM – 5:00 PM"}</td></tr><tr><th scope="row">${hi ? "राजपत्रित अवकाश" : "Gazetted holidays"}</th><td class="muted">${hi ? "समय भिन्न हो सकता है" : "Hours may differ"}</td></tr></table>
  ${S.email ? `<p style="display:flex;gap:10px;align-items:center">${ico("msg", "i")}<span>${hi ? "ईमेल" : "Email"}: <a href="mailto:${esc(S.email)}" style="overflow-wrap:anywhere">${esc(S.email)}</a></span></p>` : ""}
  <div class="row-wrap">
    <a class="btn btn-primary" href="${TEL}">${ico("phone")}${esc(S.phoneDisplay)}</a>
    ${ext(S.mapsUrl, hi ? HI.contact.directions : "Get directions", "btn btn-outline")}
  </div>
</div>`;

const areaCard = (a) => `<a class="card area-card" href="${areaUrl(a)}"><span class="ic">${ico(a.icon, "i")}</span><h3>${esc(a.t)}</h3><p class="muted" style="font-size:.94rem">${esc(a.d)}</p><span class="link" style="margin-top:auto">Read more ${ico("arrow")}</span></a>`;
const ctaBand = `<div class="card cta-band"><div class="stack" style="gap:6px"><h2 class="h3">Office contact details</h2><p class="muted">Office contact details are provided for persons seeking information about the Advocate.</p></div><div class="row-wrap"><a class="btn btn-outline" href="/contact/">${ico("pin")}Office and contact details</a></div></div>`;
const relatedPosts = (i) => { const r = POSTS.filter((x) => x.area === i).slice(0, 4); return r.length ? `<div class="card" style="padding:18px"><h2 class="foot-h">Recent blog posts</h2><ul class="plain">${r.map((x) => `<li><a href="${postUrl(x)}">${esc(x.title)}</a></li>`).join("")}</ul></div>` : ""; };
const postCard = (a) => `<a class="card j-card" href="${postUrl(a)}"><span class="cite">${fmtDate(a.published)} · ${esc(AREAS[a.area].t)}</span><h2 class="h3">${esc(a.title)}</h2><p class="muted" style="font-size:.92rem">${esc(a.desc)}</p><span class="meta">${Math.max(1, Math.round(postWords(a) / 200))} min read</span></a>`;
const notice = (t) => `<div class="notice">${ico("shield", "i")}<span>${t}</span></div>`;
const faqItems = (items) => items.map(([q, a]) => `<details><summary>${esc(q)}${ico("right", "i")}</summary><p>${esc(a)}</p></details>`).join("");
const faqLd = (items, url) => ({ "@type": "FAQPage", "@id": U(url) + "#faq", mainEntityOfPage: { "@id": U(url) + "#webpage" }, mainEntity: items.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });

/* ---------------- Pages ---------------- */
const pages = [];
const add = (p) => pages.push({ lang: "en", ...p });

// Home
add({
  path: "/", title: "Aastha Vishwakarma, Advocate | Nainital High Court, Haldwani", ogTitle: "Aastha Vishwakarma, Advocate",
  desc: "Advocate at the Uttarakhand and Delhi High Courts and District Courts. Service law, cheque bounce, family and matrimonial, civil and criminal cases. Haldwani.",
  alt: { en: "/", hi: "/hi/" }, priority: "1.0", changefreq: "weekly",
  body: `<section class="hero" aria-labelledby="h1">
  <div class="stack" style="gap:20px">
    <span class="eyebrow">Advocate · <span class="deva" lang="hi" style="letter-spacing:0;text-transform:none;font-size:.95rem">अधिवक्ता</span></span>
    <h1 id="h1">${esc(S.tagline)}</h1>
    <p class="lede">Practice in service and education law, civil and criminal litigation in the district courts including cheque bounce and recovery matters, matrimonial and family disputes, writ petitions against public authorities, criminal appeals and property matters.</p>
    <p class="deva muted" lang="hi">${esc(HI.home.lede)}</p>
    <div class="row-wrap"><a class="btn btn-primary" href="/practice-areas/">Areas of practice</a><a class="btn btn-outline" href="/contact/">${ico("pin")}Office and contact details</a></div>
    <div class="facts">
      <div class="fact">${ico("court", "i")}<div><b>High Courts and District Courts</b>Delhi and Uttarakhand, plus NCLAT, CAT, SC</div></div>
      <div class="fact">${ico("brief", "i")}<div><b>Since ${S.practiceSince}</b>In practice</div></div>
      <div class="fact">${ico("lang", "i")}<div><b>Hindi and English</b>Languages</div></div>
    </div>
  </div>
  ${officeCard()}
</section>
<section class="forums" aria-label="Forums appeared before"><span class="lbl">Appears before</span>${S.forums.map((f) => `<span class="f">${ico("court", "i")}${esc(f.replace(" (NCLAT)", ""))}</span>`).join("")}</section>
<section class="block" aria-labelledby="h-areas"><div class="sec-head"><div class="stack"><span class="eyebrow">Areas of practice</span><h2 id="h-areas">Matters handled</h2></div><a class="link" href="/practice-areas/">All practice areas ${ico("arrow")}</a></div><div class="grid3">${AREAS.map(areaCard).join("")}</div></section>
<section class="block" aria-labelledby="h-guide"><div class="card guide-band"><div class="stack"><span class="eyebrow">Guide</span><h2 id="h-guide">${esc(GUIDE.title)}</h2><p class="muted">${esc(GUIDE.desc)}</p></div><a class="btn btn-outline" href="${GUIDE_URL}">Read the guide ${ico("arrow")}</a></div></section>
<section class="block" aria-labelledby="h-faqs"><div class="sec-head"><div class="stack"><span class="eyebrow">Questions</span><h2 id="h-faqs">Common questions</h2></div><a class="link" href="/faq/">All questions ${ico("arrow")}</a></div><div style="max-width:820px">${faqItems(FAQ.slice(0, 3))}</div></section>`,
  extraLd: [faqLd(FAQ.slice(0, 3), "/")]
});

// About
add({
  path: "/about/", title: "About Aastha Vishwakarma, Advocate | Haldwani, Nainital", pageType: "AboutPage",
  desc: "Aastha Vishwakarma appears before the Uttarakhand and Delhi High Courts, the District Courts of Delhi and Nainital, NCLAT, CAT and the Supreme Court.",
  crumbs: [["About", "/about/"]], priority: "0.8",
  body: `<span class="eyebrow">About</span><h1 style="margin:10px 0 20px">${esc(S.name)}, Advocate</h1>
<div class="cols2"><div class="stack">
<p>${esc(S.summary)}</p>
<p class="muted">She practises from ${esc(S.firm)} in Vaishali Colony, Haldwani, close to the High Court at Nainital.</p>
</div>
<dl class="panel facts-dl">
<dt>Forums</dt><dd>${S.forums.map(esc).join(" · ")}</dd>
<dt>In practice since</dt><dd>${S.practiceSince}</dd>
<dt>Office</dt><dd>${esc(S.firm)}, ${esc(fullAddress)}</dd>
<dt>Phone</dt><dd><a href="${TEL}" class="mono">${esc(S.phoneDisplay)}</a></dd>
<dt>Qualifications</dt><dd>${S.qualifications.length ? S.qualifications.map(esc).join("; ") : '<span class="tag sample">to be added</span>'}</dd>
<dt>Enrolment</dt><dd>${S.enrolment.barCouncil ? `${esc(S.enrolment.barCouncil)}, enrolment no. <span class="mono">${esc(S.enrolment.number)}</span> (${esc(S.enrolment.year)})` : '<span class="tag sample">to be added</span>'}</dd>
<dt>Languages</dt><dd>${S.languages.join(", ")}</dd>
</dl></div>
<div class="block">${ctaBand}</div>`
});

// Practice areas
add({
  path: "/practice-areas/", title: "Practice Areas | Aastha Vishwakarma, Advocate, Haldwani", pageType: "CollectionPage",
  desc: "Service law, cheque bounce, recovery, family and matrimonial, civil and criminal litigation, writs, property, IBC and tribunal matters in Delhi and Uttarakhand.",
  crumbs: [["Practice areas", "/practice-areas/"]], priority: "0.9",
  body: `<span class="eyebrow">Areas of practice</span><h1 style="margin:10px 0 12px">Practice areas</h1>
<p class="muted" style="margin-bottom:28px">Listed as permitted under Rule 36 of the Bar Council of India Rules: factual areas of practice, without claims of specialisation.</p>
<div class="grid3">${AREAS.map(areaCard).join("")}</div>`
});
AREAS.forEach((a, i) => {
  add({
    path: areaUrl(a), title: a.seoTitle, desc: a.desc, crumbs: [["Practice areas", "/practice-areas/"], [a.t, areaUrl(a)]], priority: "0.8",
    extraLd: [{ "@type": "Service", "@id": U(areaUrl(a)) + "#service", name: a.t, serviceType: a.t, description: a.desc, provider: { "@id": ID.person }, areaServed: S.areaServed.map((n) => ({ "@type": "Place", name: n })), url: U(areaUrl(a)) }].concat(a.faq ? [faqLd(a.faq, areaUrl(a))] : []),
    body: `<div class="article-grid"><article class="stack prose">
<span class="eyebrow">Practice area</span><h1>${esc(a.t)}</h1>
<p class="lede">${esc(a.d)}</p>
${a.body.map((x) => `<p>${esc(x)}</p>`).join("")}
<h2 class="h3">Typical matters</h2><ul>${a.i.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
${a.faq ? `<h2 class="h3">Common questions</h2><dl class="stack" style="gap:14px">${a.faq.map(([q, x]) => `<div><dt><b>${esc(q)}</b></dt><dd style="margin:4px 0 0">${esc(x)}</dd></div>`).join("")}</dl>` : ""}
${a.hiBody ? `<section lang="hi" class="stack deva-body" style="gap:12px;margin-top:12px;padding-top:18px;border-top:1px solid var(--line-soft)"><h2 class="h3 deva">${esc(a.hiBody.t)}</h2>${a.hiBody.p.map((x) => `<p>${esc(x)}</p>`).join("")}</section>` : ""}
${notice("General information only, not legal advice. Every matter depends on its own facts and documents.")}
</article><aside class="stack side-col">${officeCard()}${relatedPosts(i)}<div class="card" style="padding:18px"><h2 class="foot-h">Other practice areas</h2><ul class="plain">${AREAS.filter((x) => x !== a).map((x) => `<li><a href="${areaUrl(x)}">${esc(x.t)}</a></li>`).join("")}</ul></div></aside></div>
<div class="block">${ctaBand}</div>`
  });
});

// Guides
add({
  path: "/guides/", title: "Legal Guides for Uttarakhand | Aastha Vishwakarma, Advocate", pageType: "CollectionPage",
  desc: "Plain-language guides on court procedure in Uttarakhand, starting with how matters reach the High Court at Nainital and how to check case status online.",
  crumbs: [["Guides", "/guides/"]], priority: "0.7",
  body: `<span class="eyebrow">Guides</span><h1 style="margin:10px 0 12px">Guides on court procedure</h1><p class="muted" style="margin-bottom:24px">Plain-language explanations of how matters move through the courts. General information only, not legal advice.</p>
<div class="grid3"><a class="card j-card" href="${GUIDE_URL}"><span class="cite">Guide</span><h2 class="h3">${esc(GUIDE.title)}</h2><p class="muted" style="font-size:.92rem">${esc(GUIDE.desc)}</p></a>${INSIGHTS.map((a) => `<a class="card j-card" href="${insightUrl(a)}"><span class="cite">${esc(a.d)}</span><h2 class="h3">${esc(a.t)}</h2><p class="muted" style="font-size:.92rem">${esc(a.desc)}</p></a>`).join("")}</div>`
});
INSIGHTS.forEach((a) => {
  add({
    path: insightUrl(a), title: fit(a.t, " | Guides"), ogType: "article", desc: a.desc, crumbs: [["Guides", "/guides/"], [a.t, insightUrl(a)]], priority: "0.6",
    extraLd: [{ "@type": "Article", "@id": U(insightUrl(a)) + "#article", headline: a.t, description: a.desc, datePublished: a.published, dateModified: a.published, author: { "@id": ID.person }, publisher: { "@id": ID.firm }, mainEntityOfPage: { "@id": U(insightUrl(a)) + "#webpage" }, image: U(S.ogImage), inLanguage: "en-IN" }],
    body: `<div class="article-grid"><article class="stack prose"><span class="eyebrow">Guide · ${esc(a.d)}</span><h1>${esc(a.t)}</h1>
<p class="muted">By <a href="/about/">${esc(S.name)}, Advocate</a> · <time datetime="${a.published}">${fmtDate(a.published)}</time></p>
${a.p.map((x) => `<p>${esc(x)}</p>`).join("")}
${a.hi ? `<section lang="hi" class="stack deva-body" style="gap:12px;margin-top:12px;padding-top:18px;border-top:1px solid var(--line-soft)"><h2 class="h3 deva">${esc(a.hi.t)}</h2>${a.hi.p.map((x) => `<p>${esc(x)}</p>`).join("")}</section>` : ""}
${notice("General information only, not legal advice.")}
</article><aside class="stack side-col">${officeCard()}</aside></div>`
  });
});
add({
  path: GUIDE_URL, title: GUIDE.seoTitle, ogType: "article", desc: GUIDE.desc, crumbs: [["Guides", "/guides/"], ["Uttarakhand High Court guide", GUIDE_URL]], priority: "0.8",
  extraLd: [{ "@type": "Article", "@id": U(GUIDE_URL) + "#article", headline: GUIDE.title, description: GUIDE.desc, datePublished: GUIDE.published, dateModified: GUIDE.published, author: { "@id": ID.person }, publisher: { "@id": ID.firm }, mainEntityOfPage: { "@id": U(GUIDE_URL) + "#webpage" }, image: U(S.ogImage), about: { "@type": "GovernmentOrganization", name: "High Court of Uttarakhand", url: "https://highcourtofuttarakhand.gov.in/", address: { "@type": "PostalAddress", addressLocality: "Nainital", addressRegion: "Uttarakhand", addressCountry: "IN" } } }],
  body: `<div class="article-grid"><article class="stack prose"><span class="eyebrow">Guide</span><h1>${esc(GUIDE.title)}</h1>
<p class="muted">By <a href="/about/">${esc(S.name)}, Advocate</a> · <time datetime="${GUIDE.published}">${fmtDate(GUIDE.published)}</time></p>
<p class="lede">${esc(GUIDE.desc)}</p>
<nav class="toc" aria-label="On this page"><b>On this page</b><ol>${GUIDE.sections.map((s, i) => `<li><a href="#s${i + 1}">${esc(s.h)}</a></li>`).join("")}</ol></nav>
${GUIDE.sections.map((s, i) => `<h2 class="h3" id="s${i + 1}">${esc(s.h)}</h2>${s.p.map((x) => `<p>${esc(x)}</p>`).join("")}${s.links ? `<ul>${s.links.map((l) => `<li>${ext(l[1], esc(l[0]))}</li>`).join("")}</ul>` : ""}`).join("")}
${notice(esc(GUIDE.note))}
</article><aside class="stack side-col">${officeCard()}</aside></div>
<div class="block">${ctaBand}</div>`
});

// Blog: short daily posts on current legal questions, 12 per listing page
const PER_PAGE = 12, BLOG_PAGES = Math.max(1, Math.ceil(POSTS.length / PER_PAGE));
for (let n = 1; n <= BLOG_PAGES; n++) {
  const list = POSTS.slice((n - 1) * PER_PAGE, n * PER_PAGE), url = n === 1 ? "/blog/" : `/blog/page/${n}/`;
  add({
    path: url, pageType: "CollectionPage", priority: n === 1 ? "0.8" : "0.4", changefreq: "daily", updated: POSTS[0]?.published,
    title: n === 1 ? "Legal Blog: Uttarakhand and Nainital | Aastha Vishwakarma" : `Legal Blog, Page ${n} | Aastha Vishwakarma, Advocate`,
    desc: n === 1 ? "Short, plain-language posts on legal questions people in Haldwani, Nainital and Uttarakhand are asking: family, property, service, cheque bounce and court procedure." : `Older posts from the legal blog of Aastha Vishwakarma, Advocate, Haldwani (page ${n} of ${BLOG_PAGES}).`,
    crumbs: n === 1 ? [["Blog", "/blog/"]] : [["Blog", "/blog/"], [`Page ${n}`, url]],
    body: `<span class="eyebrow">Blog</span><h1 style="margin:10px 0 12px">${n === 1 ? "Legal blog" : `Legal blog: page ${n}`}</h1>
<p class="muted" style="margin-bottom:24px;max-width:62ch">Short posts on legal questions in the news and in everyday life in Uttarakhand, in plain language. Each takes about two minutes to read. General information only, not legal advice.</p>
${list.length ? `<div class="grid3">${list.map(postCard).join("")}</div>` : `<div class="card" style="padding:22px"><p>The first posts will appear here soon. Meanwhile, see the <a href="/guides/">guides</a>.</p></div>`}
${BLOG_PAGES > 1 ? `<nav class="row-wrap" aria-label="Blog pages" style="margin-top:24px">${n > 1 ? `<a class="btn btn-outline" href="${n === 2 ? "/blog/" : `/blog/page/${n - 1}/`}">Newer posts</a>` : ""}${n < BLOG_PAGES ? `<a class="btn btn-outline" href="/blog/page/${n + 1}/">Older posts</a>` : ""}</nav>` : ""}`
  });
}
POSTS.forEach((a) => {
  const url = postUrl(a), area = AREAS[a.area];
  add({
    path: url, title: fit(a.title, " | Aastha Vishwakarma", " | Blog"), ogTitle: a.title, ogType: "article", desc: a.desc, priority: "0.6", updated: a.updated || a.published,
    crumbs: [["Blog", "/blog/"], [a.title, url]],
    extraLd: [{ "@type": "BlogPosting", "@id": U(url) + "#article", headline: a.title, description: a.desc, datePublished: a.published, dateModified: a.updated || a.published, author: { "@id": ID.person }, publisher: { "@id": ID.firm }, mainEntityOfPage: { "@id": U(url) + "#webpage" }, image: U(S.ogImage), inLanguage: "en-IN", articleSection: area.t, wordCount: postWords(a), keywords: (a.keywords || []).join(", "), isPartOf: { "@type": "Blog", "@id": U("/blog/") + "#blog", name: `${S.name}, Advocate — Blog` }, citation: (a.sources || []).map((x) => x.url) }],
    body: `<div class="article-grid"><article class="stack prose"><span class="eyebrow">Blog · <a href="${areaUrl(area)}">${esc(area.t)}</a></span><h1>${esc(a.title)}</h1>
<p class="muted">By <a href="/about/">${esc(S.name)}, Advocate</a> · <time datetime="${a.published}">${fmtDate(a.published)}</time> · ${Math.max(1, Math.round(postWords(a) / 200))} min read</p>
<p class="lede">${esc(a.why)}</p>
<div class="keypoints"><b>Key points</b><ul>${a.keyPoints.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
${a.sections.map((x) => `<h2 class="h3">${esc(x.h)}</h2>${x.p.map((y) => `<p>${esc(y)}</p>`).join("")}`).join("")}
${a.whatToDo?.length ? `<h2 class="h3">What you can do</h2><ol>${a.whatToDo.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>` : ""}
${a.hi ? `<section lang="hi" class="stack deva-body" style="gap:12px;margin-top:12px;padding-top:18px;border-top:1px solid var(--line-soft)"><h2 class="h3 deva">${esc(a.hi.title)}</h2><ul>${a.hi.keyPoints.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>${(a.hi.p || []).map((x) => `<p>${esc(x)}</p>`).join("")}</section>` : ""}
${a.sources?.length ? `<h2 class="h3">Sources</h2><ul>${a.sources.map((x) => `<li>${ext(x.url, esc(x.title))}</li>`).join("")}</ul>` : ""}
${notice("General information only, not legal advice. The law and its interpretation can change, and every matter depends on its own facts.")}
</article><aside class="stack side-col"><div class="card" style="padding:18px"><h2 class="foot-h">Related practice area</h2><p><a href="${areaUrl(area)}">${esc(area.t)}</a></p></div>${POSTS.filter((x) => x !== a).slice(0, 5).length ? `<div class="card" style="padding:18px"><h2 class="foot-h">More posts</h2><ul class="plain">${POSTS.filter((x) => x !== a).slice(0, 5).map((x) => `<li><a href="${postUrl(x)}">${esc(x.title)}</a></li>`).join("")}</ul></div>` : ""}${officeCard()}</aside></div>`
  });
});

// Contact
add({
  path: "/contact/", title: "Contact and Office Location, Haldwani | Aastha Vishwakarma", pageType: "ContactPage",
  desc: `${S.firm}, B-8, Vaishali Colony, Bhotia Parao, Haldwani 263139. Phone ${S.phoneDisplay}. Open 9 AM to 5 PM every day.`,
  alt: { en: "/contact/", hi: "/hi/contact/" }, crumbs: [["Contact", "/contact/"]], priority: "0.9",
  body: `<span class="eyebrow">Contact</span><h1 style="margin:10px 0 22px">Office and contact details</h1>
<div class="cols2">${officeCard()}
<div class="stack"><div class="card" style="padding:22px"><p>Office contact details are provided for persons seeking information about the Advocate.</p></div>
<div class="card" style="padding:22px"><h2 class="h3" style="margin-bottom:8px">Professional information</h2><dl class="facts-dl"><dt>Enrolment</dt><dd>${S.enrolment.barCouncil ? `${esc(S.enrolment.barCouncil)}, enrolment no. <span class="mono">${esc(S.enrolment.number)}</span>` : "To be added"}</dd>${S.qualifications.length ? `<dt>Qualifications</dt><dd>${S.qualifications.map(esc).join("; ")}</dd>` : ""}<dt>Courts</dt><dd>${S.forums.map(esc).join(" · ")}</dd></dl></div>
${notice("Please do not send confidential documents or case papers through this website or by email.")}</div></div>`
});

// FAQ
add({
  path: "/faq/", title: "FAQ | Aastha Vishwakarma, Advocate, Haldwani",
  desc: "Answers on the courts she appears before, the office in Haldwani, cheque bounce procedure, checking case status online and Bar Council rules on websites.",
  alt: { en: "/faq/", hi: "/hi/faq/" }, crumbs: [["FAQ", "/faq/"]], priority: "0.7",
  aboutId: ID.firm,
  body: `<span class="eyebrow">Questions</span><h1 style="margin:10px 0 18px">Frequently asked questions</h1><div style="max-width:820px">${faqItems(FAQ)}</div>`,
  extraLd: [faqLd(FAQ, "/faq/")]
});

// Legal pages
add({
  path: "/disclaimer/", title: "Disclaimer | Aastha Vishwakarma, Advocate", desc: "Bar Council of India disclaimer for this website: information only, no advertisement or solicitation, and no advocate–client relationship.", crumbs: [["Disclaimer", "/disclaimer/"]], priority: "0.2",
  body: `<article class="prose stack"><h1>Disclaimer</h1><p>The Bar Council of India does not permit advocates to solicit work or advertise. This website provides information about ${esc(S.name)}, Advocate, as permitted under Rule 36 of the Bar Council of India Rules: name, contact details, qualifications, enrolment details and areas of practice.</p><p>By using this website you acknowledge that you are seeking information of your own accord, that there has been no advertisement, personal communication, solicitation or inducement, and that nothing on this website is legal advice.</p><p>Using this website or contacting the office does not create an advocate–client relationship. The website does not publish past cases, their outcomes or client testimonials.</p><p>The information on this website is true and accurate to the best of my knowledge.</p></article>`
});
add({
  path: "/privacy/", title: "Privacy Notice | Aastha Vishwakarma, Advocate", desc: "This website does not collect personal details through forms, does not use tracking or advertising cookies, and does not sell any data.", crumbs: [["Privacy notice", "/privacy/"]], priority: "0.2",
  body: `<article class="prose stack"><h1>Privacy notice</h1>
<h2 class="h3">What is collected</h2><p>This website has no forms and does not collect personal details. If you contact the office by phone or email, the details you share are used only to reply to you and are not sold or shared for marketing. You can ask for them to be deleted by calling ${esc(S.phoneDisplay)}.</p>
<h2 class="h3">Cookies</h2><p>This website does not use advertising or tracking cookies. Your browser remembers only that you accepted the disclaimer, for the current visit.</p>
<p class="muted">This notice is written with the Digital Personal Data Protection Act, 2023 in mind and will be updated as the rules under it take effect.</p></article>`
});

// Hindi
const hiOffice = officeCard(true);
pages.push({
  lang: "hi", path: "/hi/", title: HI.home.seoTitle, desc: HI.home.desc, alt: { en: "/", hi: "/hi/" }, priority: "0.9",
  body: `<section class="hero" lang="hi"><div class="stack deva-body" style="gap:18px"><span class="eyebrow">अधिवक्ता</span><h1 class="deva">${esc(HI.home.h1)}</h1><p class="lede">${esc(HI.home.lede)}</p>
<div class="row-wrap"><a class="btn btn-outline" href="/hi/contact/">${ico("pin")}${esc(HI.home.cta)}</a></div></div>${hiOffice}</section>
<section class="forums" lang="hi"><span class="lbl">${esc(HI.home.forumsH)}</span>${HI.home.forums.map((f) => `<span class="f deva">${ico("court", "i")}${esc(f)}</span>`).join("")}</section>
<section class="block" lang="hi"><h2 class="deva" style="margin-bottom:18px">${esc(HI.home.areasH)}</h2><div class="grid3">${AREAS.map((a) => `<a class="card area-card" href="${areaUrl(a)}"><span class="ic">${ico(a.icon, "i")}</span><h3 class="deva">${esc(a.hi)}</h3><p class="muted" lang="en" style="font-size:.9rem">${esc(a.t)}</p></a>`).join("")}</div>
<p style="margin-top:22px"><a class="link" href="/">${esc(HI.home.enLink)} ${ico("arrow")}</a></p></section>`
});
pages.push({
  lang: "hi", path: "/hi/faq/", title: HI.faq.seoTitle, desc: HI.faq.desc, alt: { en: "/faq/", hi: "/hi/faq/" }, aboutId: ID.firm,
  crumbs: [["प्रश्नोत्तर", "/hi/faq/"]],
  body: `<div lang="hi"><h1 class="deva" style="margin-bottom:18px">${esc(HI.faq.h1)}</h1><div class="deva-body" style="max-width:820px">${faqItems(HI.faq.items)}</div></div>`,
  extraLd: [faqLd(HI.faq.items, "/hi/faq/")]
});
pages.push({
  lang: "hi", path: "/hi/contact/", title: HI.contact.seoTitle, desc: HI.contact.desc, alt: { en: "/contact/", hi: "/hi/contact/" }, pageType: "ContactPage",
  crumbs: [["संपर्क", "/hi/contact/"]],
  body: `<div lang="hi"><h1 class="deva" style="margin-bottom:22px">${esc(HI.contact.h1)}</h1><div class="cols2">${hiOffice}<div class="card deva-body" style="padding:22px"><p>${esc(HI.contact.visit)}</p></div></div></div>`
});

// 404
const notFound = { path: "/404.html", title: "Page not found | Aastha Vishwakarma, Advocate", desc: "This page does not exist or has moved. Go to the home page or contact the office in Haldwani.", noindex: true, lang: "en", body: `<h1>Page not found</h1><p class="muted" style="margin:12px 0 20px">The page you asked for does not exist or has moved.</p><div class="row-wrap"><a class="btn btn-primary" href="/">Go to the home page</a><a class="btn btn-outline" href="/contact/">Contact the office</a></div>` };

/* ---------------- Write output ---------------- */
fs.rmSync(OUT, { recursive: true, force: true });
const write = (rel, content) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); };
function relativize(html, pagePath) {
  if (!PREVIEW) return html;
  const fromDir = pagePath.endsWith("/") ? pagePath.slice(1) : path.posix.dirname(pagePath.slice(1));
  return html.replace(/(href|src)="\/(?!\/)([^"#?]*)(\?[^"#]*)?(#[^"]*)?"/g, (_, attr, p, q = "", hash = "") => {
    let target = p === "" || p.endsWith("/") ? p + "index.html" : p;
    let rel = path.posix.relative(fromDir || ".", target) || "index.html";
    return `${attr}="${rel}${q}${hash}"`;
  });
}
for (const p of [...pages, notFound]) {
  const file = p.path.endsWith("/") ? p.path.slice(1) + "index.html" : p.path.slice(1);
  write(file, relativize(layout(p), p.path));
}
// assets
fs.cpSync(path.join(ROOT, "src/assets"), path.join(OUT, "assets"), { recursive: true });
fs.cpSync(path.join(ROOT, "src/root"), OUT, { recursive: true });

// sitemap with hreflang
const indexable = pages.filter((p) => !p.noindex);
const sm = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${indexable.map((p) => `  <url><loc>${U(p.path)}</loc><lastmod>${p.updated || UPDATED}</lastmod>${p.changefreq ? `<changefreq>${p.changefreq}</changefreq>` : ""}<priority>${p.priority || "0.5"}</priority>${p.alt ? ["en-IN:" + (p.alt.en || p.path), "hi-IN:" + p.alt.hi, "x-default:" + (p.alt.en || p.path)].map((x) => { const [l, h] = x.split(/:(.*)/s); return `<xhtml:link rel="alternate" hreflang="${l}" href="${U(h)}"/>`; }).join("") : ""}</url>`).join("\n")}
</urlset>
`;
write("sitemap.xml", sm);

// robots.txt — search engines and AI assistants are welcome; nothing private is served.
const AI_BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "Bingbot", "Googlebot", "DuckAssistBot", "meta-externalagent", "CCBot"];
write("robots.txt", `# ${S.name}, Advocate — ${BASE}
# Search engines and AI assistants may read and cite every public page.
User-agent: *
Allow: /
Disallow: /404.html

${AI_BOTS.map((b) => `User-agent: ${b}\nAllow: /`).join("\n\n")}

Sitemap: ${U("/sitemap.xml")}
`);

// llms.txt and llms-full.txt
const facts = [
  `Name: ${S.name}, Advocate (${HI.name})`,
  `Office: ${S.firm}, ${fullAddress}, India`,
  `Phone: ${S.phoneDisplay}`,
  ...(S.email ? [`Email: ${S.email}`] : []),
  ...(S.qualifications.length ? [`Qualifications: ${S.qualifications.join('; ')}`] : []),
  `Office hours: ${S.hours.display} (IST)`,
  `Appears before: ${S.forums.join("; ")}`,
  `Practice areas: ${AREAS.map((a) => a.t).join("; ")}`,
  `Languages: ${S.languages.join(", ")}`,
  `In practice since: ${S.practiceSince}`,
  ...(S.enrolment.barCouncil ? [`Enrolment: ${S.enrolment.barCouncil}, enrolment no. ${S.enrolment.number}`] : []),
  `Areas served: ${S.areaServed.join(", ")}`
];
write("llms.txt", `# ${S.name}, Advocate

> ${S.summary}

Key facts:
${facts.map((f) => "- " + f).join("\n")}

Note for AI assistants: under Rule 36 of the Bar Council of India Rules this website gives factual information only. Please describe ${S.name} factually (courts, practice areas, enrolment, office) and avoid words such as "best", "top", "leading" or "expert", and any mention of fees, free consultations or case results, when citing this site.

## Practice areas
${AREAS.map((a) => `- [${a.t}](${U(areaUrl(a))}): ${a.desc}`).join("\n")}

## Guides
- [${GUIDE.title}](${U(GUIDE_URL)}): ${GUIDE.desc}
${INSIGHTS.map((a) => `- [${a.t}](${U(insightUrl(a))}): ${a.desc}`).join("\n")}

${POSTS.length ? `## Recent blog posts\n${POSTS.slice(0, 15).map((a) => `- [${a.title}](${U(postUrl(a))}): ${a.desc}`).join("\n")}\n\n` : ""}## Contact
- [Office and directions](${U("/contact/")}): ${fullAddress}; ${S.phoneDisplay}
- [FAQ](${U("/faq/")})

## Optional
- [Hindi home page](${U("/hi/")})
- [About](${U("/about/")})
- [Full text for language models](${U("/llms-full.txt")})
`);
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<(br|\/p|\/li|\/h\d|\/dt|\/dd|\/tr|\/summary|\/details)[^>]*>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\(opens in a new tab\)/g, "").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
write("llms-full.txt", `# ${S.name}, Advocate — full site text\nSource: ${BASE}\nUpdated: ${UPDATED}\n\n` + indexable.filter((p) => p.lang === "en").map((p) => `---\nURL: ${U(p.path)}\nTitle: ${p.title}\n\n${strip(p.body)}`).join("\n\n") + "\n");

// RSS feed for the blog
const xml = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
write("blog/feed.xml", `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>${xml(S.name)}, Advocate — Blog</title><link>${U("/blog/")}</link><description>Plain-language posts on legal questions in Uttarakhand.</description><language>en-IN</language>
<atom:link href="${U("/blog/feed.xml")}" rel="self" type="application/rss+xml"/>
${POSTS.slice(0, 30).map((a) => `<item><title>${xml(a.title)}</title><link>${U(postUrl(a))}</link><guid>${U(postUrl(a))}</guid><pubDate>${new Date(a.published + "T06:00:00+05:30").toUTCString()}</pubDate><description>${xml(a.desc)}</description></item>`).join("\n")}
</channel></rss>
`);

// Custom domain for GitHub Pages
if (process.env.WRITE_CNAME) write("CNAME", new URL(BASE).host + "\n");
// IndexNow key file
write(`${S.indexNowKey}.txt`, S.indexNowKey);
// Manifest
write("site.webmanifest", JSON.stringify({ name: `${S.name}, Advocate`, short_name: "Aastha V.", start_url: "/", display: "standalone", background_color: "#F8FAFC", theme_color: "#1E3A8A", icons: [{ src: "/assets/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/assets/icon-512.png", sizes: "512x512", type: "image/png" }] }, null, 1));

console.log(`Built ${pages.length} pages + 404 into ${path.relative(ROOT, OUT)}/ (${PREVIEW ? "preview" : "production"})`);
