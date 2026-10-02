# Go-live setup — the steps only a person can do

Claude has built and tested everything else. Each step below needs a login, a payment or a verification, so it is yours. Do them in order and send Claude the value marked **→ send**. Claude then updates the code and pushes it.

Never paste passwords or API keys into the chat. Enter them only in the dashboards named below.

---

## 1. Domain (₹900–1,100 a year)
1. At Hostinger, GoDaddy or BigRock, search for `aasthavishwakarma.in`. Fallbacks: `advaasthavishwakarma.in`, `aasthavishwakarma.co.in`.
2. Buy 2–3 years with auto-renew. Skip hosting, email and builder add-ons.
3. **→ send:** the domain.

## 2. Cloudflare (free)
1. Sign up at dash.cloudflare.com, choose **Add a domain**, enter the domain and pick the **Free** plan.
2. Copy the two nameservers Cloudflare shows. At the registrar, open the domain's nameserver settings, replace the existing ones with those two, and save.
3. Wait until Cloudflare shows the domain as **Active** (minutes to a few hours). **→ send:** "Cloudflare active".

## 3. GitHub (free)
1. At github.com, create a **private, empty** repository named `aastha-site` (no README).
2. **→ send:** `owner/aastha-site`. Claude attaches it and pushes the code.

## 4. Put the site live on Cloudflare Pages (free)
1. In Cloudflare, go to **Workers & Pages**, then **Create**, then **Pages**, then **Connect to Git**, and pick `aastha-site`.
2. Use these build settings:
   - Framework preset: **None**
   - Build command: `node build.mjs && node scripts/validate.mjs`
   - Build output directory: `dist`
   - Environment variable: `NODE_VERSION` = `20`
3. Choose **Save and Deploy**. Then, under **Custom domains**, add the domain and `www.<domain>`.
4. Under **Rules**, then **Redirect Rules**, create a rule from **www to root** (Cloudflare offers it as a template).
5. Under **Caching**, then **Configuration**, turn **Crawler Hints** on. Cloudflare will then notify Bing and other IndexNow engines when pages change.
6. Optional: under **Security**, then **WAF**, then **Rate limiting rules**, add a rule: if the URI path equals `/api/chat`, allow 20 requests per minute per IP, then block. This protects the chatbot budget.
7. **→ send:** "site live". Claude checks every page, robots.txt, the sitemap and llms.txt on the real domain.

## 5. Email on the domain — Zoho Mail Lite (₹59 a month + GST, billed yearly)
1. Sign up at zoho.com/mail, choose **Mail Lite (5 GB)** and add the domain.
2. Zoho shows a TXT record for verification, then MX, SPF and DKIM records. Add each one in Cloudflare under **DNS**, then **Records**, set to **DNS only** (grey cloud).
3. Add a DMARC record too: type `TXT`, name `_dmarc`, content `v=DMARC1; p=quarantine; rua=mailto:<the new address>`.
4. Create the mailbox, for example `office@<domain>`, and send a test email both ways.
5. **→ send:** the email address to show on the site.

## 6. Search engines and Google listing (free)
1. **Google Search Console:** add a **Domain** property and add the TXT record it gives you in Cloudflare DNS. Once verified, go to **Sitemaps** and submit `sitemap.xml`.
2. **Bing Webmaster Tools:** sign in, choose **Import from Google Search Console**, and submit the sitemap.
3. **Google Business Profile:** search the firm name on Google and choose **Own this business?**, then complete the verification (video or postcard). Add the phone, the website, the category **Lawyer**, the hours and photos.
4. Update Justdial, Sulekha and LawRato so they show exactly the same name, address and phone, with the website link.
5. **→ send:** "search done". Claude records an AI-visibility baseline.

> **Paused on Rule 36 advice (26 September 2026).** A review of the site under Rule 36 advised against online booking, free-consultation offers, fees and promotional calls to action. Steps 7–10 below (Cal.com booking, the booking chatbot, WhatsApp confirmations and payments) are therefore on hold, and the website carries only factual professional information and office contact details. The Worker code stays in `workers/` in case the advice changes; nothing in it is deployed.

