import { canadaInflation } from "../data/inflation-canada.js";
import { cppAmounts } from "../data/cpp-amounts.js";
import { lifeExpectancy } from "../data/life-expectancy.js";
import { oasAmounts } from "../data/oas-amounts.js";
import { planningAssumptions as assumptions } from "../data/planning-assumptions.js";
import { probateFees, provinceOrder } from "../data/probate-fees.js";
import { rrspLimits } from "../data/rrsp-limits.js";
import { tfsaContributionLimit } from "../data/tfsa-contribution-limit.js";
import { projectFutureRoom } from "./calc/contribution-room.js";
import { deathTaxAtYear } from "./calc/death-tax.js";
import { roundPercent, trailingAverage } from "./calc/inflation.js";
import { calculateLifeNeed } from "./calc/life-need.js";
import { formatDollars, readMoney } from "./calc/money.js";
import { incomeYearsAtAge, projectLifeNeed } from "./calc/need-path.js";
import { cppContributionYears, estimateCpp, estimateOas, residenceYearsFromAge } from "./calc/pensions.js";
import { projectPortfolio } from "./calc/portfolio-path.js";
import { calculateProbate } from "./calc/probate.js";

const $ = (id) => document.getElementById(id);
const inflationHistory = trailingAverage(canadaInflation.annualPercent, 100);
const defaultInflation = roundPercent(inflationHistory.average);
const planHorizonAge = Math.round(lifeExpectancy.canada[lifeExpectancy.year].both);

const dirty = { tfsa: false, rrsp: false, nonreg: false, life: false, spouseLife: false, earlyNow: false, earlyAfter: false };

function todayISO() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function num(id) {
  return readMoney($(id).value);
}

function moneyOrBlank(amount) {
  const rounded = Math.round(amount);
  return String(rounded);
}

function clientName() {
  return $("client-name").value.trim() || "Client";
}

function spouseName() {
  return $("spouse-name").value.trim() || "Spouse";
}

function hasSpouse() {
  return document.querySelector('input[name="spouse"]:checked')?.value === "yes";
}

function planningIncome(lastId, averageId) {
  const average = num(averageId);
  return average > 0 ? average : num(lastId);
}

function dependantCount() {
  const raw = $("dependant-count").value.trim();
  if (raw === "") return 0;
  return Math.max(0, Math.min(12, Math.floor(readMoney(raw))));
}

function dependantField(index, value) {
  const label = document.createElement("label");
  label.className = "block text-sm font-medium";
  label.textContent = `Dependant ${index + 1} age`;
  const input = document.createElement("input");
  input.className = "mt-1 w-full rounded-sm border border-line bg-paperdim px-3.5 py-2.5 text-sm";
  input.inputMode = "numeric";
  input.dataset.depAge = "true";
  input.value = value;
  input.setAttribute("aria-label", `Age of dependant ${index + 1}`);
  label.append(input);
  return label;
}

function ensureDependantInputs() {
  const count = dependantCount();
  const list = $("dependant-ages");
  const existing = [...list.querySelectorAll("[data-dep-age]")];
  if (existing.length === count) return;
  const ages = existing.map((input) => input.value);
  list.replaceChildren();
  for (let index = 0; index < count; index += 1) {
    list.append(dependantField(index, ages[index] ?? ""));
  }
}

function dependantAges() {
  const ages = [];
  for (const input of document.querySelectorAll("[data-dep-age]")) {
    const raw = input.value.trim();
    if (raw === "") continue;
    const age = Number(raw);
    if (Number.isFinite(age) && age >= 0 && age <= 120) ages.push(age);
  }
  return ages;
}

function ageOf(id) {
  const raw = $(id).value.trim();
  if (raw === "") return null;
  const age = Number(raw);
  return Number.isFinite(age) ? age : null;
}

function endAge(age) {
  if (age == null) return planHorizonAge;
  return Math.max(age + 1, planHorizonAge);
}

function maxCpp() {
  return cppAmounts.maxMonthlyRetirementAt65 * 12;
}

function maxOas() {
  return oasAmounts.maxMonthlyAge65to74 * 12;
}

function clearLegacyStorage() {
  const keys = ["needs-worksheet.advisor", "needs-worksheet.draft", "needs-worksheet.cases"];
  try {
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // Storage may be blocked. The plan does not write anything.
  }
}

function initProvinces() {
  const select = $("province");
  for (const code of provinceOrder) {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = probateFees.provinces[code].name;
    select.append(option);
  }
  select.value = "AB";
}

