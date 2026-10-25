import { canadaInflation } from "../data/inflation-canada.js";
import { cppAmounts } from "../data/cpp-amounts.js";
import { lifeExpectancy } from "../data/life-expectancy.js";
import { oasAmounts } from "../data/oas-amounts.js";
import { planningAssumptions as assumptions } from "../data/planning-assumptions.js";
import { probateFees, provinceOrder } from "../data/probate-fees.js";
import { rrspLimits } from "../data/rrsp-limits.js";
import { tfsaContributionLimit } from "../data/tfsa-contribution-limit.js";
import { allocationOutcome, requiredOutOfPocket } from "./calc/allocation.js";
import { deathTaxAtYear } from "./calc/death-tax.js";
import { projectFutureRoom } from "./calc/contribution-room.js";
import { deflate, inflate, purchasingPowerPath, roundPercent, trailingAverage } from "./calc/inflation.js";
import { calculateLifeNeed } from "./calc/life-need.js";
import { formatDollars, formatMoney, futureValue, readMoney } from "./calc/money.js";
import { incomeYearsAtAge, projectLifeNeed } from "./calc/need-path.js";
import { cppContributionYears, estimateCpp, estimateOas, residenceYearsFromAge } from "./calc/pensions.js";
import { calculateProbate } from "./calc/probate.js";
import { criticalIllnessLumpSum, disabilityMonthlyBenefit } from "./calc/protection.js";
import { calculateRetirement, taxableRetirementIncome } from "./calc/retirement.js";
import { describeDeposits, projectPortfolio } from "./calc/portfolio-path.js";
import { balanceAfterWithdrawals, balanceAtAge, wealthPath } from "./calc/wealth-path.js";
import { latestTaxYear, marginalRate, taxOnInclusion } from "./calc/tax.js";
import { formatYearSpan, groupLimitYears, tfsaRoomEarned } from "./calc/tfsa-room.js";

const DEFAULT_ADVISOR = {
  name: "Ethan Marchand",
  firm: "Marchand Wealth",
};

const $ = (id) => document.getElementById(id);

const dirty = {
  desired: false,
  clientShare: false,
  deathAge: false,
  partnerDeathAge: false,
  cpp: false,
  oas: false,
  partnerCpp: false,
  partnerOas: false,
  canadaYears: false,
  partnerCanadaYears: false,
  earlyDeath: false,
  disabilityMonths: false,
  allocation: false,
  recommendedLife: false,
  recommendedDisability: false,
  recommendedCritical: false,
  recommendedPartnerLife: false,
  recommendedPartnerDisability: false,
  recommendedPartnerCritical: false,
  rationale: false,
};

const inflationHistory = trailingAverage(canadaInflation.annualPercent, 100);
const defaultInflation = roundPercent(inflationHistory.average);

let incomeMode = "today";
let lastModel = null;

function todayISO() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function rateFrom(id) {
  return readMoney($(id).value) / 100;
}

function blank(id) {
  return $(id).value.trim() === "";
}

function formatPercent(rate) {
  const percent = Math.round(rate * 1000) / 10;
  return `${percent}%`;
}