## 7. Booking synced to Apple Calendar — Cal.com (free)
1. On Aastha's Apple ID (two-factor on), go to appleid.apple.com, then **Sign-In and Security**, then **App-Specific Passwords**, and create one named `Cal.com`.
2. At cal.com, sign up with the office email. Open **Apps**, choose **Apple Calendar**, and enter the Apple ID and that app-specific password. Select her calendar to check for clashes and to receive new bookings.
3. Under **Availability**, set the hours she actually takes consultations.
4. Under **Event types**, create a new event called **First meeting**, 30 minutes, with:
   - Locations: In person (the office address), Cal Video or Google Meet, and Phone
   - Booking questions: make **Phone number** required
   - Limits: 15-minute buffer after, 12 hours minimum notice
5. **→ send:** the public link (`cal.com/<username>/first-meeting`) and the event's number (in the URL when you edit it). Claude switches the consultation page to live booking.

## 8. Chatbot — Claude API (\$5–10 prepaid, then about ₹500–1,000 a month)
1. At console.anthropic.com, create an organisation. Under **Billing**, add \$5–10 of credit. Under **Limits**, set a monthly spend limit of \$15.
2. Create an API key named `aastha-chat` and keep it private.
3. At cal.com, go to **Settings**, then **Developer**, then **API keys**, and create a key.
4. In Cloudflare, go to **Workers & Pages**, then **Create**, then **Worker**, name it `aastha-chat` and deploy it. Then choose **Edit code**, paste the contents of `workers/chat/src/index.js`, and deploy again.
5. Under the Worker's **Settings**, then **Variables and Secrets**, add:
   - Secret `ANTHROPIC_API_KEY`
   - Secret `CAL_API_KEY`
   - Text `CAL_EVENT_TYPE_ID` (the event number from step 7)
   - Text `ALLOWED_ORIGIN` = `https://<domain>`
   - Text `MODEL` = `claude-haiku-4-5-20251001`
6. Under **Settings**, then **Domains & Routes**, add the route `<domain>/api/chat`.
7. **→ send:** "chat worker ready". Claude turns on the assistant button and tests it.

## 9. WhatsApp confirmations — Meta WhatsApp Cloud API (about ₹0.14 a message)
1. At business.facebook.com, create or verify the business (firm name and address; documents may be requested).
2. In **WhatsApp Manager**, add a phone number. Either use Meta's coexistence option to keep the WhatsApp Business app on the office number, or use a separate number.
3. Create two templates in the **Utility** category, language **English**. Hindi versions can follow later.
   - `booking_confirmation`: `Hello {{1}}, your consultation with Advocate Aastha Vishwakarma is confirmed for {{2}} ({{3}}). Office: B-8, Vaishali Colony, Bhotia Parao, Haldwani. To reschedule, use the link in your confirmation email or call +91 88020 29468.`
   - `appointment_reminder`: `Reminder: your consultation with Advocate Aastha Vishwakarma is on {{1}} ({{2}}). Office: B-8, Vaishali Colony, Bhotia Parao, Haldwani. Call +91 88020 29468 if you need to change it.`
4. In **Business Settings**, create a **System user** and generate a permanent token with the `whatsapp_business_messaging` permission. Also copy the **Phone number ID** from WhatsApp Manager, then **API setup**.
5. In Cloudflare, create the Worker `aastha-whatsapp` the same way as step 8 and paste `workers/whatsapp/src/index.js`.
   - Add secrets `WA_TOKEN`, `CAL_API_KEY` and `CAL_WEBHOOK_SECRET` (a long random phrase you choose).
   - Add text variables `WA_PHONE_ID`, `TEMPLATE_CONFIRM` = `booking_confirmation`, `TEMPLATE_REMIND` = `appointment_reminder` and `TEMPLATE_LANG` = `en`.
   - Under **Settings**, then **Triggers**, add the cron `0 * * * *`, and add the route `<domain>/webhooks/cal`.
