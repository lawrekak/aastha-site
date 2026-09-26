---
name: advocate-citations
description: Audit and plan the online listings (citations) and links for the website of Aastha Vishwakarma, Advocate, within Bar Council of India Rule 36 and Google's spam policies. Use when reviewing listings, name/address/phone consistency, sameAs profiles or link opportunities. Audit and suggest only; never submit, post or create accounts.
---

# Advocate citations and links (India, Rule 36)

This skill is adapted from the local-citations and local-link-building skills in garrettjsmith/localseoskills (MIT licence), changed for an Indian advocate.

## Never do these

- Create accounts, sign in, fill in or submit forms, or solve verification.
- Post comments, forum answers, Quora answers or reviews anywhere.
- Buy or exchange links.
- Suggest listings on Justdial, Sulekha, Quikr, Grotal or paid lawyer-lead portals. The BCI issued cease-and-desist notices over these in July 2024, after the Madras High Court's judgment of 3 July 2024; the Supreme Court appeal is pending.
- Use US legal directories (Avvo, FindLaw, Justia, Martindale). They don't apply.
- Suggest asking for reviews or ratings, or using "best", "top" or "expert".

## Steps

1. Run `node scripts/citations-audit.mjs` and read `citations-report.md`.
2. For each live listing, report whether the name, phone and website match `content/site.json` exactly. Flag anything that could not be checked automatically, such as LinkedIn sign-in walls.
3. Check the Google Business Profile with the claude-seo local and maps review, if it is available. Report the categories, website link, hours and map pin.
4. Look for **editorial** opportunities only. These are law portals or local newspapers that accept articles from advocates on a topic her blog already covers. List two or three, each with the publication, a suggested angle and the link to its submission guidelines. Aastha writes and submits them herself.
5. Put everything in the pull request under "Listings and links (for a person to do)". Change `content/citations.json` only to correct a URL or status that you can verify from a public page.
