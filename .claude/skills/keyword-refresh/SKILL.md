---
name: keyword-refresh
description: Weekly refresh of the 50 target keywords for the website of Aastha Vishwakarma, Advocate (Haldwani), from Google India autocomplete and Search Console, within Bar Council of India Rule 36. Use when asked to review, refresh or update the site's keywords.
---

# Weekly keyword refresh

The site targets exactly **50** keywords, listed in `content/keywords.json`. Each keyword is mapped to one page and marked `local` (someone looking for a lawyer) or `info` (someone asking how the law works). Your job each week is to keep that list aligned with what people in Haldwani, Nainital and Uttarakhand actually search. Change as little as possible: small, evidence-based swaps. Never churn the list.

## Inputs

- `keyword-report.md` and `keyword-candidates.json`, written by `node scripts/keyword-research.mjs`. They contain this week's Google India autocomplete suggestions (English and Hindi) for the seeds in `content/keywords.json`, plus Search Console queries if connected. The file is already filtered for Rule 36 and relevance, and each candidate is scored.
- `gsc-report.md`, if present: clicks, impressions and positions.

**If the report says most autocomplete calls failed**, don't swap any keywords. Report the failure and stop.

## Rules (never break these)

- **No promotional or pricing words.** No "best", "top", "fees", "free", "cheap", "affordable", "expert", "specialist", "consultation", "reviews" or "hire", in any language. The validator rejects them.
- **No other advocates' names.** No keyword for places or courts where she doesn't practise.
- **Map only to what her practice area pages already list** as typical matters. For example, "anticipatory bail" maps to the District Court page, because that is where she lists it.
- **No visible keyword lists and no meta keywords tag.** Keywords live in `content/keywords.json`, which feeds the structured data, and in natural page titles and descriptions.
- **Don't add explanatory legal text to practice pages.** It was deliberately removed. Questions people ask (`info` keywords) are answered by the daily blog, not by the practice pages.

## Steps

1. **Read the report.** Compare the current 50 with this week's candidates.
2. **Swap at most 5 keywords.** Replace a current keyword only when all three of these are true:
   - it has not appeared for **3 consecutive weeks** (check `history` in `content/keywords.json`);
   - a candidate scores clearly higher, or has Search Console impressions;
   - the candidate passes the rules above.

   Keep the total at exactly 50. Keep at least 2 keywords per practice area and at least 3 Hindi or Hinglish keywords.
3. **Search Console first.** Once connected, a query with impressions that maps to one of her areas beats any autocomplete-only candidate. If a page ranks at positions 8–20 for a `local` keyword and the page title doesn't contain it, you may reword that page's `seoTitle` or `desc` in `content/areas.json` so it does. Titles must be 60 characters or fewer and descriptions 70–160, and the result must still read naturally and state only facts. Change at most 2 titles a week.
4. **Seeds.** If a strong new theme keeps appearing, add it as a seed under the right page in `seeds` (at most 3 new seeds a week).
5. **History.** Append one entry to the `history` array in `content/keywords.json`:

   ```json
   {"week": "YYYY-MM-DD", "calls": 0, "gscRows": 0, "added": [], "removed": [], "notSeen": ["current keywords missing this week"]}
   ```

   Keep the last 12 entries. Set `updated` to today.
6. **Check.** Run `node build.mjs && node scripts/validate.mjs`. It must report no errors.
7. **Review note.** Write `.kw-pr.md` with:
   - what changed and why (the evidence for each swap);
   - the top 10 new candidates you did *not* take, and why;
   - any title changes, before and after;
   - Search Console highlights;
   - a last line: "Merge to apply. Close without merging to keep last week's keywords."

   If you changed nothing but the history entry, say so.

Do not commit, push or open the pull request yourself. The workflow does that.
