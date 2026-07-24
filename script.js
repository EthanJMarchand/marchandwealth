document.addEventListener('DOMContentLoaded', () => {

  /* ---------------- Footer year ---------------- */
  document.querySelectorAll('#year').forEach(el => {
    el.textContent = new Date().getFullYear();
  });

  /* ---------------- Mobile nav toggle ---------------- */
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

  /* ---------------- FAQ accordion ---------------- */
  document.querySelectorAll('.faq-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      item.classList.toggle('open');
    });
  });

  /* ---------------- Intake form: personal vs. business toggle ---------------- */
  const clientTypeInputs = document.querySelectorAll('input[name="clientType"]');
  if (clientTypeInputs.length) {
    const businessOnlyEls = document.querySelectorAll('.business-only');

    // Keeps the "01, 02, 03..." badges sequential when a section is hidden,
    // so it never looks like a step went missing.
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

  /* ---------------- Intake form: scroll-spy rail ---------------- */
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

  /* ---------------- Intake form: submit handling (Netlify Forms) ---------------- */
  const intakeForm = document.getElementById('intake-form');
  if (intakeForm) {
    intakeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
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
        statusEl.textContent = 'Thank you — your questionnaire has been submitted.';
        statusEl.className = 'text-[13.5px] mb-3.5 text-green-700';
        intakeForm.reset();
      } catch (err) {
        statusEl.textContent = 'Something went wrong submitting this. Please email ethan@marchandwealth.com directly.';
        statusEl.className = 'text-[13.5px] mb-3.5 text-red-700';
      }
    });
  }

  /* ---------------- Schedule page: iframe / fallback swap ---------------- */
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

  /* ---------------- TFSA calculator ---------------- */
  const tfsaAgeInput = document.getElementById('tfsa-age');
  if (tfsaAgeInput && typeof TFSA_ANNUAL_LIMITS !== 'undefined') {

    const el = {
      age: tfsaAgeInput,
      room: document.getElementById('tfsa-room'),
      balance: document.getElementById('tfsa-balance'),
      years: document.getElementById('tfsa-years'),
      yearsVal: document.getElementById('tfsa-years-val'),
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
      chartEndLabel: document.getElementById('chart-age-end-label')
    };

    const currency = (n) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(Math.max(0, Math.round(n || 0)));

    const formatCompact = (n) => {
      if (n >= 1000000) return '$' + (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
      if (n >= 1000) return '$' + Math.round(n / 1000) + 'k';
      return '$' + Math.round(n);
    };

    // Years present in tfsa-limits.js, sorted ascending
    const knownYears = Object.keys(TFSA_ANNUAL_LIMITS).map(Number).sort((a, b) => a - b);
    const firstKnownYear = knownYears[0];
    const lastKnownYear = knownYears[knownYears.length - 1];
    const lastKnownLimit = TFSA_ANNUAL_LIMITS[lastKnownYear];

    // "Guesses" how much the CRA raises the TFSA limit per year, based on
    // the trailing average of up to the last 10 real year-over-year changes
    // in tfsa-limits.js. This automatically improves as Ethan adds real
    // years — it only fills in years nobody has entered yet.
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

    // Returns the real limit for any year already in tfsa-limits.js. For a
    // year beyond the last entry, projects it forward using the estimated
    // annual increase, rounded to the nearest $500 (the CRA only ever moves
    // the TFSA limit in $500 steps).
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

    // Builds the full year-by-year contribution plan from today to
    // retirement. During the requested catch-up window, the plan absorbs
    // BOTH today's available room AND every new year of room that arrives
    // while catching up — so the monthly figure accounts for room the CRA
    // keeps adding along the way, not just today's snapshot. Once caught
    // up, contributions drop to that year's newly projected room only.
    function buildContributionSchedule(currentAge, retireAge, availableRoomNow, catchUpYearsRequested) {
      const currentYear = new Date().getFullYear();
      const totalYears = Math.max(1, retireAge - currentAge);
      const n = Math.max(1, Math.min(catchUpYearsRequested, totalYears));

      let incomingDuringCatchUp = 0;
      for (let k = 1; k <= n; k++) incomingDuringCatchUp += projectedLimitForYear(currentYear + k);

      const totalToAbsorb = Math.max(0, availableRoomNow) + incomingDuringCatchUp;
      const catchUpAnnual = totalToAbsorb / n;

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
        catchUpAnnual,
        catchUpMonthly: catchUpAnnual / 12,
        catchUpYear: currentYear + n,
        catchUpAge: currentAge + n,
        maintainMonthlyStart: rows.length > n ? rows[n].monthlyContribution : catchUpAnnual / 12
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

    // Builds a year-by-year balance series straight from the contribution
    // schedule above, so the growth chart always matches the plan exactly.
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

    // Monthly payment that fully draws a balance down to zero over `years`,
    // growing at `annualRatePct` along the way (standard annuity payout).
    function monthlyIncomeFromBalance(balance, annualRatePct, years) {
      const monthlyRate = (annualRatePct / 100) / 12;
      const n = Math.max(1, Math.round(years * 12));
      if (monthlyRate === 0) return balance / n;
      return balance * monthlyRate / (1 - Math.pow(1 + monthlyRate, -n));
    }

    function drawChart(series) {
      const svg = el.chart;
      const ns = 'http://www.w3.org/2000/svg';
      svg.innerHTML = '';

      const W = 640, H = 260, padL = 46, padR = 10, padT = 14, padB = 10;
      const chartW = W - padL - padR;
      const chartH = H - padT - padB;
      const minAge = series[0].age;
      const maxAge = series[series.length - 1].age;
      const maxVal = Math.max(1, series[series.length - 1].total);

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

      const axis = document.createElementNS(ns, 'line');
      axis.setAttribute('x1', padL); axis.setAttribute('x2', W - padR);
      axis.setAttribute('y1', baselineY); axis.setAttribute('y2', baselineY);
      axis.setAttribute('stroke', '#565f6c'); axis.setAttribute('stroke-width', '1.5');
      svg.appendChild(axis);
    }

    function recompute() {
      const age = Math.max(18, Math.min(90, parseInt(el.age.value, 10) || 18));
      const room = Math.max(0, parseFloat(el.room.value) || 0);
      const balance = Math.max(0, parseFloat(el.balance.value) || 0);

      // Keep the retirement-age slider valid relative to current age
      el.retireAge.min = age + 1;
      if (parseInt(el.retireAge.value, 10) <= age) el.retireAge.value = Math.min(85, age + 30);
      const retireAge = parseInt(el.retireAge.value, 10);
      el.retireAgeVal.textContent = retireAge;

      // Keep the catch-up slider from asking for more years than remain until retirement
      const maxCatchUpYears = Math.max(1, Math.min(10, retireAge - age));
      el.years.max = maxCatchUpYears;
      if (parseInt(el.years.value, 10) > maxCatchUpYears) el.years.value = maxCatchUpYears;
      const catchUpYearsRequested = parseInt(el.years.value, 10);
      el.yearsVal.textContent = catchUpYearsRequested;

      const rateAccum = parseFloat(el.rateAccum.value);
      el.rateAccumVal.textContent = rateAccum;
      const rateRetire = parseFloat(el.rateRetire.value);
      el.rateRetireVal.textContent = rateRetire;

      // ---- Step 1: catching up ----
      const schedule = buildContributionSchedule(age, retireAge, room, catchUpYearsRequested);
      el.monthlyNeeded.textContent = currency(schedule.catchUpMonthly);
      el.catchupDate.textContent = schedule.catchUpYear;
      el.catchupAge.textContent = schedule.catchUpAge;
      el.maintainMonthly.textContent = currency(schedule.maintainMonthlyStart);
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

      // ---- Step 2: retirement projection ----
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
      drawChart(series);
    }

    [el.age, el.room, el.balance, el.years, el.retireAge, el.rateAccum, el.rateRetire].forEach(input => {
      input.addEventListener('input', recompute);
    });

    // ---------------- TFSA calculator: keep the FAQ current ----------------
    // These two answers depend on "today's year" and the data in
    // tfsa-limits.js, so they're generated here instead of hand-edited —
    // add a new year to tfsa-limits.js and both the visible FAQ text and
    // its FAQPage schema update on their own, no further edits needed.
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

      // Keep the FAQPage structured data in sync with the visible answers above
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
        } catch (e) { /* malformed schema block — leave the static fallback in place */ }
      }
    }

    recompute();
    updateTfsaFaq();
  }

});
