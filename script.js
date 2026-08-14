// Hand-coded by Ethan Marchand. No annuities, no outsourcing, just me and too much coffee.
document.addEventListener('DOMContentLoaded', () => {

  // Auto-updates the copyright year so I don't have to remember to, like flossing.
  document.querySelectorAll('#year').forEach(el => {
    el.textContent = new Date().getFullYear();
  });

  // Hamburger menu. Not the food kind, unfortunately.
  const navToggle = document.getElementById('nav-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  if (navToggle && mobileMenu) {
    navToggle.addEventListener('click', () => {
      const isHidden = mobileMenu.classList.contains('hidden');
      if (isHidden) {
        mobileMenu.classList.remove('hidden');
        mobileMenu.classList.add('flex');
      } else {
        mobileMenu.classList.add('hidden');
        mobileMenu.classList.remove('flex');
      }
    });
  }

  // Click to expand. Kind of like my client meetings.
  document.querySelectorAll('.faq-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      item.classList.toggle('open');
    });
  });

  // Insights (blog) — reads from insights-data.js, renders on insights.html and insight.html.
  // No backend: add a post to INSIGHTS_POSTS and it shows up here on the next page load.
  const insightsGrid = document.getElementById('insights-grid');
  const postArticle = document.getElementById('post-article');
  if ((insightsGrid || postArticle) && typeof INSIGHTS_POSTS !== 'undefined') {

    const formatPostDate = (iso) => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(iso + 'T00:00:00'));
    const sortedPosts = [...INSIGHTS_POSTS].sort((a, b) => new Date(b.datePublished) - new Date(a.datePublished));

    const postCardHtml = (post) => `
      <a href="/insights/${post.slug}" class="block bg-white border border-line rounded-sm p-8 hover:-translate-y-1 hover:shadow-lg transition">
        <div class="text-[12px] font-semibold tracking-[0.14em] uppercase text-golddim mb-3">${post.category}</div>
        <h3 class="font-serif font-semibold text-xl text-navydeep mb-3 leading-snug">${post.title}</h3>
        <p class="text-[14.5px] text-inksoft leading-relaxed mb-5">${post.excerpt}</p>
        <div class="flex items-center justify-between text-[12.5px] text-inksoft">
          <span>${formatPostDate(post.datePublished)} &middot; ${post.readTime}</span>
          <span class="text-navydeep font-semibold">Read article &rarr;</span>
        </div>
      </a>`;

    // Article grid on insights.html
    if (insightsGrid) {
      if (sortedPosts.length) {
        insightsGrid.innerHTML = sortedPosts.map(postCardHtml).join('');
      } else {
        const emptyEl = document.getElementById('insights-empty');
        if (emptyEl) emptyEl.classList.remove('hidden');
      }

      const blogSchemaEl = document.getElementById('blog-schema');
      if (blogSchemaEl) {
        try {
          const schema = JSON.parse(blogSchemaEl.textContent);
          schema.blogPost = sortedPosts.map(post => ({
            '@type': 'BlogPosting',
            headline: post.title,
            url: `https://marchandwealth.ca/insights/${post.slug}`,
            datePublished: post.datePublished,
            dateModified: post.dateModified
          }));
          blogSchemaEl.textContent = JSON.stringify(schema);
        } catch (e) { /* leave the static schema as-is */ }
      }
    }

    // Single article on insight.html — slug comes from /insights/<slug> (Netlify rewrite)
    // or ?post=<slug> as a local-dev fallback.
    if (postArticle) {
      const params = new URLSearchParams(window.location.search);
      let slug = params.get('post');
      if (!slug) {
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        const idx = pathParts.indexOf('insights');
        if (idx !== -1 && pathParts[idx + 1]) slug = decodeURIComponent(pathParts[idx + 1]);
      }

      const post = sortedPosts.find(p => p.slug === slug);
      const notFoundEl = document.getElementById('post-not-found');

      if (!post) {
        if (notFoundEl) notFoundEl.classList.remove('hidden');
        document.title = 'Article Not Found | Marchand Wealth';
        const robotsMeta = document.createElement('meta');
        robotsMeta.name = 'robots';
        robotsMeta.content = 'noindex, follow';
        document.head.appendChild(robotsMeta);
      } else {
        const postUrl = `https://marchandwealth.ca/insights/${post.slug}`;

        document.title = `${post.title} | Marchand Wealth`;
        const titleTag = document.getElementById('post-title-tag');
        if (titleTag) titleTag.textContent = document.title;

        const metaDesc = document.getElementById('post-meta-description');
        if (metaDesc) metaDesc.setAttribute('content', post.metaDescription);

        const canonical = document.getElementById('post-canonical');
        if (canonical) canonical.setAttribute('href', postUrl);

        const ogTitle = document.getElementById('post-og-title');
        if (ogTitle) ogTitle.setAttribute('content', post.title);
        const ogDesc = document.getElementById('post-og-description');
        if (ogDesc) ogDesc.setAttribute('content', post.metaDescription);
        const ogUrl = document.getElementById('post-og-url');
        if (ogUrl) ogUrl.setAttribute('content', postUrl);

        const categoryEl = document.getElementById('post-category');
        if (categoryEl) categoryEl.innerHTML = `<svg width="18" height="14" viewBox="0 0 20 16" fill="none"><path d="M1 2 L10 14 L19 2" stroke="currentColor" stroke-width="2.4"/></svg>${post.category}`;

        const titleEl = document.getElementById('post-title');
        if (titleEl) titleEl.textContent = post.title;

        const subtitleEl = document.getElementById('post-subtitle');
        if (subtitleEl) subtitleEl.textContent = post.subtitle || '';

        const breadcrumbEl = document.getElementById('post-breadcrumb-current');
        if (breadcrumbEl) breadcrumbEl.textContent = post.title;

        const metaEl = document.getElementById('post-meta');
        if (metaEl) metaEl.innerHTML = `<span>${post.author}</span><span class="text-line">&middot;</span><span>${formatPostDate(post.datePublished)}</span><span class="text-line">&middot;</span><span>${post.readTime}</span>`;

        const contentEl = document.getElementById('post-content');
        if (contentEl) contentEl.innerHTML = post.content;

        const relatedEl = document.getElementById('post-related');
        if (relatedEl) {
          relatedEl.innerHTML = sortedPosts.filter(p => p.slug !== post.slug).slice(0, 2).map(postCardHtml).join('');
        }

        const schemaEl = document.getElementById('post-schema');
        if (schemaEl) {
          try {
            const schema = JSON.parse(schemaEl.textContent);
            schema.headline = post.title;
            schema.description = post.metaDescription;
            schema.datePublished = post.datePublished;
            schema.dateModified = post.dateModified;
            schema.mainEntityOfPage['@id'] = postUrl;
            schemaEl.textContent = JSON.stringify(schema);
          } catch (e) { /* leave static schema as-is */ }
        }

        const breadcrumbSchemaEl = document.getElementById('post-breadcrumb-schema');
        if (breadcrumbSchemaEl) {
          try {
            const schema = JSON.parse(breadcrumbSchemaEl.textContent);
            schema.itemListElement[2].name = post.title;
            schema.itemListElement[2].item = postUrl;
            breadcrumbSchemaEl.textContent = JSON.stringify(schema);
          } catch (e) { /* leave static schema as-is */ }
        }

        postArticle.classList.remove('hidden');
      }
    }
  }

  // Swaps sections depending on who you are. I contain multitudes; so does this form.
  const clientTypeInputs = document.querySelectorAll('input[name="clientType"]');
  if (clientTypeInputs.length) {
    const businessOnlyEls = document.querySelectorAll('.business-only');

    const renumberSections = () => {
      let n = 1;
      document.querySelectorAll('.form-section').forEach(section => {
        if (!section.hidden) {
          const badge = section.querySelector('.section-number');
          if (badge) badge.textContent = String(n).padStart(2, '0');
          n++;
        }
      });
    };

    const applyClientType = () => {
      const checked = document.querySelector('input[name="clientType"]:checked');
      const isIndividual = checked ? checked.value === 'Individual' : false;
      businessOnlyEls.forEach(el => { el.hidden = isIndividual; });
      renumberSections();
    };

    clientTypeInputs.forEach(input => input.addEventListener('change', applyClientType));
  }

  // Tracks where you are in the form. Wish something like this existed for my inbox.
  const railLinks = document.querySelectorAll('.rail-link');
  const formSections = document.querySelectorAll('.form-section');
  if (railLinks.length && formSections.length) {
    const setActive = (id) => {
      railLinks.forEach(link => {
        const active = link.dataset.section === id;
        const dot = link.querySelector('span');
        link.classList.toggle('text-navydeep', active);
        link.classList.toggle('font-semibold', active);
        link.classList.toggle('border-gold', active);
        link.classList.toggle('text-inksoft', !active);
        link.classList.toggle('border-line', !active);
        if (dot) {
          dot.classList.toggle('bg-gold', active);
          dot.classList.toggle('bg-line', !active);
        }
      });
    };
    const spy = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) setActive(entry.target.getAttribute('id'));
      });
    }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });
    formSections.forEach(sec => spy.observe(sec));
  }

  // Makes sure you didn't forget a field. I would never do that to you. Probably.
  const intakeForm = document.getElementById('intake-form');
  if (intakeForm) {

    const VALIDATORS = [
      {
        inputs: () => [document.querySelector('input[name="fullName"]')],
        borderEl: () => document.querySelector('input[name="fullName"]'),
        errorEl: () => document.getElementById('error-fullName'),
        getMessage: (inputs) => inputs[0].validity.valueMissing ? 'Full name is required.' : ''
      },
      {
        inputs: () => [document.querySelector('input[name="dob"]')],
        borderEl: () => document.querySelector('input[name="dob"]'),
        errorEl: () => document.getElementById('error-dob'),
        getMessage: (inputs) => inputs[0].validity.valueMissing ? 'Date of birth is required.' : ''
      },
      {
        inputs: () => Array.from(document.querySelectorAll('input[name="sex"]')),
        borderEl: () => document.getElementById('box-sex'),
        errorEl: () => document.getElementById('error-sex'),
        getMessage: (inputs) => inputs.some(i => i.checked) ? '' : 'Please select your sex.'
      },
      {
        inputs: () => [document.querySelector('input[name="phone"]')],
        borderEl: () => document.querySelector('input[name="phone"]'),
        errorEl: () => document.getElementById('error-phone'),
        getMessage: (inputs) => {
          if (inputs[0].validity.valueMissing) return 'Phone number is required.';
          if (inputs[0].validity.patternMismatch) return 'Enter a valid phone number.';
          return '';
        }
      },
      {
        inputs: () => [document.querySelector('input[name="email"]')],
        borderEl: () => document.querySelector('input[name="email"]'),
        errorEl: () => document.getElementById('error-email'),
        getMessage: (inputs) => {
          if (inputs[0].validity.valueMissing) return 'Email is required.';
          if (inputs[0].validity.typeMismatch) return 'Enter a valid email address.';
          return '';
        }
      },
      {
        inputs: () => Array.from(document.querySelectorAll('input[name="tobacco"]')),
        borderEl: () => document.getElementById('box-tobacco'),
        errorEl: () => document.getElementById('error-tobacco'),
        getMessage: (inputs) => inputs.some(i => i.checked) ? '' : 'Please answer this question.'
      },
      {
        inputs: () => [document.querySelector('input[name="consent"]')],
        borderEl: () => document.getElementById('box-consent'),
        errorEl: () => document.getElementById('error-consent'),
        getMessage: (inputs) => inputs[0].checked ? '' : 'Please confirm to continue.'
      }
    ];

    function checkField(validator) {
      const inputs = validator.inputs();
      if (!inputs[0]) return true;
      const message = validator.getMessage(inputs);
      const errorEl = validator.errorEl();
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.toggle('hidden', !message);
      }
      const borderEl = validator.borderEl();
      if (borderEl) {
        borderEl.classList.toggle('border-red-500', !!message);
        borderEl.classList.toggle('border-gold', !message);
      }
      return !message;
    }

    function checkAllFields() {
      let allValid = true;
      let firstInvalidEl = null;
      VALIDATORS.forEach(v => {
        if (!checkField(v)) {
          allValid = false;
          if (!firstInvalidEl) firstInvalidEl = v.borderEl();
        }
      });
      return { allValid, firstInvalidEl };
    }

    let hasAttemptedSubmit = false;
    VALIDATORS.forEach(v => {
      v.inputs().forEach(input => {
        if (!input) return;
        input.addEventListener('input', () => { if (hasAttemptedSubmit) checkField(v); });
        input.addEventListener('change', () => { if (hasAttemptedSubmit) checkField(v); });
      });
    });

    intakeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hasAttemptedSubmit = true;
      const { allValid, firstInvalidEl } = checkAllFields();
      if (!allValid) {
        if (firstInvalidEl) firstInvalidEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      const statusEl = document.getElementById('form-status');
      const body = new URLSearchParams(new FormData(intakeForm));

      statusEl.textContent = 'Submitting…';
      statusEl.className = 'text-[13.5px] mb-3.5 text-inksoft';

      try {
        const res = await fetch(window.location.pathname, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString()
        });
        if (!res.ok) throw new Error('Submission failed');
        statusEl.textContent = 'Thank you — your contact form has been submitted.';
        statusEl.className = 'text-[13.5px] mb-3.5 text-green-700';
        intakeForm.reset();
      } catch (err) {
        statusEl.textContent = 'Something went wrong submitting this. Please email ethan@marchandwealth.ca directly.';
        statusEl.className = 'text-[13.5px] mb-3.5 text-red-700';
      }
    });
  }

  // Shows the calendar, or a backup plan if Google's having a day.
  const gcalFrame = document.getElementById('gcal-embed');
  const gcalFallback = document.getElementById('gcal-fallback');
  if (gcalFrame && gcalFallback) {
    const src = gcalFrame.getAttribute('src') || '';
    if (!src || src.includes('PASTE_YOUR_APPOINTMENT_LINK_HERE')) {
      gcalFrame.style.display = 'none';
      gcalFallback.classList.remove('hidden');
      gcalFallback.classList.add('flex');
    }
  }

  // The whole TFSA calculator lives below. Built by hand, checked by caffeine.
  const tfsaAgeInput = document.getElementById('tfsa-age');
  if (tfsaAgeInput && typeof TFSA_ANNUAL_LIMITS !== 'undefined') {

    const el = {
      age: tfsaAgeInput,
      currentBalance: document.getElementById('tfsa-current-balance'),
      balance: document.getElementById('tfsa-balance'),
      balanceError: document.getElementById('tfsa-error-contributions'),
      contribution: document.getElementById('tfsa-contribution'),
      contributionNote: document.getElementById('tfsa-contribution-note'),
      scheduleBody: document.getElementById('tfsa-schedule-body'),
      lifetimeRoom: document.getElementById('tfsa-lifetime-room'),
      contributedEst: document.getElementById('tfsa-contributed-est'),
      retireAge: document.getElementById('tfsa-retire-age'),
      retireAgeVal: document.getElementById('tfsa-retire-age-val'),
      summaryRetireAge: document.getElementById('tfsa-summary-retire-age'),
      rateAccum: document.getElementById('tfsa-rate-accum'),
      rateAccumVal: document.getElementById('tfsa-rate-accum-val'),
      rateRetire: document.getElementById('tfsa-rate-retire'),
      rateRetireVal: document.getElementById('tfsa-rate-retire-val'),
      fvTotal: document.getElementById('tfsa-fv-total'),
      fvContribPct: document.getElementById('tfsa-fv-contrib-pct'),
      fvGrowthPct: document.getElementById('tfsa-fv-growth-pct'),
      monthlyIncome: document.getElementById('tfsa-monthly-income'),
      catchupNote: document.getElementById('tfsa-catchup-note'),
      increaseEstimate: document.getElementById('tfsa-increase-estimate'),
      donutContrib: document.getElementById('donut-contrib'),
      donutGrowth: document.getElementById('donut-growth'),
      donutTotal: document.getElementById('donut-total'),
      chart: document.getElementById('tfsa-area-chart'),
      chartStartLabel: document.getElementById('chart-age-start-label'),
      chartEndLabel: document.getElementById('chart-age-end-label')
    };

    const currency = (n) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(Math.max(0, Math.round(n || 0)));

    const formatCompact = (n) => {
      if (n >= 1000000) return '$' + (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
      if (n >= 1000) return '$' + Math.round(n / 1000) + 'k';
      return '$' + Math.round(n);
    };

    // The engine room. More reliable than my New Year's resolutions.
    const knownYears = Object.keys(TFSA_ANNUAL_LIMITS).map(Number).sort((a, b) => a - b);
    const firstKnownYear = knownYears[0];
    const lastKnownYear = knownYears[knownYears.length - 1];
    const lastKnownLimit = TFSA_ANNUAL_LIMITS[lastKnownYear];

    function estimateAnnualIncrease() {
      const windowSize = Math.min(10, knownYears.length - 1);
      if (windowSize <= 0) return 0;
      const recent = knownYears.slice(-(windowSize + 1));
      let totalDelta = 0;
      for (let i = 1; i < recent.length; i++) {
        totalDelta += TFSA_ANNUAL_LIMITS[recent[i]] - TFSA_ANNUAL_LIMITS[recent[i - 1]];
      }
      return Math.max(0, totalDelta / windowSize);
    }
    const ANNUAL_INCREASE_ESTIMATE = estimateAnnualIncrease();

    function projectedLimitForYear(year) {
      if (TFSA_ANNUAL_LIMITS[year] != null) return TFSA_ANNUAL_LIMITS[year];
      if (year < firstKnownYear) return TFSA_ANNUAL_LIMITS[firstKnownYear];
      const yearsAhead = year - lastKnownYear;
      const raw = lastKnownLimit + ANNUAL_INCREASE_ESTIMATE * yearsAhead;
      return Math.max(lastKnownLimit, Math.round(raw / 500) * 500);
    }

    function lifetimeRoomForAge(age) {
      const currentYear = new Date().getFullYear();
      const turned18Year = currentYear - age + 18;
      const startYear = Math.max(firstKnownYear, turned18Year);
      let total = 0;
      for (let y = startYear; y <= currentYear; y++) total += projectedLimitForYear(y);
      return total;
    }

    // The whole point of this tool: given how much someone can actually
    // contribute each month, figure out — year by year — whether that pace
    // ever fully absorbs their unused room (backlog + newly added room),
    // and what happens to their contribution once it does. CRA never lets
    // anyone contribute more than the room that actually exists, so once
    // the backlog hits zero, the schedule automatically drops the
    // contribution down to that year's new limit — that's the "reduction."
    function buildContributionSchedule(currentAge, retireAge, availableRoomNow, plannedMonthlyContribution, keepMaxedOut) {
      const currentYear = new Date().getFullYear();
      const totalYears = Math.max(1, retireAge - currentAge);
      const plannedAnnual = keepMaxedOut ? Infinity : Math.max(0, plannedMonthlyContribution) * 12;

      // If the elected pace alone is more than everything available right
      // now (before any future room even arrives), contributions can't
      // realistically continue at that pace once this year's room runs
      // out — they pause and pick back up next year with fresh room.
      const pausedThisYear = !keepMaxedOut && plannedAnnual > availableRoomNow + 0.5;

      let backlog = Math.max(0, availableRoomNow);
      let maxedOutCalendarYear = null;
      let maxedOutAge = null;
      let reducedMonthlyAfterCatchup = null;

      // If this year's room runs out mid-pace, model this year on its own:
      // contributions actually stop the moment the available room is used
      // up, so the schedule (and everything projected from it) shows the
      // real capped amount for this year instead of silently carrying the
      // full attempted pace into next year's numbers.
      let currentYearContribution = null;
      let fullMonthsThisYear = 0;
      let finalPartialMonth = 0;
      const rows = [];
      if (pausedThisYear) {
        currentYearContribution = backlog;
        if (plannedMonthlyContribution > 0) {
          fullMonthsThisYear = Math.min(12, Math.floor(backlog / plannedMonthlyContribution + 1e-9));
          finalPartialMonth = Math.round((backlog - fullMonthsThisYear * plannedMonthlyContribution) * 100) / 100;
          if (finalPartialMonth < 0.5) finalPartialMonth = 0;
        }
        rows.push({ year: currentYear, age: currentAge, monthlyContribution: currentYearContribution / 12, capped: true });
        backlog = 0;
      }

      for (let k = 1; k <= totalYears; k++) {
        const year = currentYear + k;
        const age = currentAge + k;
        const newRoomThisYear = projectedLimitForYear(year);
        const availableThisYear = backlog + newRoomThisYear;
        const annualContribution = Math.min(plannedAnnual, availableThisYear);
        const capped = !keepMaxedOut && annualContribution < plannedAnnual - 0.01;

        backlog = Math.max(0, availableThisYear - annualContribution);

        if (maxedOutCalendarYear === null && backlog <= 0 && annualContribution >= newRoomThisYear - 0.01) {
          maxedOutCalendarYear = year;
          maxedOutAge = age;
          reducedMonthlyAfterCatchup = newRoomThisYear / 12;
        }

        rows.push({ year, age, monthlyContribution: annualContribution / 12, capped });
      }

      return {
        rows,
        everCatchesUp: maxedOutCalendarYear !== null,
        maxedOutCalendarYear,
        maxedOutAge,
        reducedMonthlyAfterCatchup,
        remainingBacklogAtRetirement: backlog,
        pausedThisYear,
        currentYearContribution,
        fullMonthsThisYear,
        finalPartialMonth
      };
    }

    function renderScheduleTable(rows) {
      if (!el.scheduleBody) return;
      el.scheduleBody.innerHTML = rows.map(row => {
        const dotClass = row.capped ? 'bg-olive' : 'bg-gold';
        const textClass = row.capped ? 'text-olive' : 'text-golddim';
        const label = row.capped ? 'Capped by available room' : 'At your pace';
        return `<tr>
          <td class="px-4 py-2 text-inksoft">${row.year}</td>
          <td class="px-4 py-2 text-inksoft">${row.age}</td>
          <td class="px-4 py-2 text-right font-semibold text-navydeep">${currency(row.monthlyContribution)}/mo</td>
          <td class="px-4 py-2"><span class="inline-flex items-center gap-1.5 text-[11.5px] font-semibold ${textClass}"><span class="w-1.5 h-1.5 rounded-full ${dotClass} inline-block"></span>${label}</span></td>
        </tr>`;
      }).join('');
    }

    function buildProjectionSeries(currentAge, startBalance, scheduleRows, annualRatePct) {
      const monthlyRate = (annualRatePct / 100) / 12;
      let balance = startBalance;
      let principal = startBalance;
      const series = [{ age: currentAge, principal, total: balance }];
      scheduleRows.forEach(row => {
        for (let m = 0; m < 12; m++) {
          balance = balance * (1 + monthlyRate) + row.monthlyContribution;
          principal += row.monthlyContribution;
        }
        series.push({ age: row.age, principal, total: balance });
      });
      return series;
    }

    function monthlyIncomeFromBalance(balance, annualRatePct, years) {
      const monthlyRate = (annualRatePct / 100) / 12;
      const n = Math.max(1, Math.round(years * 12));
      if (monthlyRate === 0) return balance / n;
      return balance * monthlyRate / (1 - Math.pow(1 + monthlyRate, -n));
    }

    // Shared layout/scales/drawing helpers for the SVG chart below.
    const CHART_LAYOUT = { W: 640, H: 260, padL: 46, padR: 10, padT: 14, padB: 10 };

    function chartScales(minAge, maxAge, maxVal) {
      const { W, H, padL, padR, padT, padB } = CHART_LAYOUT;
      const chartW = W - padL - padR;
      const chartH = H - padT - padB;
      return {
        x: (age) => padL + (maxAge === minAge ? 0 : (age - minAge) / (maxAge - minAge)) * chartW,
        y: (val) => padT + chartH - (val / maxVal) * chartH
      };
    }

    function drawChartGrid(svg, ns, maxVal, y) {
      const { W, padL, padR } = CHART_LAYOUT;
      const gridSteps = 4;
      for (let i = 0; i <= gridSteps; i++) {
        const val = (maxVal / gridSteps) * i;
        const gy = y(val);
        const line = document.createElementNS(ns, 'line');
        line.setAttribute('x1', padL); line.setAttribute('x2', W - padR);
        line.setAttribute('y1', gy); line.setAttribute('y2', gy);
        line.setAttribute('stroke', '#ddd7ca'); line.setAttribute('stroke-width', '1');
        if (i !== 0) line.setAttribute('stroke-dasharray', '3 4');
        svg.appendChild(line);

        const label = document.createElementNS(ns, 'text');
        label.setAttribute('x', padL - 6); label.setAttribute('y', gy + 4);
        label.setAttribute('text-anchor', 'end'); label.setAttribute('font-size', '11'); label.setAttribute('fill', '#565f6c');
        label.textContent = formatCompact(val);
        svg.appendChild(label);
      }
    }

    function drawChartAxis(svg, ns, baselineY) {
      const { W, padL, padR } = CHART_LAYOUT;
      const axis = document.createElementNS(ns, 'line');
      axis.setAttribute('x1', padL); axis.setAttribute('x2', W - padR);
      axis.setAttribute('y1', baselineY); axis.setAttribute('y2', baselineY);
      axis.setAttribute('stroke', '#565f6c'); axis.setAttribute('stroke-width', '1.5');
      svg.appendChild(axis);
    }

    function drawChart(series) {
      const svg = el.chart;
      const ns = 'http://www.w3.org/2000/svg';
      svg.innerHTML = '';

      const minAge = series[0].age;
      const maxAge = series[series.length - 1].age;
      const maxVal = Math.max(1, series[series.length - 1].total);
      const { x, y } = chartScales(minAge, maxAge, maxVal);
      const baselineY = y(0);

      drawChartGrid(svg, ns, maxVal, y);

      const principalPoints = series.map(p => ({ x: x(p.age), y: y(p.principal) }));
      const totalPoints = series.map(p => ({ x: x(p.age), y: y(p.total) }));
      const baselinePoints = principalPoints.map(p => ({ x: p.x, y: baselineY }));

      function bandPath(topPts, bottomPts) {
        let d = `M ${topPts[0].x} ${topPts[0].y} `;
        for (let i = 1; i < topPts.length; i++) d += `L ${topPts[i].x} ${topPts[i].y} `;
        for (let i = bottomPts.length - 1; i >= 0; i--) d += `L ${bottomPts[i].x} ${bottomPts[i].y} `;
        d += 'Z';
        return d;
      }

      const contribPath = document.createElementNS(ns, 'path');
      contribPath.setAttribute('d', bandPath(principalPoints, baselinePoints));
      contribPath.setAttribute('fill', '#c1a57b'); contribPath.setAttribute('fill-opacity', '0.85');
      svg.appendChild(contribPath);

      const growthPath = document.createElementNS(ns, 'path');
      growthPath.setAttribute('d', bandPath(totalPoints, principalPoints));
      growthPath.setAttribute('fill', '#6d6650'); growthPath.setAttribute('fill-opacity', '0.85');
      svg.appendChild(growthPath);

      drawChartAxis(svg, ns, baselineY);
    }

    function getContributionMode() {
      const checked = document.querySelector('input[name="tfsa-contribution-mode"]:checked');
      return checked ? checked.value : 'amount';
    }

    function recompute() {
      const rawAge = parseInt(el.age.value, 10);
      const age = Math.max(18, Math.min(150, isNaN(rawAge) ? 18 : rawAge));
      // Nobody's client has hit 150 yet, but I like to plan for every contingency.
      if (rawAge > 150) el.age.value = 150;

      el.retireAge.min = age + 1;
      el.retireAge.max = Math.max(85, age + 1);
      if (parseInt(el.retireAge.value, 10) <= age) el.retireAge.value = Math.min(el.retireAge.max, age + 30);
      const retireAge = parseInt(el.retireAge.value, 10);
      el.retireAgeVal.textContent = retireAge;
      if (el.summaryRetireAge) el.summaryRetireAge.textContent = retireAge;

      const rateAccum = parseFloat(el.rateAccum.value);
      el.rateAccumVal.textContent = rateAccum;
      const rateRetire = parseFloat(el.rateRetire.value);
      el.rateRetireVal.textContent = rateRetire;

      // Catch an over-contribution: nobody can have contributed more than
      // the total room that's existed since they turned 18.
      const lifetimeRoom = lifetimeRoomForAge(age);
      const rawContributed = Math.max(0, parseFloat(el.balance.value) || 0);
      const isOverContributed = rawContributed > lifetimeRoom;

      if (el.balanceError) {
        if (isOverContributed) {
          el.balanceError.textContent = `That's more than the estimated ${currency(lifetimeRoom)} someone age ${age} could have contributed by now — double check the number, or your exact room in CRA My Account.`;
          el.balanceError.classList.remove('hidden');
          el.balance.classList.add('border-red-500');
          el.balance.classList.remove('border-line');
        } else {
          el.balanceError.classList.add('hidden');
          el.balance.classList.remove('border-red-500');
          el.balance.classList.add('border-line');
        }
      }

      const contributed = Math.min(rawContributed, lifetimeRoom);
      const availableRoomNow = Math.max(0, lifetimeRoom - contributed);
      el.lifetimeRoom.textContent = currency(lifetimeRoom);
      el.contributedEst.textContent = currency(contributed);

      // The actual account value (contributions + any growth) is what
      // compounds forward — "contributed" above is only used for the room
      // math, since CRA tracks room off deposits, not market value.
      const startBalance = Math.max(0, parseFloat(el.currentBalance.value) || 0);

      const keepMaxedOut = getContributionMode() === 'max';
      el.contribution.disabled = keepMaxedOut;
      el.contribution.classList.toggle('opacity-50', keepMaxedOut);
      const plannedMonthly = Math.max(0, parseFloat(el.contribution.value) || 0);

      // Step 1: does this pace ever catch up, and does the illustration
      // need to show it pausing this year and resuming next once the room
      // runs out? CRA never lets anyone contribute more than the room that
      // actually exists, so the schedule caps every year at what's real.
      const schedule = buildContributionSchedule(age, retireAge, availableRoomNow, plannedMonthly, keepMaxedOut);
      el.increaseEstimate.textContent = Math.round(ANNUAL_INCREASE_ESTIMATE);
      renderScheduleTable(schedule.rows);

      if (el.contributionNote) {
        if (schedule.pausedThisYear) {
          const paceParts = [];
          if (schedule.fullMonthsThisYear > 0) {
            paceParts.push(`${schedule.fullMonthsThisYear} month${schedule.fullMonthsThisYear === 1 ? '' : 's'} at ${currency(plannedMonthly)}`);
          }
          if (schedule.finalPartialMonth > 0) {
            paceParts.push(`one final payment of ${currency(schedule.finalPartialMonth)}`);
          }
          const paceDescription = paceParts.length ? paceParts.join(', then ') : `a single ${currency(schedule.currentYearContribution)} contribution`;
          el.contributionNote.textContent = `That's more than you're allowed to contribute right now — only ${currency(availableRoomNow)} of room is available this year. At ${currency(plannedMonthly)}/mo, that covers ${paceDescription}, for ${currency(schedule.currentYearContribution)} total this year. We've modeled contributions resuming next year once fresh room becomes available.`;
          el.contributionNote.classList.remove('hidden');
        } else {
          el.contributionNote.classList.add('hidden');
        }
      }

      if (el.catchupNote) {
        if (keepMaxedOut) {
          el.catchupNote.innerHTML = `You've chosen to keep your TFSA maxed out every year &mdash; each year above uses that year's full available room automatically, so there's no separate catch-up date to hit.`;
        } else if (schedule.everCatchesUp) {
          el.catchupNote.innerHTML = `At ${currency(plannedMonthly)}/mo, you'll be fully caught up and maxing out your TFSA by <strong class="text-white">${schedule.maxedOutCalendarYear}</strong> (age <strong class="text-white">${schedule.maxedOutAge}</strong>) &mdash; after that, CRA only adds new room each year, so you'd need to drop to roughly <strong class="text-white">${currency(schedule.reducedMonthlyAfterCatchup)}/mo</strong> to match it exactly.`;
        } else {
          el.catchupNote.innerHTML = `At ${currency(plannedMonthly)}/mo, you won't fully catch up on your available room before age ${retireAge} &mdash; you'd still have about <strong class="text-white">${currency(schedule.remainingBacklogAtRetirement)}</strong> of unused room left.`;
        }
      }

      // Step 2: what it could grow into. This part I like better than my own RRSP statements.
      const series = buildProjectionSeries(age, startBalance, schedule.rows, rateAccum);
      const final = series[series.length - 1];
      const fvTotal = final.total;
      const fvPrincipal = final.principal;
      const contribPct = fvTotal > 0 ? Math.round((fvPrincipal / fvTotal) * 100) : 0;
      const growthPct = 100 - contribPct;

      el.fvTotal.textContent = currency(fvTotal);
      el.fvContribPct.textContent = contribPct;
      el.fvGrowthPct.textContent = growthPct;
      el.donutTotal.textContent = formatCompact(fvTotal);

      const circumference = 2 * Math.PI * 50;
      el.donutContrib.style.strokeDasharray = `${circumference}`;
      el.donutContrib.style.strokeDashoffset = `${circumference * (1 - contribPct / 100)}`;
      el.donutGrowth.style.strokeDasharray = `${circumference}`;
      el.donutGrowth.style.strokeDashoffset = `${circumference * (1 - growthPct / 100)}`;
      el.donutGrowth.style.transform = `rotate(${contribPct * 3.6}deg)`;
      el.donutGrowth.style.transformOrigin = '60px 60px';

      const payoutYears = Math.max(1, 95 - retireAge);
      const monthlyIncome = monthlyIncomeFromBalance(fvTotal, rateRetire, payoutYears);
      el.monthlyIncome.textContent = currency(monthlyIncome);

      el.chartStartLabel.textContent = 'Age ' + age;
      el.chartEndLabel.textContent = 'Age ' + retireAge;
      drawChart(series);
    }

    [el.age, el.currentBalance, el.balance, el.contribution, el.retireAge, el.rateAccum, el.rateRetire].forEach(input => {
      input.addEventListener('input', recompute);
    });

    document.querySelectorAll('input[name="tfsa-contribution-mode"]').forEach(input => {
      input.addEventListener('change', recompute);
    });

    // The numbers already updated themselves. This button just makes you feel better about it.
    const calcBtn = document.getElementById('tfsa-calculate-btn');
    const resultsEl = document.getElementById('tfsa-results');

    if (calcBtn && resultsEl) {
      calcBtn.addEventListener('click', () => {
        resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    // Keeps the FAQ current every year, so I don't have to remember to.
    function updateTfsaFaq() {
      const currentYear = new Date().getFullYear();
      const currentLimit = projectedLimitForYear(currentYear);
      let lifetimeMax = 0;
      for (let y = firstKnownYear; y <= currentYear; y++) lifetimeMax += projectedLimitForYear(y);

      document.querySelectorAll('.faq-dynamic-year').forEach(span => { span.textContent = currentYear; });
      const limitEl = document.getElementById('faq-current-limit');
      if (limitEl) limitEl.textContent = currency(currentLimit);
      const limitEl2 = document.getElementById('faq-current-limit-2');
      if (limitEl2) limitEl2.textContent = currency(currentLimit);
      const lifetimeEl = document.getElementById('faq-lifetime-max');
      if (lifetimeEl) lifetimeEl.textContent = currency(lifetimeMax);

      const schemaEl = document.getElementById('faq-schema');
      if (schemaEl) {
        try {
          const schema = JSON.parse(schemaEl.textContent);
          const limitQuestion = schema.mainEntity.find(q => q.name.startsWith('What is the TFSA contribution limit'));
          const perYearQuestion = schema.mainEntity.find(q => q.name === 'How much can I contribute to my TFSA every year?');
          if (limitQuestion) {
            limitQuestion.name = `What is the TFSA contribution limit for ${currentYear}?`;
            limitQuestion.acceptedAnswer.text = `The TFSA dollar limit for ${currentYear} is ${currency(currentLimit)}. If you were 18 or older in 2009 and have never contributed, your total lifetime TFSA contribution room by ${currentYear} is ${currency(lifetimeMax)}.`;
          }
          if (perYearQuestion) {
            perYearQuestion.acceptedAnswer.text = `The CRA sets a new annual TFSA dollar limit each year, usually indexed to inflation and rounded to the nearest $500. For ${currentYear}, that limit is ${currency(currentLimit)}. Unused room carries forward indefinitely, so your total available room is usually larger than just one year's limit.`;
          }
          schemaEl.textContent = JSON.stringify(schema);
        } catch (e) { /* shrug */ }
      }
    }

    recompute();
    updateTfsaFaq();
  }

  // "Send me your results" — same validation pattern as the main contact
  // form (gold box → red box on a missed required field), plus a snapshot
  // of the calculator's current numbers tucked into hidden fields on submit.
  const tfsaConsultForm = document.getElementById('tfsa-consult-form');
  if (tfsaConsultForm) {

    const TFSA_CONSULT_VALIDATORS = [
      {
        inputs: () => [document.querySelector('#tfsa-consult-form input[name="fullName"]')],
        borderEl: () => document.querySelector('#tfsa-consult-form input[name="fullName"]'),
        errorEl: () => document.getElementById('tfsa-error-fullName'),
        getMessage: (inputs) => inputs[0].validity.valueMissing ? 'Full name is required.' : ''
      },
      {
        inputs: () => Array.from(document.querySelectorAll('#tfsa-consult-form input[name="contactMethod"]')),
        borderEl: () => document.getElementById('tfsa-box-contact-method'),
        errorEl: () => document.getElementById('tfsa-error-contact-method'),
        getMessage: (inputs) => inputs.some(i => i.checked) ? '' : 'Please select a contact method.'
      },
      {
        inputs: () => [document.querySelector('#tfsa-consult-form input[name="phone"]')],
        borderEl: () => document.querySelector('#tfsa-consult-form input[name="phone"]'),
        errorEl: () => document.getElementById('tfsa-error-phone'),
        getMessage: (inputs) => {
          const method = document.querySelector('#tfsa-consult-form input[name="contactMethod"]:checked');
          const needsPhone = !!method && (method.value === 'Call' || method.value === 'Text');
          if (!needsPhone) return '';
          if (!inputs[0].value.trim()) return 'Phone number is required for a call or text.';
          if (inputs[0].validity.patternMismatch) return 'Enter a valid phone number.';
          return '';
        }
      },
      {
        inputs: () => [document.querySelector('#tfsa-consult-form input[name="email"]')],
        borderEl: () => document.querySelector('#tfsa-consult-form input[name="email"]'),
        errorEl: () => document.getElementById('tfsa-error-email'),
        getMessage: (inputs) => {
          const method = document.querySelector('#tfsa-consult-form input[name="contactMethod"]:checked');
          const needsEmail = !!method && method.value === 'Email';
          if (!needsEmail) return '';
          if (!inputs[0].value.trim()) return 'Email is required.';
          if (inputs[0].validity.typeMismatch) return 'Enter a valid email address.';
          return '';
        }
      },
      {
        inputs: () => [document.querySelector('#tfsa-consult-form select[name="province"]')],
        borderEl: () => document.querySelector('#tfsa-consult-form select[name="province"]'),
        errorEl: () => document.getElementById('tfsa-error-province'),
        getMessage: (inputs) => inputs[0].validity.valueMissing ? 'Please select your province.' : ''
      }
    ];

    function checkTfsaConsultField(validator) {
      const inputs = validator.inputs();
      if (!inputs[0]) return true;
      const message = validator.getMessage(inputs);
      const errorEl = validator.errorEl();
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.toggle('hidden', !message);
      }
      const borderEl = validator.borderEl();
      if (borderEl) {
        borderEl.classList.toggle('border-red-500', !!message);
        borderEl.classList.toggle('border-gold', !message);
      }
      return !message;
    }

    function checkAllTfsaConsultFields() {
      let allValid = true;
      let firstInvalidEl = null;
      TFSA_CONSULT_VALIDATORS.forEach(v => {
        if (!checkTfsaConsultField(v)) {
          allValid = false;
          if (!firstInvalidEl) firstInvalidEl = v.borderEl();
        }
      });
      return { allValid, firstInvalidEl };
    }

    // Re-validating every field (not just the one that changed) on any
    // input keeps phone/email in sync when the contact method flips.
    let tfsaConsultAttemptedSubmit = false;
    TFSA_CONSULT_VALIDATORS.forEach(v => {
      v.inputs().forEach(input => {
        if (!input) return;
        input.addEventListener('input', () => { if (tfsaConsultAttemptedSubmit) checkAllTfsaConsultFields(); });
        input.addEventListener('change', () => { if (tfsaConsultAttemptedSubmit) checkAllTfsaConsultFields(); });
      });
    });

    tfsaConsultForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      tfsaConsultAttemptedSubmit = true;
      const { allValid, firstInvalidEl } = checkAllTfsaConsultFields();
      if (!allValid) {
        if (firstInvalidEl) firstInvalidEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      // Snapshot the calculator's current results into the hidden fields
      // right before submitting, so they're sent along with the contact info.
      const getVal = (id) => { const target = document.getElementById(id); return target ? target.value : ''; };
      const getText = (id) => { const target = document.getElementById(id); return target ? target.textContent : ''; };
      document.getElementById('results-age').value = getVal('tfsa-age');
      document.getElementById('results-retire-age').value = getVal('tfsa-retire-age');
      document.getElementById('results-tfsa-current-balance').value = getVal('tfsa-current-balance');
      document.getElementById('results-tfsa-balance').value = getVal('tfsa-balance');
      const contribModeChecked = document.querySelector('input[name="tfsa-contribution-mode"]:checked');
      document.getElementById('results-contribution-mode').value = contribModeChecked ? contribModeChecked.value : 'amount';
      document.getElementById('results-monthly-contribution').value = getVal('tfsa-contribution');
      document.getElementById('results-fv-total').value = getText('tfsa-fv-total');
      document.getElementById('results-tfsa-monthly-income').value = getText('tfsa-monthly-income');

      const statusEl = document.getElementById('tfsa-consult-status');
      const body = new URLSearchParams(new FormData(tfsaConsultForm));

      statusEl.textContent = 'Submitting…';
      statusEl.className = 'text-[13.5px] min-h-0 text-inksoft';

      try {
        const res = await fetch(window.location.pathname, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString()
        });
        if (!res.ok) throw new Error('Submission failed');
        statusEl.textContent = 'Thank you — your results have been sent. I\'ll be in touch soon.';
        statusEl.className = 'text-[13.5px] min-h-0 text-green-700';
        tfsaConsultForm.reset();
      } catch (err) {
        statusEl.textContent = 'Something went wrong submitting this. Please email ethan@marchandwealth.ca directly.';
        statusEl.className = 'text-[13.5px] min-h-0 text-red-700';
      }
    });
  }

});
