import { canadaInflation } from "../data/inflation-canada.js";
import { cppAmounts } from "../data/cpp-amounts.js";
import { lifeExpectancy } from "../data/life-expectancy.js";
import { oasAmounts } from "../data/oas-amounts.js";
import { planningAssumptions as assumptions } from "../data/planning-assumptions.js";
import { probateFees, provinceOrder } from "../data/probate-fees.js";
import { rrspLimits } from "../data/rrsp-limits.js";
import { tfsaContributionLimit } from "../data/tfsa-contribution-limit.js";
import { deathTaxAtYear } from "./calc/death-tax.js";
import { projectFutureRoom } from "./calc/contribution-room.js";
import { deflate, inflate, purchasingPowerPath, roundPercent, trailingAverage } from "./calc/inflation.js";
import { calculateLifeNeed } from "./calc/life-need.js";
import { formatDollars, formatMoney, readMoney } from "./calc/money.js";
import { incomeYearsAtAge, projectLifeNeed } from "./calc/need-path.js";
import { cppContributionYears, estimateCpp, estimateOas, residenceYearsFromAge } from "./calc/pensions.js";
import { calculateProbate } from "./calc/probate.js";
import { criticalIllnessLumpSum, disabilityMonthlyBenefit } from "./calc/protection.js";
import { calculateRetirement } from "./calc/retirement.js";
import { describeDeposits, projectPortfolio } from "./calc/portfolio-path.js";
import { latestTaxYear, marginalRate } from "./calc/tax.js";
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
};

const inflationHistory = trailingAverage(canadaInflation.annualPercent, 100);
const defaultInflation = roundPercent(inflationHistory.average);

let incomeMode = "today";

const investorProfiles = window.MarchandInvestorProfiles;
let questionnaireProfile = null;
let defaultProfileNote = "";

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