function moneyInput(amount) {
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function maxAnnualCpp() {
  return cppAmounts.maxMonthlyRetirementAt65 * 12;
}

function maxAnnualOas(age) {
  const monthly = age >= 75 ? oasAmounts.maxMonthlyAge75andOver : oasAmounts.maxMonthlyAge65to74;
  return monthly * 12;
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
  input.className =
    "mt-1 w-full rounded-sm border border-line bg-paperdim px-3.5 py-2.5 text-sm";
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
  if (existing.length === count) return existing;
  const ages = existing.map((input) => input.value);
  list.replaceChildren();
  for (let index = 0; index < count; index += 1) {
    list.append(dependantField(index, ages[index] ?? ""));
  }
  return [...list.querySelectorAll("[data-dep-age]")];
}

function agesFromDom() {
  const ages = [];
  let invalid = false;
  for (const input of document.querySelectorAll("[data-dep-age]")) {
    const raw = input.value.trim();
    if (raw === "") continue;
    const age = Number(raw);
    if (!Number.isFinite(age) || age < 0 || age > 120) invalid = true;
    else ages.push(age);
  }
  return { ages, invalid };
}

function planningMode() {
  return document.querySelector('input[name="planning-mode"]:checked')?.value || "";
}

function showsInsurance() {
  const mode = planningMode();
  return mode === "insurance" || mode === "both";
}

function showsPlanning() {
  const mode = planningMode();
  return mode === "planning" || mode === "both";
}

function hasPartner() {
  return $("has-partner").checked;
}

function personName() {
  return $("client-name").value.trim() || "Person 1";
}

function partnerName() {
  return $("partner-name").value.trim() || "Person 2";
}

function childLabels() {
  const count = Math.min(12, dependantCount());
  return Array.from({ length: count }, (_, index) => `Child ${index + 1}`);
}

function applyNames() {
  const person = personName();
  const partner = partnerName();
  $("person-heading-household").textContent = person;
  $("person-age-label").textContent = `${person}'s age`;
  $("partner-heading-household").textContent = partner;
  $("partner-age-label").textContent = `${partner}'s age`;
  $("partner-income-label").textContent = `${partner}'s annual income`;
  $("death-heading").textContent = hasPartner() ? `If ${person} or ${partner} dies` : `If ${person} dies`;
  $("death-intro").textContent = hasPartner()
    ? `The mortgage and the children are shared, whichever of them dies. Income to replace is calculated for each person from the years below.`
    : `The mortgage and the children are included. Income to replace is calculated for ${person} from the years below.`;
  $("partner-coverage-heading").textContent = partner;
  $("need-chart-person").textContent = person;
  $("partner-need-chart-heading").textContent = partner;
  $("person-heading-protection").textContent = person;
  $("partner-heading-protection").textContent = partner;
  $("person-heading-retirement").textContent = person;
  $("partner-heading-retirement").textContent = partner;
  $("person-heading-accounts").textContent = `${person} accounts`;
  $("partner-heading-accounts").textContent = `${partner} accounts`;
  $("recommended-person-heading").textContent = person;
  $("recommended-partner-heading").textContent = partner;
  $("recommended-life-label").textContent = `Life amount you will recommend for ${person}`;
  $("recommended-disability-label").textContent = `Disability benefit you will recommend for ${person}, monthly`;
  $("recommended-critical-label").textContent = `Critical illness amount you will recommend for ${person}`;
  $("recommended-partner-life-label").textContent = `Life amount you will recommend for ${partner}`;
  $("recommended-partner-disability-label").textContent = `Disability benefit you will recommend for ${partner}, monthly`;
  $("recommended-partner-critical-label").textContent = `Critical illness amount you will recommend for ${partner}`;
  $("chosen-person-heading").textContent = person;
  $("chosen-partner-heading").textContent = partner;
  $("chosen-life-label").textContent = `Life insurance ${person} chose`;
  $("chosen-disability-label").textContent = `Disability benefit ${person} chose, monthly`;
  $("chosen-critical-label").textContent = `Critical illness ${person} chose`;
  $("chosen-reason-label").textContent = `Why ${person}'s choice matches or differs from the recommendation`;
  $("chosen-partner-life-label").textContent = `Life insurance ${partner} chose`;
  $("chosen-partner-disability-label").textContent = `Disability benefit ${partner} chose, monthly`;
  $("chosen-partner-critical-label").textContent = `Critical illness ${partner} chose`;
  $("chosen-partner-reason-label").textContent = `Why ${partner}'s choice matches or differs from the recommendation`;
  $("mobile-life-label").textContent = `${person} life capital`;
  $("meeting-person-life-label").textContent = `${person}, life capital`;
  $("meeting-person-di-label").textContent = `${person}, disability, monthly`;
  $("meeting-person-ci-label").textContent = `${person}, critical illness`;
  $("meeting-partner-life-label").textContent = `${partner}, life capital`;
  $("meeting-partner-di-label").textContent = `${partner}, disability, monthly`;
  $("meeting-partner-ci-label").textContent = `${partner}, critical illness`;
  $("client-owns-corp-label").textContent = `${person} owns a corporation`;
  $("partner-owns-corp-label").textContent = `${partner} owns a corporation`;
  $("client-coverage-label").textContent = `Personal life insurance in force on ${person}`;
  $("client-corporate-coverage-label").textContent = `Life insurance the corporation already owns on ${person}`;
  $("client-count-corporate-label").textContent = `Count that corporate coverage toward ${person}'s capital need`;
  $("partner-personal-coverage-label").textContent = `Personal life insurance already in force on ${partner}`;
  $("partner-coverage-note").textContent = `This reduces ${partner}'s need only. The mortgage and the children's education stay in both.`;
  $("partner-corporate-coverage-label").textContent = `Life insurance a corporation already owns on ${partner}`;
  $("partner-count-corporate-label").textContent = `Count that corporate coverage toward ${partner}'s capital need`;
  $("partner-history-label").textContent = `${partner}'s average income over the last 5 years`;
  $("partner-tfsa-balance-label").textContent = `${partner}'s TFSA balance`;
  $("partner-tfsa-room-label").textContent = `${partner}'s TFSA room available now`;
  $("partner-rrsp-balance-label").textContent = `${partner}'s RRSP balance`;
  $("partner-rrsp-room-label").textContent = `${partner}'s RRSP room available now`;
  $("partner-nonreg-label").textContent = `${partner}'s non-registered balance`;
  $("partner-other-label").textContent = `${partner}'s other assets`;
  $("partner-canada-label").textContent = `Years ${partner} has lived in Canada after age 18`;
  $("partner-cpp-label").textContent = `${partner} CPP, yearly`;
  $("partner-oas-label").textContent = `${partner} OAS, yearly`;
  $("client-retirement-income-label").textContent = `Other taxable income ${person} will have in retirement, besides CPP, OAS, and these savings`;
  $("client-retirement-income-note").textContent = `A pension or rent. Leave this at zero when there is none. CPP and OAS reduce what the accounts withdraw. TFSA withdrawals are not income for the OAS screen.`;
  $("death-age-label").textContent = `${person}'s likely age at death`;
  $("partner-death-age-label").textContent = `${partner}'s likely age at death`;
}

function householdIncome() {
  const personal = readMoney($("personal-income").value);
  const partner = hasPartner() ? readMoney($("partner-income").value) : 0;
  return personal + partner;
}

function incomeModeValue() {
  return document.querySelector('input[name="income-mode"]:checked')?.value === "future" ? "future" : "today";
}

function inflationPercent() {
  return readMoney($("inflation-rate").value);
}

function ageOrNull(id) {
  if (blank(id)) return null;
  const age = readMoney($(id).value);
  if (age < 0 || age > 120) return null;
  return age;
}

function registeredTotals() {
  const partner = hasPartner();
  const tfsaBalance = readMoney($("tfsa-balance").value) + (partner ? readMoney($("partner-tfsa-balance").value) : 0);
  const rrspBalance = readMoney($("rrsp-balance").value) + (partner ? readMoney($("partner-rrsp-balance").value) : 0);
  const other = readMoney($("other-assets").value) + (partner ? readMoney($("partner-other-assets").value) : 0);
  const nonReg = readMoney($("nonreg-balance").value) + (partner ? readMoney($("partner-nonreg-balance").value) : 0);
  const clientTfsaEntered = readMoney($("tfsa-room").value);
  const partnerTfsaEntered = partner ? readMoney($("partner-tfsa-room").value) : 0;
  const clientTfsaRoom = roomWithinLifetime(clientTfsaEntered, "client-age");
  const partnerTfsaRoom = partner ? roomWithinLifetime(partnerTfsaEntered, "partner-age") : 0;
  const clientRrspRoom = readMoney($("rrsp-room").value);
  const partnerRrspRoom = partner ? readMoney($("partner-rrsp-room").value) : 0;
  const tfsaRoom = clientTfsaRoom + partnerTfsaRoom;
  const rrspRoom = clientRrspRoom + partnerRrspRoom;
  return {
    tfsaBalance,
    rrspBalance,
    nonReg,
    other,
    tfsaRoom,
    rrspRoom,
    clientTfsaRoom,
    partnerTfsaRoom,
    clientRrspRoom,
    partnerRrspRoom,
    tfsaRoomCapped: clientTfsaRoom < clientTfsaEntered || partnerTfsaRoom < partnerTfsaEntered,
    total: tfsaBalance + rrspBalance + other,
  };
}

function roomWithinLifetime(entered, ageId) {
  const amount = Math.max(0, entered);
  const earned = personTfsa(ageId);
  if (!earned || earned.invalid || !Number.isFinite(earned.total)) return amount;
  return Math.min(amount, earned.total);
}

function retirementTarget(years) {
  const entered = readMoney($("desired-income").value);
  const inflation = inflationPercent();
  const mode = incomeModeValue();
  if (mode === "future") {
    return { mode, entered, today: deflate(entered, inflation, years), nominal: entered, years, inflation };
  }
  return { mode, entered, today: entered, nominal: inflate(entered, inflation, years), years, inflation };
}

function expectancyAge() {
  const row = lifeExpectancy.canada[lifeExpectancy.year];
  const sex = $("client-sex").value;
  const years = sex === "male" || sex === "female" ? row[sex] : row.both;
  return Math.round(years);
}

function earningsForCpp(historyId, incomeId) {
  return blank(historyId) ? readMoney($(incomeId).value) : readMoney($(historyId).value);
}

function incomeYearsChosen() {
  return Math.max(0, readMoney($("income-years").value));
}

function retirementAgeValue() {
  if (blank("retirement-age")) return null;
  const age = readMoney($("retirement-age").value);
  return Number.isFinite(age) ? age : null;
}

function incomeYearsForAge(age) {
  const chosen = incomeYearsChosen();
  const retirementAge = retirementAgeValue();
  if (age == null || retirementAge == null) return chosen;
  return incomeYearsAtAge(age, chosen, retirementAge);
}

function deathAgeValue(id = "death-age") {
  if (blank(id)) return null;
  const age = readMoney($(id).value);
  return Number.isFinite(age) ? age : null;
}

function chartUntil(currentAge, deathAgeId = "death-age") {
  const deathAge = deathAgeValue(deathAgeId);
  if (currentAge != null && deathAge != null && deathAge > currentAge) return deathAge;
  return (currentAge ?? 0) + Math.max(incomeYearsChosen(), 1);
}

function applySuggestions() {
  if (!dirty.deathAge) $("death-age").value = String(expectancyAge());
  if (hasPartner() && !dirty.partnerDeathAge) $("partner-death-age").value = String(expectancyAge());
  const currentAge = ageOrNull("client-age");
  const retirementAge = blank("retirement-age") ? null : readMoney($("retirement-age").value);
  if (!dirty.canadaYears && currentAge != null) {
    $("canada-years").value = String(residenceYearsFromAge(currentAge));
  }
  if (!dirty.cpp) {
    $("cpp-annual").value = moneyInput(estimateCpp(
      earningsForCpp("income-history", "personal-income"),
      cppAmounts.ympe,
      maxAnnualCpp(),
      cppContributionYears(currentAge),
    ));
  }
  if (!dirty.oas) {
    const retireAt = retirementAge ?? 65;
    $("oas-annual").value = moneyInput(estimateOas(readMoney($("canada-years").value), maxAnnualOas(retireAt)));
  }
  if (hasPartner()) {
    const partnerAge = ageOrNull("partner-age");
    if (!dirty.partnerCanadaYears && partnerAge != null) {
      $("partner-canada-years").value = String(residenceYearsFromAge(partnerAge));
    }
    if (!dirty.partnerCpp) {
      $("partner-cpp").value = moneyInput(estimateCpp(
        earningsForCpp("partner-income-history", "partner-income"),
        cppAmounts.ympe,
        maxAnnualCpp(),
        cppContributionYears(partnerAge),
      ));
    }
    if (!dirty.partnerOas) {
      $("partner-oas").value = moneyInput(estimateOas(readMoney($("partner-canada-years").value), maxAnnualOas(65)));
    }
  }
  const household = householdIncome();
  if (!dirty.desired) {
    const amount = Math.round(household * rateFrom("retirement-replacement"));
    $("desired-income").value = String(amount);
    $("desired-income-slider").value = String(Math.min(300000, Math.max(0, amount)));
  }
  if (!dirty.disabilityMonths) {
    $("disability-months").value = String(Math.round(incomeYearsChosen() * 12));
  }
  if (!dirty.clientShare) $("client-retirement-income").value = "0";
}

function retirementHorizon() {
  if (blank("client-age") || blank("retirement-age")) return { missing: true, years: 0 };
  const currentAge = readMoney($("client-age").value);
  const retirementAge = readMoney($("retirement-age").value);
  if (currentAge < 0 || currentAge > 120 || retirementAge < 0 || retirementAge > 120) {
    return { invalid: true, years: 0 };
  }
  return { years: Math.max(0, retirementAge - currentAge), alreadyRetired: retirementAge <= currentAge };
}

function personTfsa(ageId) {
  if (blank(ageId)) return null;
  const age = readMoney($(ageId).value);
  if (age < 0 || age > 120) return { invalid: true, age };
  const earned = tfsaRoomEarned({
    age,
    taxYear: tfsaContributionLimit.taxYear,
    annualLimits: tfsaContributionLimit.annualLimits,
    introducedYear: tfsaContributionLimit.introducedYear,
    eligibilityAge: tfsaContributionLimit.eligibilityAge,
  });
  return { ...earned, age };
}

function householdTfsa() {
  const client = personTfsa("client-age");
  const partner = hasPartner() ? personTfsa("partner-age") : null;
  const lifetime = (client?.total || 0) + (partner?.total || 0);
  return { client, partner, lifetime };
}

function accountTotal(point) {
  if (!point) return 0;
  return point.tfsa + point.rrsp + point.nonReg;
}

function plannedDraw(outcome, gap, rate = 0) {
  const tfsa = Math.max(0, outcome?.tfsa || 0);
  const rrsp = Math.max(0, outcome?.rrsp || 0);
  const nonReg = Math.max(0, outcome?.nonReg || 0);
  const total = tfsa + rrsp + nonReg;
  const annual = Math.max(0, gap || 0);
  if (total <= 0 || annual <= 0) return { total: 0, tfsa: 0, rrsp: 0, nonReg: 0 };
  const drag = Math.min(0.95, Math.max(0, rate) * (rrsp / total));
  const gross = annual / (1 - drag);
  return {
    total: gross,
    tfsa: gross * (tfsa / total),
    rrsp: gross * (rrsp / total),
    nonReg: gross * (nonReg / total),
  };
}

function savingsGoal(plan) {
  return {
    incomeCapital: Math.max(0, plan.capitalNeeded - plan.legacyAtRetirement),
    legacyCapital: Math.max(0, plan.legacyAtRetirement),
  };
}

function solveSavingsMix({
  retirement,
  horizonYears,
  accounts,
  room,
  marginalNow,
  province,
  savingsReturn,
  inflationRate,
  currentAge,
}) {
  const marginal = Number.isFinite(marginalNow) ? marginalNow : 0;
  const common = {
    years: horizonYears,
    savingsReturn,
    inflationRate,
    currentTfsaBalance: accounts.tfsaBalance,
    currentRrspBalance: accounts.rrspBalance,
    currentNonRegBalance: accounts.nonReg,
    nonRegReturn: savingsReturn * (1 - 0.5 * marginal),
    currentClientTfsaRoom: accounts.clientTfsaRoom,
    currentPartnerTfsaRoom: accounts.partnerTfsaRoom,
    currentClientRrspRoom: accounts.clientRrspRoom,
    currentPartnerRrspRoom: accounts.partnerRrspRoom,
    currentOtherBalance: accounts.other,
    futureYears: room.years,
    taxNow: marginalNow,
    currentAge,
  };
  const otherTaxable = Math.max(0, readMoney($("client-retirement-income").value));
  const price = (share) => {
    let plan = retirement;
    let rate = marginalRate(otherTaxable + plan.cpp + plan.oasNet, province) ?? 0;
    let savings = 0;
    let outcome = null;
    for (let pass = 0; pass < 6; pass += 1) {
      savings = requiredOutOfPocket({ ...common, rrspShare: share, futureTaxRate: rate }, savingsGoal(plan));
      outcome = allocationOutcome({ ...common, annualSavings: savings, rrspShare: share });
      const draw = plannedDraw(outcome, plan.annualGap, rate);
      const counted = taxableRetirementIncome({
        otherTaxable,
        rrspWithdrawal: draw.rrsp,
        nonRegisteredWithdrawal: draw.nonReg,
      });
      const nextPlan = retirementQuote(counted) || plan;
      const base = otherTaxable + nextPlan.cpp + nextPlan.oasNet;
      const tax = draw.rrsp > 0 ? taxOnInclusion(base, draw.rrsp, province) : null;
      const nextRate = tax ? tax.tax / draw.rrsp : 0;
      const settled = Math.abs(nextRate - rate) < 0.002
        && Math.abs(nextPlan.capitalNeeded - plan.capitalNeeded) < 2
        && Math.abs((nextPlan.oasRepayment || 0) - (plan.oasRepayment || 0)) < 2;
      rate = nextRate;
      plan = nextPlan;
      if (settled) break;
    }
    savings = requiredOutOfPocket({ ...common, rrspShare: share, futureTaxRate: rate }, savingsGoal(plan));
    outcome = allocationOutcome({ ...common, annualSavings: savings, rrspShare: share });
    return { share, annualSavings: savings, futureTaxRate: rate, outcome, plan };
  };
  const results = [];
  for (let pct = 0; pct <= 100; pct += 1) results.push(price(pct / 100));
  const monthly = (annual) => Math.round(annual / 12);
  let best = results[0];
  for (const found of results) {
    if (monthly(found.annualSavings) < monthly(best.annualSavings)) best = found;
  }
  const sliderPct = Math.min(100, Math.max(0, Math.round(readMoney($("rrsp-share").value))));
  const selected = dirty.allocation ? results[sliderPct] : best;
  const atShare = (share) => allocationOutcome({ ...common, annualSavings: selected.annualSavings, rrspShare: share });
  return {
    annualSavings: selected.annualSavings,
    share: selected.share,
    futureTaxRate: selected.futureTaxRate,
    outcome: selected.outcome,
    bestShare: best.share,
    bestSavings: best.annualSavings,
    allTfsa: results[0].annualSavings,
    allRrsp: results[100].annualSavings,
    allTfsaOutcome: atShare(0),
    allRrspOutcome: atShare(1),
    allocationInput: common,
    plan: selected.plan,
  };
}

function retirementQuote(clientRetirementIncome) {
  const horizon = retirementHorizon();
  if (horizon.missing || horizon.invalid) return null;
  const partner = hasPartner();
  const target = retirementTarget(horizon.years || 0);
  return calculateRetirement({
    years: horizon.years,
    desiredRetirementIncome: target.today,
    clientRetirementIncome,
    cppAnnual: readMoney($("cpp-annual").value),
    oasAnnual: readMoney($("oas-annual").value),
    partnerCppAnnual: partner ? readMoney($("partner-cpp").value) : 0,
    partnerOasAnnual: partner ? readMoney($("partner-oas").value) : 0,
    retirementAssets: registeredTotals().total,
    savingsReturn: rateFrom("real-return"),
    retirementReturn: rateFrom("retirement-return"),
    retirementYears: Math.max(0, readMoney($("death-age").value) - readMoney($("retirement-age").value)),
    legacyAtDeath: $("leave-legacy").checked ? readMoney($("legacy-amount").value) : 0,
    recoveryThreshold: oasAmounts.recoveryThreshold,
    recoveryTaxRate: oasAmounts.recoveryTaxRate,
  });
}

function planSpanYears() {
  const age = ageOrNull("client-age");
  if (age == null) return 0;
  const ownDeath = deathAgeValue();
  let span = ownDeath != null ? Math.max(0, ownDeath - age) : 0;
  if (hasPartner()) {
    const partnerAge = ageOrNull("partner-age");
    const partnerDeath = deathAgeValue("partner-death-age");
    if (partnerAge != null && partnerDeath != null) span = Math.max(span, partnerDeath - partnerAge);
  }
  return span;
}

function contributionPhrase(timing) {
  if (!timing || (timing.thisYear <= 0.5 && timing.later <= 0.5)) return "";
  const month = (annual) => formatMoney(annual / 12);
  if (timing.laterOffset === 0) return `${month(timing.thisYear)} a month`;
  if (timing.thisYear <= 0.5) {
    const when = timing.laterOffset === 1 ? "beginning next year" : `beginning in ${timing.calendarYear}`;
    return `${month(timing.later)} a month, ${when}`;
  }
  const when = timing.laterOffset === 1 ? "next year" : String(timing.calendarYear);
  return `${month(timing.thisYear)} a month this year, then ${month(timing.later)} ${when}`;
}

function contributionSchedule(model) {
  if (!model?.portfolio) return [];
  const described = describeDeposits(model.portfolio.rows);
  return [
    ["TFSA", described.accounts.tfsa],
    ["RRSP", described.accounts.rrsp],
    ["Non-registered", described.accounts.nonReg],
  ].flatMap(([label, timing]) => {
    const phrase = contributionPhrase(timing);
    return phrase ? [[label, phrase]] : [];
  });
}

function contributionSentence(model) {
  const lines = contributionSchedule(model);
  if (!lines.length) return "";
  return `${lines.map(([label, phrase]) => `${label} ${phrase}`).join(". ")}.`;
}

function contributionHeadline(model) {
  const described = describeDeposits(model.portfolio.rows);
  const { annual, offset, calendarYear } = described.headline;
  let label = "Monthly contributions";
  if (offset === 1) label = "Monthly contributions, beginning next year";
  else if (offset > 1) label = `Monthly contributions, beginning in ${calendarYear}`;
  return { label, monthly: annual / 12 };
}

function rolloverChosen() {
  return $("rrsp-rollover").checked;
}

function buildModel() {
  const { ages, invalid } = agesFromDom();
  const partner = hasPartner();
  const personalCoverage = readMoney($("existing-coverage").value);
  const ownsCorporation = $("client-owns-corp").checked;
  const corporateCoverage = ownsCorporation ? readMoney($("corporate-coverage").value) : 0;
  const countCorporate = ownsCorporation && $("count-corporate").checked;
  const partnerOwnsCorporation = partner && $("partner-owns-corp").checked;
  const partnerCorporateCoverage = partnerOwnsCorporation ? readMoney($("partner-corporate-coverage").value) : 0;
  const partnerCountCorporate = partnerOwnsCorporation && $("partner-count-corporate").checked;
  const accounts = registeredTotals();
  const estateValue = readMoney($("estate-value").value);
  const probate = calculateProbate($("province").value, estateValue, {
    courtVerification: $("qc-verification").checked,
  });
  const personalIncome = readMoney($("personal-income").value);
  const partnerIncome = partner ? readMoney($("partner-income").value) : 0;
  const province = $("province").value;
  const rollover = rolloverChosen();
  const savingsReturn = rateFrom("real-return");
  const inflation = inflationPercent();
  const clientRrsp = readMoney($("rrsp-balance").value);
  const clientNonReg = readMoney($("nonreg-balance").value);
  const partnerRrsp = partner ? readMoney($("partner-rrsp-balance").value) : 0;
  const partnerNonReg = partner ? readMoney($("partner-nonreg-balance").value) : 0;
  const deathTaxInput = {
    estate: estateValue,
    rollover,
    province,
    savingsReturn,
    inflationPercent: inflation,
  };
  const deathTaxBill = deathTaxAtYear({
    ...deathTaxInput,
    income: personalIncome,
    rrsp: clientRrsp,
    nonReg: clientNonReg,
    years: 0,
  });
  const partnerDeathTaxBill = partner
    ? deathTaxAtYear({
        ...deathTaxInput,
        income: partnerIncome,
        rrsp: partnerRrsp,
        nonReg: partnerNonReg,
        years: 0,
      })
    : null;
  const replacementRatio = rateFrom("replacement-ratio");
  const incomeYears = incomeYearsChosen();
  const sharedNeed = {
    dependantAges: ages,
    independenceAge: readMoney($("independence-age").value),
    educationPerDependant: readMoney($("education-amount").value),
    debts: readMoney($("debts").value) + readMoney($("other-debts").value),
    finalExpenses: readMoney($("final-expenses").value),
    probateFee: probate.fee,
  };
  const clientAgeForNeed = ageOrNull("client-age");
  const partnerAgeForNeed = partner ? ageOrNull("partner-age") : null;
  const life = calculateLifeNeed({
    ...sharedNeed,
    personalIncome,
    replacementRatio,
    years: incomeYearsForAge(clientAgeForNeed),
    existingLifeInsurance: personalCoverage + (countCorporate ? corporateCoverage : 0),
    assetsAtDeath: readMoney($("assets-at-death").value),
    deathTax: deathTaxBill.total,
  });
  const spouseLife = partner
    ? calculateLifeNeed({
        ...sharedNeed,
        personalIncome: partnerIncome,
        replacementRatio,
        years: incomeYearsForAge(partnerAgeForNeed),
        existingLifeInsurance: readMoney($("partner-existing-coverage").value) + (partnerCountCorporate ? partnerCorporateCoverage : 0),
        assetsAtDeath: readMoney($("assets-at-death").value),
        deathTax: partnerDeathTaxBill.total,
      })
    : null;
  const ciMonths = Math.max(0, readMoney($("ci-months").value));
  const ciRatio = rateFrom("ci-ratio");
  const protection = {
    clientDisability: disabilityMonthlyBenefit(personalIncome, replacementRatio),
    spouseDisability: partner ? disabilityMonthlyBenefit(partnerIncome, replacementRatio) : 0,
    disabilityMonths: readMoney($("disability-months").value),
    ciMonths,
    ciRatio,
    clientCritical: criticalIllnessLumpSum(personalIncome, ciRatio, ciMonths),
    spouseCritical: partner ? criticalIllnessLumpSum(partnerIncome, ciRatio, ciMonths) : 0,
    childLifeEach: readMoney($("child-life").value),
    childCiEach: readMoney($("child-ci").value),
  };

  const horizon = retirementHorizon();
  const target = retirementTarget(horizon.years || 0);
  const tfsa = householdTfsa();
  let retirement = retirementQuote(readMoney($("client-retirement-income").value));

  const room = projectFutureRoom({
    yearsOfWork: horizon.years || 0,
    taxYear: tfsaContributionLimit.taxYear,
    inflationRate: inflationPercent() / 100,
    personalIncome: readMoney($("personal-income").value),
    partnerIncome: partner ? readMoney($("partner-income").value) : 0,
    hasPartner: partner,
    clientAge: ageOrNull("client-age"),
    partnerAge: partner ? ageOrNull("partner-age") : null,
    tfsaLimits: tfsaContributionLimit.annualLimits,
    rrspLimitsByYear: rrspLimits.dollarLimits,
    rrspPercent: rrspLimits.earnedIncomePercent,
  });

  const marginalNow = marginalRate(personalIncome, province);
  syncEarlyDeathSlider();
  const portfolio = ageOrNull("client-age") == null || planSpanYears() <= 0 ? null : projectPortfolio({
    currentAge: ageOrNull("client-age") ?? 0,
    retirementAge: retirementAgeValue() ?? 200,
    years: planSpanYears(),
    inflationRate: inflationPercent() / 100,
    savingsReturn: rateFrom("real-return"),
    retirementReturn: rateFrom("retirement-return"),
    otherReturn: rateFrom("other-return"),
    desiredIncomeToday: readMoney($("desired-income").value),
    tfsaAnnual: readMoney($("tfsa-contribution").value) * 12,
    rrspAnnual: readMoney($("rrsp-contribution").value) * 12,
    nonRegAnnual: readMoney($("nonreg-contribution").value) * 12,
    tfsaOpening: accounts.tfsaBalance,
    rrspOpening: accounts.rrspBalance,
    nonRegOpening: accounts.nonReg,
    otherOpening: accounts.other,
    tfsaRoomNow: accounts.tfsaRoom,
    rrspRoomNow: accounts.rrspRoom,
    tfsaNewRoom: room.years.map((year) => (year.clientTfsa || 0) + (year.partnerTfsa || 0)),
    rrspNewRoom: room.years.map((year) => (year.clientRrsp || 0) + (year.partnerRrsp || 0)),
    province,
    clientCppToday: readMoney($("cpp-annual").value),
    clientOasToday: readMoney($("oas-annual").value),
    partnerCppToday: partner ? readMoney($("partner-cpp").value) : 0,
    partnerOasToday: partner ? readMoney($("partner-oas").value) : 0,
    partnerAge: partner ? ageOrNull("partner-age") : null,
    otherIncomeToday: readMoney($("client-retirement-income").value),
    oasRecoveryThreshold: oasAmounts.recoveryThreshold,
    oasRecoveryRate: oasAmounts.recoveryTaxRate,
    workingIncomeToday: personalIncome + partnerIncome,
    rollover,
    startYear: tfsaContributionLimit.taxYear,
  });
  const mix = null;
  const allocation = null;

  const corporateAcb = ownsCorporation ? readMoney($("corporate-acb").value) : 0;
  const capitalDividend = Math.max(0, corporateCoverage - corporateAcb);
  const partnerCorporateAcb = partnerOwnsCorporation ? readMoney($("partner-corporate-acb").value) : 0;
  const earlyAge = readMoney($("early-death-age").value);
  const clientAge = ageOrNull("client-age");
  const planHouse = $("plan-house").checked && readMoney($("debts").value) <= 0;
  const mortgageYears = readMoney($("mortgage-years").value);
  const chartAge = clientAge ?? 0;
  const pathInput = {
    currentAge: chartAge,
    retirementAge: clientAge == null ? null : retirementAgeValue(),
    incomeYearsAtStart: incomeYears,
    personalIncome,
    replacementRatio: rateFrom("replacement-ratio"),
    dependantAges: ages,
    plannedChildren: Math.max(0, Math.round(readMoney($("planned-children").value))),
    independenceAge: readMoney($("independence-age").value),
    educationPerDependant: readMoney($("education-amount").value),
    mortgage: readMoney($("debts").value),
    mortgageYears,
    otherDebts: readMoney($("other-debts").value),
    futureMortgage: planHouse ? readMoney($("future-mortgage").value) : 0,
    yearsUntilPurchase: planHouse ? readMoney($("years-until-purchase").value) : 0,
    amortizationYears: planHouse ? readMoney($("future-amortization").value) || 25 : 0,
    finalExpenses: readMoney($("final-expenses").value),
    probateFee: probate.fee,
    inflationPercent: inflation,
    taxAtYear: (elapsed) => deathTaxAtYear({
      ...deathTaxInput,
      income: personalIncome,
      rrsp: clientRrsp,
      nonReg: clientNonReg,
      years: elapsed,
    }).total,
    existingLifeInsurance: personalCoverage + (countCorporate ? corporateCoverage : 0),
    assetsAtDeath: readMoney($("assets-at-death").value),
  };
  const needPath = projectLifeNeed(pathInput, chartUntil(clientAge));
  const partnerAge = partner ? ageOrNull("partner-age") : null;
  const partnerNeedPath = partner
    ? projectLifeNeed({
        ...pathInput,
        currentAge: partnerAge ?? 0,
        retirementAge: partnerAge == null ? null : retirementAgeValue(),
        personalIncome: partnerIncome,
        taxAtYear: (elapsed) => deathTaxAtYear({
          ...deathTaxInput,
          income: partnerIncome,
          rrsp: partnerRrsp,
          nonReg: partnerNonReg,
          years: elapsed,
        }).total,
        existingLifeInsurance: readMoney($("partner-existing-coverage").value) + (partnerCountCorporate ? partnerCorporateCoverage : 0),
      }, chartUntil(partnerAge, "partner-death-age"))
    : null;

  return {
    ages,
    invalidAges: invalid,
    life,
    spouseLife,
    chartUsesAge: clientAge != null,
    needPath,
    partnerChartUsesAge: partnerAge != null,
    partnerNeedPath,
    protection,
    retirement,
    horizon,
    tfsa,
    target,
    accounts,
    room,
    mix,
    allocation,
    portfolio,
    probate,
    personalCoverage,
    corporateCoverage,
    countCorporate,
    capitalDividend,
    corporateAcb,
    partnerCorporateCoverage,
    partnerCountCorporate,
    partnerCorporateAcb,
    rollover,
    deathTaxBill,
    partnerDeathTaxBill,
    marginalNow,
    earlyAge,
  };
}

function syncEarlyDeathSlider() {
  const age = ageOrNull("client-age");
  const end = age == null ? null : age + planSpanYears();
  const slider = $("early-death-age");
  if (age == null || end == null || end <= age + 1) {
    slider.disabled = true;
    return;
  }
  slider.disabled = false;
  const min = Math.floor(age) + 1;
  const max = Math.floor(end);
  slider.min = String(min);
  slider.max = String(max);
  const value = readMoney(slider.value);
  if (!dirty.earlyDeath || slider.value.trim() === "" || value < min || value > max) {
    slider.value = String(Math.min(max, Math.max(min, Math.round(age + 10))));
  }
}

function setOutputs(name, text, raw) {
  for (const node of document.querySelectorAll(`[data-out="${name}"]`)) {
    node.textContent = text;
    if (raw != null) node.dataset.value = String(raw);
  }
}

function lifeBreakdown(life) {
  return [
    [`Income for ${life.years} years`, formatDollars(life.incomeCapital)],
    ["Debts", formatDollars(life.debts)],
    ["Final expenses and probate", formatDollars(life.finalExpenses + life.probateFee)],
    ["Tax at death", formatDollars(life.deathTax)],
    ["Education", formatDollars(life.educationCapital)],
    ["Existing coverage and assets", formatDollars(life.offsets)],
  ];
}

function fillList(id, rows) {
  const list = $(id);
  list.replaceChildren();
  for (const [label, value] of rows) {
    const item = document.createElement("li");
    item.className = "flex justify-between gap-4";
    const term = document.createElement("span");
    term.className = "min-w-0";
    term.textContent = label;
    const amount = document.createElement("span");
    amount.className = "nums shrink-0";
    amount.textContent = value;
    item.append(term, amount);
    list.append(item);
  }
}

function paragraph(className, text) {
  const node = document.createElement("p");
  if (className) node.className = className;
  node.textContent = text;
  return node;
}

function heading(text) {
  const node = document.createElement("h3");
  node.className = "mt-6 font-serif font-semibold text-xl text-navydeep";
  node.textContent = text;
  return node;
}

function definitionList(pairs) {
  const list = document.createElement("dl");
  list.className = "mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1 text-sm";
  for (const [termText, valueText] of pairs) {
    const term = document.createElement("dt");
    term.className = "text-inksoft";
    term.textContent = termText;
    const value = document.createElement("dd");
    value.className = "nums text-right";
    value.textContent = valueText;
    list.append(term, value);
  }
  return list;
}

function checkedNeeds() {
  const items = [
    ["obj-income", "Replace income"],
    ["obj-debt", "Clear debts"],
    ["obj-education", "Education"],
    ["obj-final", "Final expenses"],
    ["obj-retirement", "Retirement income"],
    ["obj-disability", "Disability income"],
    ["obj-critical", "Critical illness"],
  ];
  return items.filter(([id]) => $(id).checked).map(([, label]) => label);
}

function renderTfsaBreakdown(tfsa) {
  const root = $("tfsa-breakdown");
  root.replaceChildren();

  const addPerson = (person, title) => {
    const block = document.createElement("div");
    const titleNode = document.createElement("p");
    titleNode.className = "font-medium";
    if (!person || person.invalid || !person.years.length) {
      titleNode.textContent = describeTfsa(person, title);
      block.append(titleNode);
      root.append(block);
      return;
    }
    titleNode.textContent = `${title}: ${formatDollars(person.total)} of lifetime room on the schedule`;
    const detail = document.createElement("p");
    detail.className = "text-inksoft";
    detail.textContent = `From ${person.firstYear} to ${person.taxYear}. Room available now is the amount you type, not this schedule.`;
    const list = document.createElement("ul");
    list.className = "mt-1 space-y-1";
    for (const group of groupLimitYears(person.years)) {
      const item = document.createElement("li");
      item.className = "flex justify-between gap-4";
      const term = document.createElement("span");
      term.textContent = formatYearSpan(group);
      const amount = document.createElement("span");
      amount.className = "nums";
      amount.textContent = formatDollars(group.limit);
      item.append(term, amount);
      list.append(item);
    }
    block.append(titleNode, detail, list);
    root.append(block);
  };

  addPerson(tfsa.client, personName());
  if (hasPartner()) addPerson(tfsa.partner, partnerName());
}

function describeTfsa(person, label) {
  if (!person) return `${label}: age not entered, so lifetime room is not added up.`;
  if (person.invalid) return `${label}: enter an age from 0 to 120 before adding up TFSA room.`;
  if (!person.years.length) {
    return `${label} is ${person.age}. TFSA room starts the year a person turns ${tfsaContributionLimit.eligibilityAge}, which is after ${person.taxYear}, so room available now is $0.`;
  }
  const spans = groupLimitYears(person.years)
    .map((group) => `${formatYearSpan(group)} ${formatDollars(group.limit)}`)
    .join("; ");
  const opening = person.turned18 < tfsaContributionLimit.introducedYear
    ? `Room on the schedule runs from ${tfsaContributionLimit.introducedYear}, when the TFSA was introduced, through ${person.taxYear}.`
    : `Room on the schedule runs from ${person.firstYear}, the year they turn ${tfsaContributionLimit.eligibilityAge}, through ${person.taxYear}.`;
  return `${label} is ${person.age}. ${opening} Lifetime room on that schedule is ${formatDollars(person.total)}. Room available now is the amount entered on the worksheet. Annual limits in those years: ${spans}.`;
}

function incomeReplacementLines(model) {
  const ratio = formatPercent(rateFrom("replacement-ratio"));
  const chosen = incomeYearsChosen();
  const lineFor = (name, life) => {
    const amount = `${ratio} of ${name}'s income is ${formatDollars(life.annualIncomeNeed)} a year.`;
    if (life.years <= 0 && life.years < chosen) {
      return `${amount} Retirement age is already here, so years of income are not added.`;
    }
    if (life.years < chosen) {
      return `${amount} Retirement is ${life.years} years away, so the income need is ${life.years} years. ${formatDollars(life.annualIncomeNeed)} × ${life.years} years = ${formatDollars(life.incomeCapital)}.`;
    }
    return `${amount} ${formatDollars(life.annualIncomeNeed)} × ${life.years} years = ${formatDollars(life.incomeCapital)}.`;
  };
  const lines = [lineFor(personName(), model.life)];
  if (model.spouseLife) lines.push(lineFor(partnerName(), model.spouseLife));
  return lines;
}

function guaranteedInsurabilitySentence() {
  if (!$("plan-house").checked || readMoney($("debts").value) > 0) return "";
  const amount = readMoney($("future-mortgage").value);
  const years = readMoney($("years-until-purchase").value);
  const timing = years > 0 ? ` in ${Math.round(years)} years` : "";
  const mortgage = amount > 0 ? ` A mortgage of ${formatDollars(amount)} is expected${timing}.` : "";
  const lives = hasPartner() ? `${personName()} and ${partnerName()}` : personName();
  return `A home purchase is in the plan.${mortgage} A guaranteed insurability rider is recommended for ${lives} so the coverage can be increased when the mortgage begins.`;
}

function draftAmount(id, amount, flag) {
  if (dirty[flag]) return;
  $(id).value = String(Math.max(0, Math.round(amount || 0)));
}

function rationaleDraft(model) {
  const life = model.life;
  const protection = model.protection;
  const ratio = formatPercent(rateFrom("replacement-ratio"));
  const months = Math.round(protection.disabilityMonths);
  const ciMonths = Math.round(protection.ciMonths);
  const ciRatio = formatPercent(protection.ciRatio);
  const sentences = [
    `${personName()}'s life insurance recommendation of ${formatDollars(life.capitalNeed)} replaces ${ratio} of income for ${life.years} years (${formatDollars(life.incomeCapital)}), and includes debts of ${formatDollars(life.debts)} and education of ${formatDollars(life.educationCapital)}. Final expenses, probate, and tax at death stay in the need. Existing coverage of ${formatDollars(life.existingLifeInsurance)} and assets of ${formatDollars(life.assetsAtDeath)} are already subtracted.`,
    `The disability recommendation is ${formatDollars(protection.clientDisability)} a month for ${months} months, which is ${ratio} of earned income.`,
    `The critical illness recommendation is ${formatDollars(protection.clientCritical)}, ${ciRatio} of earned income for ${ciMonths} months, as one lump sum. Income from investments is not included.`,
  ];
  if (model.spouseLife) {
    const spouse = model.spouseLife;
    sentences.push(`${partnerName()}'s life insurance recommendation of ${formatDollars(spouse.capitalNeed)} uses the same debts and education, with ${ratio} of ${partnerName()}'s income for ${spouse.years} years. Existing coverage of ${formatDollars(spouse.existingLifeInsurance)} is subtracted from ${partnerName()}'s need only. ${partnerName()}'s disability recommendation is ${formatDollars(protection.spouseDisability)} a month for the same ${months} months, and the critical illness recommendation is ${formatDollars(protection.spouseCritical)} for the same ${ciMonths} months of earned income.`);
  }
  const rider = guaranteedInsurabilitySentence();
  if (rider) sentences.push(rider);
  return sentences.join(" ");
}

function draftRecommendations(model) {
  const protection = model.protection;
  draftAmount("recommended-life", model.life.capitalNeed, "recommendedLife");
  draftAmount("recommended-disability", protection.clientDisability, "recommendedDisability");
  draftAmount("recommended-critical", protection.clientCritical, "recommendedCritical");
  if (model.spouseLife) {
    draftAmount("recommended-partner-life", model.spouseLife.capitalNeed, "recommendedPartnerLife");
    draftAmount("recommended-partner-disability", protection.spouseDisability, "recommendedPartnerDisability");
    draftAmount("recommended-partner-critical", protection.spouseCritical, "recommendedPartnerCritical");
  }
  if (!dirty.rationale) $("rationale").value = rationaleDraft(model);
}

function lifeNarrative(model) {
  const life = model.life;
  const ratio = formatPercent(rateFrom("replacement-ratio"));
  const shared = `The mortgage and other debts are ${formatDollars(life.debts)}, and education is ${formatDollars(life.educationCapital)} for ${life.educationCount} children. Those amounts are included if either person dies. Final expenses, probate, and tax at death stay in the need even after other coverage. On the chart, final expenses and probate rise with inflation, and the tax rises as the non-registered account, the estate, and an RRSP that does not roll over grow.`;
  const person = `${personName()}: ${ratio} of income is ${formatDollars(life.annualIncomeNeed)} a year. ${formatDollars(life.annualIncomeNeed)} × ${life.years} years = ${formatDollars(life.incomeCapital)}. Existing coverage of ${formatDollars(life.existingLifeInsurance)} and assets of ${formatDollars(life.assetsAtDeath)} leave a capital need of ${formatDollars(life.capitalNeed)}.`;
  if (!model.spouseLife) return `${shared} ${person}`;
  const spouse = model.spouseLife;
  const partner = `${partnerName()}: ${ratio} of income is ${formatDollars(spouse.annualIncomeNeed)} a year. ${formatDollars(spouse.annualIncomeNeed)} × ${spouse.years} years = ${formatDollars(spouse.incomeCapital)}. Existing coverage of ${formatDollars(spouse.existingLifeInsurance)} and assets of ${formatDollars(spouse.assetsAtDeath)} leave a capital need of ${formatDollars(spouse.capitalNeed)}.`;
  return `${shared} ${person} ${partner}`;
}

function portfolioRow(model, age) {
  const rows = model.portfolio?.rows || [];
  if (!rows.length || age == null) return null;
  return rows.reduce((best, row) => (Math.abs(row.age - age) < Math.abs(best.age - age) ? row : best));
}

function wealthTotals(model) {
  const rows = model.portfolio?.rows || [];
  if (!rows.length) return null;
  const retire = retirementAgeValue();
  const atRetirement = retire == null ? null : portfolioRow(model, retire);
  return {
    atRetirement: atRetirement?.total ?? 0,
    atDeath: rows[rows.length - 1].total,
  };
}

function legacyGap(model) {
  const ending = model.portfolio?.ending ?? 0;
  const goal = model.retirement?.legacyAtDeath || 0;
  return { ending, goal, delta: ending - goal };
}

function retirementNarrative(model) {
  const path = model.portfolio;
  if (!path) return "Enter an age and a likely age at death after it to draw the balances.";
  const end = path.rows[path.rows.length - 1];
  const ranOut = path.depletedAge != null
    ? `The balances reach $0 at age ${Math.round(path.depletedAge)}.`
    : `At the end of the plan the balance is ${formatDollars(end.total)}.`;
  const goal = model.retirement?.legacyAtDeath || 0;
  const legacy = goal > 0
    ? ` The legacy goal is ${formatDollars(goal)}. The balance at the end is ${formatDollars(Math.abs(end.total - goal))} ${end.total >= goal ? "past that goal" : "short of that goal"}.`
    : "";
  const retireRow = path.rows.find((row) => row.retired);
  const pensionLine = retireRow
    ? ` At retirement, CPP and OAS provide ${formatDollars(retireRow.pension)} and the accounts withdraw ${formatDollars(retireRow.withdrawal)} after tax.`
    : "";
  const schedule = contributionSentence(model);
  return `${incomeTranslation(model.target)}${schedule ? ` ${schedule}` : ""} CPP and OAS cover part of the after-tax income. The accounts withdraw what remains, raised with inflation, from the RRSP, then non-registered, then the TFSA, then other assets.${pensionLine} ${ranOut}${legacy}`;
}

function incomeTranslation(target) {
  if (!target || target.years <= 0) {
    return "Enter age and retirement age to translate the income target across the years until retirement.";
  }
  if (target.mode === "future") {
    return `The yearly amount at retirement is ${formatDollars(target.nominal)}. At ${formatPercent(target.inflation / 100)} inflation over ${target.years} years, that is ${formatDollars(target.today)} in today's dollars.`;
  }
  return `The yearly amount in today's dollars is ${formatDollars(target.today)}. At ${formatPercent(target.inflation / 100)} inflation over ${target.years} years, that is ${formatDollars(target.nominal)} in the year of retirement.`;
}

function deathTaxPiece(name, bill) {
  const pieces = [];
  if (bill.nonRegBalance > 0) {
    pieces.push(`non-registered tax of ${formatDollars(bill.nonRegTax)} on ${formatDollars(bill.nonRegBalance)}`);
  }
  if (bill.estateValue > 0) {
    pieces.push(`estate capital-gains tax of ${formatDollars(bill.estateTax)} on ${formatDollars(bill.estateValue)}`);
  }
  if (bill.rolledOver) {
    pieces.push("the RRSP or RRIF rolls to an eligible beneficiary, so it is not taxed");
  } else if (bill.rrspBalance > 0) {
    pieces.push(`RRSP tax of ${formatDollars(bill.rrspTax)} on ${formatDollars(bill.rrspBalance)}`);
  }
  const detail = pieces.length ? `${pieces.join(", ")}.` : "no tax from these accounts.";
  return `${name}: ${detail} ${formatDollars(bill.total)} is in the life insurance need.`;
}

function deathTaxSentence(model) {
  const estate = readMoney($("estate-value").value);
  const parts = [
    `${model.probate.name} probate fee on ${formatDollars(estate)} expected to go through the estate: ${formatDollars(model.probate.fee)}. ${model.probate.note}`,
    deathTaxPiece(personName(), model.deathTaxBill),
  ];
  if (model.partnerDeathTaxBill) parts.push(deathTaxPiece(partnerName(), model.partnerDeathTaxBill));
  parts.push(`The cost base of the non-registered account and of the estate property is counted as zero, and half of each amount is included as a capital gain. Leave the non-registered balance out of the estate value. An RRSP that does not roll over is included in full. These taxes stay in the life insurance need. On the chart, the accounts grow at the estimated rate of return while saving and the estate value rises with inflation, so the tax and the insurance need rise with them. Brackets are the ${latestTaxYear()} combined federal and provincial rates. Basic personal credits are not subtracted.`);
  if (model.portfolio && !$("early-death-age").disabled) {
    const row = portfolioRow(model, model.earlyAge);
    if (row) {
      const age = Math.round(row.age);
      const retire = retirementAgeValue();
      const timing = retire != null && age >= retire ? `at age ${age}` : `at age ${age}, before retirement`;
      const rollover = model.rollover ? " The RRSP rolls to an eligible beneficiary, so that balance is not in this tax." : "";
      parts.push(`If death is ${timing}, tax on the TFSA, RRSP, non-registered, and other assets in the table is about ${formatDollars(row.deathTax)}.${rollover}`);
    }
  }
  parts.push(`Personal life insurance in force on this life is ${formatDollars(model.personalCoverage)}. A death benefit paid to a named beneficiary is generally tax-free and generally bypasses probate.`);
  if ($("client-owns-corp").checked || model.corporateCoverage > 0) {
    const counted = model.countCorporate
      ? `It is counted in ${personName()}'s capital need.`
      : `It is not counted in ${personName()}'s capital need.`;
    parts.push(`A corporation owns ${formatDollars(model.corporateCoverage)} of life insurance on this life. Proceeds minus the adjusted cost base of ${formatDollars(model.corporateAcb)} leave about ${formatDollars(model.capitalDividend)} that can usually be paid as a capital dividend. ${counted}`);
  } else {
    parts.push("No corporation is marked as owning life insurance on this life.");
  }
  if (hasPartner()) {
    parts.push(`Personal coverage on ${partnerName()} is ${formatDollars(readMoney($("partner-existing-coverage").value))}. It reduces ${partnerName()}'s need only.`);
    if ($("partner-owns-corp").checked) {
      const counted = model.partnerCountCorporate
        ? `It is counted in ${partnerName()}'s capital need.`
        : `It is not counted in ${partnerName()}'s capital need.`;
      const dividend = Math.max(0, model.partnerCorporateCoverage - model.partnerCorporateAcb);
      parts.push(`${partnerName()} owns a corporation with ${formatDollars(model.partnerCorporateCoverage)} of life insurance on that life. Proceeds minus the adjusted cost base of ${formatDollars(model.partnerCorporateAcb)} leave about ${formatDollars(dividend)} that can usually be paid as a capital dividend. ${counted}`);
    }
  }
  parts.push("A TFSA is generally not taxable at death.");
  return parts.join(" ");
}

function recordedOrNull(id) {
  return blank(id) ? null : readMoney($(id).value);
}

function recordedDollars(id, suffix = "") {
  const amount = recordedOrNull(id);
  if (amount == null) return "Not recorded yet";
  return `${formatDollars(amount)}${suffix}`;
}

function coverageAdvice(name, kind, recordedId, calculated, advisedSuffix = "") {
  const recorded = recordedOrNull(recordedId);
  const advised = recorded == null
    ? "A different amount has not been recorded."
    : `I advised ${formatDollars(recorded)}${advisedSuffix}.`;
  return `${name}, ${kind}. ${advised} ${calculated}`;
}

function protectionLines(model) {
  const protection = model.protection;
  const months = Math.round(protection.disabilityMonths);
  const ciMonths = Math.round(protection.ciMonths);
  const lines = [
    `${personName()}, life insurance. The calculated need is ${formatDollars(model.life.capitalNeed)}.`,
    `${personName()}, disability. The calculated benefit is ${formatDollars(protection.clientDisability)} a month for ${months} months.`,
    `${personName()}, critical illness. The calculated lump sum is ${formatDollars(protection.clientCritical)}, ${formatPercent(protection.ciRatio)} of earned income for ${ciMonths} months.`,
  ];
  if (model.spouseLife) {
    lines.push(
      `${partnerName()}, life insurance. The calculated need is ${formatDollars(model.spouseLife.capitalNeed)}.`,
      `${partnerName()}, disability. The calculated benefit is ${formatDollars(protection.spouseDisability)} a month for ${months} months.`,
      `${partnerName()}, critical illness. The calculated lump sum is ${formatDollars(protection.spouseCritical)}, ${formatPercent(protection.ciRatio)} of earned income for ${ciMonths} months.`,
    );
  }
  for (const child of childLabels()) {
    lines.push(`${child}, life insurance. ${formatDollars(protection.childLifeEach)}.`);
    lines.push(`${child}, critical illness. ${formatDollars(protection.childCiEach)}.`);
  }
  lines.push("These are separate amounts. Choosing a policy, including term or permanent coverage, is separate from this letter. Income from investments is not included in the critical illness amount.");
  return lines;
}

function adviceLines(model) {
  const protection = model.protection;
  const months = Math.round(protection.disabilityMonths);
  const lines = [
    coverageAdvice(personName(), "life insurance", "recommended-life", `The calculated need is ${formatDollars(model.life.capitalNeed)}.`),
    coverageAdvice(personName(), "disability", "recommended-disability", `The calculated benefit is ${formatDollars(protection.clientDisability)} a month for ${months} months.`, " a month"),
    coverageAdvice(personName(), "critical illness", "recommended-critical", `The calculated lump sum is ${formatDollars(protection.clientCritical)}.`),
  ];
  if (model.spouseLife) {
    lines.push(
      coverageAdvice(partnerName(), "life insurance", "recommended-partner-life", `The calculated need is ${formatDollars(model.spouseLife.capitalNeed)}.`),
      coverageAdvice(partnerName(), "disability", "recommended-partner-disability", `The calculated benefit is ${formatDollars(protection.spouseDisability)} a month for ${months} months.`, " a month"),
      coverageAdvice(partnerName(), "critical illness", "recommended-partner-critical", `The calculated lump sum is ${formatDollars(protection.spouseCritical)}.`),
    );
  }
  for (const child of childLabels()) {
    lines.push(`${child}, life insurance. ${formatDollars(protection.childLifeEach)}.`);
    lines.push(`${child}, critical illness. ${formatDollars(protection.childCiEach)}.`);
  }
  return lines;
}

function choiceGap(chosenId, recommendedId, suffix = "") {
  const chosen = recordedOrNull(chosenId);
  const recommended = recordedOrNull(recommendedId);
  if (chosen == null) return { text: "The client's choice has not been recorded.", value: "Not recorded yet" };
  const amount = `${formatDollars(chosen)}${suffix}`;
  if (recommended == null) {
    return { text: `The client chose ${amount}. A recommendation has not been recorded.`, value: amount };
  }
  const gap = Math.round(chosen) - Math.round(recommended);
  if (gap === 0) {
    return { text: `The client chose ${amount}. This matches the recommendation.`, value: `${amount}. Matches the recommendation.` };
  }
  const direction = gap < 0 ? "less" : "more";
  const difference = `${formatDollars(Math.abs(gap))}${suffix} ${direction} than the recommendation of ${formatDollars(recommended)}${suffix}`;
  return {
    text: `The client chose ${amount}. This is ${difference}.`,
    value: `${amount}. ${formatDollars(Math.abs(gap))}${suffix} ${direction}.`,
  };
}

function clientChoiceLines() {
  const rows = [
    [personName(), "life insurance", "chosen-life", "recommended-life", ""],
    [personName(), "disability", "chosen-disability", "recommended-disability", " a month"],
    [personName(), "critical illness", "chosen-critical", "recommended-critical", ""],
  ];
  if (hasPartner()) {
    rows.push(
      [partnerName(), "life insurance", "chosen-partner-life", "recommended-partner-life", ""],
      [partnerName(), "disability", "chosen-partner-disability", "recommended-partner-disability", " a month"],
      [partnerName(), "critical illness", "chosen-partner-critical", "recommended-partner-critical", ""],
    );
  }
  const lines = rows.map(([name, kind, chosenId, recommendedId, suffix]) => {
    return `${name}, ${kind}. ${choiceGap(chosenId, recommendedId, suffix).text}`;
  });
  const reason = $("chosen-reason").value.trim();
  lines.push(reason
    ? `${personName()}. ${reason}`
    : `${personName()}. The reason this choice matches or differs from the recommendation has not been written yet.`);
  if (hasPartner()) {
    const partnerReason = $("chosen-partner-reason").value.trim();
    lines.push(partnerReason
      ? `${partnerName()}. ${partnerReason}`
      : `${partnerName()}. The reason this choice matches or differs from the recommendation has not been written yet.`);
  }
  return lines;
}

function clientChoicePairs() {
  const pairs = [
    [`${personName()} life insurance chosen`, choiceGap("chosen-life", "recommended-life").value],
    [`${personName()} disability chosen`, choiceGap("chosen-disability", "recommended-disability", " a month").value],
    [`${personName()} critical illness chosen`, choiceGap("chosen-critical", "recommended-critical").value],
  ];
  if (hasPartner()) {
    pairs.push(
      [`${partnerName()} life insurance chosen`, choiceGap("chosen-partner-life", "recommended-partner-life").value],
      [`${partnerName()} disability chosen`, choiceGap("chosen-partner-disability", "recommended-partner-disability", " a month").value],
      [`${partnerName()} critical illness chosen`, choiceGap("chosen-partner-critical", "recommended-partner-critical").value],
    );
  }
  return pairs;
}

function scenarioSentence() {
  return "";
}

function balancesAtReturn(model, savingsReturn) {
  const marginal = Number.isFinite(model.marginalNow) ? model.marginalNow : 0;
  const outcome = allocationOutcome({
    ...model.mix.allocationInput,
    annualSavings: model.mix.annualSavings,
    rrspShare: model.mix.share,
    savingsReturn,
    nonRegReturn: savingsReturn * (1 - 0.5 * marginal),
  });
  const other = futureValue(model.accounts.other, savingsReturn, model.horizon.years || 0);
  return { outcome, wealth: outcome.tfsa + outcome.rrsp + outcome.nonReg + other };
}

function depositSentence(year) {
  const who = hasPartner()
    ? `${personName()} puts ${formatDollars(year.clientTfsa)} in the TFSA and ${formatDollars(year.clientRrsp)} in the RRSP. ${partnerName()} puts ${formatDollars(year.partnerTfsa)} in the TFSA and ${formatDollars(year.partnerRrsp)} in the RRSP.`
    : `${formatDollars(year.tfsa)} goes into the TFSA and ${formatDollars(year.rrsp)} goes into the RRSP.`;
  const refund = year.refund > 0
    ? ` The RRSP deposit includes about ${formatDollars(year.refund)} from the tax refund.`
    : "";
  const overflow = year.unsheltered > 0
    ? ` ${formatDollars(year.unsheltered)} goes to non-registered once the TFSA and RRSP room are full.`
    : "";
  return `${who}${refund}${overflow}`;
}

function allocationSentence(model) {
  const path = model.portfolio;
  if (!path) return "Enter an age and a likely age at death to list the yearly deposits.";
  const retire = path.rows.find((row) => row.retired);
  let text = retire
    ? `At retirement the balances are TFSA ${formatDollars(retire.tfsa)}, RRSP ${formatDollars(retire.rrsp)}, non-registered ${formatDollars(retire.nonReg)}, and other assets ${formatDollars(retire.other)}. `
    : "";
  text += "Withdrawals start at retirement. CPP and OAS cover part of the after-tax income, and the accounts withdraw the rest. RRSP withdrawals are taxed in full. Non-registered withdrawals are taxed on the gain, with the cost of the balance already owned counted as zero. Only the growth on other assets is taxed. A TFSA withdrawal is not taxed.";
  return text;
}

function pathSentence(points, chosenYears, usesAge, name, deathAgeId = "death-age") {
  if (!points.length) return "";
  const today = points[0];
  const when = usesAge ? `at age ${today.age}` : "today";
  const opening = `If ${name} dies ${when}, the life insurance need is ${formatDollars(today.capitalNeed)}.`;
  const retirementAge = retirementAgeValue();
  const deathAge = deathAgeValue(deathAgeId);
  const atDeath = points[points.length - 1];
  const deathSentence = usesAge && deathAge != null && atDeath.age >= deathAge
    ? ` The line runs to age ${Math.round(atDeath.age)}. Final expenses and probate there are ${formatDollars(atDeath.floor - atDeath.deathTax)}. Tax at death there is ${formatDollars(atDeath.deathTax)}.`
    : "";
  if (!usesAge || retirementAge == null) return `${opening}${deathSentence}`;
  const atRetirement = points.find((point) => point.age >= retirementAge) || points[points.length - 1];
  const ending = `At retirement the life insurance need is ${formatDollars(atRetirement.capitalNeed)}.`;
  if (today.age >= retirementAge) {
    return `${opening} This age is already at retirement, so the chart does not include years of income.${deathSentence}`;
  }
  if (today.years < chosenYears) {
    return `${opening} Income replacement is ${today.years} years because retirement is that close, and it steps down by one year each year of age. Those dollars rise with inflation. The mortgage pays down in a straight line. ${ending}${deathSentence}`;
  }
  const holdThrough = retirementAge - chosenYears;
  return `${opening} Income replacement stays at ${chosenYears} years through age ${holdThrough}, then steps down by one year each year of age. Those dollars rise with inflation. The mortgage pays down in a straight line. ${ending}${deathSentence}`;
}

function longevitySentence(model) {
  const chosen = incomeYearsChosen();
  const person = pathSentence(model.needPath, chosen, model.chartUsesAge, personName());
  if (!model.partnerNeedPath) return person;
  return `${person} ${pathSentence(model.partnerNeedPath, chosen, model.partnerChartUsesAge, partnerName(), "partner-death-age")}`;
}

function futureRoomSentence(model) {
  return `New room from next year through retirement, on top of the room available now, in each future year's dollars: TFSA ${formatDollars(model.room.householdTfsa)}, RRSP ${formatDollars(model.room.householdRrsp)}. The projection ignores a pension adjustment. TFSA limits after ${tfsaContributionLimit.taxYear} follow the inflation assumption and round to the nearest $500. Later RRSP dollar limits grow at ${formatPercent(model.room.rrspGrowth)} a year. TFSA room continues after retirement; this projection stops at the retirement age.`;
}

function reportLogo() {
  const wrap = document.createElement("div");
  wrap.className = "flex items-center gap-3";
  const image = document.createElement("img");
  image.src = "assets/icon.png";
  image.alt = "";
  image.className = "h-12 w-auto";
  const text = document.createElement("div");
  const firm = document.createElement("p");
  firm.className = "text-lg text-ink";
  firm.textContent = $("advisor-firm").value.trim() || DEFAULT_ADVISOR.firm;
  const person = document.createElement("p");
  person.className = "text-sm text-inksoft";
  person.textContent = $("advisor-name").value.trim() || DEFAULT_ADVISOR.name;
  text.append(firm, person);
  wrap.append(image, text);
  return wrap;
}

function clientLetterLines(model) {
  const name = personName();
  const advisor = $("advisor-name").value.trim() || DEFAULT_ADVISOR.name;
  const needs = checkedNeeds();
  const monthly = "";
  const children = childLabels();
  const advice = adviceLines(model);
  return [
    "Reason Why Letter",
    $("meeting-date").value || "Date not set",
    "",
    `Dear ${name},`,
    "",
    "This letter records what we discussed and what I advised. It is the needs analysis for your file.",
    "",
    "What we discussed",
    `${name} is ${blank("client-age") ? "of an age not yet entered" : `${$("client-age").value} years old`}, in ${model.probate.name}. Personal income is ${formatDollars(readMoney($("personal-income").value))} and household income is ${formatDollars(householdIncome())}.`,
    hasPartner() ? `${partnerName()} is ${blank("partner-age") ? "an age not entered" : `${$("partner-age").value} years old`} with income of ${formatDollars(readMoney($("partner-income").value))}.` : "No spouse was included.",
    children.length ? `Children already born: ${children.join(", ")}.` : "No children already born were included.",
    ...(readMoney($("planned-children").value) > 0
      ? ["A child who is not born yet is not given a life or critical illness amount. Planned children still add an education amount on the life insurance chart."]
      : []),
    `The mortgage balance is ${formatDollars(readMoney($("debts").value))}, with ${$("mortgage-years").value || "0"} years left. Other debts are ${formatDollars(readMoney($("other-debts").value))}.`,
    guaranteedInsurabilitySentence(),
    ...(showsInsurance() ? [
      "",
      `If ${name}${hasPartner() ? ` or ${partnerName()}` : ""} dies`,
      lifeNarrative(model),
      longevitySentence(model),
      deathTaxSentence(model),
      ...protectionLines(model),
    ] : []),
    ...(showsPlanning() ? [
      "",
      "Retirement",
      retirementNarrative(model),
      monthly,
      $("savings-destination").textContent,
      scenarioSentence(model),
      "",
      "TFSA and RRSP",
      allocationSentence(model),
    ] : []),
    "",
    "What I advised",
    needs.length ? `Needs we assessed: ${needs.join(", ")}.` : "No needs were checked.",
    ...advice,
    $("rationale").value.trim() || "The reason for that advice has not been written yet.",
    "",
    "What the client chose",
    ...clientChoiceLines(),
    $("not-disclosed").value.trim() ? `Information you did not provide: ${$("not-disclosed").value.trim()}` : "",
    $("unmet-needs").value.trim() ? `Left for later: ${$("unmet-needs").value.trim()}` : "Nothing was left for later.",
    "",
    "This is not a product illustration and not a tax filing. Choosing a policy or an investment is separate from this letter.",
    "",
    advisor,
    $("advisor-firm").value.trim() || DEFAULT_ADVISOR.firm,
    "Alberta Life and A&S",
  ].filter((line) => line !== "");
}

const LETTER_HEADINGS = new Set(["What we discussed", "Retirement", "TFSA and RRSP", "What I advised", "What the client chose"]);

function isLetterHeading(line) {
  if (LETTER_HEADINGS.has(line)) return true;
  return line.startsWith("If ") && !line.includes(".");
}

function emailParagraphs(line) {
  if (isLetterHeading(line) || line.startsWith("Dear ") || line.length < 280) return [line];
  const sentences = line.split(/(?<=\.)\s+(?=[A-Z])/).map((part) => part.trim()).filter(Boolean);
  return sentences.length ? sentences : [line];
}

function emailLetterParts(model) {
  const lines = clientLetterLines(model);
  const body = lines.slice(2, -3).flatMap(emailParagraphs);
  return {
    date: lines[1],
    body,
    signature: lines.slice(-3),
  };
}

function escapeEmailHtml(value) {
  return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
}

function emailLetterText(model) {
  const { date, body, signature } = emailLetterParts(model);
  const blocks = ["Reason Why Letter", date, ""];
  for (const line of body) {
    blocks.push(isLetterHeading(line) ? `\n${line}\n` : line, "");
  }
  blocks.push(signature.join("\n"));
  return `${blocks.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

function emailLetterHtml(model) {
  const { date, body, signature } = emailLetterParts(model);
  const parts = [
    `<p style="margin:0 0 4px;font-size:20px"><strong>Reason Why Letter</strong></p>`,
    `<p style="margin:0 0 16px;color:#444">${escapeEmailHtml(date)}</p>`,
  ];
  for (const line of body) {
    parts.push(isLetterHeading(line)
      ? `<p style="margin:18px 0 8px"><strong>${escapeEmailHtml(line)}</strong></p>`
      : `<p style="margin:0 0 12px">${escapeEmailHtml(line)}</p>`);
  }
  parts.push(`<p style="margin:18px 0 0">${signature.map(escapeEmailHtml).join("<br>")}</p>`);
  return `<div style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.5;color:#111">${parts.join("")}</div>`;
}

function renderFileCopy(model) {
  const root = $("file-copy");
  const engagement = document.querySelector('input[name="engagement"]:checked')?.value;
  const needs = checkedNeeds();
  const recommendedBlank = blank("recommended-life");
  const recommended = readMoney($("recommended-life").value);
  const ages = [...document.querySelectorAll("[data-dep-age]")].map((input) => input.value.trim() || "not provided");
  const client = document.createElement("section");
  client.id = "client-letter";
  client.className = "rounded-sm border border-line bg-white p-6 shadow-sm";
  const advisor = document.createElement("section");
  advisor.id = "advisor-record";
  advisor.className = "report-break rounded-sm border border-line bg-white p-6 shadow-sm";
  const letter = clientLetterLines(model);

  client.append(
    reportLogo(),
    paragraph("mt-4 font-serif font-semibold text-3xl text-navydeep", "Reason Why Letter"),
    paragraph("mt-1 text-sm text-inksoft", letter[1]),
  );
  for (const line of letter.slice(2)) {
    client.append(paragraph(isLetterHeading(line) ? "mt-4 font-medium" : "mt-2 text-sm leading-6", line));
  }

  advisor.append(
    reportLogo(),
    paragraph("mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-golddim", "Advisor record"),
    paragraph("font-serif font-semibold text-3xl text-navydeep", "Needs worksheet"),
    paragraph(
      "mt-1 text-sm text-inksoft",
      `${$("meeting-date").value || "Date not set"} · ${personName()}`,
    ),
    heading("Engagement"),
    paragraph(
      "mt-2 text-sm leading-6",
      engagement === "stated"
        ? "The client already identified the need. The figures below are the worksheet's check, not a claim that the need was discovered in this meeting."
        : "The client asked for advice. The need below was assessed from the facts in this worksheet.",
    ),
  );

  if (engagement === "stated") {
    advisor.append(paragraph("mt-2 text-sm leading-6", $("stated-need").value.trim() || "The client's stated need was not written down."));
  }

  advisor.append(
    heading("Facts"),
    definitionList([
      ["Advisor", $("advisor-name").value.trim() || "Not entered"],
      ["Firm", $("advisor-firm").value.trim() || "Not entered"],
      ["Province", model.probate.name],
      [`${personName()} age`, blank("client-age") ? "Not provided" : $("client-age").value],
      [`${personName()} income`, formatDollars(readMoney($("personal-income").value))],
      ["Household income", formatDollars(householdIncome())],
      [partnerName(), hasPartner() ? "Included" : "Not included"],
      [`${partnerName()} age`, hasPartner() ? (blank("partner-age") ? "Not provided" : $("partner-age").value) : "Not applicable"],
      [`${partnerName()} income`, hasPartner() ? formatDollars(readMoney($("partner-income").value)) : "Not applicable"],
      ["Children already born", childLabels().join(", ") || "None"],
      ["Dependant ages", ages.length ? ages.join(", ") : "None entered"],
      [`${personName()} owns a corporation`, $("client-owns-corp").checked ? "Yes" : "No"],
      [`${partnerName()} owns a corporation`, hasPartner() && $("partner-owns-corp").checked ? "Yes" : "No"],
      ["Personal coverage on this life", formatDollars(model.personalCoverage)],
      ["Corporate coverage on this life", formatDollars(model.corporateCoverage)],
      ["Corporate coverage counted in the need", model.countCorporate ? "Yes" : "No"],
      ["Estate value for probate", formatDollars(readMoney($("estate-value").value))],
      ["Probate fee", formatDollars(model.probate.fee)],
      ["TFSA balance", formatDollars(model.accounts.tfsaBalance)],
      ["TFSA room available now", formatDollars(model.accounts.tfsaRoom)],
      ["RRSP balance", formatDollars(model.accounts.rrspBalance)],
      ["RRSP room available now", formatDollars(model.accounts.rrspRoom)],
      ["Non-registered balance", formatDollars(model.accounts.nonReg)],
      ["Other retirement assets", formatDollars(model.accounts.other)],
      ["Inflation assumption", formatPercent(model.target.inflation / 100)],
      ["Retirement income basis", model.target.mode === "future" ? "Future dollars" : "Today's dollars"],
      ["Legacy goal", model.retirement && model.retirement.legacyAtDeath > 0 ? formatDollars(model.retirement.legacyAtDeath) : "None entered."],
    ]),
    heading("Life insurance need"),
    paragraph("mt-2 text-sm leading-6", lifeNarrative(model)),
    ...(guaranteedInsurabilitySentence() ? [paragraph("mt-2 text-sm leading-6", guaranteedInsurabilitySentence())] : []),
    definitionList([
      [`${personName()} capital need`, formatDollars(model.life.capitalNeed)],
      [`${personName()} life amount recorded`, recordedDollars("recommended-life")],
      [`${personName()} disability, monthly`, formatDollars(model.protection.clientDisability)],
      [`${personName()} disability amount recorded`, recordedDollars("recommended-disability", " a month")],
      [`${personName()} critical illness`, formatDollars(model.protection.clientCritical)],
      [`${personName()} critical illness amount recorded`, recordedDollars("recommended-critical")],
      [`${personName()} surplus over the gross need`, formatDollars(model.life.surplus)],
      ...(model.spouseLife ? [
        [`${partnerName()} capital need`, formatDollars(model.spouseLife.capitalNeed)],
        [`${partnerName()} life amount recorded`, recordedDollars("recommended-partner-life")],
        [`${partnerName()} disability, monthly`, formatDollars(model.protection.spouseDisability)],
        [`${partnerName()} disability amount recorded`, recordedDollars("recommended-partner-disability", " a month")],
        [`${partnerName()} critical illness`, formatDollars(model.protection.spouseCritical)],
        [`${partnerName()} critical illness amount recorded`, recordedDollars("recommended-partner-critical")],
      ] : []),
      ...childLabels().flatMap((child) => [
        [`${child} life insurance`, formatDollars(model.protection.childLifeEach)],
        [`${child} critical illness`, formatDollars(model.protection.childCiEach)],
      ]),
    ]),
  );

  if (!recommendedBlank && Math.round(recommended) !== Math.round(model.life.capitalNeed)) {
    advisor.append(
      paragraph(
        "mt-2 text-sm leading-6",
        `The recommended amount differs from the calculated need by ${formatDollars(Math.abs(recommended - model.life.capitalNeed))}.`,
      ),
    );
  }

  advisor.append(
    heading("Tax at death"),
    paragraph("mt-2 text-sm leading-6", deathTaxSentence(model)),
    paragraph("mt-2 text-sm leading-6", `Probate schedule as of ${model.probate.asOf}. ${model.probate.source}`),
    heading("Registered room"),
    paragraph("mt-2 text-sm leading-6", describeTfsa(model.tfsa.client, personName())),
    paragraph(
      "mt-2 text-sm leading-6",
      hasPartner() ? describeTfsa(model.tfsa.partner, partnerName()) : `${partnerName()} is not included, so only ${personName()}'s TFSA schedule is added up.`,
    ),
    paragraph("mt-2 text-sm leading-6", futureRoomSentence(model)),
    heading("Retirement gap"),
    paragraph("mt-2 text-sm leading-6", retirementNarrative(model)),
    paragraph("mt-2 text-sm leading-6", allocationSentence(model)),
  );

  if (model.retirement) {
    advisor.append(
      definitionList([
        ...contributionSchedule(model),
        ["Legacy goal", model.retirement.legacyAtDeath > 0 ? formatDollars(model.retirement.legacyAtDeath) : "None"],
        ["Balance at the end of the plan", wealthTotals(model) ? formatDollars(wealthTotals(model).atDeath) : "—"],
        ["Income in today's dollars", formatDollars(model.target.today)],
        ["Income in the year of retirement", formatDollars(model.target.nominal)],
        ["TFSA room available now", formatDollars(model.accounts.tfsaRoom)],
        ["RRSP room available now", formatDollars(model.accounts.rrspRoom)],
        ["Projected new TFSA room to retirement", formatDollars(model.room.householdTfsa)],
        ["Projected new RRSP room to retirement", formatDollars(model.room.householdRrsp)],
      ]),
    );
  }

  advisor.append(
    heading("What the client chose"),
    definitionList(clientChoicePairs()),
    paragraph("mt-2 text-sm leading-6", $("chosen-reason").value.trim() || `${personName()}: the reason this choice matches or differs from the recommendation has not been written yet.`),
    ...(hasPartner() ? [paragraph("mt-2 text-sm leading-6", $("chosen-partner-reason").value.trim() || `${partnerName()}: the reason this choice matches or differs from the recommendation has not been written yet.`)] : []),
    heading("Needs assessed"),
    paragraph("mt-2 text-sm", needs.length ? needs.join(", ") : "None checked."),
    heading("Not provided"),
    paragraph("mt-2 text-sm leading-6", $("not-disclosed").value.trim() || "Nothing noted."),
    heading("Reason why"),
    paragraph("mt-2 text-sm leading-6", $("rationale").value.trim() || "Advisor rationale not written yet."),
    heading("Left for later"),
    paragraph("mt-2 text-sm leading-6", $("unmet-needs").value.trim() || "Nothing noted."),
    heading("Figures used"),
    paragraph(
      "mt-2 text-sm leading-6",
      `Inflation history ${inflationHistory.from}–${inflationHistory.to}, ${inflationHistory.count}-year average ${defaultInflation}%. Tax brackets through ${latestTaxYear()}. Life expectancy year ${lifeExpectancy.year}. TFSA annual limit ${tfsaContributionLimit.taxYear}: ${formatDollars(tfsaContributionLimit.annualDollarLimit)}. RRSP dollar limit ${rrspLimits.contributionYear}: ${formatDollars(rrspLimits.dollarLimit)}. Next year's RRSP dollar limit: ${formatDollars(rrspLimits.nextYearDollarLimit)}. CPP maximum at 65, ${cppAmounts.year}: ${formatMoney(maxAnnualCpp())} a year. OAS maximum, ${oasAmounts.period}: ${formatDollars(oasAmounts.maxMonthlyAge65to74 * 12)} (65–74) and ${formatDollars(oasAmounts.maxMonthlyAge75andOver * 12)} (75 and over). Probate fees as of ${probateFees.asOf}.`,
    ),
    paragraph(
      "mt-4 text-sm leading-6 text-inksoft",
      "Worksheet only. Not a policy illustration, not a CRA determination of contribution room, and not a recommendation of an insurance or investment product. The savings gap is in today's dollars. Exporting this report is the copy for the file. The worksheet does not store the entries.",
    ),
  );

  root.replaceChildren(client, advisor);
}

function renderSavingsMix(model) {
  const marker = $("rrsp-best");
  const note = $("rrsp-best-note");
  const detail = $("allocation-note");
  if (!model.mix) {
    marker.classList.add("hidden");
    note.textContent = "Enter age and retirement age to see how the mix changes the savings.";
    detail.textContent = "";
    return;
  }
  const pct = Math.round(model.mix.bestShare * 100);
  marker.classList.remove("hidden");
  marker.style.left = `${pct}%`;
  marker.style.transform = pct < 8 ? "none" : pct > 92 ? "translateX(-100%)" : "translateX(-50%)";
  marker.textContent = "Lowest";
  if (!dirty.allocation) $("rrsp-share").value = String(pct);
  const chosen = Math.round(model.mix.share * 100);
  $("rrsp-share-readout").textContent = ` · ${100 - chosen}% TFSA, ${chosen}% RRSP`;
  const amount = (annual) => model.horizon.alreadyRetired ? formatDollars(annual) : `${formatDollars(annual / 12)} a month`;
  const placed = chosen === pct ? "The slider is on that mix." : `The slider is at ${chosen}% RRSP. Choose Lowest to put it back.`;
  note.textContent = `All TFSA needs ${amount(model.mix.allTfsa)}. All RRSP needs ${amount(model.mix.allRrsp)}. The lowest is ${amount(model.mix.bestSavings)} at ${pct}% RRSP. ${placed}`;
  detail.textContent = allocationSentence(model);
}

function render() {
  document.body.dataset.scope = planningMode();
  ensureDependantInputs();
  applySuggestions();
  applyNames();
  document.querySelectorAll(".partner-only").forEach((node) => {
    node.classList.toggle("hidden", !hasPartner());
  });
  const stated = document.querySelector('input[name="engagement"]:checked')?.value === "stated";
  $("stated-need-wrap").classList.toggle("hidden", !stated);
  $("qc-verification-wrap").classList.toggle("hidden", $("province").value !== "QC");
  $("legacy-amount-wrap").classList.toggle("hidden", !$("leave-legacy").checked);
  $("legacy-note").textContent = $("leave-legacy").checked
    ? "The line on the chart is this amount. Move the contribution and return sliders to see whether the balance at the end lands on it."
    : "No legacy line is drawn. The chart shows the balance that remains after the withdrawals.";
  $("household-income").textContent = formatDollars(householdIncome());
  $("planned-children-text").textContent = dependantCount() > 0
    ? "How many more children are in the plan?"
    : "How many children do you hope to have?";
  const noMortgage = readMoney($("debts").value) <= 0;
  $("child-coverage").classList.toggle("hidden", dependantCount() === 0);
  $("child-recommendations").classList.toggle("hidden", dependantCount() === 0);
  $("house-plan").classList.toggle("hidden", !noMortgage);
  $("house-plan-fields").classList.toggle("hidden", !noMortgage || !$("plan-house").checked);
  const rider = guaranteedInsurabilitySentence();
  $("house-plan-note").classList.toggle("hidden", !rider);
  $("house-plan-note").textContent = rider;
  $("mortgage-years-wrap").classList.toggle("hidden", noMortgage);
  $("client-corp-fields").classList.toggle("hidden", !$("client-owns-corp").checked);
  $("partner-corp-fields").classList.toggle("hidden", !hasPartner() || !$("partner-owns-corp").checked);
  $("inflation-average-note").textContent = `Starts at the ${inflationHistory.count}-year Canadian average, ${defaultInflation}% (${inflationHistory.from}–${inflationHistory.to}). Slide it, or type a rate. Life insurance capital stays in today's dollars.`;
  const model = buildModel();
  draftRecommendations(model);
  const hint = $("years-hint");
  hint.replaceChildren();
  for (const line of incomeReplacementLines(model)) {
    const row = document.createElement("p");
    row.textContent = line;
    hint.append(row);
  }
  const incomePercent = formatPercent(rateFrom("replacement-ratio"));
  if (model.spouseLife && model.spouseLife.years !== model.life.years) {
    $("meeting-years").textContent = `${incomePercent} of income. ${personName()} is ${model.life.years} years. ${partnerName()} is ${model.spouseLife.years} years. The mortgage and the children are in both.`;
  } else if (model.spouseLife) {
    $("meeting-years").textContent = `${incomePercent} of each income for ${model.life.years} years. The mortgage and the children are in both.`;
  } else {
    $("meeting-years").textContent = `${incomePercent} of income for ${model.life.years} years.`;
  }
  lastModel = model;
  $("income-translation").textContent = incomeTranslation(model.target);
  renderIncomeErosion(model);
  $("probate-result").textContent = `${model.probate.name}: ${formatDollars(model.probate.fee)}. ${model.probate.note}`;
  $("death-tax-note").textContent = deathTaxSentence(model);
  setOutputs("life", formatDollars(model.life.capitalNeed), Math.round(model.life.capitalNeed));

  fillList("life-waterfall", lifeBreakdown(model.life));
  fillList("partner-life-waterfall", model.spouseLife ? lifeBreakdown(model.spouseLife) : []);
  renderProtection(model);

  const notes = [];
  if (model.invalidAges) notes.push("Enter dependant ages from 0 to 120.");
  if (blank("personal-income")) notes.push("Personal income is blank, so it is counted as zero.");
  if (model.life.capitalNeed === model.life.floor && model.life.offsets > 0) {
    notes.push(`The life insurance need stays at ${formatDollars(model.life.floor)}, which covers final expenses, probate, and tax at death.`);
  }
  if (model.corporateCoverage > 0 && !model.countCorporate) {
    notes.push("Corporate coverage is on the report and is not subtracted from the capital need.");
  }
  if (rider) notes.push(rider);

  if (!model.portfolio) {
    setOutputs("savings-label", "Monthly contributions");
    setOutputs("savings", "—", "");
    fillList("retirement-waterfall", []);
    $("savings-destination").textContent = "";
    notes.push(`Enter ${personName()}'s age and a likely age at death to draw the balances.`);
  } else {
    const headline = contributionHeadline(model);
    const gap = legacyGap(model);
    setOutputs("savings-label", headline.label);
    setOutputs("savings", formatMoney(headline.monthly), Math.round(headline.monthly));
    const rows = [
      ...contributionSchedule(model),
      ["Yearly income today", formatDollars(model.target.today)],
      ["Yearly income at retirement", formatDollars(model.target.nominal)],
      ["CPP and OAS at retirement", formatDollars(model.portfolio.rows.find((row) => row.retired)?.pension || 0)],
      ["From the accounts at retirement", formatDollars(model.portfolio.rows.find((row) => row.retired)?.withdrawal || 0)],
    ];
    if (model.portfolio.depletedAge != null) {
      rows.push(["Balances reach $0", `Age ${Math.round(model.portfolio.depletedAge)}`]);
    } else {
      rows.push(["Balance at the end", formatDollars(gap.ending)]);
    }
    if (gap.goal > 0) {
      rows.push(["Legacy goal", formatDollars(gap.goal)]);
      rows.push([gap.delta >= 0 ? "Above the legacy goal" : "Below the legacy goal", formatDollars(Math.abs(gap.delta))]);
    }
    fillList("retirement-waterfall", rows);
    savingsDestination(model);
    if (model.retirement?.oasRepayment > 0) {
      notes.push(`OAS is reduced by ${formatDollars(model.retirement.oasRepayment)}. The income counted is CPP, OAS, and other taxable income entered above. TFSA withdrawals are not included. That total is above the ${oasAmounts.incomeYear} threshold.`);
    }
    if (!blank("retirement-age") && readMoney($("retirement-age").value) < 60 && readMoney($("cpp-annual").value) > 0) {
      notes.push("CPP starts at 60. Until then, the income from the accounts does not subtract it.");
    }
    if (!blank("retirement-age") && readMoney($("retirement-age").value) < 65 && readMoney($("oas-annual").value) > 0) {
      notes.push("OAS starts at 65. Until then, the income from the accounts does not subtract it.");
    }
    if (!blank("cpp-annual") && !blank("retirement-age") && readMoney($("retirement-age").value) !== 65) {
      notes.push("CPP is the amount you entered. The maximum button is the age-65 maximum, before an early or late start.");
    }
  }

  $("calc-notes").textContent = notes.join(" ");
  renderTfsaBreakdown(model.tfsa);
  $("tfsa-room-note").textContent = `Lifetime TFSA room on the schedule runs from ${tfsaContributionLimit.introducedYear} through ${tfsaContributionLimit.taxYear}. It assumes the birthday has already happened and Canadian residence in every year counted. Room available now is the amount you enter.`;
  $("rrsp-room-note").textContent = `CPP uses earnings capped at the yearly maximum pensionable earnings, then the share of a 39-year contribution history already reached. One year at that cap is not the full maximum. OAS is years lived in Canada after 18, out of 40. Type a different amount, or use the maximum button. RRSP room available now is the amount you enter. New room ignores a pension adjustment.`;
  $("future-room-note").textContent = futureRoomSentence(model);
  renderNeedChart(model);
  renderWealthChart(model);
  renderPortfolioTable(model);
  renderEarlyDeath(model);
  renderFileCopy(model);
}

function compactDollars(value) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}k`;
  return formatDollars(value);
}

function chartFrame(root) {
  if (!window.matchMedia("(max-width: 767px)").matches) {
    return { width: 640, height: 240, padLeft: 64, padRight: 16, padTop: 16, padBottom: 36 };
  }
  const measured = root.clientWidth;
  const width = Math.max(260, Math.round(measured || 320));
  return { width, height: 200, padLeft: 58, padRight: 8, padTop: 12, padBottom: 28 };
}

function placeChartTip(tip, box, xPx, yPx, preferredWidth) {
  const tipWidth = Math.min(preferredWidth, Math.max(112, box.width - 8));
  tip.style.maxWidth = `${tipWidth}px`;
  let left = xPx + 8;
  if (left + tipWidth > box.width - 4) left = Math.max(4, box.width - tipWidth - 4);
  if (left < 4) left = 4;
  tip.style.left = `${left}px`;
  tip.style.top = `${Math.max(0, yPx)}px`;
}

function bindChartPointer(hit, svg, geometry, place, hide) {
  const indexAt = (event) => {
    const box = svg.getBoundingClientRect();
    if (!box.width) return 0;
    const x = ((event.clientX - box.left) / box.width) * geometry.width;
    const span = geometry.width - geometry.padLeft - geometry.padRight;
    if (!span) return 0;
    return Math.round(((x - geometry.padLeft) / span) * (geometry.count - 1));
  };
  const show = (event) => place(indexAt(event));
  hit.style.touchAction = "pan-y";
  hit.addEventListener("pointerdown", show);
  hit.addEventListener("pointermove", show);
  hit.addEventListener("pointerleave", hide);
  hit.addEventListener("pointercancel", hide);
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

function drawNeedChart({ root, points, usesAge, sentence, empty }) {
  if (points.length < 2) {
    root.textContent = empty;
    return;
  }
  const { width, height, padLeft, padRight, padTop, padBottom } = chartFrame(root);
  const maxNeed = Math.max(...points.map((point) => Math.max(point.capitalNeed, point.mortgageLeft)), 1);
  const xFor = (index) => padLeft + (index / (points.length - 1)) * (width - padLeft - padRight);
  const yFor = (need) => padTop + (1 - need / maxNeed) * (height - padTop - padBottom);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", sentence);
  svg.classList.add("w-full", "h-64");
  for (let step = 0; step <= 4; step += 1) {
    const need = (maxNeed * step) / 4;
    const y = yFor(need);
    const grid = document.createElementNS("http://www.w3.org/2000/svg", "line");
    grid.setAttribute("x1", String(padLeft));
    grid.setAttribute("x2", String(width - padRight));
    grid.setAttribute("y1", String(y));
    grid.setAttribute("y2", String(y));
    grid.setAttribute("stroke", "#ddd7ca");
    svg.append(grid, svgText(padLeft - 8, y + 4, compactDollars(need), "end"));
  }
  const ageMarks = [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]];
  ageMarks.forEach((point) => {
    const index = points.indexOf(point);
    const label = usesAge ? String(point.age) : (point.elapsed === 0 ? "Now" : `+${Math.round(point.elapsed)}`);
    svg.append(svgText(xFor(index), height - 10, label, "middle"));
  });
  const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", "#2f3744");
  line.setAttribute("stroke-width", "3");
  line.setAttribute("points", points.map((point, index) => `${xFor(index)},${yFor(point.capitalNeed)}`).join(" "));
  svg.append(line);
  const hasMortgage = points.some((point) => point.mortgageLeft > 0);
  if (hasMortgage) {
    const mortgageLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    mortgageLine.setAttribute("fill", "none");
    mortgageLine.setAttribute("stroke", "#a68a61");
    mortgageLine.setAttribute("stroke-width", "2");
    mortgageLine.setAttribute("stroke-dasharray", "5 4");
    mortgageLine.setAttribute("points", points.map((point, index) => `${xFor(index)},${yFor(point.mortgageLeft)}`).join(" "));
    svg.append(mortgageLine);
  }
  const hit = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  hit.setAttribute("x", "0");
  hit.setAttribute("y", "0");
  hit.setAttribute("width", String(width));
  hit.setAttribute("height", String(height));
  hit.setAttribute("fill", "transparent");
  svg.append(hit);
  const guideY = document.createElement("div");
  guideY.className = "need-guide-y";
  const guideX = document.createElement("div");
  guideX.className = "need-guide-x";
  const tip = document.createElement("div");
  tip.className = "need-tip rounded-sm bg-navydeep px-3 py-2 text-xs text-white shadow";
  const place = (index) => {
    const point = points[Math.max(0, Math.min(points.length - 1, index))];
    const x = xFor(points.indexOf(point));
    const y = yFor(point.capitalNeed);
    const box = svg.getBoundingClientRect();
    const scaleX = box.width / width;
    const scaleY = box.height / height;
    guideY.style.opacity = "1";
    guideX.style.opacity = "1";
    tip.style.opacity = "1";
    guideY.style.left = `${x * scaleX}px`;
    guideY.style.height = `${(height - padBottom) * scaleY}px`;
    guideX.style.top = `${y * scaleY}px`;
    guideX.style.left = `${padLeft * scaleX}px`;
    guideX.style.width = `${(x - padLeft) * scaleX}px`;
    placeChartTip(tip, box, x * scaleX, Math.max(0, y * scaleY - 48), 156);
    tip.replaceChildren();
    const age = document.createElement("p");
    age.textContent = usesAge
      ? `Age ${point.age}`
      : (point.elapsed === 0 ? "Today" : `${Math.round(point.elapsed)} years from now`);
    const yearsOfIncome = document.createElement("p");
    const roundedYears = Math.round(point.years);
    yearsOfIncome.textContent = roundedYears === 1 ? "1 year of income" : `${roundedYears} years of income`;
    const amount = document.createElement("p");
    amount.className = "text-base font-bold text-white";
    amount.textContent = formatDollars(point.capitalNeed);
    tip.append(age, yearsOfIncome, amount);
    const mortgageDue = point.mortgageLeft;
    if (mortgageDue > 0) {
      const mortgage = document.createElement("p");
      mortgage.textContent = `Mortgage ${formatDollars(mortgageDue)}`;
      tip.append(mortgage);
    }
    const expenses = document.createElement("p");
    expenses.textContent = `Final expenses ${formatDollars(point.floor - (point.deathTax || 0))}`;
    tip.append(expenses);
    if (point.deathTax > 0) {
      const tax = document.createElement("p");
      tax.textContent = `Tax at death ${formatDollars(point.deathTax)}`;
      tip.append(tax);
    }
  };
  bindChartPointer(hit, svg, { width, padLeft, padRight, count: points.length }, place, () => {
    guideY.style.opacity = "0";
    guideX.style.opacity = "0";
    tip.style.opacity = "0";
  });
  const legend = document.createElement("p");
  legend.className = "mt-2 text-xs text-inksoft";
  legend.textContent = hasMortgage
    ? "Solid line: capital need. Dashed line: mortgage, paid down in a straight line."
    : "Solid line: capital need.";
  root.replaceChildren(svg, guideY, guideX, tip, legend);
}

function drawErosionChart({ root, points, sentence }) {
  const { width, height, padLeft, padRight, padTop, padBottom } = chartFrame(root);
  const maxPower = Math.max(...points.map((point) => point.buyingPower), 1);
  const xFor = (index) => padLeft + (index / (points.length - 1)) * (width - padLeft - padRight);
  const yFor = (value) => padTop + (1 - value / maxPower) * (height - padTop - padBottom);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", sentence);
  svg.classList.add("w-full", "h-64");
  for (let step = 0; step <= 4; step += 1) {
    const value = (maxPower * step) / 4;
    const y = yFor(value);
    const grid = document.createElementNS("http://www.w3.org/2000/svg", "line");
    grid.setAttribute("x1", String(padLeft));
    grid.setAttribute("x2", String(width - padRight));
    grid.setAttribute("y1", String(y));
    grid.setAttribute("y2", String(y));
    grid.setAttribute("stroke", "#ddd7ca");
    svg.append(grid, svgText(padLeft - 8, y + 4, compactDollars(value), "end"));
  }
  const ageMarks = [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]];
  ageMarks.forEach((point) => {
    const index = points.indexOf(point);
    svg.append(svgText(xFor(index), height - 10, String(point.age), "middle"));
  });
  const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", "#2f3744");
  line.setAttribute("stroke-width", "3");
  line.setAttribute("stroke-linejoin", "round");
  line.setAttribute("stroke-linecap", "round");
  line.setAttribute("points", points.map((point, index) => `${xFor(index)},${yFor(point.buyingPower)}`).join(" "));
  svg.append(line);
  const hit = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  hit.setAttribute("x", "0");
  hit.setAttribute("y", "0");
  hit.setAttribute("width", String(width));
  hit.setAttribute("height", String(height));
  hit.setAttribute("fill", "transparent");
  svg.append(hit);
  const guideY = document.createElement("div");
  guideY.className = "need-guide-y";
  const guideX = document.createElement("div");
  guideX.className = "need-guide-x";
  const tip = document.createElement("div");
  tip.className = "need-tip rounded-sm bg-navydeep px-3 py-2 text-xs text-white shadow";
  const place = (index) => {
    const point = points[Math.max(0, Math.min(points.length - 1, index))];
    const x = xFor(points.indexOf(point));
    const y = yFor(point.buyingPower);
    const box = svg.getBoundingClientRect();
    const scaleX = box.width / width;
    const scaleY = box.height / height;
    guideY.style.opacity = "1";
    guideX.style.opacity = "1";
    tip.style.opacity = "1";
    guideY.style.left = `${x * scaleX}px`;
    guideY.style.height = `${(height - padBottom) * scaleY}px`;
    guideX.style.top = `${y * scaleY}px`;
    guideX.style.left = `${padLeft * scaleX}px`;
    guideX.style.width = `${(x - padLeft) * scaleX}px`;
    placeChartTip(tip, box, x * scaleX, Math.max(0, y * scaleY - 56), 168);
    tip.replaceChildren();
    const age = document.createElement("p");
    age.textContent = `Age ${point.age}`;
    const amount = document.createElement("p");
    amount.className = "text-base font-bold text-white";
    amount.textContent = formatDollars(point.buyingPower);
    const meaning = document.createElement("p");
    meaning.textContent = "today's buying power";
    tip.append(age, amount, meaning);
  };
  bindChartPointer(hit, svg, { width, padLeft, padRight, count: points.length }, place, () => {
    guideY.style.opacity = "0";
    guideX.style.opacity = "0";
    tip.style.opacity = "0";
  });
  const legend = document.createElement("p");
  legend.className = "mt-2 text-xs text-inksoft";
  legend.textContent = "Solid line: what that yearly income buys, in today's dollars, if it never rises.";
  root.replaceChildren(svg, guideY, guideX, tip, legend);
}

function renderIncomeErosion(model) {
  const root = $("income-erosion");
  const note = $("income-erosion-note");
  const amount = readMoney($("desired-income").value);
  const currentAge = ageOrNull("client-age");
  const years = model.horizon.years || 0;
  if (model.horizon.missing || model.horizon.invalid || currentAge == null || years < 1) {
    root.textContent = "Enter age and retirement age to see how inflation erodes that yearly income.";
    note.textContent = "";
    return;
  }
  if (amount <= 0) {
    root.textContent = "Enter a yearly income to see how inflation erodes it.";
    note.textContent = "";
    return;
  }
  const inflation = inflationPercent();
  const points = purchasingPowerPath(amount, inflation, years).map((point) => ({
    ...point,
    age: currentAge + point.elapsed,
  }));
  const end = points[points.length - 1];
  const sentence = `If ${formatDollars(amount)} a year never rises, at ${formatPercent(inflation / 100)} inflation it buys ${formatDollars(end.buyingPower)} of today's goods at age ${end.age}.`;
  drawErosionChart({ root, points, sentence });
  note.textContent = sentence;
}

