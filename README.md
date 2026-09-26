# Aastha Vishwakarma, Advocate — website

A static site with no dependencies. Every page is plain HTML with its own URL, title, description, canonical, language alternates and structured data, so search engines and AI assistants can read and cite it.

```
content/     all text and facts (edit these, never the HTML)
  site.json    name, office, phone, hours, domain, enrolment
  areas.json   practice areas
  insights.json (extra guides), guide.json, faq.json, fees.json, hi.json (Hindi pages)
src/         styles, script, icons, favicon, social image
build.mjs    generates dist/ (production) or preview/ (relative links)
scripts/     validate.mjs, indexnow.mjs, audit-live.mjs
.github/workflows/  checks.yml (every push), weekly-audit.yml (Mondays), indexnow.yml (manual)
workers/     chat (booking assistant) and whatsapp (confirmations, reminders), with offline tests
SETUP.md     the account steps only a person can do
```

## Commands

| Command | What it does |
|---|---|
| `npm run check` | Build and run every SEO, structured-data and Rule 36 check |
| `npm run preview` | Build a copy with relative links you can open from a folder |
| `npm run indexnow` | Tell Bing and IndexNow partners the URLs changed |
| `npm run audit` | Audit the live site and PageSpeed scores |

## What is built in

**Search engines**
- One URL per page: 6 practice areas, the Uttarakhand High Court guide, and About, Fees, Consultation, Contact, FAQ, Disclaimer and Privacy pages, plus Hindi home, FAQ and contact pages
- Titles of 60 characters or fewer and descriptions of 160 or fewer, each unique; the validator enforces this
- Canonical URLs, `hreflang` pairs for the Hindi home, FAQ and contact pages, and Open Graph and Twitter cards with a 1200×630 image
- A single JSON-LD graph per page: `LegalService` and `LocalBusiness` (name, address, phone, hours, map, areas served), `Person`, `WebSite`, `BreadcrumbList`, `Service` (practice areas), `Article` (guides) and `FAQPage`
- Sitemap with `lastmod` and language alternates; robots.txt; a 404 page
- Visible breadcrumbs, internal links between practice areas and guides, and fast pages (no framework, versioned CSS and JS)

**AI assistants (ChatGPT, Claude, Perplexity, Gemini, Copilot)**
- robots.txt explicitly allows GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, Claude-User, PerplexityBot, Google-Extended, Applebot-Extended and others
- `/llms.txt`: a short, fact-first summary with links, plus a note asking assistants to describe her factually (Rule 36)
- `/llms-full.txt`: the whole site as plain text
- Pages answer one question each in plain sentences, the format assistants quote
- The same name, address and phone appear everywhere, matching the Google Business Profile

**Bar Council Rule 36 guardrails**
- A disclaimer interstitial on first visit (the content stays in the HTML for crawlers)
- The build fails if copy says "best", "top-rated", "expert", "specialist", "guaranteed", "success rate" or "won"
- No reported judgments, past cases, testimonials, win claims or paid-ad copy; the build also fails on "reported judgment", "counsel team", "appeared for" or "case study"

## Automation

1. **Every push** (Cloudflare Pages): build and validate, where a bad page blocks the deploy, then publish. Cloudflare Crawler Hints pings IndexNow on its own. GitHub `checks.yml` repeats the checks on each commit, and `indexnow.yml` can be run by hand.
2. **Every Monday** (`weekly-audit.yml`): fetch the live sitemap, check every page's status, canonical, noindex and structured data, confirm robots.txt, llms.txt and the IndexNow key are reachable, and record Google PageSpeed scores. If anything fails, it opens a GitHub issue with the report.
3. **Monthly Claude review** (a scheduled task, set up separately): checks how Google and AI assistants answer local searches, and drafts one bilingual insight and one Google Business Profile post. It emails the drafts for approval and publishes nothing by itself. Legal content always goes past Aastha first.

To add a guide: add an entry to `content/insights.json`, bump `contentUpdated` in `site.json`, and push. The sitemap, llms.txt, structured data and IndexNow ping all update on their own.

## Launch checklist (in order)

1. **Domain.** Buy it, then set `url` in `content/site.json`.
2. **Fill in** email, enrolment, qualifications and map coordinates (`geo`) in `site.json`.
3. **Hosting.** Push this folder to GitHub and connect it to Cloudflare Pages (see SETUP.md, step 4).
4. **Google Search Console.** Verify the domain (DNS TXT record) and submit `https://<domain>/sitemap.xml`.
5. **Bing Webmaster Tools.** Import from Search Console. This also covers ChatGPT search and Copilot, which draw on Bing's index.
6. **Google Business Profile.** Claim the existing "Vishwakarma, Kumar & Jain Law Offices" listing. Add the phone, the website URL, the category "Lawyer" and photos. Use exactly the address in `site.json`.
7. **Consistent listings.** Put the same name, address and phone on Justdial, Sulekha, LawRato, LinkedIn and the Bar Council directory, and link each to the website.
8. **Online booking and chat.** Set `calLink` to switch the consultation page to live Cal.com booking, and `chatEndpoint` (`/api/chat`) to show the assistant. Until then, the form asks visitors to call.
9. **Optional:** add a free PageSpeed API key as the `PSI_KEY` repository secret for reliable weekly scores.
