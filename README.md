# Marchand Wealth

The marketing site, client tools (quote, TFSA calculator, financial plan, client intake, investor questionnaire), contact form, and meeting scheduler for **Marchand Wealth** (legal name: Marchand Financial Solutions Inc.), an independent insurance and wealth planning practice serving incorporated business owners in Sherwood Park and the greater Edmonton region.

**Live site:** [marchandwealth.ca](https://marchandwealth.ca)

---

## What's in here

| Page | Purpose |
|---|---|
| [`index.html`](index.html) | Homepage — services, why-independent pitch, about, FAQ |
| [`life-insurance-quote.html`](life-insurance-quote.html) | Free instant life insurance quote tool — Compulife quoter embedded in an iframe, plus SEO content and FAQ |
| [`tfsa-calculator.html`](tfsa-calculator.html) | Free public tool: whether a planned monthly contribution catches up your TFSA room (and when), plus projected retirement balance and income |
| [`needs-analysis.html`](needs-analysis.html) | Simplified financial plan — life insurance need, protection amounts, and retirement savings path. Entries stay in the browser tab |
| [`client-intake.html`](client-intake.html) | Client intake form — one question at a time, submitted via Netlify Forms with a link that opens the financial plan pre-filled |
| [`investor-questionnaire.html`](investor-questionnaire.html) | Investor profile questionnaire — 13 questions, six risk profiles, Netlify submission with a re-open link, and a PDF download. See [The investor questionnaire](#the-investor-questionnaire) |
| [`insights.html`](insights.html) | Blog index — article cards rendered from [`insights-data.js`](insights-data.js) |
| [`insight.html`](insight.html) | Blog post template — renders whichever post matches the URL, also from `insights-data.js` |
| [`contact.html`](contact.html) | Contact page — advisor intro up top, detailed contact form below, submitted via Netlify Forms |
| [`schedule.html`](schedule.html) | Meeting booking, embedded Google Calendar appointment scheduler |

No framework, no JS bundler. Every page is a standalone HTML file. `npm run build` compiles Tailwind's CSS and pre-renders the Insights articles — see [Editing styles](#editing-styles) and [The blog](#the-blog-insights).

---

## Tech stack

- **HTML** — plain, semantic, one file per page
- **[Tailwind CSS](https://tailwindcss.com) v3** — compiled locally to a static production stylesheet, **not** the CDN script. See [Editing styles](#editing-styles) — this is the one workflow change from how this project used to work.
- **Vanilla JavaScript** — a shared [`script.js`](script.js) plus one script per tool, no bundler. The only third-party library is jsPDF, vendored for the questionnaire PDF
- **Fonts** — [Fraunces](https://fonts.google.com/specimen/Fraunces) (serif headings) + [Inter](https://fonts.google.com/specimen/Inter) (body), loaded from Google Fonts
- **Hosting** — [Netlify](https://netlify.com)
- **Forms** — [Netlify Forms](https://docs.netlify.com/forms/setup/) (no external form backend)
- **Analytics** — Google Analytics 4 (`gtag.js`)

---

## Project structure

```
marchand-site/
├── index.html                  Homepage
├── contact.html                Contact page — advisor intro + contact form (Netlify Forms)
├── schedule.html               Meeting scheduler (Google Calendar embed)
├── life-insurance-quote.html   Instant life insurance quote tool (Compulife iframe)
├── tfsa-calculator.html        TFSA contribution & retirement calculator
├── needs-analysis.html         Financial plan
├── needs-analysis/             Plan UI, annual figures, and calculation tests
│   ├── js/                     Worksheet UI and calculators (ES modules)
│   ├── data/                   CPP, OAS, tax, TFSA, RRSP, inflation, probate figures
│   └── tests/                  `npm run test:needs-analysis`
├── client-intake.html/.js      Client intake form (Netlify Forms)
├── investor-questionnaire.html/.js  Investor questionnaire and its PDF
├── investor-profiles.js        Six investor profiles and return rates, shared by
│                               the questionnaire, intake, and plan
├── insights.html               Blog index (article cards)
├── insight.html                Blog post template
├── insights/                   Pre-rendered posts (generated — don't hand-edit)
├── insights-data.js            Blog post content — see below
├── scripts/build-insights.js   Builds insights/ and the insights.html grid
├── script.js                   Shared JS — nav, FAQ accordions, contact form,
│                               TFSA calculator engine, blog rendering
├── tfsa-limits.js              TFSA annual contribution limits — see below
├── tailwind.config.js          Brand colours, fonts, and content-scan paths
├── src/tailwind.css            Source CSS — Tailwind directives + custom rules
├── assets/
│   ├── css/site.css            Compiled Tailwind CSS (generated — don't hand-edit)
│   ├── vendor/                 jsPDF and its licence
│   ├── logo.png                Full "Marchand Wealth" wordmark logo
│   ├── logo-social.png         Social sharing image
│   ├── ethan-headshot.jpg      Footer and about photo
│   └── icon.png                Icon-only shield mark (favicon + hero illustration)
├── package.json                `npm run build`, `npm run watch:css`, tests
├── netlify.toml                Build command and redirects
├── sitemap.xml, robots.txt, llms.txt
```

---

## The TFSA calculator

This is the most involved piece of the site, so it's worth understanding how it works.

Deliberately kept simpler than an earlier version, which also compared against an RRSP — that tested as too much for most visitors to get through, so the RRSP side is gone. The year-by-year table came back, though: without it, an over-committed monthly amount had no way to visibly show *when* it gets capped, just a one-line claim.

**What it does:**
1. Takes the user's age and estimated TFSA contributions to date, and estimates available contribution room from those two (no need to look anything up in CRA My Account first) — with an inline error if the entered contributions exceed what's realistically possible for that age.
2. Takes either a planned monthly contribution amount or a "keep me maxed out" toggle that overrides it, and simulates the choice year by year against the available room (backlog + newly added room each year, capped so it never exceeds what CRA actually allows). It tells the user either the exact year they'll be fully caught up (and the reduced monthly amount they'd drop to once there's no backlog left to absorb), or that their planned pace won't fully catch up before retirement. If the monthly amount alone is more than everything available *this year*, it isn't rejected — the calculator assumes contributions pause once this year's room runs out and resume next year at the projected new limit, and says so.
3. Renders that same simulation as a year-by-year payment schedule (monthly figures, not annual), flagging which years are "at your pace" versus "capped by available room" — this is the part that makes the pause-and-resume behavior visible rather than just asserted in a sentence.
4. Takes the account's actual current balance separately from contributions-to-date — contributions drive the room math (CRA tracks room off deposits), but the real balance, including any growth already earned, is what compounds forward in the projection.
5. Projects tax-free growth to retirement age (slider, 4–12% return) and estimated monthly retirement income to age 95 (slider, 2–8% return), with a live-updating stacked-area chart and donut chart, all built with hand-rolled SVG — no chart library.
6. Includes an FAQ section whose year-dependent answers (this year's limit, lifetime max contribution room) — plus the matching `FAQPage` structured data — are generated by JavaScript, not hand-written, so they never go stale.

### The one file you'll need to touch every year

**[`tfsa-limits.js`](tfsa-limits.js)** holds the CRA's official TFSA dollar limit for every year since 2009. Every fall, once the CRA/Department of Finance announces next year's limit, add **one line**:

```js
const TFSA_ANNUAL_LIMITS = {
  // ...
  2026: 7000,
  2027: 7500,   // add the new year here, nothing else needs to change
};
```

Nothing else in the codebase needs to be touched:

- The calculator, the FAQ text, and the FAQ's structured data all read from this file directly.
- For any year you *haven't* added yet, the calculator automatically **projects** a future limit using the trailing average of the last ~10 real year-over-year increases (rounded to the nearest $500, matching how the CRA actually moves the limit) — so the tool never breaks, it just gets more accurate the more years you add.

---

## The financial plan

[`needs-analysis.html`](needs-analysis.html) is a simplified financial plan for life insurance need, disability and critical illness amounts, and the retirement savings path. It is a normal page on this site, with the same header, footer, and colours as the rest of Marchand Wealth. The calculation code lives in [`needs-analysis/`](needs-analysis/) and is loaded by the page. Nothing on the page is posted to a server, and nothing is written to the browser. Print the plan when a copy needs to be kept. The print sets the file name to `Financial-Plan-<names>-<date>`, and each page carries the same footer line as the questionnaire PDF, with page numbers.

The meeting starts by choosing life insurance, disability, and critical illness, financial planning, or both. Sections that do not belong to that choice stay off the page and out of the letter. The page does not choose a product.

Preview it through a local server (VS Code Live Server, `python3 -m http.server`, or `npx serve .`). Opening the file directly will not load the worksheet, because the browser blocks its JavaScript modules from a `file://` address.

Calculation tests do not need a browser:

```bash
npm run test:needs-analysis
```

### Figures to update once a year

Add a year by copying the newest block in the file. Do not change older years.

| File | What to add |
|---|---|
| `needs-analysis/data/inflation-canada.js` | The new annual CPI percent from Statistics Canada table 18-10-0005-01. The slider starts at the 100-year average of this file. |
| `needs-analysis/data/tfsa-contribution-limit.js` | The new annual TFSA dollar limit, and set `taxYear` to that year. |
| `needs-analysis/data/rrsp-limits.js` | The new RRSP dollar limit. Set `contributionYear` and `nextYearDollarLimit`. |
| `needs-analysis/data/cpp-amounts.js` | The new maximum monthly CPP at 65, YMPE, and YAMPE. |
| `needs-analysis/data/oas-amounts.js` | The new OAS maximums and the recovery-tax threshold. |
| `needs-analysis/data/tax-brackets.js` | Combined federal and provincial brackets for the new year, for every province and territory. |
| `needs-analysis/data/life-expectancy.js` | The new Statistics Canada life expectancy at birth, if a new release replaces the year on file. |
| `needs-analysis/data/probate-fees.js` | A province's schedule when the fee changes. Set `asOf`. |
| `needs-analysis/data/planning-assumptions.js` | Only if the default planning choices should change. |

---

## The investor questionnaire

[`investor-questionnaire.html`](investor-questionnaire.html) combines the Equitable Investor Profile Questionnaire (IW2272) and the Manulife Asset Allocation Portfolios questionnaire (MK3484E) into one 13-question form. Manulife's unscored mutual fund versus segregated fund question is left out. Questions both carriers ask (time horizon, goal, attitude to risk, reaction to a drop, range of returns) are asked once and scored for both. All question wording, points, and profiles live at the top of [`investor-questionnaire.js`](investor-questionnaire.js).

- **Result shown to the client:** the Equitable score (0–50) and its six profiles, Minimal Risk to Aggressive Growth, each with an equity and fixed income mix. Insurers are never named to the client, on the page or in the PDF. The Netlify submission alone carries each answer's Equitable and Manulife points and the Manulife score (8–64) with its four profiles.
- **Submission:** the questions are built by JavaScript, so a hidden static form at the bottom of the page registers the field names with Netlify Forms. A new field must be added there too, or Netlify drops it.
- **Re-open link:** the submission includes `iq-link`, the page URL with every answer in the query string. Opening it restores all answers, shows the results, and offers the PDF download without submitting again.
- **Profiles and return rates:** [`investor-profiles.js`](investor-profiles.js) is shared by the questionnaire, the client intake, and the financial plan. Each profile has a default return while saving and in retirement (Minimal Risk 3% / 3% up to Aggressive Growth 8% / 7%). Change them there and all three pages follow.
- **Hand-off:** "Start the client intake" opens the intake with the client's name, profile, and questionnaire link filled in. The intake's Investor profile dropdown sets its return rates, and its Netlify submission includes the profile and the questionnaire link. The plan link carries the profile, and on the plan, moving the return-while-saving rate switches the profile to match (12% shows Aggressive Growth) and notes when that is riskier than the questionnaire result.
- **PDF:** drawn with [jsPDF](https://github.com/parallax/jsPDF), vendored at `assets/vendor/jspdf.umd.min.js` and loaded only when Download PDF is clicked.

---

## The life insurance quote tool

[`life-insurance-quote.html`](life-insurance-quote.html) embeds a third-party quoter — [Compulife](https://www.compulife.org) — in an iframe (`https://www.compulife.org/website/833/quoter.html`, Ethan's account). Compulife doesn't provide a resize/postMessage bridge and the site is cross-origin, so the parent page can't read the iframe's content height to auto-resize it. Instead, the iframe height is set with `clamp(640px, 85vh, 1000px)` — comfortably tall on both mobile and desktop without wasting space on the bare form, while relying on the iframe's own native scrollbar for the (long, 30-50+ row) results list. A "prefer to open in a new tab" link sits under the iframe as a fallback for anyone who has trouble with the embed.

Because search engines don't meaningfully index cross-origin iframe content, all the actual SEO copy — the explainer section and FAQ — lives in the surrounding page HTML, not inside the iframe.

---

## The blog (Insights)

No CMS, no backend — blog posts are just entries in an array in [`insights-data.js`](insights-data.js), read fresh by the browser on every page load, the same pattern `tfsa-limits.js` uses for TFSA limits.

**To add a post:** copy an existing object in `insights-data.js`, give it a unique `slug`, fill in the fields, and add it to the array. Nothing else needs to change — both `insights.html` (the index) and `insight.html` (the single-post template) read from that file automatically and re-render on load.

**How the two pages work:**
- [`insights.html`](insights.html) lists every post as a card, newest first, and injects a `Blog` JSON-LD schema built from the same data.
- [`insight.html`](insight.html) is a single template shared by every post. It reads the slug out of the URL, finds the matching post in `insights-data.js`, and fills in the title, meta description, canonical tag, Open Graph tags, and `BlogPosting` JSON-LD schema client-side — then renders the post's HTML content into the page.

**Clean URLs without a backend:** posts are linked as `/insights/<slug>`. [`scripts/build-insights.js`](scripts/build-insights.js) writes each post to `insights/<slug>.html` (with its title, canonical tag, and content baked in for search engines) and fills the `insights.html` grid, so run `npm run build:insights` after editing `insights-data.js`. The `/insights/*` → `/insight.html` rewrite in [`netlify.toml`](netlify.toml) is only a fallback for a slug that hasn't been built. Because the browser treats `/insights/<slug>` as a nested path, every asset reference inside `insight.html` (CSS, logo, `script.js`, nav links) is root-absolute (`/assets/...`) rather than relative — a relative path would resolve against the fake `/insights/` directory and 404.

**Local preview:** open `/insights/<slug>.html`. The extension-less URL only resolves on Netlify, or under [`.claude/static-server.js`](.claude/static-server.js), which mirrors the rewrite.

**Remember to add new posts to [`sitemap.xml`](sitemap.xml)** — they're plain static entries, not generated automatically.

---

## Brand

| Name | Hex | Used for |
|---|---|---|
| `navy` | `#2f3744` | Primary brand colour, buttons |
| `navydeep` | `#232a35` | Headings, footer/CTA backgrounds |
| `gold` | `#c1a57b` | Primary accent, CTAs, highlights |
| `olive` | `#6c6753` | Supporting accent (bands, secondary eyebrows) |
| `paper` | `#ffffff` | Base background |
| `paperdim` | `#f2f2f2` | Alternating section background |
| `golddim` | `#a68a61` | Eyebrows, links on light backgrounds |
| `inksoft` | `#565f6c` | Body copy and secondary text |
| `line` | `#ddd7ca` | Borders and dividers |

Colours and fonts are defined once, in [`tailwind.config.js`](tailwind.config.js) — update the hex values there and rebuild the CSS (see below) rather than hunting for one-off classes across pages.

Logos:
- `assets/logo.png` — full wordmark, used in every header/footer site-wide
- `assets/icon.png` — icon-only shield, used for the favicon and the homepage hero illustration only

---

## Forms

The contact form ([`contact.html`](contact.html)) submits via **Netlify Forms** — no external service, no API keys. Internally it's still registered with Netlify under the form name `intake` (unchanged, so existing submission history and any dashboard notifications keep working). It's wired up with:

- `data-netlify="true"` and a matching hidden `form-name` field
- A honeypot field (`netlify-honeypot="bot-field"`) for basic spam filtering
- An AJAX submit handler in `script.js` that POSTs to the current page so the user gets an inline "thank you" message with no page reload

**This only works once deployed to Netlify** — Netlify's build step scans the static HTML for `data-netlify` to register the form, so it won't do anything on localhost or opening the file directly.

> Submissions land silently in the Netlify dashboard by default. Turn on notifications under *Site settings → Forms → Form notifications* so they actually reach an inbox.

The scheduler ([`schedule.html`](schedule.html)) embeds a Google Calendar appointment scheduling page directly via iframe — no Netlify Forms involved there.

---

## Editing styles

**Read this before editing any HTML.** This project used to run Tailwind's CDN script, which compiled styles live in the browser — any class you typed just worked, instantly, no build step. That's gone now, replaced with a real production stylesheet ([`assets/css/site.css`](assets/css/site.css)) compiled ahead of time from [`src/tailwind.css`](src/tailwind.css) + [`tailwind.config.js`](tailwind.config.js). It's faster and it's what Tailwind actually recommends for production — but it means:

> **If you add a new Tailwind utility class to any HTML file (or to `script.js`) that wasn't used anywhere before, it will not be styled until you rebuild the CSS.** Nothing will error — the class will just silently do nothing, because it was never compiled.

So the workflow is now:

1. Edit HTML/JS as normal.
2. Run `npm run build:css` (or leave `npm run watch:css` running in the background while you work — it rebuilds automatically on every save).
3. Refresh the browser.

First-time setup (once you have Node.js installed):

```bash
npm install
npm run build:css      # one-off build
# or
npm run watch:css      # rebuilds automatically as you edit
```

If you only ever edit *content* (text, adding a year to `tfsa-limits.js`, swapping an image) and never introduce a brand-new utility class combination, you can skip all of this locally — Netlify rebuilds the CSS for you on every deploy (see below). It only matters for previewing changes locally before pushing.

---

## Local development

Serve the folder locally (VS Code Live Server works). Pages use root-absolute paths (`/assets/...`) and the financial plan uses JavaScript modules, so opening files directly from disk does not work. From a terminal:

```bash
npx serve .
# or
python3 -m http.server
```

Just remember to rebuild the CSS first if you've added new classes — see [Editing styles](#editing-styles) above.

---

## Deployment

Hosted on **Netlify**, deployed straight from this repo. [`netlify.toml`](netlify.toml) tells Netlify to run `npm install && npm run build` on every deploy, so the live CSS and the pre-rendered Insights posts always reflect the source at deploy time — you don't need to remember to rebuild before pushing, only for local preview.

Checklist after the first deploy:
- [ ] Confirm the custom domain is connected and HTTPS is active
- [ ] Turn on Netlify Forms notifications (see above)
- [ ] Submit `sitemap.xml` in Google Search Console
- [ ] Confirm the GA4 property (`G-3EV5EXLFQV`) is receiving traffic

---

## License

Private — all rights reserved, Marchand Financial Solutions Inc.