6. At cal.com, go to **Settings**, then **Developer**, then **Webhooks**. Add the URL `https://<domain>/webhooks/cal`, events **Booking created** and **Booking rescheduled**, and the same secret phrase.
7. Make a test booking with your own number. **→ send:** "whatsapp ready".

## 10. Payments — only when paid follow-up consultations start (Razorpay, 2% + GST per payment)
1. Sign up at razorpay.com and complete KYC with PAN and a bank account.
2. Create a **Payment Page** for follow-up consultations and put its link in the written fee note. The first meeting stays free, with no payment step.

---

Everything Claude does between your steps, such as filling in site.json, switching features on, pushing code, running checks and testing the live site, is listed in `README.md`. The offline tests for both Workers run with `node workers/test.mjs`.

---

## 11. Weekly SEO agent (about 10 minutes, once)

Every Tuesday at 10:15 IST, Claude audits the site with the open-source **claude-seo** plugin (AgriciDaniel/claude-seo, MIT licence) and reads Search Console. It makes safe technical fixes and drafts one educational guide in English and Hindi, then opens a **pull request**. Nothing is published until Aastha reviews and merges it; merging deploys through Cloudflare.

1. **Anthropic API key.** At console.anthropic.com, create a key named `aastha-seo-agent` and set a monthly spend limit (for example $10). In GitHub, go to `lawrekak/aastha-site` → **Settings → Secrets and variables → Actions → New repository secret**, name it `ANTHROPIC_API_KEY` and paste the key.
2. **Let Actions open pull requests.** Go to **Settings → Actions → General → Workflow permissions**, select **Read and write permissions**, and tick **Allow GitHub Actions to create and approve pull requests**.
3. **Protect `main` (recommended).** Go to **Settings → Branches → Add rule** for `main` and turn on **Require a pull request before merging**. The agent can then never change the live site without a human merge.
4. **Articles on or off.** Articles are on by default. If Aastha doesn't want to review a weekly draft yet, add a repository **variable** (not a secret) named `DRAFT_ARTICLES` with the value `false`. The agent then only makes technical fixes and reports.
5. **Search Console data (optional, recommended):**
   1. In Google Cloud Console, create a project, enable the **Google Search Console API**, then create a **service account** and a JSON key for it.
   2. In Search Console, go to **Settings → Users and permissions → Add user**, enter the service account's email and choose **Restricted** access.
   3. In GitHub, add the whole JSON file's contents as the secret `GSC_SERVICE_ACCOUNT_JSON`.
6. **Test run.** Go to **Actions → Weekly SEO agent → Run workflow**. A pull request labelled `seo` should appear within about 20 minutes.

**Monthly report:** on the 1st of each month, **Monthly SEO report** files a GitHub issue with Search Console totals, top queries and pages, and the live-site audit.

**Listings:** see `CITATIONS.md`. Listings and citations are done by hand; there is no automated link building.

**Cost:** one agent run typically uses a few hundred thousand tokens of Claude Sonnet, roughly $1–3 (about ₹100–300) a week, so ₹400–1,200 a month. The spend limit caps it.

## 12. Daily blog (uses the same API key as step 11)

Every day at 06:20 IST, `.github/workflows/daily-blog.yml` runs Claude with the **daily-law-blog** skill (`.claude/skills/daily-law-blog/SKILL.md`). Claude picks a current legal topic people in Uttarakhand are searching for, writes a two-minute post in English with a Hindi summary, checks it against the Rule 36 validator and opens a pull request labelled `blog`.

1. Complete steps 11.1 and 11.2 (the `ANTHROPIC_API_KEY` secret and letting Actions open pull requests).
2. **Review each morning.** GitHub emails the repository owner when a pull request opens. Open it, read the post and the "For Aastha to check" list, then:
   - **Merge** to publish. Cloudflare deploys in about a minute.
   - **Close** it to drop the post.
   - To fix a word, edit the file in the pull request (the pencil icon), then merge.