function fillDefaults() {
  $("plan-date").value = todayISO();
  $("client-name").value = "Client";
  $("spouse-name").value = "Spouse";
  $("dependant-count").value = "0";
  $("income-years").value = "10";
  $("replacement-ratio").value = String(assumptions.survivorIncomeReplacement * 100);
  $("final-expenses").value = String(assumptions.finalExpenses);
  $("education-amount").value = String(assumptions.educationFundPerDependant);
  $("independence-age").value = String(assumptions.dependantIndependenceAge);
  $("retirement-age").value = "65";
  $("retirement-replacement").value = String(assumptions.retirementIncomeReplacement * 100);
  $("mortgage-years").value = "20";
  const rate = String(assumptions.realReturnBeforeRetirement * 100);
  $("tfsa-return").value = rate;
  $("rrsp-return").value = rate;
  $("nonreg-return").value = rate;
  if ($("province").options.length) $("province").value = "AB";
}

function pairSlider(eventTarget) {
  const pairs = [
    ["rec-tfsa-slider", "rec-tfsa", 10000],
    ["rec-rrsp-slider", "rec-rrsp", 10000],
    ["rec-nonreg-slider", "rec-nonreg", 10000],
  ];
  for (const [sliderId, inputId, max] of pairs) {
    if (eventTarget.id === sliderId) $(inputId).value = eventTarget.value;
    if (eventTarget.id === inputId) $(sliderId).value = String(Math.min(max, Math.max(0, readMoney(eventTarget.value))));
  }
}

function syncRecommendations() {
  const copy = (flag, monthlyId, inputId, sliderId) => {
    if (dirty[flag]) return;
    const amount = num(monthlyId);
    $(inputId).value = moneyOrBlank(amount);
    $(sliderId).value = String(Math.min(10000, Math.max(0, amount)));
  };
  copy("tfsa", "tfsa-monthly", "rec-tfsa", "rec-tfsa-slider");
  copy("rrsp", "rrsp-monthly", "rec-rrsp", "rec-rrsp-slider");
  copy("nonreg", "nonreg-monthly", "rec-nonreg", "rec-nonreg-slider");
}

function placeRange(id, age, end, flag) {
  const slider = $(id);
  if (age == null || end <= age) {
    slider.disabled = true;
    return null;
  }
  slider.disabled = false;
  slider.min = String(Math.ceil(age));
  slider.max = String(Math.floor(end));
  if (!dirty[flag]) slider.value = String(Math.round(Math.min(end - 1, Math.max(age + 1, age + 15))));
  return Math.min(Number(slider.max), Math.max(Number(slider.min), Number(slider.value)));
}

