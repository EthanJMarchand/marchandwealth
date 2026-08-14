// Insights (blog) content lives here — no backend, no CMS, just this array.
// The site reads it fresh on every page load.
//
// TO ADD A NEW POST: copy an existing object, give it a unique `slug`
// (lowercase, hyphens, no spaces — it becomes the URL: /insights/your-slug),
// fill in the fields below, and add it to the top of INSIGHTS_POSTS.
// Nothing else needs to change — insights.html and insight.html both pull
// from this array automatically.
//
// `content` is raw HTML. Use the same tag/class patterns as the posts below
// so new articles look identical to the existing ones:
//   <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">...</p>
//   <h2 class="font-serif font-semibold text-2xl md:text-[26px] text-navydeep mt-10 mb-4">...</h2>
//   <h3 class="font-serif font-semibold text-lg text-navydeep mt-7 mb-3">...</h3>
const INSIGHTS_POSTS = [
  {
    slug: 'cra-tax-instalment-interest-2026',
    title: 'CRA Tax Instalments: What You Owe at 7%, and What They Actually Pay You',
    subtitle: "The rate CRA charges you and the rate CRA pays you aren't the same number",
    category: 'Tax Planning',
    metaDescription: "Miss a CRA tax instalment and you're charged 7% interest in 2026. Overpay one and CRA credits you back — but not at 7%, and not in cash. Here's how it actually works.",
    keywords: 'CRA tax instalments, CRA instalment interest rate 2026, do I have to pay tax instalments Canada, CRA prescribed interest rate, CRA instalment penalty, overpaid tax instalment interest',
    author: 'Ethan Marchand',
    datePublished: '2026-08-14',
    dateModified: '2026-08-14',
    readTime: '7 min read',
    excerpt: "CRA charges 7% interest on a late or underpaid tax instalment in 2026. A lot of people assume overpaying pays that same 7% back to them. It doesn't work that way — here's what actually happens.",
    content: `
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">Every year I get some version of the same question from clients who are new to paying tax instalments: "If CRA charges interest when I'm late, do they pay me interest if I overpay?" The honest answer is yes, technically &mdash; but the details surprise almost everyone, and the two rates involved aren't the same number. In 2026, CRA charges <strong>7%</strong> on a late or insufficient instalment payment. What they pay you back is a different, lower rate, and for instalments specifically, it usually isn't paid to you in cash at all. Worth understanding clearly before you assume either direction works the way you think it does.</p>

      <h2 class="font-serif font-semibold text-2xl md:text-[26px] text-navydeep mt-10 mb-4">Who actually has to pay instalments</h2>
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">Tax instalments are quarterly payments toward the tax bill you'd otherwise pay in one lump sum the following April &mdash; the same idea as an employer withholding tax from every paycheque, just handled by you instead. They typically apply to self-employed income, rental or investment income, certain pension income, or income from more than one job where not enough tax is being withheld at the source.</p>
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">CRA's actual test is a two-part one, and both parts have to be true: your <strong>net tax owing for 2026</strong> has to be more than $3,000 ($1,800 in Quebec), <em>and</em> your net tax owing was also more than that amount in either 2025 or 2024. If either of those two conditions isn't met, you're not required to pay instalments for 2026, even if CRA sends you a reminder suggesting an amount.</p>
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">CRA sends two instalment reminders (form INNS1) if their records suggest you'll need to pay: one in February, covering the March and June payments, and one in August, covering the September and December payments. If you get a reminder but your actual 2026 net tax owing turns out to be $3,000 or less, you don't have to pay &mdash; the reminder is based on your last assessed return, not a final determination.</p>

      <h2 class="font-serif font-semibold text-2xl md:text-[26px] text-navydeep mt-10 mb-4">The four due dates</h2>
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">Instalments are due <strong>March 15, June 15, September 15, and December 15</strong> every year. The one exception is farmers and fishers, whose main income comes from farming or fishing, who have a single combined due date of December 31 instead of four separate payments.</p>

      <h2 class="font-serif font-semibold text-2xl md:text-[26px] text-navydeep mt-10 mb-4">Three ways to calculate what you owe</h2>
      <ul class="space-y-3 mb-6">
        <li class="flex items-start gap-3 text-[15px] text-inksoft leading-relaxed"><svg class="mt-1 flex-shrink-0 text-olive" width="14" height="11" viewBox="0 0 20 16" fill="none"><path d="M1 2 L10 14 L19 2" stroke="currentColor" stroke-width="2.4"/></svg><span><strong>No-calculation option</strong> &mdash; CRA tells you the amount, based on your latest assessed return. Best if your income is fairly stable year to year, and it's the one option where CRA won't charge interest or a penalty even if it turns out to be too low.</span></li>
        <li class="flex items-start gap-3 text-[15px] text-inksoft leading-relaxed"><svg class="mt-1 flex-shrink-0 text-olive" width="14" height="11" viewBox="0 0 20 16" fill="none"><path d="M1 2 L10 14 L19 2" stroke="currentColor" stroke-width="2.4"/></svg><span><strong>Prior-year option</strong> &mdash; you calculate the amount based on your 2025 return. Best when 2026 looks similar to 2025 but different from 2024.</span></li>
        <li class="flex items-start gap-3 text-[15px] text-inksoft leading-relaxed"><svg class="mt-1 flex-shrink-0 text-olive" width="14" height="11" viewBox="0 0 20 16" fill="none"><path d="M1 2 L10 14 L19 2" stroke="currentColor" stroke-width="2.4"/></svg><span><strong>Current-year option</strong> &mdash; you estimate 2026 directly. Best when this year is genuinely different from the last two, but it's also the riskiest: underestimate, and you're exposed to interest on the shortfall.</span></li>
      </ul>
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">Whichever option you use, paying in full by each due date under the prior-year or current-year methods avoids interest and penalties &mdash; unless your estimate turns out to be too low.</p>

      <h2 class="font-serif font-semibold text-2xl md:text-[26px] text-navydeep mt-10 mb-4">What 7% actually costs you</h2>
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">If you miss an instalment, pay late, or pay less than required, CRA charges <strong>instalment interest</strong>, compounded daily, at the prescribed rate &mdash; currently 7% for the third quarter of 2026 (July 1 to September 30). That rate is reset every calendar quarter and can move, so it's worth checking the current rate rather than assuming it stays fixed all year.</p>

      <div class="grid sm:grid-cols-2 gap-5 my-8">
        <div class="bg-white border border-line rounded-sm p-6 text-center">
          <p class="text-[12px] font-semibold tracking-[0.14em] uppercase text-golddim mb-2">What CRA charges you</p>
          <p class="font-serif font-semibold text-4xl text-navydeep mb-1">7%</p>
          <p class="text-[13.5px] text-inksoft m-0">On late or insufficient instalments &mdash; Q3 2026, compounded daily</p>
        </div>
        <div class="bg-white border border-line rounded-sm p-6 text-center">
          <p class="text-[12px] font-semibold tracking-[0.14em] uppercase text-golddim mb-2">What CRA pays individuals</p>
          <p class="font-serif font-semibold text-4xl text-navydeep mb-1">5%</p>
          <p class="text-[13.5px] text-inksoft m-0">On non-corporate overpayments &mdash; Q3 2026 (corporations: 3%)</p>
        </div>
      </div>

      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">On top of the interest, CRA can also charge an <strong>instalment penalty</strong>, but only if your total instalment interest for the year exceeds $1,000. When it applies, the penalty is half the amount by which your actual instalment interest exceeds the greater of $1,000 or 25% of the interest you'd have owed had you made no instalment payments at all. In practice, that means the penalty is reserved for meaningful, sustained shortfalls &mdash; not a single payment that's a few days late.</p>

      <h2 class="font-serif font-semibold text-2xl md:text-[26px] text-navydeep mt-10 mb-4">The part most people get wrong: overpaying doesn't pay you cash</h2>
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">Here's the nuance that trips people up. CRA's own guidance says you can reduce or eliminate instalment interest and penalties by overpaying your next instalment or paying it early &mdash; doing so earns you <strong>instalment credit interest</strong>. It sounds like the mirror image of being charged interest for paying late. It isn't, in two important ways.</p>

      <div class="bg-paperdim border-l-4 border-l-gold rounded-sm p-6 my-8">
        <p class="font-serif font-semibold text-navydeep text-[15px] mb-1">Key takeaway</p>
        <p class="text-[14.5px] text-inksoft leading-relaxed m-0">Instalment credit interest is <strong>not refundable</strong> and can <strong>only be used to offset instalment interest charges on a late or insufficient payment within that same tax year.</strong> If you don't end up with any instalment interest to offset, the credit simply isn't paid out &mdash; it doesn't carry forward, and it doesn't show up as cash in your pocket or a bigger refund.</p>
      </div>

      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">In other words, overpaying an instalment on purpose to "earn interest" from CRA isn't really a strategy &mdash; at best it cancels out interest you'd otherwise owe on a different late payment the same year. It's genuinely useful if your instalment amounts are uneven quarter to quarter, but it isn't a way to make money off CRA.</p>
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">The separate 5% figure above &mdash; what CRA pays non-corporate taxpayers on overpayments generally &mdash; is the rate that applies more broadly, including refund interest once your return is assessed. It's real, it is paid out, and it's set the same way the 7% debit rate is: quarterly, and it can change. But it's consistently the lower of the two numbers, which is really the whole point of this article: the arrangement is not symmetrical, and CRA's cost of money to you is always higher than its cost of money to CRA.</p>

      <h2 class="font-serif font-semibold text-2xl md:text-[26px] text-navydeep mt-10 mb-4">The practical takeaway</h2>
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">Given the asymmetry, the better goal usually isn't chasing instalment credit interest &mdash; it's simply picking the calculation option that fits your situation closely enough that you avoid the 7% charge in the first place. If your income is genuinely unpredictable year to year (common for the self-employed and incorporated business owners I work with), that usually means checking in partway through the year rather than setting an estimate in January and forgetting about it, so a swing in income doesn't turn into an instalment shortfall by September.</p>
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">If a big part of why your instalments are unpredictable is business income flowing through a corporation, that's also exactly the kind of thing worth coordinating with your broader tax and compensation plan &mdash; not treated as a separate, once-a-quarter chore.</p>
    `,
  },
  {
    slug: 'tfsa-underutilized-retirement-vehicle',
    title: "The TFSA Is Canada's Most Underused Retirement Account",
    subtitle: "Here's why that needs to change",
    category: 'Retirement Planning',
    metaDescription: "Most Canadians treat their TFSA like a side savings account. Here's why the Tax-Free Savings Account deserves a central role in your retirement plan.",
    keywords: 'TFSA for retirement, TFSA retirement strategy, TFSA vs RRSP, tax-free savings account Canada, how to use a TFSA for retirement',
    author: 'Ethan Marchand',
    datePublished: '2026-08-13',
    dateModified: '2026-08-13',
    readTime: '7 min read',
    excerpt: "The Tax-Free Savings Account has quietly become one of the most powerful retirement tools available to Canadians — and one of the most misunderstood. Here's how to actually use it like one.",
    content: `
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">Ask most Canadians what their TFSA is for, and you'll get some version of the same answer: "It's my savings account." A place for the emergency fund, the vacation money, the cushion between paycheques. That's not wrong, exactly — a TFSA can absolutely hold cash for short-term goals. But treating it <em>only</em> as a savings account is, in my view, the single most common and most expensive misunderstanding I see in this industry. Used properly, the TFSA is one of the most effective retirement vehicles available in Canada, and most people are leaving an enormous amount of tax-free growth on the table.</p>

      <h2 class="font-serif font-semibold text-2xl md:text-[26px] text-navydeep mt-10 mb-4">What the TFSA actually gives you</h2>
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">The name undersells it. "Tax-Free Savings Account" sounds like a better chequing account. What it actually is: a registered account where investments grow completely tax-free, and where every dollar you withdraw — contributions and decades of growth included — comes out with zero tax owing. No T-slip, no reporting requirement, nothing. Compare that to a non-registered investment account, where every dividend, every bit of interest, and every capital gain is taxed the year it happens, and the difference in long-term outcomes is significant.</p>
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">The other piece people underweight: TFSA withdrawals are invisible to the CRA for income-testing purposes. That matters more than it sounds. Old Age Security has a clawback that starts reducing your benefit once your net income crosses a threshold. Income-tested benefits like the Guaranteed Income Supplement work the same way. Pull money from an RRSP or RRIF in retirement, and it counts as taxable income — which can trigger a clawback and push you into a higher bracket. Pull the same dollar amount from a TFSA, and as far as the CRA and every income-tested program is concerned, it never happened.</p>

      <div class="bg-paperdim border-l-4 border-l-gold rounded-sm p-6 my-8">
        <p class="font-serif font-semibold text-navydeep text-[15px] mb-1">Key takeaway</p>
        <p class="text-[14.5px] text-inksoft leading-relaxed m-0">A TFSA withdrawal in retirement doesn't just avoid tax on that dollar — it can also protect the OAS and GIS you'd otherwise be at risk of losing by drawing the same amount from an RRSP or RRIF.</p>
      </div>

      <h2 class="font-serif font-semibold text-2xl md:text-[26px] text-navydeep mt-10 mb-4">Why it's so underused</h2>
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">Two habits explain most of it. First, a lot of TFSAs sit in cash, or near-cash, at whatever big-bank interest rate happens to be on offer that year. That's a legitimate use for a short-term goal, but it wastes the account's real advantage — decades of tax-free compounding — on a purpose it wasn't designed for. Second, most people fund their TFSA with whatever's left over at the end of the year, instead of treating it as a genuine long-term retirement account that deserves regular, deliberate contributions and an investment mix that matches a multi-decade time horizon.</p>
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">There's also a room problem hiding in plain sight. TFSA contribution room has accumulated every single year since 2009, whether or not you ever opened an account, and it carries forward indefinitely. If you were 18 or older in 2009 and have never contributed a dollar, your lifetime TFSA room by 2026 is well over $100,000. Most people have no idea how much unused room they're sitting on, which means they have no idea how much tax-free growth they're missing out on.</p>

      <h2 class="font-serif font-semibold text-2xl md:text-[26px] text-navydeep mt-10 mb-4">TFSA vs. RRSP for retirement income</h2>
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">The RRSP isn't a bad tool — it's just a different one, and the two get compared far more often than they get coordinated. An RRSP contribution defers tax today and gets taxed later, when it's withdrawn (or forced out through a RRIF). That works well if your income — and tax bracket — will genuinely be lower in retirement than during your working years. A TFSA contribution uses after-tax dollars today, and every dollar of growth comes out tax-free, with no bearing on your bracket or your government benefits later.</p>
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">In practice, the strongest retirement income plans I build don't pick one over the other — they use both, deliberately. RRSP withdrawals fill up the lower tax brackets. TFSA withdrawals top up the rest of what's needed without pushing income (or OAS clawback exposure) any higher. Having a meaningful TFSA balance by retirement is what gives that strategy room to work. Without it, RRIF withdrawals are often the only lever available, and that lever comes with a tax bill and a benefit clawback attached.</p>

      <h3 class="font-serif font-semibold text-lg text-navydeep mt-7 mb-3">What "using it like a retirement account" actually looks like</h3>
      <ul class="space-y-3 mb-6">
        <li class="flex items-start gap-3 text-[15px] text-inksoft leading-relaxed"><svg class="mt-1 flex-shrink-0 text-olive" width="14" height="11" viewBox="0 0 20 16" fill="none"><path d="M1 2 L10 14 L19 2" stroke="currentColor" stroke-width="2.4"/></svg>Contribute on a schedule, not whatever's left over — even a modest, automatic monthly amount beats an irregular lump sum most years, because it's consistent.</li>
        <li class="flex items-start gap-3 text-[15px] text-inksoft leading-relaxed"><svg class="mt-1 flex-shrink-0 text-olive" width="14" height="11" viewBox="0 0 20 16" fill="none"><path d="M1 2 L10 14 L19 2" stroke="currentColor" stroke-width="2.4"/></svg>Invest it for growth if retirement is decades away, rather than parking it entirely in cash — the tax-free compounding is the whole point.</li>
        <li class="flex items-start gap-3 text-[15px] text-inksoft leading-relaxed"><svg class="mt-1 flex-shrink-0 text-olive" width="14" height="11" viewBox="0 0 20 16" fill="none"><path d="M1 2 L10 14 L19 2" stroke="currentColor" stroke-width="2.4"/></svg>Check your actual available room in CRA My Account rather than guessing — most people are surprised by how much they have.</li>
        <li class="flex items-start gap-3 text-[15px] text-inksoft leading-relaxed"><svg class="mt-1 flex-shrink-0 text-olive" width="14" height="11" viewBox="0 0 20 16" fill="none"><path d="M1 2 L10 14 L19 2" stroke="currentColor" stroke-width="2.4"/></svg>Coordinate it with your RRSP and, if you're incorporated, your corporate accounts — the goal is one retirement income plan, not three disconnected accounts.</li>
      </ul>

      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">If you want to see exactly where you stand — how much room you have, what it would take to catch up, and what that balance could realistically grow to by retirement — I built a free calculator that walks through all of it, including a full comparison against an RRSP. It's the same starting point I use with clients before we talk strategy.</p>
    `,
  },
  {
    slug: 'corporate-owned-life-insurance-capital-dividend-account',
    title: 'Why Every Business Owner Should Own Their Life Insurance Through Their Corporation',
    subtitle: 'The Capital Dividend Account changes the math',
    category: 'Corporate Strategy',
    metaDescription: 'If you own a corporation, personally-owned life insurance is likely leaving money on the table. Here\'s how corporate ownership and the Capital Dividend Account change the math.',
    keywords: 'corporate owned life insurance, capital dividend account, CDA life insurance, life insurance through a corporation Canada, corporate insurance strategy',
    author: 'Ethan Marchand',
    datePublished: '2026-08-13',
    dateModified: '2026-08-13',
    readTime: '8 min read',
    excerpt: "If you're incorporated and your life insurance is owned personally, you're probably paying for it with the wrong dollars — and missing one of the few genuinely tax-free tools left in the Income Tax Act.",
    content: `
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">This is one of the most common gaps I find when I sit down with an incorporated business owner for the first time: they have life insurance, it's adequate, and it's owned personally — paid for with money that's already been through personal tax. For an employee, that's simply how it has to work. For a business owner with a corporation, it's usually the more expensive way to do it, and it quietly gives up one of the few genuinely tax-free planning tools still available under the Income Tax Act: the Capital Dividend Account.</p>

      <h2 class="font-serif font-semibold text-2xl md:text-[26px] text-navydeep mt-10 mb-4">The problem with paying for it personally</h2>
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">When you own a policy personally, the premiums come out of income you've already paid personal tax on — potentially at your top marginal rate, which in Alberta can run close to half of every dollar. If your corporation is earning active business income eligible for the small business rate, that same dollar is taxed substantially lower before it ever leaves the company. Move the ownership of the policy to the corporation, and the premiums get funded with those lower-taxed corporate dollars instead. Same coverage, meaningfully cheaper to fund.</p>

      <h2 class="font-serif font-semibold text-2xl md:text-[26px] text-navydeep mt-10 mb-4">What the Capital Dividend Account actually does</h2>
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">This is the part that surprises most owners. Ordinarily, if a corporation accumulates cash and later pays it out to shareholders, that payout is a taxable dividend — taxed again in the shareholder's hands, on top of whatever corporate tax was already paid. It's the classic problem with just letting surplus cash pile up in a company.</p>
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">Life insurance is one of the narrow exceptions. When a private corporation is the beneficiary of a policy it owns and the insured passes away, the death benefit — less the policy's adjusted cost basis (ACB) — is credited to the company's <strong>Capital Dividend Account</strong>. Whatever balance sits in the CDA can then be paid out to shareholders as a <strong>capital dividend</strong>, completely free of personal tax. That's money moving out of a corporation to your family or your estate without the usual taxable-dividend toll — one of the very few ways that happens under Canadian tax law.</p>

      <div class="bg-white border border-line border-l-4 border-l-gold rounded-sm p-6 my-8">
        <p class="font-serif text-lg text-navydeep leading-snug m-0">"The corporation doesn't have to sit on surplus cash and get taxed on it year after year. Structured properly, that same capital can fund coverage that eventually moves back out to your family tax-free."</p>
      </div>

      <h2 class="font-serif font-semibold text-2xl md:text-[26px] text-navydeep mt-10 mb-4">It also solves a second, quieter problem</h2>
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">Many incorporated business owners accumulate surplus cash inside the company well beyond what the business actually needs to operate — sitting in a savings account or a passive investment portfolio, waiting for "someday." That passive income gets taxed annually inside the corporation, generally at a higher rate than active business income, and enough of it can grind down the small business deduction limit that keeps your operating income taxed favourably in the first place.</p>
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">An exempt life insurance policy owned by the corporation gives that surplus cash somewhere else to go: it can grow inside the policy on a tax-advantaged basis instead of being taxed annually as passive investment income, while still building the death benefit that eventually credits the CDA. It's a way to put idle corporate cash to work without adding to the passive-income drag on the rest of the business.</p>

      <h3 class="font-serif font-semibold text-lg text-navydeep mt-7 mb-3">Where this needs to be done carefully</h3>
      <ul class="space-y-3 mb-6">
        <li class="flex items-start gap-3 text-[15px] text-inksoft leading-relaxed"><svg class="mt-1 flex-shrink-0 text-olive" width="14" height="11" viewBox="0 0 20 16" fill="none"><path d="M1 2 L10 14 L19 2" stroke="currentColor" stroke-width="2.4"/></svg><span><strong>Ownership and beneficiary designation</strong> have to be set up correctly from day one — retrofitting a personally-owned policy later isn't always straightforward or cost-free.</span></li>
        <li class="flex items-start gap-3 text-[15px] text-inksoft leading-relaxed"><svg class="mt-1 flex-shrink-0 text-olive" width="14" height="11" viewBox="0 0 20 16" fill="none"><path d="M1 2 L10 14 L19 2" stroke="currentColor" stroke-width="2.4"/></svg><span><strong>ACB tracking</strong> determines exactly how much credits the CDA — this needs to be calculated correctly by your accountant when a claim is paid, not estimated.</span></li>
        <li class="flex items-start gap-3 text-[15px] text-inksoft leading-relaxed"><svg class="mt-1 flex-shrink-0 text-olive" width="14" height="11" viewBox="0 0 20 16" fill="none"><path d="M1 2 L10 14 L19 2" stroke="currentColor" stroke-width="2.4"/></svg><span><strong>Multiple shareholders</strong> raise a separate question worth solving up front: how the CDA credit and the coverage itself interact with a buy-sell agreement, so the right person receives the right amount at the right time.</span></li>
        <li class="flex items-start gap-3 text-[15px] text-inksoft leading-relaxed"><svg class="mt-1 flex-shrink-0 text-olive" width="14" height="11" viewBox="0 0 20 16" fill="none"><path d="M1 2 L10 14 L19 2" stroke="currentColor" stroke-width="2.4"/></svg><span><strong>Your accountant and your advisor need to be coordinated</strong> — this is a case where the insurance decision and the corporate tax structure genuinely have to be planned together, not in sequence.</span></li>
      </ul>

      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">None of this makes corporate ownership the automatic right answer for every owner — personal circumstances, other shareholders, and how the business is structured all factor in. But if your coverage has been sitting personally-owned since before incorporation, or nobody has looked at how it interacts with your corporation's balance sheet, it's worth a real conversation before assuming the current setup is the efficient one.</p>
    `,
  },
  {
    slug: 'pay-yourself-first-wealth-building-habit',
    title: 'Pay Yourself First: The Simple Habit That Builds Real Wealth',
    subtitle: "It's one of the oldest rules in personal finance — and one of the most ignored",
    category: 'Financial Habits',
    metaDescription: "Pay yourself first is one of the oldest rules in personal finance — and one of the most ignored. Here's how to actually put it into practice, personally and through a corporation.",
    keywords: 'pay yourself first, pay yourself first strategy, automate savings Canada, how to save money consistently, pay yourself first business owner',
    author: 'Ethan Marchand',
    datePublished: '2026-08-13',
    dateModified: '2026-08-13',
    readTime: '6 min read',
    excerpt: "Most people save whatever's left after spending — which is usually nothing. Paying yourself first flips the order, and it's the single habit I see separate people who build wealth from people who just earn a good income.",
    content: `
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">Of everything I talk about with clients, "pay yourself first" is the least sophisticated idea in the room — and it's also the one that predicts long-term financial outcomes better than almost anything else. The concept isn't new; it's been around for close to a century. What's changed is how easy it's become to actually do it, and how rarely people take advantage of that.</p>

      <h2 class="font-serif font-semibold text-2xl md:text-[26px] text-navydeep mt-10 mb-4">The idea, in one sentence</h2>
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">Before you pay a single bill or spend a single discretionary dollar, a portion of every paycheque gets moved into savings and investments — treated as a fixed obligation, not a nice-to-have. Whatever's left after that is what you actually live on. It's the exact opposite of the way most households handle money, which is to pay everything else first and save whatever happens to be left over at the end of the month. For the vast majority of people, "whatever's left over" rounds to zero.</p>

      <h2 class="font-serif font-semibold text-2xl md:text-[26px] text-navydeep mt-10 mb-4">Why the order matters so much</h2>
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">This isn't really a math problem — it's a behaviour problem, and paying yourself first is a behavioural fix. Spending naturally expands to fill whatever's available; that's not a character flaw, it's just how budgets work in practice for almost everyone. If saving is the last thing that happens each month, it competes with every other want and need in your life and loses more often than it wins. If saving is the <em>first</em> thing that happens — ideally automatically, on payday, before you ever see the money — it stops being a decision you have to make every single month. It just happens.</p>

      <div class="bg-paperdim border-l-4 border-l-gold rounded-sm p-6 my-8">
        <p class="font-serif font-semibold text-navydeep text-[15px] mb-1">Key takeaway</p>
        <p class="text-[14.5px] text-inksoft leading-relaxed m-0">You don't need willpower if the money is already gone before you can spend it. Automate the transfer on payday and the habit takes care of itself.</p>
      </div>

      <h2 class="font-serif font-semibold text-2xl md:text-[26px] text-navydeep mt-10 mb-4">How to actually set it up</h2>
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">There's no universal percentage that's right for everyone — someone carrying high-interest debt has a different starting point than someone with none. What matters more than the exact number is starting with something and automating it, then increasing it as your income grows rather than letting your lifestyle absorb every raise.</p>
      <ul class="space-y-3 mb-6">
        <li class="flex items-start gap-3 text-[15px] text-inksoft leading-relaxed"><svg class="mt-1 flex-shrink-0 text-olive" width="14" height="11" viewBox="0 0 20 16" fill="none"><path d="M1 2 L10 14 L19 2" stroke="currentColor" stroke-width="2.4"/></svg>Set up an automatic transfer for the same day your pay lands — not a manual transfer you have to remember to make.</li>
        <li class="flex items-start gap-3 text-[15px] text-inksoft leading-relaxed"><svg class="mt-1 flex-shrink-0 text-olive" width="14" height="11" viewBox="0 0 20 16" fill="none"><path d="M1 2 L10 14 L19 2" stroke="currentColor" stroke-width="2.4"/></svg>Start with an amount you genuinely won't miss, then raise it every time your income does — a percentage of a raise is far less painful to redirect than a percentage of your current take-home pay.</li>
        <li class="flex items-start gap-3 text-[15px] text-inksoft leading-relaxed"><svg class="mt-1 flex-shrink-0 text-olive" width="14" height="11" viewBox="0 0 20 16" fill="none"><path d="M1 2 L10 14 L19 2" stroke="currentColor" stroke-width="2.4"/></svg>Send it somewhere with a real purpose — an emergency fund first if you don't have one, then a TFSA or RRSP for the long term, not a chequing account it can quietly leak back out of.</li>
        <li class="flex items-start gap-3 text-[15px] text-inksoft leading-relaxed"><svg class="mt-1 flex-shrink-0 text-olive" width="14" height="11" viewBox="0 0 20 16" fill="none"><path d="M1 2 L10 14 L19 2" stroke="currentColor" stroke-width="2.4"/></svg>Treat it exactly like rent or a loan payment in your own head — non-negotiable, not the thing that flexes when the month gets tight.</li>
      </ul>

      <h2 class="font-serif font-semibold text-2xl md:text-[26px] text-navydeep mt-10 mb-4">It applies at the corporate level too</h2>
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">If you're an incorporated business owner, the exact same principle applies one level up, and it's just as easy to skip. It's common for surplus cash to sit in a corporation indefinitely — not reinvested in the business, not paid out, just accumulating with no real plan attached to it. "Pay yourself first" as a business owner means deciding, deliberately and on a schedule, how much of that surplus gets moved into structured savings, investments, or insurance planning — rather than leaving it to accumulate as passive income the CRA will happily tax and that offers no real strategy behind it.</p>
      <p class="text-[15.5px] text-inksoft leading-relaxed mb-5">Where that money should actually go — a personal TFSA, a corporate investment account, an exempt life insurance policy funding future retirement income and the corporation's Capital Dividend Account — depends entirely on your situation. But the habit underneath all of it is the same one: decide the amount, automate the move, and build your spending around what's left rather than the other way around.</p>
    `,
  },
];