function longDate(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(y, m - 1, d).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
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
  $("mobile-life-label").textContent = `${person} life insurance gap`;
  $("meeting-person-life-label").textContent = `${person}, life insurance gap`;
  $("meeting-person-di-label").textContent = `${person}, disability gap, monthly`;
  $("meeting-person-ci-label").textContent = `${person}, critical illness gap`;
  $("meeting-partner-life-label").textContent = `${partner}, life insurance gap`;
  $("meeting-partner-di-label").textContent = `${partner}, disability gap, monthly`;
  $("meeting-partner-ci-label").textContent = `${partner}, critical illness gap`;
  $("client-owns-corp-label").textContent = `${person} owns a corporation`;
  $("partner-owns-corp-label").textContent = `${partner} owns a corporation`;
  $("client-coverage-label").textContent = `Personal life insurance in force on ${person}`;
  $("client-existing-di-label").textContent = `Disability already in force on ${person}, monthly`;
  $("client-existing-ci-label").textContent = `Critical illness already in force on ${person}`;
  $("client-corporate-coverage-label").textContent = `Life insurance the corporation already owns on ${person}`;
  $("client-count-corporate-label").textContent = `Count that corporate coverage toward ${person}'s life insurance gap`;
  $("partner-personal-coverage-label").textContent = `Personal life insurance already in force on ${partner}`;
  $("partner-existing-di-label").textContent = `Disability already in force on ${partner}, monthly`;
  $("partner-existing-ci-label").textContent = `Critical illness already in force on ${partner}`;
  $("partner-coverage-note").textContent = `This reduces ${partner}'s life insurance gap only. The mortgage and the children's education stay in both.`;
  $("partner-corporate-coverage-label").textContent = `Life insurance a corporation already owns on ${partner}`;
  $("partner-count-corporate-label").textContent = `Count that corporate coverage toward ${partner}'s life insurance gap`;
  $("partner-history-label").textContent = `${partner}'s average income over the last 5 years`;
  $("partner-tfsa-balance-label").textContent = `${partner}'s TFSA balance`;
  $("partner-tfsa-room-label").textContent = `${partner}'s TFSA room available now`;
  $("partner-rrsp-balance-label").textContent = `${partner}'s RRSP balance`;
  $("partner-rrsp-room-label").textContent = `${partner}'s RRSP room available now`;
  $("partner-nonreg-label").textContent = `${partner}'s non-registered balance`;
  $("partner-other-label").textContent = `${partner}'s other assets`;
  $("partner-canada-label").textContent = `Years ${partner} will have lived in Canada from 18 to 65`;
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
  // CPP builds until the person stops working, at most 70. OAS residence counts to 65.
  const clientStopAge = Math.min(70, retirementAge ?? 65);
  if (!dirty.canadaYears && currentAge != null) {
    $("canada-years").value = String(residenceYearsFromAge(65));
  }
  if (!dirty.cpp) {
    $("cpp-annual").value = moneyInput(estimateCpp(
      earningsForCpp("income-history", "personal-income"),
      cppAmounts.ympe,
      maxAnnualCpp(),
      cppContributionYears(clientStopAge),
    ));
  }
  if (!dirty.oas) {
    $("oas-annual").value = moneyInput(estimateOas(readMoney($("canada-years").value), maxAnnualOas(65)));
  }
  if (hasPartner()) {
    const partnerAge = ageOrNull("partner-age");
    const partnerStopAge = partnerAge != null && currentAge != null && retirementAge != null
      ? Math.min(70, partnerAge + retirementAge - currentAge)
      : 65;
    if (!dirty.partnerCanadaYears && partnerAge != null) {
      $("partner-canada-years").value = String(residenceYearsFromAge(65));
    }
    if (!dirty.partnerCpp) {
      $("partner-cpp").value = moneyInput(estimateCpp(
        earningsForCpp("partner-income-history", "partner-income"),
        cppAmounts.ympe,
        maxAnnualCpp(),
        cppContributionYears(partnerStopAge),
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

function contributionHeadline(model) {
  const described = describeDeposits(model.portfolio.rows);
  const { annual, offset, calendarYear } = described.headline;
  let label = "Monthly contributions";
  if (offset === 1) label = "Monthly contributions, beginning next year";
  else if (offset > 1) label = `Monthly contributions, beginning in ${calendarYear}`;
  return { label, monthly: annual / 12 };
}

// Eligible TFSA successor holder / RRSP–RRIF rollover follows the household:
// with a spouse or partner on the plan, Tax if death leaves the RRSP out;
// without one, the RRSP is taxed.
function rolloverChosen() {
  return hasPartner();
}

function syncRolloverNote() {
  const note = $("rrsp-rollover-note");
  const tip = $("rrsp-rollover-tip");
  if (!note) return;
  if (hasPartner()) {
    note.textContent =
      "An eligible TFSA & RRSP successor holder is on this plan, so Tax if death (Table F3) and Fig. D1 / D2 treat the TFSA as continuing to that person and the RRSP or RRIF as rolling over. Those balances are not taxed at death.";
    if (tip) {
      tip.classList.add("hidden");
      tip.textContent = "";
    }
    return;
  }
  note.textContent =
    "No eligible TFSA & RRSP successor holder is on this plan, so Tax if death includes the full RRSP or RRIF on the final return.";
  if (tip) {
    tip.classList.add("hidden");
    tip.textContent = "";
  }
}

// Fig. D1 / D2 tax at death is per person: that person's share of the plan
// balances before that year's withdrawal (same moment as Table F3), plus estate
// tax. A spousal rollover drops the RRSP. Without a portfolio path, grow today's
// entries alone.
function deathTaxForNeedChart({
  portfolio,
  elapsed,
  deathTaxInput,
  income,
  rrsp,
  nonReg,
  other,
  household,
}) {
  const rows = portfolio?.rows;
  if (rows?.length && household) {
    const index = Math.max(0, Math.min(rows.length - 1, Math.round(elapsed)));
    const row = rows[index];
    const rrspShare = household.rrsp > 0 ? Math.max(0, rrsp) / household.rrsp : 0;
    const nonRegShare = household.nonReg > 0 ? Math.max(0, nonReg) / household.nonReg : 0;
    const otherShare = household.other > 0 ? Math.max(0, other) / household.other : 0;
    const personNonRegGain = (row.nonRegGainAtDeath || 0) * nonRegShare;
    return deathTaxAtYear({
      ...deathTaxInput,
      income,
      rrsp: (row.rrspAtDeath || 0) * rrspShare,
      // deathTaxAtYear treats non-reg as fully gain; pass twice the gain so inclusion matches.
      nonReg: personNonRegGain / 0.5,
      otherGain: (row.otherGainAtDeath || 0) * otherShare,
      savingsReturn: 0,
      years: elapsed,
    }).total;
  }
  return deathTaxAtYear({
    ...deathTaxInput,
    income,
    rrsp,
    nonReg,
    years: elapsed,
  }).total;
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
  const disabilityRatio = Math.min(0.7, rateFrom("disability-ratio"));
  const clientDisabilityGross = disabilityMonthlyBenefit(personalIncome, disabilityRatio);
  const spouseDisabilityGross = partner ? disabilityMonthlyBenefit(partnerIncome, disabilityRatio) : 0;
  const clientCriticalGross = criticalIllnessLumpSum(personalIncome, ciRatio, ciMonths);
  const spouseCriticalGross = partner ? criticalIllnessLumpSum(partnerIncome, ciRatio, ciMonths) : 0;
  const protection = {
    clientDisability: Math.max(0, clientDisabilityGross - readMoney($("existing-disability").value)),
    spouseDisability: Math.max(0, spouseDisabilityGross - (partner ? readMoney($("partner-existing-disability").value) : 0)),
    disabilityMonths: readMoney($("disability-months").value),
    disabilityRatio,
    ciMonths,
    ciRatio,
    clientCritical: Math.max(0, clientCriticalGross - readMoney($("existing-ci").value)),
    spouseCritical: Math.max(0, spouseCriticalGross - (partner ? readMoney($("partner-existing-ci").value) : 0)),
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
    desiredIncomeToday: target.today,
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
    workingIncomeToday: personalIncome,
    rollover,
    startYear: tfsaContributionLimit.taxYear,
  });
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
    taxAtYear: (elapsed) => deathTaxForNeedChart({
      portfolio,
      elapsed,
      deathTaxInput,
      income: personalIncome,
      rrsp: clientRrsp,
      nonReg: clientNonReg,
      other: readMoney($("other-assets").value),
      household: {
        rrsp: accounts.rrspBalance,
        nonReg: accounts.nonReg,
        other: accounts.other,
      },
    }),
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
        taxAtYear: (elapsed) => deathTaxForNeedChart({
          portfolio,
          elapsed,
          deathTaxInput,
          income: partnerIncome,
          rrsp: partnerRrsp,
          nonReg: partnerNonReg,
          other: readMoney($("partner-other-assets").value),
          household: {
            rrsp: accounts.rrspBalance,
            nonReg: accounts.nonReg,
            other: accounts.other,
          },
        }),
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
    item.className = "flex items-baseline justify-between gap-3";
    const term = document.createElement("span");
    term.className = "shrink-0 whitespace-nowrap text-inksoft";
    term.textContent = label;
    const amount = document.createElement("span");
    amount.className = "nums min-w-0 flex-1 text-right";
    amount.textContent = value;
    item.append(term, amount);
    list.append(item);
  }
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
  return `${label} is ${person.age}. ${opening} Lifetime room on that schedule is ${formatDollars(person.total)}. Room available now is the amount entered on this plan. Annual limits in those years: ${spans}.`;
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

function portfolioRow(model, age) {
  const rows = model.portfolio?.rows || [];
  if (!rows.length || age == null) return null;
  return rows.reduce((best, row) => (Math.abs(row.age - age) < Math.abs(best.age - age) ? row : best));
}

function legacyGap(model) {
  const ending = model.portfolio?.ending ?? 0;
  const goal = model.retirement?.legacyAtDeath || 0;
  return { ending, goal, delta: ending - goal };
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
  return `${name}: ${detail} ${formatDollars(bill.total)} is in the life insurance gap.`;
}

function deathTaxSentence(model) {
  const estate = readMoney($("estate-value").value);
  const parts = [
    `${model.probate.name} probate fee on ${formatDollars(estate)} expected to go through the estate: ${formatDollars(model.probate.fee)}. ${model.probate.note}`,
    deathTaxPiece(personName(), model.deathTaxBill),
  ];
  if (model.partnerDeathTaxBill) parts.push(deathTaxPiece(partnerName(), model.partnerDeathTaxBill));
  parts.push(`The cost base of the non-registered account and of the estate property is counted as zero, and half of each amount is included as a capital gain. Leave the non-registered balance out of the estate value. An RRSP that does not roll over is included in full. Today's tax figure stays in the life insurance gap. On Fig. D1 and Fig. D2, tax at death follows Table F3 for that year of the retirement plan — remaining account balances after withdrawals, with a rolled RRSP left out. Brackets are the ${latestTaxYear()} combined federal and provincial rates. Basic personal credits are not subtracted.`);
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
      ? `It is counted in ${personName()}'s life insurance gap.`
      : `It is not counted in ${personName()}'s life insurance gap.`;
    parts.push(`A corporation owns ${formatDollars(model.corporateCoverage)} of life insurance on this life. Proceeds minus the adjusted cost base of ${formatDollars(model.corporateAcb)} leave about ${formatDollars(model.capitalDividend)} that can usually be paid as a capital dividend. ${counted}`);
  } else {
    parts.push("No corporation is marked as owning life insurance on this life.");
  }
  if (hasPartner()) {
    parts.push(`Personal coverage on ${partnerName()} is ${formatDollars(readMoney($("partner-existing-coverage").value))}. It reduces ${partnerName()}'s life insurance gap only.`);
    if ($("partner-owns-corp").checked) {
      const counted = model.partnerCountCorporate
        ? `It is counted in ${partnerName()}'s life insurance gap.`
        : `It is not counted in ${partnerName()}'s life insurance gap.`;
      const dividend = Math.max(0, model.partnerCorporateCoverage - model.partnerCorporateAcb);
      parts.push(`${partnerName()} owns a corporation with ${formatDollars(model.partnerCorporateCoverage)} of life insurance on that life. Proceeds minus the adjusted cost base of ${formatDollars(model.partnerCorporateAcb)} leave about ${formatDollars(dividend)} that can usually be paid as a capital dividend. ${counted}`);
    }
  }
  parts.push("A TFSA is generally not taxable at death.");
  return parts.join(" ");
}

function pathSentence(points, chosenYears, usesAge, name, deathAgeId = "death-age") {
  if (!points.length) return "";
  const today = points[0];
  const when = usesAge ? `at age ${today.age}` : "today";
  const opening = `If ${name} dies ${when}, the life insurance gap is ${formatDollars(today.capitalNeed)}.`;
  const retirementAge = retirementAgeValue();
  const deathAge = deathAgeValue(deathAgeId);
  const atDeath = points[points.length - 1];
  const deathSentence = usesAge && deathAge != null && atDeath.age >= deathAge
    ? ` The line runs to age ${Math.round(atDeath.age)}. Final expenses and probate there are ${formatDollars(atDeath.floor - atDeath.deathTax)}. Tax at death there is ${formatDollars(atDeath.deathTax)}.`
    : "";
  if (!usesAge || retirementAge == null) return `${opening}${deathSentence}`;
  const atRetirement = points.find((point) => point.age >= retirementAge) || points[points.length - 1];
  const ending = `At retirement the life insurance gap is ${formatDollars(atRetirement.capitalNeed)}.`;
  if (today.age >= retirementAge) {
    return `${opening} This age is already at retirement, so the chart does not include years of income.${deathSentence}`;
  }
  if (today.years < chosenYears) {
    return `${opening} Income replacement is ${today.years} years because retirement is that close, and it steps down by one year each year of age. Those dollars rise with inflation. The mortgage pays down in a straight line. ${ending}${deathSentence}`;
  }
  const holdThrough = retirementAge - chosenYears;
  return `${opening} Income replacement stays at ${chosenYears} years through age ${holdThrough}, then steps down by one year each year of age. Those dollars rise with inflation. The mortgage pays down in a straight line. ${ending}${deathSentence}`;
}

function futureRoomSentence(model) {
  return `New room from next year through retirement, on top of the room available now, in each future year's dollars: TFSA ${formatDollars(model.room.householdTfsa)}, RRSP ${formatDollars(model.room.householdRrsp)}. The projection ignores a pension adjustment. TFSA limits after ${tfsaContributionLimit.taxYear} follow the inflation assumption and round to the nearest $500. Later RRSP dollar limits grow at ${formatPercent(model.room.rrspGrowth)} a year. TFSA room continues after retirement; this projection stops at the retirement age.`;
}

function render() {
  document.body.dataset.scope = planningMode();
  ensureDependantInputs();
  applySuggestions();
  applyNames();
  syncRolloverNote();
  document.querySelectorAll(".partner-only").forEach((node) => {
    node.classList.toggle("hidden", !hasPartner());
  });
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
  const advisor = $("advisor-name").value.trim() || DEFAULT_ADVISOR.name;
  const firm = $("advisor-firm").value.trim() || DEFAULT_ADVISOR.firm;
  const date = longDate($("meeting-date").value) || "Date not set";
  const preparedLine = `${date} · Prepared by ${advisor}, ${firm}`;
  const prepared = $("plan-prepared");
  if (prepared) prepared.textContent = preparedLine;
  const printClient = $("print-client-line");
  if (printClient) {
    printClient.textContent = hasPartner()
      ? `${personName()} and ${partnerName()}`
      : personName();
  }
  const printPrepared = $("print-prepared-line");
  if (printPrepared) printPrepared.textContent = preparedLine;
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
  if (model.life.capitalNeed === 0 && model.life.offsets > 0 && model.life.grossNeed > 0) {
    notes.push(`Existing coverage and assets cover the full life insurance need of ${formatDollars(model.life.grossNeed)}, so the gap is $0.`);
  }
  if (model.corporateCoverage > 0 && !model.countCorporate) {
    notes.push("Corporate coverage is shown and is not subtracted from the life insurance gap.");
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
  $("rrsp-room-note").textContent = `CPP uses earnings capped at the yearly maximum pensionable earnings, then the share of a 39-year contribution history reached by retirement (at most 70). OAS counts years in Canada from 18 to 65, out of 40. Enter the age-65 amounts: the plan lowers CPP 0.6% a month when it starts before 65 and raises CPP 0.7% and OAS 0.6% a month when retirement is after 65, to 70. OAS rises 10% at 75. Type a different amount, or use the maximum button. RRSP room available now is the amount you enter. New room ignores a pension adjustment.`;
  $("future-room-note").textContent = futureRoomSentence(model);
  renderNeedChart(model);
  renderWealthChart(model);
  renderPortfolioTable(model);
  renderEarlyDeath(model);
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

function appendNeedSeries(svg, points, xFor, yFor, key, { stroke, width = 2, dash = null }) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", stroke);
  line.setAttribute("stroke-width", String(width));
  line.setAttribute("stroke-linejoin", "round");
  line.setAttribute("stroke-linecap", "round");
  if (dash) line.setAttribute("stroke-dasharray", dash);
  line.setAttribute("points", points.map((point, index) => `${xFor(index)},${yFor(point[key] || 0)}`).join(" "));
  svg.append(line);
  return line;
}

function drawNeedChart({ root, points, usesAge, sentence, empty }) {
  if (points.length < 2) {
    root.textContent = empty;
    return;
  }
  const { width, height, padLeft, padRight, padTop, padBottom } = chartFrame(root);
  const maxNeed = Math.max(
    ...points.map((point) => Math.max(
      point.capitalNeed || 0,
      point.mortgageLeft || 0,
      point.educationCapital || 0,
      point.deathTax || 0,
    )),
    1,
  );
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
  const hasMortgage = points.some((point) => point.mortgageLeft > 0);
  const hasEducation = points.some((point) => point.educationCapital > 0);
  const hasTax = points.some((point) => point.deathTax > 0);
  if (hasTax) {
    appendNeedSeries(svg, points, xFor, yFor, "deathTax", {
      stroke: "#7a3b2e",
      width: 2,
      dash: "2 3",
    });
  }
  if (hasEducation) {
    appendNeedSeries(svg, points, xFor, yFor, "educationCapital", {
      stroke: "#6b7c5c",
      width: 2,
      dash: "7 5",
    });
  }
  if (hasMortgage) {
    appendNeedSeries(svg, points, xFor, yFor, "mortgageLeft", {
      stroke: "#a68a61",
      width: 2,
      dash: "5 4",
    });
  }
  appendNeedSeries(svg, points, xFor, yFor, "capitalNeed", {
    stroke: "#2f3744",
    width: 3,
  });
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
    placeChartTip(tip, box, x * scaleX, Math.max(0, y * scaleY - 48), 176);
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
    const mortgageDue = point.mortgageLeft || 0;
    if (mortgageDue > 0) {
      const mortgage = document.createElement("p");
      mortgage.textContent = `Mortgage ${formatDollars(mortgageDue)}`;
      tip.append(mortgage);
    }
    const educationDue = point.educationCapital || 0;
    if (educationDue > 0 || hasEducation) {
      const education = document.createElement("p");
      const kids = Math.round(point.educationCount || 0);
      education.textContent = kids > 0
        ? `Education ${formatDollars(educationDue)} (${kids === 1 ? "1 child" : `${kids} children`})`
        : `Education ${formatDollars(0)}`;
      tip.append(education);
    }
    const finalAndProbate = Math.max(0, (point.floor || 0) - (point.deathTax || 0));
    const expenses = document.createElement("p");
    expenses.textContent = `Final expenses and probate ${formatDollars(finalAndProbate)}`;
    tip.append(expenses);
    if ((point.deathTax || 0) > 0 || hasTax) {
      const tax = document.createElement("p");
      tax.textContent = `Tax at death ${formatDollars(point.deathTax || 0)}`;
      tip.append(tax);
    }
  };
  bindChartPointer(hit, svg, { width, padLeft, padRight, count: points.length }, place, () => {
    guideY.style.opacity = "0";
    guideX.style.opacity = "0";
    tip.style.opacity = "0";
  });
  const legendParts = ["Solid line: life insurance gap"];
  if (hasMortgage) legendParts.push("gold dashed: mortgage");
  if (hasEducation) legendParts.push("olive dashed: education until independence age");
  if (hasTax) legendParts.push("dotted: tax at death");
  const legend = document.createElement("p");
  legend.className = "mt-2 text-xs text-inksoft";
  legend.textContent = `${legendParts.join(". ")}.`;
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
  $("disability-hint").textContent = `The monthly disability benefit replaces ${formatPercent(protection.disabilityRatio)} of earned income for ${enteredMonths} months, capped at 70%.`;
  const spouseLine = model.spouseLife
    ? ` ${partnerName()}'s lump sum is ${formatDollars(protection.spouseCritical)}, from ${partnerName()}'s earned income for the same months.`
    : "";
  $("ci-hint").textContent = `${formatPercent(protection.ciRatio)} of earned income for ${Math.round(protection.ciMonths)} months is ${formatDollars(protection.clientCritical)} as one lump sum for ${personName()}. This replaces earned income only. Income from investments is not included.${spouseLine}`;
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
    note.textContent = `The solid line is the combined TFSA, RRSP, non-registered, and other assets. Contributions run until age ${retire == null ? "retirement" : Math.round(retire)}. After that, CPP and OAS cover part of the income and the accounts withdraw the rest.${legacy} The red mark drops from that year's balance by the tax if death is at the age on the slider — the same tax as Table F3.${ages}`;
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
    // Tax if death is reckoned on balances before that year's withdrawal (Table F3).
    // The solid line is the plan if you live (after withdrawal). Show the tax as a
    // drop from the line so the mark cannot sit above the graph.
    const lineTotal = rows[deathIndex].total;
    const tax = Math.max(0, rows[deathIndex].deathTax || 0);
    const afterTax = Math.max(0, lineTotal - tax);
    const x = xFor(deathIndex);
    const drop = document.createElementNS("http://www.w3.org/2000/svg", "line");
    drop.setAttribute("x1", String(x));
    drop.setAttribute("x2", String(x));
    drop.setAttribute("y1", String(yFor(lineTotal)));
    drop.setAttribute("y2", String(yFor(afterTax)));
    drop.setAttribute("stroke", "#b42318");
    drop.setAttribute("stroke-width", "3");
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", String(x));
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

function portfolioMetaCells(row, partnerStart, clientStart) {
  const cells = [String(row.calendarYear), String(Math.round(row.age))];
  if (partnerStart != null) cells.push(String(Math.round(partnerStart + (row.age - clientStart))));
  return cells;
}

function fillPortfolioTable(table, labels, rowValues, { stickyYear = false, earlyIndex = -1, emphasizeCol = -1 } = {}) {
  table.replaceChildren();
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  labels.forEach((label, index) => {
    const cell = document.createElement("th");
    cell.className = "border-b border-line px-2 py-2 font-medium";
    if (stickyYear && index === 0) cell.classList.add("portfolio-sticky-year");
    cell.textContent = label;
    headRow.append(cell);
  });
  head.append(headRow);
  const body = document.createElement("tbody");
  rowValues.forEach((values, rowIndex) => {
    const tr = document.createElement("tr");
    if (rowIndex === earlyIndex) tr.className = "portfolio-early-row";
    values.forEach((value, index) => {
      const cell = document.createElement("td");
      cell.className = "whitespace-nowrap border-b border-line px-2 py-1 nums";
      if (stickyYear && index === 0) cell.classList.add("portfolio-sticky-year");
      if (rowIndex === earlyIndex && index === emphasizeCol) {
        cell.className += " font-semibold text-red-700";
      }
      cell.textContent = value;
      tr.append(cell);
    });
    body.append(tr);
  });
  table.append(head, body);
}

function renderPortfolioTable(model) {
  const table = $("portfolio-table");
  const printRoot = $("portfolio-print");
  const note = $("allocation-note");
  const rows = model.portfolio?.rows || [];
  table.replaceChildren();
  if (printRoot) printRoot.replaceChildren();
  if (!rows.length) {
    if (note) note.textContent = "";
    return;
  }
  const early = portfolioRow(model, model.earlyAge);
  const earlyIndex = early ? rows.indexOf(early) : -1;
  const partnerStart = hasPartner() ? ageOrNull("partner-age") : null;
  const clientStart = rows[0].age;
  const partnerLabel = partnerStart != null ? `${partnerName()} age` : null;
  const metaLabels = partnerLabel ? ["Year", "Age", partnerLabel] : ["Year", "Age"];

  const screenLabels = [
    ...metaLabels,
    "TFSA in",
    "RRSP in",
    "Non-reg in",
    "TFSA",
    "RRSP",
    "Non-reg",
    "Other",
    "Total",
    "Retirement income requested",
    "CPP, OAS, and other income",
    "From the accounts",
    "Retirement income taken",
    "Tax on withdrawal",
    "Tax if death",
  ];
  const screenRows = rows.map((row) => [
    ...portfolioMetaCells(row, partnerStart, clientStart),
    formatDollars(row.tfsaIn),
    formatDollars(row.rrspIn),
    formatDollars(row.nonRegIn),
    formatDollars(row.tfsa),
    formatDollars(row.rrsp),
    formatDollars(row.nonReg),
    formatDollars(row.other),
    formatDollars(row.total),
    formatDollars(row.incomeRequested),
    formatDollars(row.pensionNet),
    formatDollars(row.withdrawal),
    formatDollars(row.incomeTaken),
    formatDollars(row.tax),
    formatDollars(row.deathTax),
  ]);
  fillPortfolioTable(table, screenLabels, screenRows, {
    stickyYear: true,
    earlyIndex,
    emphasizeCol: screenLabels.length - 1,
  });

  if (printRoot) {
    const printMeta = partnerStart != null ? ["Year", "Age", "Sp."] : ["Year", "Age"];
    const printLabels = [
      ...printMeta,
      "TFSA in",
      "RRSP in",
      "Non-reg in",
      "TFSA",
      "RRSP",
      "Non-reg",
      "Other",
      "Total",
      "Requested",
      "CPP/OAS",
      "From accts",
      "Taken",
      "Tax wd",
      "Tax death",
    ];
    const printRows = rows.map((row) => [
      ...portfolioMetaCells(row, partnerStart, clientStart),
      compactDollars(row.tfsaIn),
      compactDollars(row.rrspIn),
      compactDollars(row.nonRegIn),
      compactDollars(row.tfsa),
      compactDollars(row.rrsp),
      compactDollars(row.nonReg),
      compactDollars(row.other),
      compactDollars(row.total),
      compactDollars(row.incomeRequested),
      compactDollars(row.pensionNet),
      compactDollars(row.withdrawal),
      compactDollars(row.incomeTaken),
      compactDollars(row.tax),
      compactDollars(row.deathTax),
    ]);

    const block = document.createElement("div");
    block.className = "portfolio-print-block";
    const caption = document.createElement("p");
    caption.className = "portfolio-print-caption";
    caption.textContent = "Table F3 · Year path ($k / $M)";
    const printTable = document.createElement("table");
    printTable.className = "portfolio-print-table";
    fillPortfolioTable(printTable, printLabels, printRows, {
      earlyIndex,
      emphasizeCol: printLabels.length - 1,
    });
    block.append(caption, printTable);
    printRoot.append(block);
  }

  if (note) {
    note.textContent = hasPartner()
      ? "Each year shows the deposit the room allows, up to the monthly slider. At retirement the deposits stop. Retirement income requested is the after-tax amount chosen at the start of retirement, raised with inflation each year. CPP and OAS (after tax on those benefits) are kept in full even when they exceed that request, and nothing is taken from the accounts in those years. When they fall short, the shortfall is taken from Other, non-registered, and the RRSP in proportion to those balances so they run down together. The TFSA is used only after that pool is gone. Retirement income taken is CPP and OAS plus from the accounts. Tax if death is the tax on that year's balances before the retirement withdrawal: with a spouse on the plan the RRSP rolls over and is not taxed, non-registered and other assets tax only the gain, and the TFSA is not taxed. The red row is the age on the early-death slider."
      : "Each year shows the deposit the room allows, up to the monthly slider. At retirement the deposits stop. Retirement income requested is the after-tax amount chosen at the start of retirement, raised with inflation each year. CPP and OAS (after tax on those benefits) are kept in full even when they exceed that request, and nothing is taken from the accounts in those years. When they fall short, the shortfall is taken from Other, non-registered, and the RRSP in proportion to those balances so they run down together. The TFSA is used only after that pool is gone. Retirement income taken is CPP and OAS plus from the accounts. Tax if death is the tax on that year's balances before the retirement withdrawal: with no spouse on the plan the full RRSP is taxed on the final return, non-registered and other assets tax only the gain, and the TFSA is not taxed. The red row is the age on the early-death slider.";
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
    ? ` The RRSP rolls to ${partnerName()}, so it is not in this tax.`
    : " There is no spouse on this plan, so the RRSP is included in full.";
  $("early-death-note").textContent = row
    ? `If death is at age ${age}, tax on these accounts before that year's retirement withdrawal is ${formatDollars(row.deathTax)}. That year is the red row in the table. On Fig. F2 the red mark drops from the solid line by that tax.${rollover}`
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
  });
  fillDefaults();
  $("advisor-name").value = advisorName.trim() || DEFAULT_ADVISOR.name;
  $("advisor-firm").value = advisorFirm.trim() || DEFAULT_ADVISOR.firm;
  questionnaireProfile = null;
  syncInvestorProfileNote();
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
  $("client-sex").value = "both";
  $("retirement-replacement").value = String(assumptions.retirementIncomeReplacement * 100);
  $("planned-children").value = "0";
  $("future-amortization").value = "25";
  $("disability-ratio").value = "70";
  $("disability-ratio-slider").value = "70";
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

function planHasEntries() {
  const name = $("client-name").value.trim();
  if (name && name !== "Person 1") return true;
  if ($("has-partner").checked) return true;
  const filled = [
    "client-age",
    "personal-income",
    "partner-age",
    "partner-income",
    "debts",
    "other-debts",
    "existing-coverage",
    "existing-disability",
    "existing-ci",
    "partner-existing-coverage",
    "partner-existing-disability",
    "partner-existing-ci",
    "tfsa-balance",
    "rrsp-balance",
    "nonreg-balance",
    "estate-value",
    "desired-income",
  ];
  return filled.some((id) => !blank(id) && readMoney($(id).value) > 0)
    || dependantCount() > 0
    || readMoney($("planned-children").value) > 0;
}

function loadSample() {
  if (planHasEntries() && !confirm("Replace this plan with the sample household?")) return;
  resetSession();
  document.querySelector('input[name="planning-mode"][value="both"]').checked = true;
  $("province").value = "AB";
  $("client-sex").value = "both";
  $("meeting-date").value = todayISO();
  $("advisor-name").value = DEFAULT_ADVISOR.name;
  $("advisor-firm").value = DEFAULT_ADVISOR.firm;

  $("client-name").value = "Alex Morgan";
  $("client-age").value = "42";
  $("retirement-age").value = "65";
  $("personal-income").value = "95000";
  $("income-history").value = "90000";
  $("has-partner").checked = true;
  $("partner-name").value = "Jordan Morgan";
  $("partner-age").value = "40";
  $("partner-income").value = "45000";
  $("partner-income-history").value = "42000";

  $("dependant-count").value = "2";
  $("planned-children").value = "0";
  const ages = ensureDependantInputs();
  ages[0].value = "8";
  ages[1].value = "11";

  $("replacement-ratio").value = "70";
  $("income-years").value = "10";
  $("income-years-slider").value = "10";
  $("debts").value = "320000";
  $("mortgage-years").value = "20";
  $("other-debts").value = "15000";
  $("final-expenses").value = String(assumptions.finalExpenses);
  $("education-amount").value = String(assumptions.educationFundPerDependant);
  $("independence-age").value = String(assumptions.dependantIndependenceAge);
  $("existing-coverage").value = "100000";
  $("partner-existing-coverage").value = "50000";
  $("existing-disability").value = "0";
  $("existing-ci").value = "0";
  $("partner-existing-disability").value = "0";
  $("partner-existing-ci").value = "0";
  $("assets-at-death").value = "40000";
  $("client-owns-corp").checked = false;
  $("partner-owns-corp").checked = false;
  $("plan-house").checked = false;

  $("disability-months").value = "120";
  dirty.disabilityMonths = true;
  $("disability-ratio").value = "70";
  $("disability-ratio-slider").value = "70";
  $("ci-ratio").value = "70";
  $("ci-ratio-slider").value = "70";
  $("ci-months").value = "12";
  $("ci-months-slider").value = "12";
  $("child-life").value = String(assumptions.childLifeInsuranceNeed);
  $("child-ci").value = String(assumptions.childCriticalIllnessNeed);

  $("death-age").value = "85";
  dirty.deathAge = true;
  $("partner-death-age").value = "88";
  dirty.partnerDeathAge = true;
  $("canada-years").value = "40";
  dirty.canadaYears = true;
  $("partner-canada-years").value = "40";
  dirty.partnerCanadaYears = true;

  $("retirement-replacement").value = "70";
  $("desired-income").value = "98000";
  $("desired-income-slider").value = "98000";
  dirty.desired = true;
  $("client-retirement-income").value = "0";
  dirty.clientShare = true;
  $("leave-legacy").checked = true;
  $("legacy-amount").value = "100000";
  $("inflation-rate").value = String(defaultInflation);
  $("inflation-slider").value = String(defaultInflation);

  $("tfsa-balance").value = "40000";
  $("tfsa-room").value = "20000";
  $("rrsp-balance").value = "80000";
  $("rrsp-room").value = "15000";
  $("nonreg-balance").value = "25000";
  $("other-assets").value = "80000";
  $("partner-tfsa-balance").value = "15000";
  $("partner-tfsa-room").value = "8000";
  $("partner-rrsp-balance").value = "35000";
  $("partner-rrsp-room").value = "9000";
  $("partner-nonreg-balance").value = "10000";
  $("partner-other-assets").value = "40000";
  $("estate-value").value = "250000";
  $("qc-verification").checked = false;

  $("real-return").value = "5";
  $("real-return-slider").value = "5";
  $("other-return").value = "3";
  $("other-return-slider").value = "3";
  $("retirement-return").value = "4";
  $("retirement-return-slider").value = "4";
  $("tfsa-contribution").value = "500";
  $("tfsa-contribution-slider").value = "500";
  $("rrsp-contribution").value = "600";
  $("rrsp-contribution-slider").value = "600";
  $("nonreg-contribution").value = "200";
  $("nonreg-contribution-slider").value = "200";

  dirty.cpp = false;
  dirty.oas = false;
  dirty.partnerCpp = false;
  dirty.partnerOas = false;
  dirty.earlyDeath = false;
  render();
  dirty.earlyDeath = true;
  $("early-death-age").value = "57";
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
  if (target.id === "disability-ratio-slider") $("disability-ratio").value = target.value;
  if (target.id === "disability-ratio") {
    const capped = Math.min(70, Math.max(0, readMoney(target.value)));
    $("disability-ratio").value = String(capped);
    $("disability-ratio-slider").value = String(capped);
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

function setReturnsFromProfile(profile, { saving = true, retirement = true } = {}) {
  if (saving) {
    $("real-return").value = String(profile.saving);
    $("real-return-slider").value = String(profile.saving);
  }
  if (retirement) {
    $("retirement-return").value = String(profile.retirement);
    $("retirement-return-slider").value = String(profile.retirement);
  }
}

function syncInvestorProfileNote() {
  const note = $("investor-profile-note");
  const chosen = investorProfiles.profileByKey($("investor-profile").value);
  if (!chosen) {
    note.textContent = defaultProfileNote;
    return;
  }
  const parts = [
    `${investorProfiles.describe(chosen)}.`,
    `Suggested return: ${chosen.saving}% while saving, ${chosen.retirement}% in retirement.`,
  ];
  if (questionnaireProfile && questionnaireProfile !== chosen) {
    const riskier = chosen.level > questionnaireProfile.level;
    parts.push(`Your investor questionnaire result was ${questionnaireProfile.name}${riskier ? ", so this assumes more risk than you said you are comfortable with" : ""}.`);
  }
  note.textContent = parts.join(" ");
}

function syncInvestorProfile(target) {
  if (!target) return;
  if (target.id === "investor-profile") {
    const chosen = investorProfiles.profileByKey(target.value);
    if (chosen) setReturnsFromProfile(chosen);
  } else if (target.id === "real-return" || target.id === "real-return-slider") {
    if ($("real-return").value.trim() === "") return;
    const matched = investorProfiles.profileForReturn(readMoney($("real-return").value));
    if (matched) $("investor-profile").value = matched.key;
  } else {
    return;
  }
  syncInvestorProfileNote();
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

function applyPrefillFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (![...params.keys()].length) return false;

  const textFields = [
    "client-name",
    "partner-name",
    "client-age",
    "partner-age",
    "personal-income",
    "partner-income",
    "dependant-count",
    "debts",
    "other-debts",
    "existing-coverage",
    "existing-disability",
    "existing-ci",
    "partner-existing-coverage",
    "partner-existing-disability",
    "partner-existing-ci",
    "retirement-age",
    "tfsa-balance",
    "tfsa-room",
    "rrsp-balance",
    "rrsp-room",
    "nonreg-balance",
    "partner-tfsa-balance",
    "partner-tfsa-room",
    "partner-rrsp-balance",
    "partner-rrsp-room",
    "partner-nonreg-balance",
    "real-return",
    "retirement-return",
    "tfsa-contribution",
    "rrsp-contribution",
    "nonreg-contribution",
    "province",
    "legacy-amount",
    "disability-ratio",
  ];

  for (const id of textFields) {
    if (!params.has(id)) continue;
    const el = $(id);
    if (!el) continue;
    el.value = params.get(id) ?? "";
  }

  if (params.has("has-partner")) {
    const raw = (params.get("has-partner") || "").toLowerCase();
    $("has-partner").checked = raw === "1" || raw === "true" || raw === "yes";
  }

  if (params.has("leave-legacy")) {
    const raw = (params.get("leave-legacy") || "").toLowerCase();
    const wantsLegacy = raw === "1" || raw === "true" || raw === "yes";
    $("leave-legacy").checked = wantsLegacy;
  } else if (params.has("legacy-amount")) {
    $("leave-legacy").checked = readMoney(params.get("legacy-amount")) > 0;
  }

  if (params.has("disability-ratio")) {
    const capped = Math.min(70, Math.max(0, readMoney($("disability-ratio").value)));
    $("disability-ratio").value = String(capped);
    $("disability-ratio-slider").value = String(capped);
  }

  if (params.has("planning-mode")) {
    const mode = params.get("planning-mode");
    const radio = document.querySelector(`input[name="planning-mode"][value="${mode}"]`);
    if (radio) radio.checked = true;
  } else {
    const both = document.querySelector('input[name="planning-mode"][value="both"]');
    if (both) both.checked = true;
  }

  const count = Math.min(12, Math.max(0, Math.round(readMoney($("dependant-count").value))));
  if (count > 0) {
    const ages = ensureDependantInputs();
    for (let index = 0; index < count; index += 1) {
      const key = `dependant-age-${index}`;
      if (params.has(key) && ages[index]) ages[index].value = params.get(key) ?? "";
    }
  }

  questionnaireProfile = investorProfiles.profileByKey(params.get("iq-profile"));
  const profile = investorProfiles.profileByKey(params.get("investor-profile"));
  if (profile) {
    $("investor-profile").value = profile.key;
    setReturnsFromProfile(profile, { saving: !params.has("real-return"), retirement: !params.has("retirement-return") });
  }

  if (params.has("real-return")) {
    $("real-return-slider").value = String(Math.min(14, Math.max(0, readMoney($("real-return").value))));
  }
  if (params.has("retirement-return")) {
    $("retirement-return-slider").value = String(Math.min(8, Math.max(0, readMoney($("retirement-return").value))));
  }
  if (params.has("tfsa-contribution")) {
    $("tfsa-contribution-slider").value = String(Math.min(10000, Math.max(0, readMoney($("tfsa-contribution").value))));
  }
  if (params.has("rrsp-contribution")) {
    $("rrsp-contribution-slider").value = String(Math.min(10000, Math.max(0, readMoney($("rrsp-contribution").value))));
  }
  if (params.has("nonreg-contribution")) {
    $("nonreg-contribution-slider").value = String(Math.min(10000, Math.max(0, readMoney($("nonreg-contribution").value))));
  }

  return true;
}

function init() {
  clearLegacyStorage();
  initProvinces();
  fillDefaults();
  $("advisor-name").value = DEFAULT_ADVISOR.name;
  $("advisor-firm").value = DEFAULT_ADVISOR.firm;
  defaultProfileNote = $("investor-profile-note").textContent;
  applyPrefillFromUrl();
  syncInvestorProfileNote();
  render();

  $("worksheet").addEventListener("input", (event) => {
    syncInflation(event.target);
    syncReturn(event.target);
    syncInvestorProfile(event.target);
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
    $("oas-annual").value = moneyInput(maxAnnualOas(65));
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
  $("print-plan").addEventListener("click", () => {
    const panels = [...document.querySelectorAll("#worksheet details")];
    const wasOpen = panels.map((panel) => panel.open);
    panels.forEach((panel) => { panel.open = true; });
    const title = document.title;
    const names = hasPartner() ? `${personName()}-${partnerName()}` : personName();
    const fileName = ["Financial-Plan", names, $("meeting-date").value]
      .filter(Boolean)
      .join("-")
      .replace(/[^\w-]+/g, "-")
      .replace(/-+/g, "-");
    document.title = fileName;
    const restore = () => {
      panels.forEach((panel, index) => { panel.open = wasOpen[index]; });
      document.title = title;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  });
  $("new-case").addEventListener("click", () => {
    const named = $("client-name").value.trim() || $("personal-income").value.trim();
    if (named && !confirm("Clear every entry on this plan? Closing the tab discards them too, and clearing cannot be undone.")) return;
    resetSession();
    render();
  });
}

init();
