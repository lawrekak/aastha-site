---
name: daily-law-blog
description: Write one short, plain-language blog post a day for the website of Aastha Vishwakarma, Advocate (Haldwani), on a current legal topic people in Uttarakhand are searching for, within Bar Council of India Rule 36. Use when asked to write or draft the daily blog post.
---

# Daily law blog post

You write **one** post a day for https://advaasthavishwakarma.in/blog/, published under the name of Aastha Vishwakarma, Advocate. Readers are ordinary people in Haldwani, Nainital and the rest of Uttarakhand, not lawyers. They should understand the key point in **two minutes**.

Each post goes into a pull request. It is published only after Aastha reviews and merges it. You never push to `main`.

## Hard rules (Bar Council of India Rule 36 and professional conduct)

The post is **education, not promotion**:
- No "best", "top", "leading", "expert", "specialist", "guaranteed", "affordable", "trusted" or any comparative or self-praising wording.
- No call to action: no "contact us", "call", "book", "consult us", phone numbers, email addresses or WhatsApp. "Take legal advice on your own facts" is the most you may say.
- Never mention, hint at or search for any case Aastha has handled. No outcomes, clients, testimonials or "we".
- Write in the neutral third person or second person ("you"). Don't write "I won" or "our firm".

Write responsibly about courts and people:
- Report only what a court has actually held or ordered. Don't predict outcomes or comment on the merits of a pending case.
- **Never name** the following people or anyone who could identify them:
  - victims of sexual offences;
  - children;
  - parties to matrimonial or custody disputes;
  - private individuals accused in criminal cases.
- No political opinion. When a law or policy is contested, explain what it says and what it means for the reader, not whether it is good.

Get the facts right:
- Check every legal statement against a **primary or official source**: India Code (indiacode.nic.in), the Gazette, the Supreme Court or High Court of Uttarakhand websites, government portals (e.g. ucc.uk.gov.in), or the judgment itself.
- News reports alone are enough for the *news hook*, never for the law.
- Use the current section numbers. For criminal law, use BNS, BNSS and BSA and give the old IPC, CrPC or Evidence Act number in brackets.
- If you cannot confirm a point, leave it out.

## Step 1 — choose today's topic

1. Read what already exists, and do not repeat a topic from the last 60 days:
   - `ls content/blog/`;
   - `gh pr list --label blog --state all --limit 30`.
2. Find what people are asking about **now**. Use WebSearch for news from the last 3 days, in this order:
   - High Court of Uttarakhand orders and news (e.g. "Uttarakhand High Court" with this week's date, LiveLaw or Bar and Bench Uttarakhand pages, highcourtofuttarakhand.gov.in court news);
   - Uttarakhand government legal changes: UCC rules, land and property law (bhu kanoon), service and recruitment rules, notifications;
   - Supreme Court judgments that change something for ordinary people;
   - new central rules affecting the practice areas below.

   If `gsc-report.md` exists, prefer topics that match its queries.
3. The topic must fit one of these practice areas. Its index number goes in `area`:
   - 0 education and service law
   - 1 District Court practice (cheque bounce, recovery, civil suits, bail)
   - 2 matrimonial and family
   - 3 constitutional and writ
   - 4 criminal appeals and white-collar
   - 5 property and land
   - 6 insolvency (IBC)
   - 7 tribunals (CAT, NCLAT)
4. **Target keywords.** `content/keywords.json` lists the 50 searches the site targets. The entries with `"intent": "info"` are questions people ask, such as "cheque bounce case time limit", "mutual divorce process", "138 ni act kya hai", "dakhil kharij uttarakhand" and "cat case status". On days without strong news, answer one of them that no post covers yet. Use the phrase naturally in the title or the first heading, and put the Hindi or Hinglish form in `keywords` and the Hindi title. Never stuff keywords, and never use one that says "best", "fees" or similar.
5. If nothing new fits, write an evergreen explainer that people search for, linked to something seasonal or current. Examples:
   - how long you have to file a cheque-bounce complaint;
   - mutation (dakhil-kharij) of land in Kumaon;
   - interim maintenance;
   - what anticipatory bail means.

   Rotate the areas, but favour family law, property and land, and cheque bounce, which people search for most in Haldwani and Nainital.

## Step 2 — write the post

Create `content/blog/<YYYY-MM-DD>-<slug>.json`, using today's date (`date +%F`):

```json
{
  "title": "Plain question or statement, under 60 characters",
  "slug": "lowercase-hyphenated-4-to-7-words",
  "published": "YYYY-MM-DD",
  "area": 2,
  "desc": "70–160 characters: the answer in one sentence, with the place name if natural (Uttarakhand, Haldwani, Nainital).",
  "keywords": ["3–6 phrases people actually search, English and Hinglish, e.g. 'mutual divorce Haldwani'"],
  "why": "One sentence: why this matters today (the news hook or the everyday problem).",
  "keyPoints": ["3–4 bullets, each under 25 words — the whole post in brief"],
  "sections": [
    {"h": "Short heading as a question people ask", "p": ["2–4 short paragraphs, 2–3 sentences each"]}
  ],
  "whatToDo": ["2–4 practical, neutral steps a reader can take themselves (documents to keep, deadlines, where to check status online)"],
  "hi": {"title": "Hindi title", "keyPoints": ["the same key points in simple Hindi"], "p": ["one short Hindi paragraph (optional)"]},
  "sources": [{"title": "Name of official source", "url": "https://..."}]
}
```

Style:
- **250–450 words** in English, counting `why`, `keyPoints`, `sections` and `whatToDo`. The validator rejects anything under 200 or over 600.
- 2–3 sections. Headings are questions a person would type into Google.
- Short sentences, mostly under 20 words, at about a Class 8 reading level. Explain any legal term in brackets the first time, e.g. "maintenance (monthly support)".
- Start with the answer, not the background. Numbers and deadlines beat adjectives.
- **Answer-first passage (so AI search can quote it).** The first paragraph of the first section must answer that section's question on its own, in 40–80 words. AI assistants quote passages like this word for word. It must:
  - repeat the subject by name, with no "it" or "this" that depends on earlier text;
  - name the law and section, the court or authority, and the place (Uttarakhand, Haldwani, Nainital);
  - include at least one concrete number: a deadline, an amount, a year or a section.

  Example: "A cheque bounce complaint under section 138 of the Negotiable Instruments Act must be filed within one month after the 15-day notice period ends. In Haldwani it goes to the Judicial Magistrate's court. If the complaint is late, the court can condone the delay only for a sufficient reason."
- Name local institutions only where they are factually relevant: the Family Court at Haldwani, the District Court at Nainital, the High Court of Uttarakhand at Nainital.
- The Hindi must be natural, simple Hindi (Devanagari), faithful to the English, not word-for-word.
- Give 1–4 sources, official ones first. They are shown on the page.

## Step 3 — check

Run `node build.mjs && node scripts/validate.mjs`. It must print "No errors". Fix whatever it reports and run it again.

## Step 4 — the review note

Write `.blog-pr.md` (it is not committed; the workflow uses it as the pull request text). Include:
- **Topic and why today:** one line, with the news link that prompted it.
- **For Aastha to check:** a checklist of each legal statement in the post, each with the source that supports it.
- **Anything uncertain:** points you left out and why.
- A last line: "Merge to publish. Close without merging to drop it."

Do not commit, push or open the pull request yourself. The workflow does that.