function buildPath(facts, monthly) {
  const inflation = defaultInflation;
  const spouse = facts.spouse;
  const clientIncome = facts.clientIncome;
  const spouseIncome = spouse ? facts.spouseIncome : 0;
  const province = facts.province;
  const rollover = spouse && facts.rollover;
  const probate = calculateProbate(province, facts.estate, { courtVerification: facts.qcVerification });
  const blend = (facts.rrspReturn + facts.nonRegReturn) / 2;
  const deathBase = {
    estate: facts.estate,
    rollover,
    province,
    savingsReturn: blend,
    inflationPercent: inflation,
  };
  const clientTax = deathTaxAtYear({ ...deathBase, income: clientIncome, rrsp: facts.rrsp, nonReg: facts.nonReg, years: 0 });
  const spouseTax = spouse
    ? deathTaxAtYear({ ...deathBase, income: spouseIncome, rrsp: 0, nonReg: 0, years: 0 })
    : null;
  const years = facts.age == null ? facts.incomeYears : incomeYearsAtAge(facts.age, facts.incomeYears, facts.retirementAge);
  const spouseYears = facts.spouseAge == null ? facts.incomeYears : incomeYearsAtAge(facts.spouseAge, facts.incomeYears, facts.retirementAge);
  const shared = {
    dependantAges: facts.ages,
    independenceAge: facts.independenceAge,
    educationPerDependant: facts.education,
    debts: facts.mortgage + facts.otherDebts,
    finalExpenses: facts.finalExpenses,
    probateFee: probate.fee,
    inflationPercent: inflation,
  };
  const life = calculateLifeNeed({
    ...shared,
    personalIncome: clientIncome,
    replacementRatio: facts.replacement,
    years,
    existingLifeInsurance: facts.existingCoverage,
    assetsAtDeath: facts.tfsa,
    deathTax: clientTax.total,
  });
  const spouseLife = spouse
    ? calculateLifeNeed({
        ...shared,
        personalIncome: spouseIncome,
        replacementRatio: facts.replacement,
        years: spouseYears,
        existingLifeInsurance: facts.spouseCoverage,
        assetsAtDeath: 0,
        deathTax: spouseTax.total,
      })
    : null;
  const until = endAge(facts.age);
  const pathInput = {
    currentAge: facts.age ?? 0,
    retirementAge: facts.retirementAge,
    incomeYearsAtStart: facts.incomeYears,
    personalIncome: clientIncome,
    replacementRatio: facts.replacement,
    dependantAges: facts.ages,
    plannedChildren: 0,
    independenceAge: facts.independenceAge,
    educationPerDependant: facts.education,
    mortgage: facts.mortgage,
    mortgageYears: facts.mortgageYears,
    otherDebts: facts.otherDebts,
    futureMortgage: 0,
    yearsUntilPurchase: 0,
    amortizationYears: 0,
    finalExpenses: facts.finalExpenses,
    probateFee: probate.fee,
    inflationPercent: inflation,
    taxAtYear: (elapsed) => deathTaxAtYear({
      ...deathBase,
      income: clientIncome,
      rrsp: facts.rrsp,
      nonReg: facts.nonReg,
      years: elapsed,
    }).total,
    existingLifeInsurance: facts.existingCoverage,
    assetsAtDeath: facts.tfsa,
  };
  const needPath = facts.age == null ? [] : projectLifeNeed(pathInput, until);
  const spouseNeedPath = spouse && facts.spouseAge != null
    ? projectLifeNeed({
        ...pathInput,
        currentAge: facts.spouseAge,
        personalIncome: spouseIncome,
        taxAtYear: (elapsed) => deathTaxAtYear({
          ...deathBase,
          income: spouseIncome,
          rrsp: 0,
          nonReg: 0,
          years: elapsed,
        }).total,
        existingLifeInsurance: facts.spouseCoverage,
        assetsAtDeath: 0,
      }, endAge(facts.spouseAge))
    : [];

  let portfolio = null;
  if (facts.age != null) {
    const span = Math.max(0, until - facts.age);
    const workYears = Math.max(0, (facts.retirementAge ?? until) - facts.age);
    const room = projectFutureRoom({
      yearsOfWork: workYears,
      taxYear: tfsaContributionLimit.taxYear,
      inflationRate: inflation / 100,
      personalIncome: clientIncome,
      partnerIncome: spouseIncome,
      hasPartner: spouse,
      clientAge: facts.age,
      partnerAge: spouse ? facts.spouseAge : null,
      tfsaLimits: tfsaContributionLimit.annualLimits,
      rrspLimitsByYear: rrspLimits.dollarLimits,
      rrspPercent: rrspLimits.earnedIncomePercent,
    });
    const cpp = estimateCpp(clientIncome, cppAmounts.ympe, maxCpp(), cppContributionYears(facts.age));
    const oas = estimateOas(residenceYearsFromAge(facts.age), maxOas());
    const spouseCpp = spouse ? estimateCpp(spouseIncome, cppAmounts.ympe, maxCpp(), cppContributionYears(facts.spouseAge)) : 0;
    const spouseOas = spouse ? estimateOas(residenceYearsFromAge(facts.spouseAge), maxOas()) : 0;
    const desired = (clientIncome + spouseIncome) * facts.retirementReplacement;
    portfolio = projectPortfolio({
      currentAge: facts.age,
      retirementAge: facts.retirementAge ?? 200,
      years: span,
      inflationRate: inflation / 100,
      savingsReturn: blend,
      retirementReturn: blend,
      useAccountReturns: true,
      tfsaReturn: facts.tfsaReturn,
      rrspReturn: facts.rrspReturn,
      nonRegReturn: facts.nonRegReturn,
      desiredIncomeToday: desired,
      tfsaAnnual: monthly.tfsa * 12,
      rrspAnnual: monthly.rrsp * 12,
      nonRegAnnual: monthly.nonreg * 12,
      tfsaOpening: facts.tfsa,
      rrspOpening: facts.rrsp,
      nonRegOpening: facts.nonReg,
      tfsaRoomNow: facts.tfsaRoom,
      rrspRoomNow: facts.rrspRoom,
      tfsaNewRoom: room.years.map((year) => (year.clientTfsa || 0) + (year.partnerTfsa || 0)),
      rrspNewRoom: room.years.map((year) => (year.clientRrsp || 0) + (year.partnerRrsp || 0)),
      province,
      clientCppToday: cpp,
      clientOasToday: oas,
      partnerCppToday: spouseCpp,
      partnerOasToday: spouseOas,
      partnerAge: spouse ? facts.spouseAge : null,
      oasRecoveryThreshold: oasAmounts.recoveryThreshold,
      oasRecoveryRate: oasAmounts.recoveryTaxRate,
      workingIncomeToday: clientIncome + spouseIncome,
      rollover,
      startYear: tfsaContributionLimit.taxYear,
    });
  }

  return { life, spouseLife, needPath, spouseNeedPath, portfolio, probate, clientTax, spouseTax };
}