function renderNeedChart(model) {
  const chosen = incomeYearsChosen();
  const personSentence = pathSentence(model.needPath, chosen, model.chartUsesAge, personName());
  drawNeedChart({
    root: $("need-chart"),
    points: model.needPath,
    usesAge: model.chartUsesAge,
    sentence: personSentence,
    empty: `Enter ${personName()}'s age to draw how the insurance need changes.`,
  });
  $("longevity-note").textContent = model.needPath.length < 2 ? "" : personSentence;
  if (!model.partnerNeedPath) {
    $("partner-need-chart").replaceChildren();
    $("partner-longevity-note").textContent = "";
    return;
  }
  const partnerSentence = pathSentence(model.partnerNeedPath, chosen, model.partnerChartUsesAge, partnerName(), "partner-death-age");
  drawNeedChart({
    root: $("partner-need-chart"),
    points: model.partnerNeedPath,
    usesAge: model.partnerChartUsesAge,
    sentence: partnerSentence,
    empty: `Enter ${partnerName()}'s age to draw how the insurance need changes.`,
  });
  $("partner-longevity-note").textContent = partnerSentence;
}

function renderChildren(model) {
  const children = childLabels();
  const eachLife = formatDollars(model.protection.childLifeEach);
  const eachCi = formatDollars(model.protection.childCiEach);
  const cards = $("child-recommendations");
  const meeting = $("meeting-children");
  cards.replaceChildren();
  meeting.replaceChildren();
  for (const child of children) {
    const card = document.createElement("div");
    card.className = "rounded-sm border border-line bg-white p-4";
    const title = document.createElement("p");
    title.className = "text-xs font-semibold uppercase tracking-[0.14em] text-inksoft";
    title.textContent = child;
    const lifeLabel = document.createElement("p");
    lifeLabel.className = "mt-3 text-sm";
    lifeLabel.textContent = "Life insurance";
    const life = document.createElement("p");
    life.className = "figure nums text-2xl";
    life.textContent = eachLife;
    const ciLabel = document.createElement("p");
    ciLabel.className = "mt-3 text-sm";
    ciLabel.textContent = "Critical illness";
    const ci = document.createElement("p");
    ci.className = "figure nums text-2xl";
    ci.textContent = eachCi;
    card.append(title, lifeLabel, life, ciLabel, ci);
    cards.append(card);

    const block = document.createElement("div");
    const heading = document.createElement("p");
    heading.className = "text-sm font-medium text-golddim";
    heading.textContent = child;
    const lifeLine = document.createElement("p");
    lifeLine.className = "mt-1 text-sm";
    lifeLine.textContent = `Life insurance ${eachLife}`;
    const ciLine = document.createElement("p");
    ciLine.className = "text-sm";
    ciLine.textContent = `Critical illness ${eachCi}`;
    block.append(heading, lifeLine, ciLine);
    meeting.append(block);
  }
}

