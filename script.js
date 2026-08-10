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
      room: document.getElementById('tfsa-room'),
      balance: document.getElementById('tfsa-balance'),
      years: document.getElementById('tfsa-years'),
      yearsVal: document.getElementById('tfsa-years-val'),
      yearsHint: document.getElementById('tfsa-years-hint'),
      headlineLabel: document.getElementById('tfsa-headline-label'),
      catchupLine: document.getElementById('tfsa-catchup-line'),
      maxedLine: document.getElementById('tfsa-maxed-line'),
      maintainLine: document.getElementById('tfsa-maintain-line'),
      monthlyNeeded: document.getElementById('tfsa-monthly-needed'),
      catchupDate: document.getElementById('tfsa-catchup-date'),
      catchupAge: document.getElementById('tfsa-catchup-age'),
      maintainMonthly: document.getElementById('tfsa-maintain-monthly'),
      increaseEstimate: document.getElementById('tfsa-increase-estimate'),
      scheduleBody: document.getElementById('tfsa-schedule-body'),
      lifetimeRoom: document.getElementById('tfsa-lifetime-room'),
      contributedEst: document.getElementById('tfsa-contributed-est'),
      contributedPct: document.getElementById('tfsa-contributed-pct'),
      progressBar: document.getElementById('tfsa-progress-bar'),
      availableDisplay: document.getElementById('tfsa-available-display'),
      retireAge: document.getElementById('tfsa-retire-age'),
      retireAgeVal: document.getElementById('tfsa-retire-age-val'),
      rateAccum: document.getElementById('tfsa-rate-accum'),
      rateAccumVal: document.getElementById('tfsa-rate-accum-val'),
      rateRetire: document.getElementById('tfsa-rate-retire'),
      rateRetireVal: document.getElementById('tfsa-rate-retire-val'),
      fvTotal: document.getElementById('tfsa-fv-total'),
      fvContribPct: document.getElementById('tfsa-fv-contrib-pct'),
      fvGrowthPct: document.getElementById('tfsa-fv-growth-pct'),
      monthlyIncome: document.getElementById('tfsa-monthly-income'),
      donutContrib: document.getElementById('donut-contrib'),
      donutGrowth: document.getElementById('donut-growth'),
      donutTotal: document.getElementById('donut-total'),
      chart: document.getElementById('tfsa-area-chart'),
      chartStartLabel: document.getElementById('chart-age-start-label'),
      chartEndLabel: document.getElementById('chart-age-end-label'),
      rrspEquivalent: document.getElementById('tfsa-rrsp-equivalent'),
      rrspFvContribPct: document.getElementById('tfsa-rrsp-fv-contrib-pct'),
      rrspFvGrowthPct: document.getElementById('tfsa-rrsp-fv-growth-pct'),
      donutRrspContrib: document.getElementById('donut-rrsp-contrib'),
      donutRrspGrowth: document.getElementById('donut-rrsp-growth'),
      donutRrspTotal: document.getElementById('donut-rrsp-total'),
      rrspMonthlyIncome: document.getElementById('tfsa-rrsp-monthly-income')
    };

    // The RRSP-equivalent scenario lives in the comparison section below,
    // but it's computed here too since "Projected TFSA value at retirement"
    // now illustrates the RRSP side by side with it.
    const cmp = {
      income: document.getElementById('cmp-income'),
      incomeVal: document.getElementById('cmp-income-val'),
      needAge: document.getElementById('cmp-need-age'),
      needAgeVal: document.getElementById('cmp-need-age-val'),
      whatifAgeEcho: document.getElementById('cmp-whatif-age-echo'),
      whatifRrspCost: document.getElementById('cmp-whatif-rrsp-cost'),
      whatifRrspPct: document.getElementById('cmp-whatif-rrsp-pct'),
      winnerHeadline: document.getElementById('cmp-winner-headline'),
      currentRate: document.getElementById('cmp-current-rate'),
      retireRate: document.getElementById('cmp-retire-rate'),
      retireYear: document.getElementById('cmp-retire-year'),
      chart: document.getElementById('cmp-chart'),
      chartStartLabel: document.getElementById('cmp-chart-start-label'),
      chartEndLabel: document.getElementById('cmp-chart-end-label')
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

    // Tax-bracket engine for the RRSP side. Income and bracket thresholds
    // are both projected forward using the same COST_OF_LIVING_RATE, so a
    // person's marginal rate holds steady in real terms for the whole
    // projection instead of drifting on two independently-fitted trends.
    const hasTaxData = typeof TAX_BRACKETS_BY_YEAR !== 'undefined' && typeof COST_OF_LIVING_RATE !== 'undefined';
    let projectedBracketsForYear = () => [];
    let marginalRateForIncome = () => 0;
    let taxOnIncome = () => 0;

    if (hasTaxData) {
      const taxYears = Object.keys(TAX_BRACKETS_BY_YEAR).map(Number).sort((a, b) => a - b);
      const firstTaxYear = taxYears[0];
      const lastTaxYear = taxYears[taxYears.length - 1];
      const lastBrackets = TAX_BRACKETS_BY_YEAR[lastTaxYear];

      projectedBracketsForYear = function(year) {
        if (TAX_BRACKETS_BY_YEAR[year]) return TAX_BRACKETS_BY_YEAR[year];
        if (year < firstTaxYear) return TAX_BRACKETS_BY_YEAR[firstTaxYear];
        const factor = Math.pow(1 + COST_OF_LIVING_RATE, year - lastTaxYear);
        return lastBrackets.map(b => ({
          upTo: b.upTo === Infinity ? Infinity : Math.round(b.upTo * factor / 50) * 50,
          rate: b.rate
        }));
      };

      marginalRateForIncome = function(year, income) {
        const brackets = projectedBracketsForYear(year);
        for (const b of brackets) if (income <= b.upTo) return b.rate;
        return brackets[brackets.length - 1].rate;
      };

      // Full progressive tax on a given income, assumed to be someone's only income that year.
      taxOnIncome = function(year, income) {
        const brackets = projectedBracketsForYear(year);
        let tax = 0, lower = 0;
        for (const b of brackets) {
          if (income <= lower) break;
          tax += (Math.min(income, b.upTo) - lower) * (b.rate / 100);
          lower = b.upTo;
          if (income <= b.upTo) break;
        }
        return tax;
      };
    }

    // Same contribution stream as the TFSA, grossed up by reinvesting each
    // year's RRSP tax refund back in — the closed form of C + Cr + Cr² + …
    // (contribute the refund, get a refund on the refund, forever).
    function rrspContributionRows(scheduleRows, marginalRatePct) {
      const factor = 1 / (1 - marginalRatePct / 100);
      return scheduleRows.map(row => ({ age: row.age, monthlyContribution: row.monthlyContribution * factor }));
    }

    // If you're already maxed out, congratulations — nothing to catch up on here.
    function buildContributionSchedule(currentAge, retireAge, availableRoomNow, catchUpYearsRequested) {
      const currentYear = new Date().getFullYear();
      const totalYears = Math.max(1, retireAge - currentAge);
      const isAlreadyMaxed = availableRoomNow <= 0;
      const n = isAlreadyMaxed ? 0 : Math.max(1, Math.min(catchUpYearsRequested, totalYears));

      let incomingDuringCatchUp = 0;
      for (let k = 1; k <= n; k++) incomingDuringCatchUp += projectedLimitForYear(currentYear + k);

      const totalToAbsorb = Math.max(0, availableRoomNow) + incomingDuringCatchUp;
      const catchUpAnnual = n > 0 ? totalToAbsorb / n : 0;

      const rows = [];
      for (let k = 1; k <= totalYears; k++) {
        const year = currentYear + k;
        const age = currentAge + k;
        const annualLimit = projectedLimitForYear(year);
        const isCatchUp = k <= n;
        const annualContribution = isCatchUp ? catchUpAnnual : annualLimit;
        rows.push({
          year, age, phase: isCatchUp ? 'catchup' : 'maintain',
          annualLimit, annualContribution, monthlyContribution: annualContribution / 12
        });
      }

      return {
        rows,
        effectiveCatchUpYears: n,
        isAlreadyMaxed,
        catchUpAnnual,
        catchUpMonthly: catchUpAnnual / 12,
        catchUpYear: currentYear + n,
        catchUpAge: currentAge + n,
        maintainMonthlyStart: rows.length > n ? rows[n].monthlyContribution : rows[0].monthlyContribution
      };
    }

    function renderScheduleTable(rows) {
      el.scheduleBody.innerHTML = rows.map(row => {
        const isCatchUp = row.phase === 'catchup';
        const dotClass = isCatchUp ? 'bg-gold' : 'bg-olive';
        const textClass = isCatchUp ? 'text-golddim' : 'text-olive';
        const label = isCatchUp ? 'Catching Up' : 'Maintaining';
        return `<tr>
          <td class="px-4 py-2 text-inksoft">${row.year}</td>
          <td class="px-4 py-2 text-inksoft">${row.age}</td>
          <td class="px-4 py-2"><span class="inline-flex items-center gap-1.5 text-[12px] font-semibold ${textClass}"><span class="w-1.5 h-1.5 rounded-full ${dotClass} inline-block"></span>${label}</span></td>
          <td class="px-4 py-2 text-right text-inksoft">${currency(row.annualLimit)}</td>
          <td class="px-4 py-2 text-right font-semibold text-navydeep">${currency(row.annualContribution)}</td>
          <td class="px-4 py-2 text-right text-inksoft">${currency(row.monthlyContribution)}</td>
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

    // Draws a balance down to (roughly) zero by drawEndAge, withdrawing the
    // same fixed monthly amount monthlyIncomeFromBalance already computed
    // for that balance/rate/horizon — so the chart matches the income figures.
    function buildDecumulationSeries(startAge, drawEndAge, startBalance, annualRatePct, monthlyWithdrawal) {
      const monthlyRate = (annualRatePct / 100) / 12;
      let balance = startBalance;
      const points = [{ age: startAge, total: Math.max(0, balance) }];
      for (let a = startAge; a < drawEndAge; a++) {
        for (let m = 0; m < 12; m++) {
          balance = balance * (1 + monthlyRate) - monthlyWithdrawal;
        }
        points.push({ age: a + 1, total: Math.max(0, balance) });
      }
      return points;
    }

    function drawChart(series, rrspSeries) {
      const svg = el.chart;
      const ns = 'http://www.w3.org/2000/svg';
      svg.innerHTML = '';

      const W = 640, H = 260, padL = 46, padR = 10, padT = 14, padB = 10;
      const chartW = W - padL - padR;
      const chartH = H - padT - padB;
      const minAge = series[0].age;
      const maxAge = series[series.length - 1].age;
      const maxVal = Math.max(1, series[series.length - 1].total, rrspSeries ? rrspSeries[rrspSeries.length - 1].total : 0);

      const x = (age) => padL + (maxAge === minAge ? 0 : (age - minAge) / (maxAge - minAge)) * chartW;
      const y = (val) => padT + chartH - (val / maxVal) * chartH;
      const baselineY = y(0);

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

      if (rrspSeries) {
        const rrspPoints = rrspSeries.map(p => ({ x: x(p.age), y: y(p.total) }));
        const rrspLine = document.createElementNS(ns, 'path');
        rrspLine.setAttribute('d', rrspPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' '));
        rrspLine.setAttribute('fill', 'none'); rrspLine.setAttribute('stroke', '#232a35');
        rrspLine.setAttribute('stroke-width', '2.5'); rrspLine.setAttribute('stroke-dasharray', '5 4');
        svg.appendChild(rrspLine);
      }

      const axis = document.createElementNS(ns, 'line');
      axis.setAttribute('x1', padL); axis.setAttribute('x2', W - padR);
      axis.setAttribute('y1', baselineY); axis.setAttribute('y2', baselineY);
      axis.setAttribute('stroke', '#565f6c'); axis.setAttribute('stroke-width', '1.5');
      svg.appendChild(axis);
    }

    // TFSA vs. RRSP over the full age-to-95 span — accumulation then
    // drawdown for both — with a "what if" drop annotation showing the RRSP
    // curve taking a lump-sum tax hit wherever needAge lands on that timeline.
    function drawComparisonChart(tfsaSeries, rrspSeries, needAge, currentAge, retireAge, atNeedBalance, atNeedTax) {
      const svg = cmp.chart;
      const ns = 'http://www.w3.org/2000/svg';
      svg.innerHTML = '';

      const W = 640, H = 260, padL = 46, padR = 10, padT = 14, padB = 10;
      const chartW = W - padL - padR;
      const chartH = H - padT - padB;
      const minAge = tfsaSeries[0].age;
      const maxAge = tfsaSeries[tfsaSeries.length - 1].age;
      const maxVal = Math.max(1, ...tfsaSeries.map(p => p.total), ...rrspSeries.map(p => p.total));

      const x = (age) => padL + (maxAge === minAge ? 0 : (age - minAge) / (maxAge - minAge)) * chartW;
      const y = (val) => padT + chartH - (val / maxVal) * chartH;
      const baselineY = y(0);

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

      function linePath(points) {
        return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      }

      if (retireAge > minAge && retireAge < maxAge) {
        const retireX = x(retireAge);
        const retireLine = document.createElementNS(ns, 'line');
        retireLine.setAttribute('x1', retireX); retireLine.setAttribute('x2', retireX);
        retireLine.setAttribute('y1', padT); retireLine.setAttribute('y2', baselineY);
        retireLine.setAttribute('stroke', '#a8a294'); retireLine.setAttribute('stroke-width', '1'); retireLine.setAttribute('stroke-dasharray', '2 3');
        svg.appendChild(retireLine);

        const retireLabel = document.createElementNS(ns, 'text');
        retireLabel.setAttribute('x', retireX + 5); retireLabel.setAttribute('y', padT + 10);
        retireLabel.setAttribute('font-size', '10.5'); retireLabel.setAttribute('fill', '#8a8473');
        retireLabel.textContent = 'Retire';
        svg.appendChild(retireLabel);
      }

      const rrspLine = document.createElementNS(ns, 'path');
      rrspLine.setAttribute('d', linePath(rrspSeries.map(p => ({ x: x(p.age), y: y(p.total) }))));
      rrspLine.setAttribute('fill', 'none'); rrspLine.setAttribute('stroke', '#6d6650');
      rrspLine.setAttribute('stroke-width', '2.5'); rrspLine.setAttribute('stroke-dasharray', '5 4');
      svg.appendChild(rrspLine);

      const tfsaLine = document.createElementNS(ns, 'path');
      tfsaLine.setAttribute('d', linePath(tfsaSeries.map(p => ({ x: x(p.age), y: y(p.total) }))));
      tfsaLine.setAttribute('fill', 'none'); tfsaLine.setAttribute('stroke', '#c1a57b');
      tfsaLine.setAttribute('stroke-width', '3');
      svg.appendChild(tfsaLine);

      if (atNeedTax > 0) {
        const dropX = x(needAge);
        const topY = y(atNeedBalance);
        const bottomY = y(Math.max(0, atNeedBalance - atNeedTax));

        const dropLine = document.createElementNS(ns, 'line');
        dropLine.setAttribute('x1', dropX); dropLine.setAttribute('x2', dropX);
        dropLine.setAttribute('y1', topY); dropLine.setAttribute('y2', bottomY);
        dropLine.setAttribute('stroke', '#9c4a3c'); dropLine.setAttribute('stroke-width', '2.5');
        dropLine.setAttribute('stroke-dasharray', '4 3');
        svg.appendChild(dropLine);

        const dot = document.createElementNS(ns, 'circle');
        dot.setAttribute('cx', dropX); dot.setAttribute('cy', bottomY); dot.setAttribute('r', '4');
        dot.setAttribute('fill', '#9c4a3c');
        svg.appendChild(dot);

        const nearRightEdge = dropX > W - padR - 70;
        const label = document.createElementNS(ns, 'text');
        label.setAttribute('x', nearRightEdge ? dropX - 6 : dropX + 6);
        label.setAttribute('y', (topY + bottomY) / 2);
        label.setAttribute('text-anchor', nearRightEdge ? 'end' : 'start');
        label.setAttribute('font-size', '11'); label.setAttribute('font-weight', '600'); label.setAttribute('fill', '#9c4a3c');
        label.textContent = '-' + formatCompact(atNeedTax);
        svg.appendChild(label);
      }

      const axis = document.createElementNS(ns, 'line');
      axis.setAttribute('x1', padL); axis.setAttribute('x2', W - padR);
      axis.setAttribute('y1', baselineY); axis.setAttribute('y2', baselineY);
      axis.setAttribute('stroke', '#565f6c'); axis.setAttribute('stroke-width', '1.5');
      svg.appendChild(axis);
    }

    function recompute() {
      const rawAge = parseInt(el.age.value, 10);
      const age = Math.max(18, Math.min(150, isNaN(rawAge) ? 18 : rawAge));
      // Nobody's client has hit 150 yet, but I like to plan for every contingency.
      if (rawAge > 150) el.age.value = 150;
      const room = Math.max(0, parseFloat(el.room.value) || 0);
      const balance = Math.max(0, parseFloat(el.balance.value) || 0);

      el.retireAge.min = age + 1;
      el.retireAge.max = Math.max(85, age + 1);
      if (parseInt(el.retireAge.value, 10) <= age) el.retireAge.value = Math.min(el.retireAge.max, age + 30);
      const retireAge = parseInt(el.retireAge.value, 10);
      el.retireAgeVal.textContent = retireAge;

      const maxCatchUpYears = Math.max(1, Math.min(10, retireAge - age));
      el.years.max = maxCatchUpYears;
      if (parseInt(el.years.value, 10) > maxCatchUpYears) el.years.value = maxCatchUpYears;
      const catchUpYearsRequested = parseInt(el.years.value, 10);

      const rateAccum = parseFloat(el.rateAccum.value);
      el.rateAccumVal.textContent = rateAccum;
      const rateRetire = parseFloat(el.rateRetire.value);
      el.rateRetireVal.textContent = rateRetire;

      // Step 1: how much catching up you've got to do. Hopefully less than me at the gym.
      const schedule = buildContributionSchedule(age, retireAge, room, catchUpYearsRequested);
      el.catchupDate.textContent = schedule.catchUpYear;
      el.catchupAge.textContent = schedule.catchUpAge;
      el.maintainMonthly.textContent = currency(schedule.maintainMonthlyStart);

      el.years.disabled = schedule.isAlreadyMaxed;
      if (schedule.isAlreadyMaxed) {
        el.monthlyNeeded.textContent = currency(schedule.maintainMonthlyStart);
        el.headlineLabel.textContent = "You're already maxed out";
        el.catchupLine.classList.add('hidden');
        el.maxedLine.classList.remove('hidden');
        el.maintainLine.classList.add('hidden');
        el.yearsVal.textContent = 'N/A';
        el.yearsHint.textContent = "You're already fully caught up, so there's no catch-up window needed right now.";
      } else {
        el.monthlyNeeded.textContent = currency(schedule.catchUpMonthly);
        el.headlineLabel.textContent = 'You need to save';
        el.catchupLine.classList.remove('hidden');
        el.maxedLine.classList.add('hidden');
        el.maintainLine.classList.remove('hidden');
        el.yearsVal.textContent = catchUpYearsRequested;
        el.yearsHint.textContent = "New room keeps arriving while you catch up too — the target below already accounts for it.";
      }
      el.increaseEstimate.textContent = Math.round(ANNUAL_INCREASE_ESTIMATE);
      renderScheduleTable(schedule.rows);

      const lifetimeRoom = lifetimeRoomForAge(age);
      const contributedEst = Math.max(0, lifetimeRoom - room);
      const contributedPct = lifetimeRoom > 0 ? Math.round((contributedEst / lifetimeRoom) * 100) : 0;

      el.lifetimeRoom.textContent = currency(lifetimeRoom);
      el.contributedEst.textContent = currency(contributedEst);
      el.contributedPct.textContent = contributedPct;
      el.availableDisplay.textContent = currency(room);
      el.progressBar.style.width = Math.min(100, contributedPct) + '%';

      // Step 2: what it could grow into. This part I like better than my own RRSP statements.
      const series = buildProjectionSeries(age, balance, schedule.rows, rateAccum);
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

      // RRSP-equivalent scenario: same contributions, same starting balance,
      // same rates of return — just grossed up by reinvesting the tax
      // refund each contribution triggers, and taxed as ordinary income on
      // the way out instead of being tax-free.
      const currentYear = new Date().getFullYear();
      const income = Math.max(0, parseFloat(cmp.income.value) || 0);
      cmp.incomeVal.textContent = currency(income);

      const marginalRate = marginalRateForIncome(currentYear, income);
      cmp.currentRate.textContent = marginalRate + '%';

      const rrspRows = rrspContributionRows(schedule.rows, marginalRate);
      const rrspSeries = buildProjectionSeries(age, balance, rrspRows, rateAccum);
      drawChart(series, rrspSeries);
      const rrspFinal = rrspSeries[rrspSeries.length - 1];
      const rrspTotal = rrspFinal.total;
      const rrspPrincipal = rrspFinal.principal;
      const rrspContribPct = rrspTotal > 0 ? Math.round((rrspPrincipal / rrspTotal) * 100) : 0;
      const rrspGrowthPct = 100 - rrspContribPct;

      el.rrspEquivalent.textContent = currency(rrspTotal);
      el.rrspFvContribPct.textContent = rrspContribPct;
      el.rrspFvGrowthPct.textContent = rrspGrowthPct;
      el.donutRrspTotal.textContent = formatCompact(rrspTotal);
      el.donutRrspContrib.style.strokeDasharray = `${circumference}`;
      el.donutRrspContrib.style.strokeDashoffset = `${circumference * (1 - rrspContribPct / 100)}`;
      el.donutRrspGrowth.style.strokeDasharray = `${circumference}`;
      el.donutRrspGrowth.style.strokeDashoffset = `${circumference * (1 - rrspGrowthPct / 100)}`;
      el.donutRrspGrowth.style.transform = `rotate(${rrspContribPct * 3.6}deg)`;
      el.donutRrspGrowth.style.transformOrigin = '60px 60px';

      const retireYear = currentYear + (retireAge - age);
      const rrspAnnualWithdrawal = monthlyIncomeFromBalance(rrspTotal, rateRetire, payoutYears) * 12;
      const rrspWithdrawalTax = taxOnIncome(retireYear, rrspAnnualWithdrawal);
      const rrspNetMonthly = Math.max(0, (rrspAnnualWithdrawal - rrspWithdrawalTax) / 12);
      el.rrspMonthlyIncome.textContent = currency(rrspNetMonthly);

      const retireMarginalRate = marginalRateForIncome(retireYear, rrspAnnualWithdrawal);
      cmp.retireRate.textContent = retireMarginalRate + '%';
      cmp.retireYear.textContent = retireYear;

      const monthlyDiff = Math.abs(monthlyIncome - rrspNetMonthly);
      if (monthlyDiff < 5) {
        cmp.winnerHeadline.textContent = "It's close to a wash";
      } else if (monthlyIncome > rrspNetMonthly) {
        cmp.winnerHeadline.textContent = 'TFSA wins by ' + currency(monthlyDiff) + '/mo';
      } else {
        cmp.winnerHeadline.textContent = 'RRSP wins by ' + currency(monthlyDiff) + '/mo';
      }

      // Full lifetime picture: accumulate to retirement, then draw both
      // accounts down at the same monthly income already shown above, all
      // the way to age 95 — so "what if" can land anywhere in between.
      const tfsaDecum = buildDecumulationSeries(retireAge, 95, fvTotal, rateRetire, monthlyIncome);
      const rrspGrossMonthly = rrspAnnualWithdrawal / 12;
      const rrspDecum = buildDecumulationSeries(retireAge, 95, rrspTotal, rateRetire, rrspGrossMonthly);
      const tfsaLifeSeries = series.concat(tfsaDecum.slice(1));
      const rrspLifeSeries = rrspSeries.concat(rrspDecum.slice(1));

      // What if: the whole remaining RRSP balance needed as a lump sum at
      // "needAge" — whether that's before retirement (still saving) or
      // after (mid-drawdown) — instead of continuing as planned income.
      cmp.needAge.min = age + 1;
      cmp.needAge.max = 95;
      if (parseInt(cmp.needAge.value, 10) > 95 || parseInt(cmp.needAge.value, 10) <= age) cmp.needAge.value = retireAge;
      const needAge = parseInt(cmp.needAge.value, 10);
      cmp.needAgeVal.textContent = needAge;
      cmp.whatifAgeEcho.textContent = needAge;

      const atNeedRrsp = rrspLifeSeries[needAge - age] ? rrspLifeSeries[needAge - age].total : 0;
      const needYear = currentYear + (needAge - age);
      // Before retirement, "other income" that year is projected employment
      // income; from retirement on, it's the RRIF income already flowing —
      // the remaining balance stacks on top of that in the year you pass.
      const otherIncomeAtNeed = needAge <= retireAge
        ? income * Math.pow(1 + COST_OF_LIVING_RATE, needAge - age)
        : rrspAnnualWithdrawal;
      const rrspLumpSumTax = taxOnIncome(needYear, otherIncomeAtNeed + atNeedRrsp) - taxOnIncome(needYear, otherIncomeAtNeed);
      cmp.whatifRrspCost.textContent = currency(rrspLumpSumTax);
      cmp.whatifRrspPct.textContent = atNeedRrsp > 0 ? Math.round((rrspLumpSumTax / atNeedRrsp) * 100) : 0;

      cmp.chartStartLabel.textContent = 'Age ' + age;
      cmp.chartEndLabel.textContent = 'Age 95';
      drawComparisonChart(tfsaLifeSeries, rrspLifeSeries, needAge, age, retireAge, atNeedRrsp, rrspLumpSumTax);
    }

    [el.age, el.room, el.balance, el.years, el.retireAge, el.rateAccum, el.rateRetire, cmp.income, cmp.needAge].forEach(input => {
      input.addEventListener('input', recompute);
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

    // Beginning default for "Current TFSA balance": assume everything except
    // today's available room has already been contributed, using the same
    // stored TFSA-limit data as the rest of the calculator — stays correct
    // automatically as Ethan adds new years to TFSA_ANNUAL_LIMITS.
    const defaultAge = parseInt(el.age.value, 10);
    const defaultRoom = parseFloat(el.room.value) || 0;
    el.balance.value = Math.max(0, lifetimeRoomForAge(defaultAge) - defaultRoom);

    recompute();
    updateTfsaFaq();
  }

});