function readFacts() {
  const spouse = hasSpouse();
  return {
    spouse,
    province: $("province").value || "AB",
    qcVerification: $("qc-verification").checked,
    clientIncome: planningIncome("income-last", "income-average"),
    spouseIncome: spouse ? planningIncome("spouse-income-last", "spouse-income-average") : 0,
    age: ageOf("client-age"),
    spouseAge: spouse ? ageOf("spouse-age") : null,
    ages: dependantAges(),
    incomeYears: num("income-years"),
    replacement: num("replacement-ratio") / 100,
    mortgage: num("debts"),
    mortgageYears: num("mortgage-years"),
    otherDebts: num("other-debts"),
    finalExpenses: num("final-expenses"),
    education: num("education-amount"),
    independenceAge: num("independence-age") || assumptions.dependantIndependenceAge,
    retirementAge: num("retirement-age") || 65,
    retirementReplacement: num("retirement-replacement") / 100,
    existingCoverage: num("existing-coverage"),
    spouseCoverage: spouse ? num("spouse-existing-coverage") : 0,
    estate: num("estate-value"),
    rollover: $("rrsp-rollover").checked,
    tfsa: num("tfsa-balance"),
    tfsaMonthly: num("tfsa-monthly"),
    tfsaRoom: num("tfsa-room"),
    tfsaReturn: num("tfsa-return") / 100,
    rrsp: num("rrsp-balance"),
    rrspMonthly: num("rrsp-monthly"),
    rrspRoom: num("rrsp-room"),
    rrspReturn: num("rrsp-return") / 100,
    nonReg: num("nonreg-balance"),
    nonRegMonthly: num("nonreg-monthly"),
    nonRegReturn: num("nonreg-return") / 100,
  };
}

function chartFrame(root) {
  if (!window.matchMedia("(max-width: 767px)").matches) {
    return { width: 640, height: 220, padLeft: 58, padRight: 12, padTop: 14, padBottom: 28 };
  }
  const width = Math.max(260, Math.round(root.clientWidth || 320));
  return { width, height: 190, padLeft: 52, padRight: 8, padTop: 12, padBottom: 26 };
}

function svgText(x, y, text, anchor) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", "text");
  node.setAttribute("x", String(x));
  node.setAttribute("y", String(y));
  node.setAttribute("fill", "#565f6c");
  node.setAttribute("font-size", "12");
  node.setAttribute("font-family", "Inter, system-ui, sans-serif");
  if (anchor) node.setAttribute("text-anchor", anchor);
  node.textContent = text;
  return node;
}