3. **Let Aastha review directly (recommended).** Give her a free GitHub account and add her under **Settings → Collaborators**. She can then review and merge from the GitHub mobile app.
4. **Pause.** Add the repository variable `BLOG_PAUSED` = `true` to stop the daily run, for example during court vacations.
5. **Test now.** Go to **Actions → Daily blog post → Run workflow**.

Cost: about $0.30–1 a run, so roughly ₹800–2,500 a month on top of the weekly agent. The spend limit on the API key caps it.

## 13. Weekly keyword refresh (no extra setup)

Every Thursday, `.github/workflows/weekly-keywords.yml` researches the week's searches and proposes small updates to the 50 target keywords as a pull request labelled `keywords`. It uses the same `ANTHROPIC_API_KEY` as steps 11 and 12. Until that key is added, it files the research as an issue instead. Connecting Search Console (step 11.5) lets it use the site's real search queries. To run it now, go to **Actions → Weekly keyword refresh → Run workflow**.

## 14. Google Analytics and the daily report

**Status (2 Oct 2026): live.**
- Analytics account "Aastha Vishwakarma, Advocate" (410488037), owned by kakerwalharsh@gmail.com; property `advaasthavishwakarma.in` (557105503); web stream measurement ID `G-ENFEMQXGRX`.
- India time zone, INR; data sharing options all off; Google signals off; data retention 2 months.
- Service account `aastha-seo-reader@aastha-seo.iam.gserviceaccount.com` is a Viewer, with the Google Analytics Data API enabled in Cloud project `aastha-seo`.
- Reports post to issue #14.
- To give Aastha access: in GA4, go to Admin → Account access management → add her Google account as Administrator.

The site has Google Analytics 4 built in, but it stays off until a measurement ID is added. Once switched on, the tag loads only after a visitor selects "I agree" on the Bar Council disclaimer. Advertising features and Google signals are off. The disclaimer and the privacy notice tell visitors this. Selections of the phone number, email address, map link and WhatsApp are counted as events (`contact_phone`, `contact_email`, `contact_map`, `contact_whatsapp`).

1. **[Owner] Create the property.** At analytics.google.com, signed in with the Google account that should own the data:
   - Admin → Create → Property. Name it "advaasthavishwakarma.in", time zone India, currency INR.
   - Then add a **Web** data stream for `https://advaasthavishwakarma.in`.
   - Leave Enhanced measurement on.
2. **[Owner] Change two settings in Admin:**
   - Data collection and modification → Data retention → set **2 months**.
   - Data collection → leave **Google signals off**.
3. **Send Claude two values:**
   - the **Measurement ID** (G-…), from the data stream;
   - the numeric **Property ID**, from Admin → Property details.

   Both go into `content/site.json` as `ga4` and `ga4PropertyId`. Neither is a secret: the measurement ID is public in every page.
4. **[Owner] Give the report read access:**
   - In Google Cloud Console, use the same project as the Search Console service account (step 11.5) and enable **Google Analytics Data API**.
   - In GA4 → Admin → Property access management, add the service account's email as **Viewer**.
   - If the `GSC_SERVICE_ACCOUNT_JSON` secret already exists, nothing else is needed. Otherwise add the JSON key as the secret `GA4_SERVICE_ACCOUNT_JSON`.
5. **Daily report.** `.github/workflows/daily-analytics.yml` runs every day at 09:45 IST. It adds a comment to the issue **Daily Google Analytics report** (label `analytics`), covering:
   - yesterday against the day before and the same day last week;
   - the last 7 days against the previous 7;
   - channels and sources, landing pages, top pages, contact selections, cities, devices;
   - the most-read blog posts.

   To get these by email, **Watch** the repository ("All activity" or "Participating and @mentions" plus subscribing to the issue). To test it, go to Actions → Daily Google Analytics report → Run workflow. It uses no Claude, so it costs nothing.