function renderProtection(model) {
  const protection = model.protection;
  $("client-di").textContent = formatDollars(protection.clientDisability);
  $("spouse-di").textContent = formatDollars(protection.spouseDisability);
  $("client-ci").textContent = formatDollars(protection.clientCritical);
  $("spouse-ci").textContent = formatDollars(protection.spouseCritical);
  $("meeting-di").textContent = formatDollars(protection.clientDisability);
  $("meeting-ci").textContent = formatDollars(protection.clientCritical);
  $("meeting-partner-life").textContent = model.spouseLife ? formatDollars(model.spouseLife.capitalNeed) : "$0";
  $("meeting-partner-di").textContent = formatDollars(protection.spouseDisability);
  $("meeting-partner-ci").textContent = formatDollars(protection.spouseCritical);
  renderChildren(model);
  const enteredMonths = Math.round(protection.disabilityMonths);
  $("disability-hint").textContent = `The monthly disability benefit replaces ${formatPercent(rateFrom("replacement-ratio"))} of earned income for ${enteredMonths} months.`;
  const spouseLine = model.spouseLife
    ? ` ${partnerName()}'s lump sum is ${formatDollars(protection.spouseCritical)}, from ${partnerName()}'s earned income for the same months.`
    : "";
  $("ci-hint").textContent = `${formatPercent(protection.ciRatio)} of earned income for ${Math.round(protection.ciMonths)} months is ${formatDollars(protection.clientCritical)} as one lump sum for ${personName()}. This replaces earned income only. Income from investments is not included.${spouseLine}`;
}