function compactDollars(value) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}k`;
  return formatDollars(value);
}

function drawSeries(root, { series, xLabels, aria, mark, tipAt }) {
  root.replaceChildren();
  const usable = series.filter((line) => line.values.length > 1);
  if (!usable.length) {
    root.textContent = "Add an age to draw this.";
    return;
  }
  const frame = chartFrame(root);
  const { width, height, padLeft, padRight, padTop, padBottom } = frame;
  const count = usable[0].values.length;
  const maxValue = Math.max(1, ...usable.flatMap((line) => line.values), mark ? mark.from : 0, mark ? mark.to : 0);
  const xFor = (index) => padLeft + (index / (count - 1)) * (width - padLeft - padRight);
  const yFor = (value) => padTop + (1 - value / maxValue) * (height - padTop - padBottom);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", aria);
  svg.classList.add("w-full");
  for (let step = 0; step <= 4; step += 1) {
    const value = (maxValue * step) / 4;
    const y = yFor(value);
    const grid = document.createElementNS("http://www.w3.org/2000/svg", "line");
    grid.setAttribute("x1", String(padLeft));
    grid.setAttribute("x2", String(width - padRight));
    grid.setAttribute("y1", String(y));
    grid.setAttribute("y2", String(y));
    grid.setAttribute("stroke", "#ddd7ca");
    svg.append(grid, svgText(padLeft - 8, y + 4, compactDollars(value), "end"));
  }
  [0, Math.floor((count - 1) / 2), count - 1].forEach((index) => {
    svg.append(svgText(xFor(index), height - 8, xLabels[index] || "", "middle"));
  });
  for (const line of usable) {
    const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    poly.setAttribute("fill", "none");
    poly.setAttribute("stroke", line.color);
    poly.setAttribute("stroke-width", line.width || "3");
    if (line.dash) poly.setAttribute("stroke-dasharray", line.dash);
    poly.setAttribute("points", line.values.map((value, index) => `${xFor(index)},${yFor(value)}`).join(" "));
    svg.append(poly);
  }
  if (mark && mark.index >= 0) {
    const drop = document.createElementNS("http://www.w3.org/2000/svg", "line");
    drop.setAttribute("x1", String(xFor(mark.index)));
    drop.setAttribute("x2", String(xFor(mark.index)));
    drop.setAttribute("y1", String(yFor(mark.from)));
    drop.setAttribute("y2", String(yFor(mark.to)));
    drop.setAttribute("stroke", "#b42318");
    drop.setAttribute("stroke-width", "3");
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", String(xFor(mark.index)));
    dot.setAttribute("cy", String(yFor(mark.to)));
    dot.setAttribute("r", "4");
    dot.setAttribute("fill", "#b42318");
    svg.append(drop, dot);
  }
  root.append(svg);
  if (!tipAt) return;
  const tip = document.createElement("div");
  tip.className = "need-tip rounded-sm bg-navydeep px-3 py-2 text-xs text-white shadow";
  const hit = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  hit.setAttribute("x", "0");
  hit.setAttribute("y", "0");
  hit.setAttribute("width", String(width));
  hit.setAttribute("height", String(height));
  hit.setAttribute("fill", "transparent");
  hit.style.touchAction = "pan-y";
  svg.append(hit);
  root.classList.add("need-chart");
  root.append(tip);
  const show = (event) => {
    const box = svg.getBoundingClientRect();
    if (!box.width) return;
    const x = ((event.clientX - box.left) / box.width) * width;
    const index = Math.round(((x - padLeft) / (width - padLeft - padRight)) * (count - 1));
    const point = Math.max(0, Math.min(count - 1, index));
    const lines = tipAt(point);
    tip.replaceChildren();
    lines.forEach((line, lineIndex) => {
      const paragraph = document.createElement("p");
      if (lineIndex === 1) paragraph.className = "text-base font-bold text-white";
      paragraph.textContent = line;
      tip.append(paragraph);
    });
    const tipWidth = Math.min(180, Math.max(112, box.width - 8));
    tip.style.maxWidth = `${tipWidth}px`;
    tip.style.opacity = "1";
    let left = (xFor(point) / width) * box.width + 8;
    if (left + tipWidth > box.width - 4) left = Math.max(4, box.width - tipWidth - 4);
    tip.style.left = `${left}px`;
    tip.style.top = "8px";
  };
  hit.addEventListener("pointerdown", show);
  hit.addEventListener("pointermove", show);
  hit.addEventListener("pointerleave", () => { tip.style.opacity = "0"; });
}

function fillBars(life) {
  const root = $("need-bars");
  root.replaceChildren();
  const parts = [
    ["Income", life.incomeCapital],
    ["Debts", life.debts],
    ["Education", life.educationCapital],
    ["Expenses and tax", life.floor],
  ].filter(([, amount]) => amount > 0);
  const max = Math.max(1, ...parts.map(([, amount]) => amount));
  for (const [label, amount] of parts) {
    const row = document.createElement("div");
    row.className = "grid grid-cols-[7.5rem_minmax(0,1fr)_auto] items-center gap-3 text-sm";
    const name = document.createElement("span");
    name.className = "text-inksoft";
    name.textContent = label;
    const track = document.createElement("span");
    track.className = "block h-2 rounded-sm bg-paperdim";
    const bar = document.createElement("span");
    bar.className = "block h-2 rounded-sm bg-navydeep";
    bar.style.width = `${Math.max(4, (amount / max) * 100)}%`;
    track.append(bar);
    const value = document.createElement("span");
    value.className = "nums";
    value.textContent = formatDollars(amount);
    row.append(name, track, value);
    root.append(row);
  }
}

function rowNearest(portfolio, age) {
  if (!portfolio?.rows?.length || age == null) return null;
  return portfolio.rows.reduce((best, row) => (Math.abs(row.age - age) < Math.abs(best.age - age) ? row : best));
}

function deathLine(row) {
  if (!row) return "";
  const after = Math.max(0, row.total - row.deathTax);
  return `Age ${Math.round(row.age)} · tax ${formatDollars(row.deathTax)} · ${formatDollars(after)} left`;
}

function markFor(portfolio, age) {
  const row = rowNearest(portfolio, age);
  if (!row) return null;
  const index = portfolio.rows.indexOf(row);
  return { index, from: row.total, to: Math.max(0, row.total - row.deathTax) };
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

function planPage(kicker, title) {
  const page = node("section", "plan-page");
  page.append(node("p", "text-xs font-semibold uppercase tracking-[0.16em] text-golddim", kicker));
  page.append(node("h2", "mt-3 font-serif text-4xl font-semibold text-navydeep", title));
  page.append(node("hr", "plan-rule mt-5"));
  return page;
}

function planRow(label, value) {
  const row = node("div", "flex items-baseline justify-between gap-4 border-b border-line py-2 text-sm");
  row.append(node("span", "text-inksoft", label), node("span", "nums text-right", value));
  return row;
}

function renderPlan(facts, current, recommended, earlyNow, earlyAfter) {
  const root = $("financial-plan");
  root.replaceChildren();
  const date = $("plan-date").value || "Date not set";
  const cover = planPage("Marchand Wealth", "Financial plan");
  cover.append(
    node("p", "mt-8 font-serif text-3xl text-navydeep", clientName()),
    node("p", "mt-2 text-sm text-inksoft", hasSpouse() ? `and ${spouseName()}` : "Individual plan"),
    node("p", "mt-6 text-sm text-inksoft", `${date} · Prepared by Ethan Marchand`),
    node("p", "mt-10 max-w-md text-sm leading-6 text-inksoft", "Insurance need, the savings path if nothing changes, and the path after the recommendation."),
  );
  root.append(cover);

  const household = planPage("Facts", "Household");
  const factsList = node("div", "mt-6");
  const rows = [
    ["Plan date", date],
    [clientName(), facts.age == null ? "Age not entered" : `Age ${facts.age}`],
    ["Last year's income", formatDollars(num("income-last"))],
    ["Five-year average income", formatDollars(num("income-average"))],
    ["Spouse", hasSpouse() ? spouseName() : "No"],
  ];
  if (hasSpouse()) {
    rows.push(
      [`${spouseName()} age`, facts.spouseAge == null ? "Not entered" : String(facts.spouseAge)],
      [`${spouseName()} last year`, formatDollars(num("spouse-income-last"))],
      [`${spouseName()} five-year average`, formatDollars(num("spouse-income-average"))],
    );
  }
  rows.push(
    ["Dependants", facts.ages.length ? facts.ages.join(", ") : "None"],
    ["Income to replace", `${facts.incomeYears} years at ${Math.round(facts.replacement * 100)}%`],
    ["Mortgage", formatDollars(facts.mortgage)],
    ["Other debts", formatDollars(facts.otherDebts)],
    ["Retirement age", String(facts.retirementAge)],
    ["Retirement income", `${Math.round(facts.retirementReplacement * 100)}% of income`],
    ["TFSA", `${formatDollars(facts.tfsa)} · ${formatDollars(facts.tfsaMonthly)} a month`],
    ["RRSP", `${formatDollars(facts.rrsp)} · ${formatDollars(facts.rrspMonthly)} a month`],
    ["Non-registered", `${formatDollars(facts.nonReg)} · ${formatDollars(facts.nonRegMonthly)} a month`],
  );
  for (const [label, value] of rows) factsList.append(planRow(label, value));
  household.append(factsList);
  root.append(household);

  const insurance = planPage("If death comes now", "Insurance need");
  insurance.append(node("p", "mt-8 font-serif text-5xl text-navydeep nums", formatDollars(current.life.capitalNeed)));
  insurance.append(node("p", "mt-2 text-sm text-inksoft", `${clientName()} · existing coverage ${formatDollars(facts.existingCoverage)}`));
  const chart = node("div", "need-chart mt-8");
  insurance.append(chart);
  if (current.spouseLife) {
    insurance.append(node("p", "mt-8 font-serif text-4xl text-navydeep nums", formatDollars(current.spouseLife.capitalNeed)));
    insurance.append(node("p", "mt-2 text-sm text-inksoft", spouseName()));
    const spouseChart = node("div", "need-chart mt-6");
    insurance.append(spouseChart);
    drawSeries(spouseChart, seriesFromNeed(current.spouseNeedPath, `${spouseName()} insurance need`));
  }
  root.append(insurance);
  drawSeries(chart, seriesFromNeed(current.needPath, `${clientName()} insurance need`));

  const today = planPage("If nothing changes", "Savings path");
  const nowRow = rowNearest(current.portfolio, earlyNow);
  today.append(node("p", "mt-8 text-sm text-inksoft", deathLine(nowRow) || "Add an age to see the path."));
  const wealth = node("div", "need-chart mt-6");
  today.append(wealth);
  root.append(today);
  drawSeries(wealth, seriesFromWealth(current.portfolio, earlyNow, "Savings if contributions stay where they are"));

  const advice = planPage("Recommendation", "What changes");
  advice.append(node("p", "mt-8 font-serif text-4xl text-navydeep nums", `${formatDollars(num("rec-tfsa") + num("rec-rrsp") + num("rec-nonreg"))} / month`));
  const adviceList = node("div", "mt-6");
  adviceList.append(
    planRow("TFSA", `${formatDollars(num("rec-tfsa"))} a month`),
    planRow("RRSP", `${formatDollars(num("rec-rrsp"))} a month`),
    planRow("Non-registered", `${formatDollars(num("rec-nonreg"))} a month`),
    planRow(`New life insurance, ${clientName()}`, formatDollars(num("rec-life"))),
  );
  if (hasSpouse()) adviceList.append(planRow(`New life insurance, ${spouseName()}`, formatDollars(num("rec-spouse-life"))));
  advice.append(adviceList);
  root.append(advice);

  const after = planPage("After the recommendation", "The two paths");
  const atRetireNow = rowNearest(current.portfolio, facts.retirementAge)?.total ?? 0;
  const atRetireNext = rowNearest(recommended.portfolio, facts.retirementAge)?.total ?? 0;
  after.append(node("p", "mt-8 text-sm text-inksoft", `At retirement: ${formatDollars(atRetireNow)} on the current path, ${formatDollars(atRetireNext)} after the recommendation.`));
  const compare = node("div", "need-chart mt-6");
  after.append(compare);
  const afterRow = rowNearest(recommended.portfolio, earlyAfter);
  after.append(node("p", "mt-4 text-sm text-inksoft", deathLine(afterRow)));
  const still = Math.max(0, current.life.capitalNeed - num("rec-life"));
  after.append(node("p", "mt-6 font-serif text-3xl text-navydeep nums", formatDollars(still)));
  after.append(node("p", "mt-1 text-sm text-inksoft", `Still open on ${clientName()} after the new life insurance.`));
  after.append(node("p", "mt-10 text-xs leading-5 text-inksoft", "Illustration only. Not a policy, not a tax opinion, and not a specific contract. Figures stay in this tab and are not saved."));
  root.append(after);
  drawSeries(compare, compareSeries(current.portfolio, recommended.portfolio, earlyAfter));
}

function seriesFromNeed(points, aria) {
  return {
    aria,
    series: [
      { values: points.map((point) => point.capitalNeed), color: "#2f3744" },
      { values: points.map((point) => point.mortgageLeft), color: "#a68a61", dash: "5 4", width: "2" },
    ],
    xLabels: labelMap(points.map((point) => String(point.age))),
    tipAt: (index) => {
      const point = points[index];
      return [`Age ${point.age}`, formatDollars(point.capitalNeed), point.mortgageLeft > 0 ? `Mortgage ${formatDollars(point.mortgageLeft)}` : "Capital need"];
    },
  };
}

function seriesFromWealth(portfolio, earlyAge, aria) {
  const rows = portfolio?.rows || [];
  return {
    aria,
    series: [{ values: rows.map((row) => row.total), color: "#2f3744" }],
    xLabels: labelMap(rows.map((row) => String(Math.round(row.age)))),
    mark: markFor(portfolio, earlyAge),
    tipAt: (index) => {
      const row = rows[index];
      return [`Age ${Math.round(row.age)}`, formatDollars(row.total)];
    },
  };
}

function compareSeries(current, recommended, earlyAge) {
  const rows = recommended?.rows?.length ? recommended.rows : current?.rows || [];
  const currentValues = (current?.rows || []).map((row) => row.total);
  const nextValues = (recommended?.rows || []).map((row) => row.total);
  return {
    aria: "Current savings path and the path after the recommendation",
    series: [
      { values: currentValues, color: "#a68a61", dash: "6 4", width: "2" },
      { values: nextValues, color: "#2f3744" },
    ],
    xLabels: labelMap(rows.map((row) => String(Math.round(row.age)))),
    mark: markFor(recommended, earlyAge),
    tipAt: (index) => [
      `Age ${Math.round(rows[index].age)}`,
      formatDollars(nextValues[index] || 0),
      `Today ${formatDollars(currentValues[index] || 0)}`,
    ],
  };
}

function labelMap(labels) {
  const map = [];
  if (!labels.length) return map;
  map[0] = labels[0];
  map[Math.floor((labels.length - 1) / 2)] = labels[Math.floor((labels.length - 1) / 2)];
  map[labels.length - 1] = labels[labels.length - 1];
  return map;
}

function render() {
  ensureDependantInputs();
  const spouse = hasSpouse();
  $("spouse-fields").classList.toggle("hidden", !spouse);
  $("spouse-coverage-wrap").classList.toggle("hidden", !spouse);
  $("spouse-need-block").classList.toggle("hidden", !spouse);
  $("rec-spouse-life-wrap").classList.toggle("hidden", !spouse);
  $("after-spouse-life-wrap").classList.toggle("hidden", !spouse);
  $("rollover-wrap").classList.toggle("hidden", !spouse);
  $("dependant-extra").classList.toggle("hidden", dependantCount() === 0);
  $("qc-wrap").classList.toggle("hidden", $("province").value !== "QC");
  syncRecommendations();

  const facts = readFacts();
  const current = buildPath(facts, { tfsa: facts.tfsaMonthly, rrsp: facts.rrspMonthly, nonreg: facts.nonRegMonthly });
  if (!dirty.life) $("rec-life").value = moneyOrBlank(current.life.capitalNeed);
  if (!dirty.spouseLife && current.spouseLife) $("rec-spouse-life").value = moneyOrBlank(current.spouseLife.capitalNeed);
  const recommended = buildPath(facts, { tfsa: num("rec-tfsa"), rrsp: num("rec-rrsp"), nonreg: num("rec-nonreg") });

  $("life-figure").textContent = formatDollars(current.life.capitalNeed);
  $("sticky-life").textContent = formatDollars(current.life.capitalNeed);
  $("life-caption").textContent = `${clientName()} · ${formatDollars(facts.existingCoverage)} already in place`;
  fillBars(current.life);
  drawSeries($("need-chart"), seriesFromNeed(current.needPath, `${clientName()} insurance need over time`));
  if (current.spouseLife) {
    $("spouse-life-figure").textContent = formatDollars(current.spouseLife.capitalNeed);
    drawSeries($("spouse-need-chart"), seriesFromNeed(current.spouseNeedPath, `${spouseName()} insurance need over time`));
  }

  const earlyNow = placeRange("early-now", facts.age, endAge(facts.age), "earlyNow");
  $("early-now-readout").textContent = deathLine(rowNearest(current.portfolio, earlyNow));
  drawSeries($("wealth-chart"), seriesFromWealth(current.portfolio, earlyNow, "Savings if monthly contributions stay where they are"));

  const monthly = num("rec-tfsa") + num("rec-rrsp") + num("rec-nonreg");
  $("sticky-monthly").textContent = formatDollars(monthly);
  $("compare-today").textContent = formatDollars(facts.tfsaMonthly + facts.rrspMonthly + facts.nonRegMonthly);
  $("compare-rec").textContent = formatDollars(monthly);
  $("retire-today").textContent = formatDollars(rowNearest(current.portfolio, facts.retirementAge)?.total ?? 0);
  $("retire-rec").textContent = formatDollars(rowNearest(recommended.portfolio, facts.retirementAge)?.total ?? 0);
  const earlyAfter = placeRange("early-after", facts.age, endAge(facts.age), "earlyAfter");
  $("early-after-readout").textContent = deathLine(rowNearest(recommended.portfolio, earlyAfter));
  drawSeries($("compare-chart"), compareSeries(current.portfolio, recommended.portfolio, earlyAfter));
  const still = Math.max(0, current.life.capitalNeed - num("rec-life"));
  $("after-life").textContent = formatDollars(still);
  if (current.spouseLife) {
    const spouseStill = Math.max(0, current.spouseLife.capitalNeed - num("rec-spouse-life"));
    $("after-spouse-life").textContent = formatDollars(spouseStill);
  }

  renderPlan(facts, current, recommended, earlyNow, earlyAfter);
}

function loadSample() {
  if (!confirm("Replace this plan with the sample household?")) return;
  fillDefaults();
  $("client-name").value = "Alex Morgan";
  $("client-age").value = "42";
  $("income-last").value = "95000";
  $("income-average").value = "90000";
  document.querySelector('input[name="spouse"][value="yes"]').checked = true;
  $("spouse-name").value = "Jordan Morgan";
  $("spouse-age").value = "40";
  $("spouse-income-last").value = "45000";
  $("spouse-income-average").value = "42000";
  $("dependant-count").value = "2";
  ensureDependantInputs();
  const ages = [...document.querySelectorAll("[data-dep-age]")];
  ages[0].value = "8";
  ages[1].value = "11";
  $("debts").value = "320000";
  $("mortgage-years").value = "20";
  $("existing-coverage").value = "100000";
  $("spouse-existing-coverage").value = "50000";
  $("tfsa-balance").value = "40000";
  $("tfsa-monthly").value = "200";
  $("tfsa-room").value = "20000";
  $("tfsa-return").value = "5";
  $("rrsp-balance").value = "80000";
  $("rrsp-monthly").value = "300";
  $("rrsp-room").value = "15000";
  $("rrsp-return").value = "5";
  $("nonreg-balance").value = "20000";
  $("nonreg-monthly").value = "0";
  $("nonreg-return").value = "4";
  dirty.tfsa = true;
  dirty.rrsp = true;
  dirty.nonreg = true;
  dirty.life = false;
  dirty.spouseLife = false;
  $("rec-tfsa").value = "500";
  $("rec-tfsa-slider").value = "500";
  $("rec-rrsp").value = "600";
  $("rec-rrsp-slider").value = "600";
  $("rec-nonreg").value = "200";
  $("rec-nonreg-slider").value = "200";
  render();
}

function clearPlan() {
  if (!confirm("Clear every entry on this plan?")) return;
  $("worksheet").reset();
  Object.keys(dirty).forEach((key) => { dirty[key] = false; });
  fillDefaults();
  render();
}

function init() {
  clearLegacyStorage();
  initProvinces();
  fillDefaults();
  render();
  $("worksheet").addEventListener("input", (event) => {
    const id = event.target.id;
    if (id === "rec-tfsa" || id === "rec-tfsa-slider") dirty.tfsa = true;
    if (id === "rec-rrsp" || id === "rec-rrsp-slider") dirty.rrsp = true;
    if (id === "rec-nonreg" || id === "rec-nonreg-slider") dirty.nonreg = true;
    if (id === "rec-life") dirty.life = true;
    if (id === "rec-spouse-life") dirty.spouseLife = true;
    if (id === "early-now") dirty.earlyNow = true;
    if (id === "early-after") dirty.earlyAfter = true;
    pairSlider(event.target);
    render();
  });
  $("worksheet").addEventListener("change", (event) => {
    if (event.target.type === "radio" || event.target.type === "checkbox" || event.target.tagName === "SELECT") render();
  });
  $("worksheet").addEventListener("submit", (event) => event.preventDefault());
  $("print-plan").addEventListener("click", () => window.print());
  $("sample-case").addEventListener("click", loadSample);
  $("clear-plan").addEventListener("click", clearPlan);
}

init();
