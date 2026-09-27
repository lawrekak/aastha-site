# Listings, citations and links: what is done, what is not, and why

**Updated 27 September 2026.** This replaces the earlier advice to update Justdial, Sulekha and LawRato.

## The rules this follows

1. **Bar Council of India Rule 36.** Advocates may not solicit work or advertise, directly or indirectly.
   - On 3 July 2024 the Madras High Court directed the Bar Councils to act against advocates who advertise or solicit through online service providers.
   - The BCI then issued cease-and-desist notices to Quikr, Sulekha, Justdial and Grotal over advocate listings, and asked State Bar Councils to act.
   - Sulekha's appeal is pending in the Supreme Court. The Court issued notice on 13 November 2024; no stay has been reported.

   Until that is decided, a paid or promotional listing on these portals is a professional-conduct risk.
2. **Google's spam policies.** Links placed by automated programs, links in blog or forum comments, and paid links are all treated as link spam. Sites that use them can be demoted or removed from Google Search. For a two-week-old site, that could undo everything else.
3. **No account creation or posting by Claude.** Accounts, passwords and verification stay with Aastha.

## So the approach is

| Do | Don't |
|---|---|
| Factual map listings: Google Business Profile, Bing Places, Apple Business Connect | Justdial, Sulekha, Quikr, Grotal, paid lead portals (LawRato and similar) |
| Bar Council and Bar Association records kept current | Comments on blogs, forums or Quora with links to the site |
| LinkedIn profile with the website | Directory-submission tools, link packages, "100 backlinks" services |
| Articles she writes for legal-knowledge websites, with an author line | Paid placements, link exchanges, "top lawyer" awards or badges |
| The same name, address and phone everywhere | Asking clients for reviews or ratings |

## How it works in this repository

- **`content/citations.json`** records every listing, its status and its URL. Live URLs are added to the site's structured data automatically, telling Google that these profiles are the same person.
- **`listings/KIT.md`** has ready-to-paste, factual text for each platform, with categories and settings.
- **`scripts/citations-audit.mjs`** runs in the monthly report on the 1st. It checks that each live listing still shows the same name, phone and website, and lists what is still to do.
- **`.claude/skills/advocate-citations/SKILL.md`** is the skill the weekly SEO agent uses to review citations. It only audits and suggests; it never submits.

## Status

| Listing | Status |
|---|---|
| LinkedIn | Live. Update the headline, About and website (see KIT section 4). |
| Google Business Profile | Live and verified. Categories set 27 Sep 2026 (Law firm, Lawyer, Divorce lawyer, Family Lawyer); phone present. Services added 27 Sep 2026 (pending Google review). Still to do: exterior photo, decide on the WhatsApp chat link, review the older generic services. |
| Google Business Profile: Aastha (practitioner listing) | Live 27 Sep 2026 (/g/11zxxc4ysy); linked from the site's structured data. Categories Divorce lawyer, Family Lawyer, Lawyer; all services added (pending Google review). Still to do: upload her photo; check the phone shows publicly after review. |
| Bing Places | Ready: import from Google Business Profile |
| Apple Business Connect | To create (KIT section 3) |
| Bar Council / Bar Association records | Check |
| Alumni network | Optional |
| Justdial (existing listing) | Aastha to decide whether to ask Justdial to remove it, given the BCI notice. Don't update or pay to promote it. |