function renderScenarios(model) {
  const root = $("return-scenarios");
  root.replaceChildren();
  if (!showsPlanning() || !model.retirement || model.horizon.missing || !model.mix) return;
  const statedSave = rateFrom("real-return");
  const statedRetire = rateFrom("retirement-return");
  const legacy = model.retirement.legacyAtDeath;
  const cards = [
    {
      name: "2 points lower",
      shift: -0.02,
      sentence: (ending) => `Same deposits, at a return 2 percentage points below the rate you entered. Withdrawing the income gap each year, the balance at death is about ${formatDollars(ending)}`,
    },
    {
      name: "Average",
      shift: 0,
      sentence: (ending) => `The rate you entered. Withdrawing the income gap each year, the balance at death is about ${formatDollars(ending)}`,
    },
    {
      name: "2 points higher",
      shift: 0.02,
      sentence: (ending) => `Same deposits, at a return 2 percentage points above the rate you entered. Withdrawing the income gap each year, the balance at death is about ${formatDollars(ending)}`,
    },
  ];
  cards.forEach((card, index) => {
    const savingsReturn = statedSave + card.shift;
    const retirementReturn = statedRetire + card.shift;
    const wealth = balancesAtReturn(model, savingsReturn).wealth;
    const ending = balanceAfterWithdrawals(
      wealth,
      model.plannedWithdrawal?.total || model.retirement.annualGap,
      retirementReturn,
      model.retirement.retirementYears,
    );
    const box = document.createElement("div");
    box.className = index === 1 ? "rounded-sm border border-gold bg-white p-3" : "rounded-sm border border-line bg-paperdim p-3";
    const title = document.createElement("p");
    title.className = "text-xs font-semibold uppercase tracking-[0.14em] text-olive";
    title.textContent = card.name;
    const rate = document.createElement("p");
    rate.className = "mt-1 text-sm";
    rate.textContent = `${formatPercent(savingsReturn)} while saving, ${formatPercent(retirementReturn)} in retirement`;
    const worth = document.createElement("p");
    worth.className = "figure nums mt-2 text-xl";
    worth.textContent = formatDollars(wealth);
    const detail = document.createElement("p");
    detail.className = "mt-1 text-sm leading-5 text-inksoft";
    detail.textContent = legacy > 0
      ? `${card.sentence(ending)}. The legacy minimum is ${formatDollars(legacy)}.`
      : `${card.sentence(ending)}.`;
    box.append(title, rate, worth, detail);
    root.append(box);
  });
}

function savingsDestination(model) {
  const path = model.portfolio;
  const el = $("savings-destination");
  if (!path) {
    el.textContent = "";
    el.className = "mt-2 text-sm font-semibold leading-6 text-ink";
    return;
  }
  const gap = legacyGap(model);
  let sentence = path.depletedAge != null
    ? `The balances reach $0 at age ${Math.round(path.depletedAge)}.`
    : `The balance at the end is ${formatDollars(gap.ending)}.`;
  let color = "text-ink";
  if (gap.goal > 0) {
    const off = gap.delta >= 0
      ? `${formatDollars(gap.delta)} above the legacy goal of ${formatDollars(gap.goal)}.`
      : `${formatDollars(Math.abs(gap.delta))} below the legacy goal of ${formatDollars(gap.goal)}.`;
    sentence = `${sentence} ${off}`;
    color = gap.delta >= 0 ? "text-emerald-700" : "text-red-700";
  } else if (path.depletedAge != null) {
    color = "text-red-700";
  }
  el.className = `mt-2 text-sm font-semibold leading-6 ${color}`;
  el.textContent = sentence;
}

function strategyPoint(outcome, model) {
  if (!model.mix || !outcome) return null;
  const age = ageOrNull("client-age");
  const death = deathAgeValue();
  if (age == null || death == null) return null;
  const marginal = Number.isFinite(model.marginalNow) ? model.marginalNow : 0;
  const retirementReturn = rateFrom("retirement-return");
  const gap = model.retirement?.annualGap || 0;
  const rough = plannedDraw(outcome, gap, 0);
  const rate = rough.rrsp > 0 && model.retirement
    ? taxOnInclusion(
        model.retirement.pensionIncome,
        rough.rrsp,
        $("province").value,
      ).rate
    : 0;
  const points = wealthPath({
    opening: {
      tfsa: model.accounts.tfsaBalance,
      rrsp: model.accounts.rrspBalance,
      nonReg: model.accounts.nonReg,
    },
    balancesByAge: outcome.balancesByAge,
    currentAge: age,
    retirementAge: retirementAgeValue(),
    deathAge: death,
    retirementReturn,
    nonRegReturn: retirementReturn * (1 - 0.5 * marginal),
    annualWithdrawal: plannedDraw(outcome, gap, rate).total,
  });
  return { points, atDeath: balanceAtAge(points, model.earlyAge) };
}

function taxOnPoint(point, age, model) {
  if (!point) return 0;
  const retirementAge = retirementAgeValue();
  const retired = retirementAge != null && age >= retirementAge;
  const base = retired && model.retirement
    ? Math.max(0, readMoney($("client-retirement-income").value)) + model.retirement.cpp + model.retirement.oasNet
    : Math.max(0, readMoney($("personal-income").value));
  return deathTaxAtYear({
    income: base,
    rrsp: point.rrsp,
    nonReg: point.nonReg,
    estate: 0,
    rollover: model.rollover,
    province: $("province").value,
    years: 0,
  }).total;
}

function renderWealthChart(model) {
  const root = $("wealth-chart");
  const note = $("wealth-chart-note");
  const rows = model.portfolio?.rows || [];
  if (!showsPlanning() || rows.length < 2) {
    root.replaceChildren();
    root.textContent = "Enter an age and a likely age at death after it to see the balances.";
    if (note) note.textContent = "";
    return;
  }
  drawPortfolioChart(root, rows, model);
  const retire = retirementAgeValue();
  const goal = model.retirement?.legacyAtDeath || 0;
  if (note) {
    const legacy = goal > 0 ? ` The gold line is the legacy goal of ${formatDollars(goal)}.` : "";
    const ages = hasPartner() ? ` Ages on the chart are ${personName()}'s age. The plan ends at the later death.` : "";
    note.textContent = `The solid line is the combined TFSA, RRSP, non-registered, and other assets. Contributions run until age ${retire == null ? "retirement" : Math.round(retire)}. After that, CPP and OAS cover part of the income and the accounts withdraw the rest.${legacy} The red mark is the tax if death is at the age on the slider.${ages}`;
  }
}

function drawPortfolioChart(root, rows, model) {
  const { width, height, padLeft, padRight, padTop, padBottom } = chartFrame(root);
  const goal = model.retirement?.legacyAtDeath || 0;
  const maxWealth = Math.max(...rows.map((row) => row.total), goal, 1);
  const xFor = (index) => padLeft + (index / (rows.length - 1)) * (width - padLeft - padRight);
  const yFor = (value) => padTop + (1 - value / maxWealth) * (height - padTop - padBottom);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Combined balance from this year to the end of the plan");
  svg.classList.add("w-full", "h-64");
  for (let step = 0; step <= 4; step += 1) {
    const value = (maxWealth * step) / 4;
    const y = yFor(value);
    const grid = document.createElementNS("http://www.w3.org/2000/svg", "line");
    grid.setAttribute("x1", String(padLeft));
    grid.setAttribute("x2", String(width - padRight));
    grid.setAttribute("y1", String(y));
    grid.setAttribute("y2", String(y));
    grid.setAttribute("stroke", "#ddd7ca");
    svg.append(grid, svgText(padLeft - 8, y + 4, compactDollars(value), "end"));
  }
  if (goal > 0) {
    const legacy = document.createElementNS("http://www.w3.org/2000/svg", "line");
    legacy.setAttribute("x1", String(padLeft));
    legacy.setAttribute("x2", String(width - padRight));
    legacy.setAttribute("y1", String(yFor(goal)));
    legacy.setAttribute("y2", String(yFor(goal)));
    legacy.setAttribute("stroke", "#a68a61");
    legacy.setAttribute("stroke-width", "2");
    legacy.setAttribute("stroke-dasharray", "6 4");
    svg.append(legacy);
  }
  const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", "#2f3744");
  line.setAttribute("stroke-width", "3");
  line.setAttribute("stroke-linejoin", "round");
  line.setAttribute("stroke-linecap", "round");
  line.setAttribute("points", rows.map((row, index) => `${xFor(index)},${yFor(row.total)}`).join(" "));
  svg.append(line);
  const early = portfolioRow(model, model.earlyAge);
  const deathIndex = early ? rows.indexOf(early) : -1;
  if (deathIndex >= 0) {
    const afterTax = Math.max(0, rows[deathIndex].total - rows[deathIndex].deathTax);
    const drop = document.createElementNS("http://www.w3.org/2000/svg", "line");
    drop.setAttribute("x1", String(xFor(deathIndex)));
    drop.setAttribute("x2", String(xFor(deathIndex)));
    drop.setAttribute("y1", String(yFor(rows[deathIndex].total)));
    drop.setAttribute("y2", String(yFor(afterTax)));
    drop.setAttribute("stroke", "#b42318");
    drop.setAttribute("stroke-width", "3");
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", String(xFor(deathIndex)));
    dot.setAttribute("cy", String(yFor(afterTax)));
    dot.setAttribute("r", "4");
    dot.setAttribute("fill", "#b42318");
    svg.append(drop, dot);
  }
  const labeled = [rows[0]];
  const retire = retirementAgeValue();
  const retireRow = retire == null ? null : rows.find((row) => row.age >= retire);
  if (retireRow) labeled.push(retireRow);
  labeled.push(rows[rows.length - 1]);
  for (const row of labeled) {
    svg.append(svgText(xFor(rows.indexOf(row)), height - 10, String(Math.round(row.age)), "middle"));
  }
  const hit = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  hit.setAttribute("x", "0");
  hit.setAttribute("y", "0");
  hit.setAttribute("width", String(width));
  hit.setAttribute("height", String(height));
  hit.setAttribute("fill", "transparent");
  svg.append(hit);
  const guideY = document.createElement("div");
  guideY.className = "need-guide-y";
  const guideX = document.createElement("div");
  guideX.className = "need-guide-x";
  const tip = document.createElement("div");
  tip.className = "need-tip rounded-sm bg-navydeep px-3 py-2 text-xs text-white shadow";
  const place = (index) => {
    const row = rows[Math.max(0, Math.min(rows.length - 1, index))];
    const x = xFor(rows.indexOf(row));
    const y = yFor(row.total);
    const box = svg.getBoundingClientRect();
    const scaleX = box.width / width;
    const scaleY = box.height / height;
    guideY.style.opacity = "1";
    guideX.style.opacity = "1";
    tip.style.opacity = "1";
    guideY.style.left = `${x * scaleX}px`;
    guideY.style.height = `${(height - padBottom) * scaleY}px`;
    guideX.style.top = `${y * scaleY}px`;
    guideX.style.left = `${padLeft * scaleX}px`;
    guideX.style.width = `${(x - padLeft) * scaleX}px`;
    placeChartTip(tip, box, x * scaleX, Math.max(0, y * scaleY - 88), 188);
    tip.replaceChildren();
    const age = document.createElement("p");
    age.textContent = `Age ${Math.round(row.age)}`;
    const sum = document.createElement("p");
    sum.className = "text-base font-bold text-white";
    sum.textContent = formatDollars(row.total);
    tip.append(age, sum);
    for (const [label, value] of [["TFSA", row.tfsa], ["RRSP", row.rrsp], ["Non-registered", row.nonReg], ["Other", row.other]]) {
      const lineItem = document.createElement("p");
      lineItem.textContent = `${label} ${formatDollars(value)}`;
      tip.append(lineItem);
    }
  };
  bindChartPointer(hit, svg, { width, padLeft, padRight, count: rows.length }, place, () => {
    guideY.style.opacity = "0";
    guideX.style.opacity = "0";
    tip.style.opacity = "0";
  });
  root.replaceChildren(svg, guideY, guideX, tip);
}

function renderPortfolioTable(model) {
  const table = $("portfolio-table");
  const note = $("allocation-note");
  const rows = model.portfolio?.rows || [];
  table.replaceChildren();
  if (!rows.length) {
    if (note) note.textContent = "";
    return;
  }
  const early = portfolioRow(model, model.earlyAge);
  const partnerStart = hasPartner() ? ageOrNull("partner-age") : null;
  const clientStart = rows[0].age;
  const labels = ["Year", "Age"];
  if (partnerStart != null) labels.push(`${partnerName()} age`);
  labels.push("TFSA in", "RRSP in", "Non-reg in", "TFSA", "RRSP", "Non-reg", "Other", "Total", "CPP and OAS", "From the accounts", "Tax on withdrawal", "Tax if death");
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const label of labels) {
    const cell = document.createElement("th");
    cell.className = "whitespace-nowrap border-b border-line px-2 py-2 font-medium";
    cell.textContent = label;
    headRow.append(cell);
  }
  head.append(headRow);
  const body = document.createElement("tbody");
  for (const row of rows) {
    const hit = early && row === early;
    const values = [String(row.calendarYear), String(Math.round(row.age))];
    if (partnerStart != null) values.push(String(Math.round(partnerStart + (row.age - clientStart))));
    values.push(
      formatDollars(row.tfsaIn),
      formatDollars(row.rrspIn),
      formatDollars(row.nonRegIn),
      formatDollars(row.tfsa),
      formatDollars(row.rrsp),
      formatDollars(row.nonReg),
      formatDollars(row.other),
      formatDollars(row.total),
      formatDollars(row.pension),
      formatDollars(row.withdrawal),
      formatDollars(row.tax),
      formatDollars(row.deathTax),
    );
    const tr = document.createElement("tr");
    if (hit) tr.className = "bg-red-50";
    values.forEach((value, index) => {
      const cell = document.createElement("td");
      cell.className = "whitespace-nowrap border-b border-line px-2 py-1 nums";
      if (hit && index === values.length - 1) cell.className += " font-semibold text-red-700";
      cell.textContent = value;
      tr.append(cell);
    });
    body.append(tr);
  }
  table.append(head, body);
  if (note) {
    note.textContent = "Each year shows the deposit the room allows, up to the monthly slider. At retirement the deposits stop. CPP and OAS, raised with inflation, cover part of the after-tax income, and the accounts withdraw the rest. RRSP withdrawals are taxed in full. Non-registered withdrawals are taxed on the gain. Only the growth on other assets is taxed. The red row is the age on the early-death slider, and the red tax is not taken off the continuing balance.";
  }
}

function renderEarlyDeath(model) {
  const slider = $("early-death-age");
  if (slider.disabled || !model.portfolio) {
    $("early-death-readout").textContent = "";
    $("early-death-note").textContent = "Enter an age and a likely age at death after it to see the tax.";
    return;
  }
  const row = portfolioRow(model, model.earlyAge);
  const age = Math.round(row?.age ?? model.earlyAge);
  $("early-death-readout").textContent = ` · age ${age}`;
  const rollover = model.rollover
    ? " The RRSP rolls to an eligible beneficiary, so it is not in this tax."
    : " The RRSP is included in full.";
  $("early-death-note").textContent = row
    ? `If death is at age ${age}, tax on these accounts is ${formatDollars(row.deathTax)}. That year is the red row in the table. The solid line keeps going. The red mark is the balance after that tax.${rollover}`
    : "";
}

function resetSession() {
  const advisorName = $("advisor-name").value;
  const advisorFirm = $("advisor-firm").value;
  $("worksheet").reset();
  incomeMode = "today";
  Object.assign(dirty, {
    desired: false,
    clientShare: false,
    deathAge: false,
    partnerDeathAge: false,
    cpp: false,
    oas: false,
    partnerCpp: false,
    partnerOas: false,
    canadaYears: false,
    partnerCanadaYears: false,
    earlyDeath: false,
    disabilityMonths: false,
    allocation: false,
    recommendedLife: false,
    recommendedDisability: false,
    recommendedCritical: false,
    recommendedPartnerLife: false,
    recommendedPartnerDisability: false,
    recommendedPartnerCritical: false,
    rationale: false,
  });
  fillDefaults();
  $("advisor-name").value = advisorName.trim() || DEFAULT_ADVISOR.name;
  $("advisor-firm").value = advisorFirm.trim() || DEFAULT_ADVISOR.firm;
  ensureDependantInputs();
}

function fillDefaults() {
  $("meeting-date").value = todayISO();
  $("dependant-count").value = "0";
  $("retirement-age").value = "65";
  $("replacement-ratio").value = String(assumptions.survivorIncomeReplacement * 100);
  $("income-years").value = "10";
  $("income-years-slider").value = "10";
  $("final-expenses").value = String(assumptions.finalExpenses);
  $("education-amount").value = String(assumptions.educationFundPerDependant);
  $("independence-age").value = String(assumptions.dependantIndependenceAge);
  $("retirement-replacement").value = String(assumptions.retirementIncomeReplacement * 100);
  $("planned-children").value = "0";
  $("future-amortization").value = "25";
  $("ci-ratio").value = "70";
  $("ci-ratio-slider").value = "70";
  $("ci-months").value = "12";
  $("ci-months-slider").value = "12";
  $("child-life").value = String(assumptions.childLifeInsuranceNeed);
  $("child-ci").value = String(assumptions.childCriticalIllnessNeed);
  $("client-name").value = $("client-name").value.trim() || "Person 1";
  $("partner-name").value = $("partner-name").value.trim() || "Person 2";
  $("real-return").value = String(assumptions.realReturnBeforeRetirement * 100);
  $("real-return-slider").value = String(assumptions.realReturnBeforeRetirement * 100);
  $("retirement-return").value = String(assumptions.realReturnInRetirement * 100);
  $("retirement-return-slider").value = String(assumptions.realReturnInRetirement * 100);
  $("other-return").value = "0";
  $("other-return-slider").value = "0";
  $("tfsa-contribution").value = "0";
  $("tfsa-contribution-slider").value = "0";
  $("rrsp-contribution").value = "0";
  $("rrsp-contribution-slider").value = "0";
  $("nonreg-contribution").value = "0";
  $("nonreg-contribution-slider").value = "0";
  $("inflation-rate").value = String(defaultInflation);
  $("inflation-slider").value = String(defaultInflation);
  if ($("province").options.length) $("province").value = "AB";
}

function loadSample() {
  const named = $("client-name").value.trim() || $("personal-income").value.trim();
  if (named && !confirm("Replace the current worksheet with the sample household?")) return;
  resetSession();
  document.querySelector('input[name="planning-mode"][value="both"]').checked = true;
  $("client-name").value = "Person 1";
  $("client-age").value = "42";
  $("has-partner").checked = true;
  $("partner-name").value = "Person 2";
  $("partner-age").value = "25";
  $("personal-income").value = "95000";
  $("partner-income").value = "45000";
  $("dependant-count").value = "2";
  const inputs = ensureDependantInputs();
  inputs[0].value = "8";
  inputs[1].value = "11";
  $("debts").value = "320000";
  $("mortgage-years").value = "20";
  $("existing-coverage").value = "100000";
  $("assets-at-death").value = "40000";
  $("retirement-age").value = "65";
  $("tfsa-balance").value = "40000";
  $("rrsp-balance").value = "80000";
  $("tfsa-room").value = "20000";
  $("rrsp-room").value = "15000";
  $("other-assets").value = "0";
  $("partner-other-assets").value = "0";
  $("obj-income").checked = true;
  $("obj-debt").checked = true;
  $("obj-education").checked = true;
  $("obj-retirement").checked = true;
  render();
}

function markDirty(target) {
  if (target.id === "desired-income" || target.id === "desired-income-slider") dirty.desired = true;
  if (target.id === "client-retirement-income") dirty.clientShare = true;
  if (target.id === "death-age") dirty.deathAge = true;
  if (target.id === "partner-death-age") dirty.partnerDeathAge = true;
  if (target.id === "cpp-annual") dirty.cpp = true;
  if (target.id === "oas-annual") dirty.oas = true;
  if (target.id === "partner-cpp") dirty.partnerCpp = true;
  if (target.id === "partner-oas") dirty.partnerOas = true;
  if (target.id === "canada-years") dirty.canadaYears = true;
  if (target.id === "partner-canada-years") dirty.partnerCanadaYears = true;
  if (target.id === "early-death-age") dirty.earlyDeath = true;
  if (target.id === "disability-months") dirty.disabilityMonths = true;
  if (target.id === "rrsp-share") dirty.allocation = true;
  if (target.id === "recommended-life") dirty.recommendedLife = true;
  if (target.id === "recommended-disability") dirty.recommendedDisability = true;
  if (target.id === "recommended-critical") dirty.recommendedCritical = true;
  if (target.id === "recommended-partner-life") dirty.recommendedPartnerLife = true;
  if (target.id === "recommended-partner-disability") dirty.recommendedPartnerDisability = true;
  if (target.id === "recommended-partner-critical") dirty.recommendedPartnerCritical = true;
  if (target.id === "rationale") dirty.rationale = true;
}

function syncInflation(target) {
  if (!target) return;
  if (target.id === "inflation-slider") $("inflation-rate").value = target.value;
  if (target.id === "inflation-rate") {
    const value = readMoney(target.value);
    $("inflation-slider").value = String(Math.min(8, Math.max(0, value)));
  }
}

function syncIncomeYears(target) {
  if (!target) return;
  if (target.id === "income-years-slider") $("income-years").value = target.value;
  if (target.id === "income-years") {
    $("income-years-slider").value = String(Math.min(40, Math.max(0, readMoney(target.value))));
  }
  if (target.id === "ci-months-slider") $("ci-months").value = target.value;
  if (target.id === "ci-months") {
    $("ci-months-slider").value = String(Math.min(36, Math.max(0, readMoney(target.value))));
  }
  if (target.id === "ci-ratio-slider") $("ci-ratio").value = target.value;
  if (target.id === "ci-ratio") {
    $("ci-ratio-slider").value = String(Math.min(100, Math.max(0, readMoney(target.value))));
  }
}

function syncReturn(target) {
  if (!target) return;
  if (target.id === "real-return-slider") $("real-return").value = target.value;
  if (target.id === "real-return") $("real-return-slider").value = String(Math.min(14, Math.max(0, readMoney(target.value))));
  if (target.id === "retirement-return-slider") $("retirement-return").value = target.value;
  if (target.id === "retirement-return") $("retirement-return-slider").value = String(Math.min(8, Math.max(0, readMoney(target.value))));
  if (target.id === "other-return-slider") $("other-return").value = target.value;
  if (target.id === "other-return") $("other-return-slider").value = String(Math.min(14, Math.max(0, readMoney(target.value))));
  const pairs = [
    ["desired-income-slider", "desired-income", 300000],
    ["tfsa-contribution-slider", "tfsa-contribution", 10000],
    ["rrsp-contribution-slider", "rrsp-contribution", 10000],
    ["nonreg-contribution-slider", "nonreg-contribution", 10000],
  ];
  for (const [sliderId, inputId, max] of pairs) {
    if (target.id === sliderId) $(inputId).value = target.value;
    if (target.id === inputId) $(sliderId).value = String(Math.min(max, Math.max(0, readMoney(target.value))));
  }
}

function convertDesiredIncome(next) {
  const mode = next === "future" ? "future" : "today";
  if (mode === incomeMode) return;
  const amount = readMoney($("desired-income").value);
  const years = retirementHorizon().years || 0;
  const inflation = inflationPercent();
  if (amount > 0 && years > 0) {
    const converted = mode === "future" ? inflate(amount, inflation, years) : deflate(amount, inflation, years);
    $("desired-income").value = String(Math.round(converted));
  }
  incomeMode = mode;
  dirty.desired = true;
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

function clearLegacyStorage() {
  const keys = ["needs-worksheet.advisor", "needs-worksheet.draft", "needs-worksheet.cases"];
  try {
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // Storage may be blocked. There is nothing to write.
  }
}

function printReport(which) {
  document.body.dataset.print = which;
  const clear = () => {
    delete document.body.dataset.print;
    window.removeEventListener("afterprint", clear);
  };
  window.addEventListener("afterprint", clear);
  window.print();
}

async function copyLetter() {
  const button = $("copy-letter");
  const text = emailLetterText(lastModel);
  const html = emailLetterHtml(lastModel);
  try {
    if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([text], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
    } else {
      await navigator.clipboard.writeText(text);
    }
    button.textContent = "Copied";
  } catch {
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "Copied";
    } catch {
      button.textContent = "Select the letter and copy it";
    }
  }
  setTimeout(() => {
    button.textContent = "Copy letter for email";
  }, 1600);
}

function init() {
  clearLegacyStorage();
  initProvinces();
  fillDefaults();
  $("advisor-name").value = DEFAULT_ADVISOR.name;
  $("advisor-firm").value = DEFAULT_ADVISOR.firm;
  render();

  $("worksheet").addEventListener("input", (event) => {
    syncInflation(event.target);
    syncReturn(event.target);
    syncIncomeYears(event.target);
    markDirty(event.target);
    render();
  });
  $("worksheet").addEventListener("change", (event) => {
    if (event.target.type === "checkbox" || event.target.type === "radio" || event.target.tagName === "SELECT") render();
  });
  $("worksheet").addEventListener("submit", (event) => event.preventDefault());

  $("use-max-cpp").addEventListener("click", () => {
    dirty.cpp = true;
    $("cpp-annual").value = moneyInput(maxAnnualCpp());
    render();
  });
  $("use-max-oas").addEventListener("click", () => {
    dirty.oas = true;
    const age = blank("retirement-age") ? 65 : readMoney($("retirement-age").value);
    $("oas-annual").value = moneyInput(maxAnnualOas(age));
    render();
  });
  $("use-max-partner-cpp").addEventListener("click", () => {
    dirty.partnerCpp = true;
    $("partner-cpp").value = moneyInput(maxAnnualCpp());
    render();
  });
  $("use-max-partner-oas").addEventListener("click", () => {
    dirty.partnerOas = true;
    $("partner-oas").value = moneyInput(maxAnnualOas(65));
    render();
  });
  $("sample-case").addEventListener("click", loadSample);
  $("export-client").addEventListener("click", () => printReport("client"));
  $("export-advisor").addEventListener("click", () => printReport("advisor"));
  $("copy-letter").addEventListener("click", copyLetter);
  window.addEventListener("afterprint", () => {
    delete document.body.dataset.print;
  });
  $("new-case").addEventListener("click", () => {
    const named = $("client-name").value.trim() || $("personal-income").value.trim();
    if (named && !confirm("Clear every entry on this worksheet? Closing the tab discards them too, and clearing cannot be undone.")) return;
    resetSession();
    render();
  });
}

init();
