import { cppAmounts } from "../data/cpp-amounts.js";
import { lifeExpectancy } from "../data/life-expectancy.js";
import { oasAmounts } from "../data/oas-amounts.js";
import { planningAssumptions as assumptions } from "../data/planning-assumptions.js";
import { probateFees, provinceOrder } from "../data/probate-fees.js";
import { rrspLimits } from "../data/rrsp-limits.js";
import { tfsaContributionLimit } from "../data/tfsa-contribution-limit.js";
import { projectFutureRoom } from "./calc/contribution-room.js";
import { deathTaxAtYear } from "./calc/death-tax.js";
import { calculateLifeNeed } from "./calc/life-need.js";
import { formatDollars, readMoney } from "./calc/money.js";
import { incomeYearsAtAge, projectLifeNeed } from "./calc/need-path.js";
import { adjustCppForStart, adjustOasForStart, cppStartAge, cppStartChangePercent, estimateCpp, estimateOas, oasStartAge, oasStartChangePercent, projectedCppYears, projectedOasYears } from "./calc/pensions.js";
import { depositsOverYears, describeDeposits, projectPortfolio } from "./calc/portfolio-path.js";
import { calculateProbate } from "./calc/probate.js";
import { criticalIllnessLumpSum, disabilityMonthlyBenefit } from "./calc/protection.js";

const $ = (id) => document.getElementById(id);
const planHorizonAge = Math.round(lifeExpectancy.canada[lifeExpectancy.year].both);

const dirty = {
  tfsa: false,
  rrsp: false,
  nonreg: false,
  life: false,
  spouseLife: false,
  disability: false,
  spouseDisability: false,
  cpp: false,
  oas: false,
  spouseCpp: false,
  spouseOas: false,
  earlyNow: false,
  earlyAfter: false,
};

function todayISO() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function num(id) {
  return readMoney($(id).value);
}

function inflationPercent() {
  if (!$("inflation-rate") || $("inflation-rate").value.trim() === "") return 2.2;
  return num("inflation-rate");
}

function moneyOrBlank(amount) {
  const rounded = Math.round(amount);
  return String(rounded);
}

function clientName() {
  return $("client-name").value.trim() || "Client 1";
}

function spouseName() {
  return $("spouse-name").value.trim() || "Client 2";
}

function hasSpouse() {
  return document.querySelector('input[name="spouse"]:checked')?.value === "yes";
}

function planningIncome(lastId) {
  return num(lastId);
}

function roundLife(amount) {
  return Math.round(Math.max(0, amount) / 50000) * 50000;
}

function dependantCount() {
  const raw = $("dependant-count").value.trim();
  if (raw === "") return 0;
  return Math.max(0, Math.min(12, Math.floor(readMoney(raw))));
}

function dependantField(index, value) {
  const label = document.createElement("label");
  label.className = "block text-sm font-medium";
  label.append(document.createTextNode(`Child ${index + 1} age`));
  const input = document.createElement("input");
  input.className = "mt-1 w-full rounded-sm border border-line bg-paperdim px-3.5 py-2.5 text-sm";
  input.inputMode = "numeric";
  input.dataset.depAge = "true";
  input.value = value;
  input.setAttribute("aria-label", `Age of child ${index + 1}`);
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

function childSummary() {
  const items = [...document.querySelectorAll("[data-dep-age]")];
  if (!items.length) return "None";
  return items.map((input, index) => {
    const age = input.value.trim();
    return age ? `Child ${index + 1}, age ${age}` : `Child ${index + 1}`;
  }).join("; ");
}

function setLabel(id, text) {
  const element = $(id);
  if (!element) return;
  element.textContent = text;
}

function applyNames() {
  const client = clientName();
  const spouse = spouseName();
  setLabel("section-2-title", `If ${client} dies`);
  setLabel("section-2b-title", `If ${spouse} dies`);
  setLabel("section-2b-intro", `${client}'s years and percent stay in the box above. This box uses only ${spouse}'s income, years, percent, tax, and life insurance. The shared debts are added here too.`);
  setLabel("section-2-intro", hasSpouse()
    ? `Only ${client}'s income, years, and percent. ${spouse}'s box does not change this one. Each later year of income is higher by the inflation rate. The shared debts are added on top.`
    : `The household keeps this share of ${client}'s income for this many years. Each later year is higher by the inflation rate.`);
  setLabel("income-years-label", `Years of ${client}'s income to replace`);
  setLabel("spouse-income-years-label", `Years of ${spouse}'s income to replace`);
  setLabel("replacement-hint", `70 means each year the household keeps 70% of ${client}'s income. The amount rises with Slider 11.`);
  setLabel("spouse-replacement-hint", `70 means each year the household keeps 70% of ${spouse}'s income.`);
  setLabel("spouse-coverage-label", `${spouse}'s life insurance already in place`);
  setLabel("illustration-1-label", `Illustration 1 · If ${client} dies`);
  $("illustration-1-label").dataset.crumb = `Financial plan · Section 5 · Illustration 1 · If ${client} dies`;
  setLabel("illustration-2-label", `Illustration 2 · If ${client} dies, over time`);
  $("illustration-2-label").dataset.crumb = `Financial plan · Section 5 · Illustration 2 · If ${client} dies, over time`;
  setLabel("illustration-3-label", `Illustration 3 · If ${spouse} dies`);
  $("illustration-3-label").dataset.crumb = `Financial plan · Section 5 · Illustration 3 · If ${spouse} dies`;
  setLabel("sticky-life-label", `If ${client} dies`);
  setLabel("after-life-label", `${client}'s life insurance need not covered`);
  setLabel("ci-client-label", `${client} lump sum`);
  setLabel("rec-life-text", `New life insurance, ${client}`);
  setLabel("rec-spouse-life-text", `New life insurance, ${spouse}`);
  $("rec-spouse-life-label").dataset.crumb = `Financial plan · Section 7 · Slider 6 · ${spouse}'s life insurance`;
  setLabel("rec-spouse-disability-text", `${spouse}'s disability benefit, monthly income to replace`);
  $("rec-spouse-disability-label").dataset.crumb = `Financial plan · Section 7 · Slider 8 · ${spouse}'s disability`;
  setLabel("spouse-ci-label", `${spouse} lump sum`);
  setLabel("after-spouse-life-label", `${spouse}'s life insurance need not covered`);
  setLabel("client-accounts-heading", client);
  setLabel("spouse-accounts-heading", spouse);
  setPensionLabel("cpp-label", "cpp-annual", client, "CPP", acceptedRetirementAge());
  setPensionLabel("oas-label", "oas-annual", client, "OAS", acceptedRetirementAge());
  setPensionLabel("spouse-cpp-label", "spouse-cpp", spouse, "CPP", acceptedRetirementAge());
  setPensionLabel("spouse-oas-label", "spouse-oas", spouse, "OAS", acceptedRetirementAge());
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

const MIN_RETIREMENT_AGE = 50;
const MAX_RETIREMENT_AGE = 80;

function retirementFloor() {
  const current = ageOf("client-age");
  if (current == null || current < 18) return MIN_RETIREMENT_AGE;
  return Math.max(MIN_RETIREMENT_AGE, Math.ceil(current));
}

function acceptedRetirementAge() {
  const entered = num("retirement-age");
  const floor = retirementFloor();
  if (!Number.isFinite(entered) || entered <= 0) return Math.max(floor, 65);
  return Math.min(MAX_RETIREMENT_AGE, Math.max(floor, entered));
}

function retirementAgeNote() {
  const note = $("retirement-age-note");
  if (!note) return;
  const entered = num("retirement-age");
  const floor = retirementFloor();
  const accepted = acceptedRetirementAge();
  if (entered > 0 && entered < floor) {
    note.textContent = `Retirement age has to be at least ${floor}. The plan uses ${accepted} until you enter a later age.`;
  } else if (entered > MAX_RETIREMENT_AGE) {
    note.textContent = `The plan stops at age ${MAX_RETIREMENT_AGE}. It uses ${accepted} until you enter an earlier age.`;
  } else {
    note.textContent = "";
  }
}

function pensionLabel(person, kind, retirementAge) {
  const start = kind === "CPP" ? cppStartAge(retirementAge) : oasStartAge(retirementAge);
  return `${person} ${kind} at ${start}, a year`;
}

function pensionHint(at65, payable, retirementAge, kind, dirtyFlag) {
  const start = kind === "CPP" ? cppStartAge(retirementAge) : oasStartAge(retirementAge);
  const change = kind === "CPP" ? cppStartChangePercent(retirementAge) : oasStartChangePercent(retirementAge);
  const rounded = Math.round(Math.abs(change) * 10) / 10;
  const percent = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  const shift = change === 0
    ? `Starting at ${start} leaves the age-65 estimate unchanged.`
    : change > 0
      ? `Starting at ${start} raises the age-65 estimate ${percent}%, to ${formatDollars(payable)}.`
      : `Starting at ${start} lowers the age-65 estimate ${percent}%, to ${formatDollars(payable)}.`;
  const early = start !== Math.round(retirementAge)
    ? ` Retirement at ${Math.round(retirementAge)} does not start ${kind} before ${start}.`
    : "";
  const entered = dirty[dirtyFlag]
    ? " Using the amount you entered."
    : " Type the CRA amount at this start age to replace it.";
  return `Age-65 estimate ${formatDollars(at65)} a year. ${shift}${early}${entered}`;
}

function setPensionLabel(id, inputId, person, kind, retirementAge) {
  const text = pensionLabel(person, kind, retirementAge);
  setLabel(id, text);
  const input = $(inputId);
  if (input) input.setAttribute("aria-label", text);
}

function insuranceGapOf(life) {
  if (!life) return 0;
  return Math.max(0, (life.grossNeed || 0) - (life.offsets || 0));
}

function gapNote(life) {
  if (!life) return "";
  const gap = insuranceGapOf(life);
  if (gap <= 0 && life.capitalNeed > 0) {
    return `Zero means life insurance and assets already cover the insurable need. The illustrated need stays at ${formatDollars(life.capitalNeed)} for final expenses and tax.`;
  }
  if (gap <= 0) return "Zero means the life insurance and assets already in place cover this need.";
  return "Insurable need minus the life insurance and assets already in place.";
}

function showNeedFigures(prefix, life) {
  const need = $(prefix ? `${prefix}-insurable-need` : "insurable-need");
  const gap = $(prefix ? `${prefix}-insurance-gap` : "insurance-gap");
  const note = $(prefix ? `${prefix}-insurance-gap-note` : "insurance-gap-note");
  if (need) need.textContent = formatDollars(life?.grossNeed || 0);
  if (gap) gap.textContent = formatDollars(insuranceGapOf(life));
  if (note) note.textContent = gapNote(life);
}

function needAt(points, age) {
  if (!points?.length || age == null) return null;
  return points.reduce((best, point) => (Math.abs(point.age - age) < Math.abs(best.age - age) ? point : best));
}

function disabilityBreakdown(name, annual, ratio, benefit) {
  const monthly = Math.max(0, annual) / 12;
  return `${name}'s income is ${formatDollars(annual)} a year, ${formatDollars(monthly)} a month. Section 2 keeps ${Math.round(ratio * 100)}% of that, so the starting benefit is ${formatDollars(benefit)} a month. Slide it to recommend a different amount.`;
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
  $("client-name").value = "Client 1";
  $("spouse-name").value = "Client 2";
  $("dependant-count").value = "0";
  $("income-years").value = "10";
  $("spouse-income-years").value = "10";
  $("replacement-ratio").value = String(assumptions.survivorIncomeReplacement * 100);
  $("spouse-replacement-ratio").value = String(assumptions.survivorIncomeReplacement * 100);
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
  $("spouse-tfsa-return").value = rate;
  $("spouse-rrsp-return").value = rate;
  $("spouse-nonreg-return").value = rate;
  $("ci-months").value = "12";
  $("ci-months-slider").value = "12";
  $("inflation-rate").value = "2.2";
  $("inflation-slider").value = "2.2";
  if ($("province").options.length) $("province").value = "AB";
}

function rangeHeld(slider) {
  return Boolean(slider) && document.activeElement === slider;
}

function placeBenefit(flag, inputId, sliderId, amount, max) {
  const life = flag === "life" || flag === "spouseLife";
  const slider = $(sliderId);
  const target = life ? roundLife(amount) : Math.max(0, amount || 0);
  const htmlMax = Number(slider.getAttribute("max")) || (life ? 2000000 : 20000);
  const htmlStep = life ? 50000 : 1;
  let ceiling = life
    ? Math.max(roundLife(max || 0), target, 50000)
    : Math.max(0, Math.ceil(max || 0), Math.ceil(target));
  if (!life && ceiling <= 0) ceiling = htmlMax;
  const step = !life && ceiling < htmlStep ? 1 : htmlStep;
  const held = rangeHeld(slider);
  if (!held) {
    slider.max = String(ceiling);
    slider.step = String(step);
  }
  const input = $(inputId);
  const focused = document.activeElement === input;
  if (!dirty[flag]) input.value = moneyOrBlank(target);
  const cap = Number(slider.max) || ceiling;
  const raw = Math.min(cap, Math.max(0, num(inputId)));
  const chosen = life ? roundLife(raw) : raw;
  if (life && !focused && !held) input.value = moneyOrBlank(chosen);
  if (!held) slider.value = String(Math.round(chosen));
}

function pairSlider(eventTarget) {
  const pairs = [
    ["rec-tfsa-slider", "rec-tfsa", 10000, false],
    ["rec-rrsp-slider", "rec-rrsp", 10000, false],
    ["rec-nonreg-slider", "rec-nonreg", 10000, false],
    ["rec-life-slider", "rec-life", 5000000, true],
    ["rec-spouse-life-slider", "rec-spouse-life", 5000000, true],
    ["rec-disability-slider", "rec-disability", 50000, false],
    ["rec-spouse-disability-slider", "rec-spouse-disability", 50000, false],
    ["ci-months-slider", "ci-months", 36, false],
    ["inflation-slider", "inflation-rate", 8, false],
    ["cpp-slider", "cpp-annual", 20000, false],
    ["oas-slider", "oas-annual", 12000, false],
    ["spouse-cpp-slider", "spouse-cpp", 20000, false],
    ["spouse-oas-slider", "spouse-oas", 12000, false],
  ];
  for (const [sliderId, inputId, max, life] of pairs) {
    const ceiling = Number($(sliderId).max) || max;
    if (eventTarget.id === sliderId) {
      $(inputId).value = life ? String(roundLife(Number(eventTarget.value))) : eventTarget.value;
    }
    if (eventTarget.id === inputId) {
      const raw = Math.min(ceiling, Math.max(0, readMoney(eventTarget.value)));
      $(sliderId).value = String(life ? roundLife(raw) : raw);
    }
  }
}

function pensionEstimate(income, age, retirementAge) {
  return {
    cpp: estimateCpp(income, cppAmounts.ympe, maxCpp(), projectedCppYears(age, retirementAge)),
    oas: estimateOas(projectedOasYears(age, retirementAge), maxOas()),
  };
}

function placeAmount(flag, id, amount) {
  if (!dirty[flag]) $(id).value = moneyOrBlank(amount);
}

function placePension(flag, inputId, sliderId, estimate, max) {
  const slider = $(sliderId);
  const held = rangeHeld(slider);
  if (!held) {
    slider.max = String(Math.max(100, Math.round(max || 0)));
    slider.step = "1";
  }
  if (!dirty[flag]) $(inputId).value = moneyOrBlank(estimate);
  if (!held) {
    slider.value = String(Math.min(Number(slider.max), Math.max(0, Math.round(num(inputId)))));
  }
}

function syncPensions() {
  const retire = acceptedRetirementAge();
  const client = pensionEstimate(planningIncome("income-last"), ageOf("client-age"), retire);
  const spouse = pensionEstimate(
    hasSpouse() ? planningIncome("spouse-income-last") : 0,
    hasSpouse() ? ageOf("spouse-age") : null,
    retire,
  );
  const clientCpp = adjustCppForStart(client.cpp, retire);
  const clientOas = adjustOasForStart(client.oas, retire);
  const spouseCpp = adjustCppForStart(spouse.cpp, retire);
  const spouseOas = adjustOasForStart(spouse.oas, retire);
  const cppMax = Math.max(maxCpp() * 1.5, clientCpp, spouseCpp, num("cpp-annual"), num("spouse-cpp"));
  const oasMax = Math.max(maxOas() * 1.5, clientOas, spouseOas, num("oas-annual"), num("spouse-oas"));
  placePension("cpp", "cpp-annual", "cpp-slider", clientCpp, cppMax);
  placePension("oas", "oas-annual", "oas-slider", clientOas, oasMax);
  placePension("spouseCpp", "spouse-cpp", "spouse-cpp-slider", spouseCpp, cppMax);
  placePension("spouseOas", "spouse-oas", "spouse-oas-slider", spouseOas, oasMax);
  $("cpp-hint").textContent = pensionHint(client.cpp, clientCpp, retire, "CPP", "cpp");
  $("oas-hint").textContent = pensionHint(client.oas, clientOas, retire, "OAS", "oas");
  $("spouse-cpp-hint").textContent = pensionHint(spouse.cpp, spouseCpp, retire, "CPP", "spouseCpp");
  $("spouse-oas-hint").textContent = pensionHint(spouse.oas, spouseOas, retire, "OAS", "spouseOas");
  retirementAgeNote();
}

function syncRecommendations() {
  const copy = (flag, amount, inputId, sliderId) => {
    if (dirty[flag]) return;
    $(inputId).value = moneyOrBlank(amount);
    $(sliderId).value = String(Math.min(10000, Math.max(0, amount)));
  };
  const both = (first, second) => num(first) + (hasSpouse() ? num(second) : 0);
  copy("tfsa", both("tfsa-monthly", "spouse-tfsa-monthly"), "rec-tfsa", "rec-tfsa-slider");
  copy("rrsp", both("rrsp-monthly", "spouse-rrsp-monthly"), "rec-rrsp", "rec-rrsp-slider");
  copy("nonreg", both("nonreg-monthly", "spouse-nonreg-monthly"), "rec-nonreg", "rec-nonreg-slider");
}

function placeRange(id, age, end, flag) {
  const slider = $(id);
  const held = rangeHeld(slider);
  if (age == null || end <= age) {
    if (!held) slider.disabled = false;
    return null;
  }
  if (!held) {
    slider.disabled = false;
    slider.min = String(Math.ceil(age));
    slider.max = String(Math.floor(end));
    if (!dirty[flag]) {
      slider.value = String(Math.round(Math.min(end - 1, Math.max(age + 1, age + 15))));
    } else {
      const value = Number(slider.value);
      slider.value = String(Math.min(Number(slider.max), Math.max(Number(slider.min), value)));
    }
  }
  return Math.min(Number(slider.max), Math.max(Number(slider.min), Number(slider.value)));
}

function addLists(first, second) {
  const count = Math.max(first.length, second.length);
  const out = [];
  for (let i = 0; i < count; i += 1) out.push((first[i] || 0) + (second[i] || 0));
  return out;
}

function weightedRate(parts) {
  const weight = parts.reduce((sum, part) => sum + part.weight, 0);
  if (weight <= 0) return parts[0]?.rate || 0;
  return parts.reduce((sum, part) => sum + part.weight * part.rate, 0) / weight;
}

function ownDeposits(annual, roomNow, newRoom, years) {
  return depositsOverYears({
    desiredAnnual: Math.max(0, annual),
    openingRoom: Math.max(0, roomNow),
    newRoomByYear: newRoom,
    years,
  });
}

function secondPersonDeposits(totalAnnual, firstDeposits, roomNow, newRoom) {
  let available = Math.max(0, roomNow);
  return firstDeposits.map((got, year) => {
    if (year > 0) available += Math.max(0, newRoom[year - 1] || 0);
    const want = Math.max(0, totalAnnual - got);
    const deposit = Math.min(want, available);
    available -= deposit;
    return deposit;
  });
}

function buildPath(facts, monthly, mode) {
  const inflation = facts.inflation;
  const spouse = facts.spouse;
  const clientIncome = facts.clientIncome;
  const spouseIncome = spouse ? facts.spouseIncome : 0;
  const province = facts.province;
  const rollover = spouse && facts.rollover;
  const probate = calculateProbate(province, facts.estate, { courtVerification: facts.qcVerification });
  const clientBlend = (facts.rrspReturn + facts.nonRegReturn) / 2;
  const spouseBlend = (facts.spouseRrspReturn + facts.spouseNonRegReturn) / 2;
  const deathBase = {
    estate: facts.estate,
    rollover,
    province,
    inflationPercent: inflation,
  };
  const includeTax = facts.coverTax;
  const clientTax = deathTaxAtYear({
    ...deathBase,
    savingsReturn: clientBlend,
    income: clientIncome,
    rrsp: facts.rrsp,
    nonReg: facts.nonReg,
    other: facts.other,
    otherReturn: facts.otherReturn,
    years: 0,
  });
  const spouseTax = spouse
    ? deathTaxAtYear({
        ...deathBase,
        savingsReturn: spouseBlend,
        income: spouseIncome,
        rrsp: facts.spouseRrsp,
        nonReg: facts.spouseNonReg,
        other: facts.spouseOther,
        otherReturn: facts.spouseOtherReturn,
        years: 0,
      })
    : null;
  const clientTaxLater = deathTaxAtYear({
    ...deathBase,
    savingsReturn: clientBlend,
    income: clientIncome,
    rrsp: facts.rrsp,
    nonReg: facts.nonReg,
    other: facts.other,
    otherReturn: facts.otherReturn,
    years: 10,
  });
  const spouseTaxLater = spouse
    ? deathTaxAtYear({
        ...deathBase,
        savingsReturn: spouseBlend,
        income: spouseIncome,
        rrsp: facts.spouseRrsp,
        nonReg: facts.spouseNonReg,
        other: facts.spouseOther,
        otherReturn: facts.spouseOtherReturn,
        years: 10,
      })
    : null;
  const years = facts.age == null ? facts.incomeYears : incomeYearsAtAge(facts.age, facts.incomeYears, facts.retirementAge);
  const spouseYears = facts.spouseAge == null ? facts.spouseIncomeYears : incomeYearsAtAge(facts.spouseAge, facts.spouseIncomeYears, facts.retirementAge);
  const shared = {
    dependantAges: facts.ages,
    independenceAge: facts.independenceAge,
    educationPerDependant: facts.education,
    debts: facts.mortgage + facts.otherDebts,
    finalExpenses: facts.finalExpenses,
    probateFee: includeTax ? probate.fee : 0,
    inflationPercent: inflation,
  };
  const life = calculateLifeNeed({
    ...shared,
    personalIncome: clientIncome,
    replacementRatio: facts.replacement,
    years,
    existingLifeInsurance: facts.existingCoverage,
    assetsAtDeath: facts.tfsa,
    deathTax: includeTax ? clientTax.total : 0,
  });
  const spouseLife = spouse
    ? calculateLifeNeed({
        ...shared,
        personalIncome: spouseIncome,
        replacementRatio: facts.spouseReplacement,
        years: spouseYears,
    existingLifeInsurance: facts.spouseCoverage,
    assetsAtDeath: facts.spouseTfsa,
    deathTax: includeTax ? spouseTax.total : 0,
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
    probateFee: includeTax ? probate.fee : 0,
    inflationPercent: inflation,
    taxAtYear: (elapsed) => includeTax ? deathTaxAtYear({
      ...deathBase,
      savingsReturn: clientBlend,
      income: clientIncome,
      rrsp: facts.rrsp,
      nonReg: facts.nonReg,
      other: facts.other,
      otherReturn: facts.otherReturn,
      years: elapsed,
    }).total : 0,
    existingLifeInsurance: facts.existingCoverage,
    assetsAtDeath: facts.tfsa,
  };
  const needPath = facts.age == null ? [] : projectLifeNeed(pathInput, until);
  const spouseNeedPath = spouse && facts.spouseAge != null
    ? projectLifeNeed({
        ...pathInput,
        currentAge: facts.spouseAge,
        incomeYearsAtStart: facts.spouseIncomeYears,
        personalIncome: spouseIncome,
        replacementRatio: facts.spouseReplacement,
        taxAtYear: (elapsed) => includeTax ? deathTaxAtYear({
          ...deathBase,
          savingsReturn: spouseBlend,
          income: spouseIncome,
          rrsp: facts.spouseRrsp,
          nonReg: facts.spouseNonReg,
          other: facts.spouseOther,
          otherReturn: facts.spouseOtherReturn,
          years: elapsed,
        }).total : 0,
        existingLifeInsurance: facts.spouseCoverage,
        assetsAtDeath: facts.spouseTfsa,
      }, endAge(facts.spouseAge))
    : [];

  let portfolio = null;
  let accountPlan = null;
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
    const cpp = facts.cpp;
    const oas = facts.oas;
    const spouseCpp = spouse ? facts.spouseCpp : 0;
    const spouseOas = spouse ? facts.spouseOas : 0;
    const desired = (clientIncome + spouseIncome) * facts.retirementReplacement;
    const clientTfsaNew = room.years.map((year) => year.clientTfsa || 0);
    const spouseTfsaNew = room.years.map((year) => year.partnerTfsa || 0);
    const clientRrspNew = room.years.map((year) => year.clientRrsp || 0);
    const spouseRrspNew = room.years.map((year) => year.partnerRrsp || 0);
    const tfsaAsked = mode === "recommended"
      ? { client: monthly.tfsa * 12, spouse: 0 }
      : { client: facts.tfsaMonthly * 12, spouse: facts.spouseTfsaMonthly * 12 };
    const rrspAsked = mode === "recommended"
      ? { client: monthly.rrsp * 12, spouse: 0 }
      : { client: facts.rrspMonthly * 12, spouse: facts.spouseRrspMonthly * 12 };
    const clientTfsaDeposits = ownDeposits(tfsaAsked.client, facts.tfsaRoom, clientTfsaNew, workYears);
    const spouseTfsaDeposits = mode === "recommended"
      ? secondPersonDeposits(monthly.tfsa * 12, clientTfsaDeposits, facts.spouseTfsaRoom, spouseTfsaNew)
      : ownDeposits(tfsaAsked.spouse, facts.spouseTfsaRoom, spouseTfsaNew, workYears);
    const clientRrspDeposits = ownDeposits(rrspAsked.client, facts.rrspRoom, clientRrspNew, workYears);
    const spouseRrspDeposits = mode === "recommended"
      ? secondPersonDeposits(monthly.rrsp * 12, clientRrspDeposits, facts.spouseRrspRoom, spouseRrspNew)
      : ownDeposits(rrspAsked.spouse, facts.spouseRrspRoom, spouseRrspNew, workYears);
    if (mode === "recommended") {
      tfsaAsked.spouse = Math.max(0, monthly.tfsa * 12 - (clientTfsaDeposits[0] || 0));
      rrspAsked.spouse = Math.max(0, monthly.rrsp * 12 - (clientRrspDeposits[0] || 0));
    }
    accountPlan = {
      tfsa: { client: clientTfsaDeposits, spouse: spouseTfsaDeposits, clientWant: tfsaAsked.client, spouseWant: tfsaAsked.spouse },
      rrsp: { client: clientRrspDeposits, spouse: spouseRrspDeposits, clientWant: rrspAsked.client, spouseWant: rrspAsked.spouse },
    };
    const tfsaReturn = weightedRate([
      { weight: facts.tfsa + facts.tfsaMonthly * 12, rate: facts.tfsaReturn },
      { weight: facts.spouseTfsa + facts.spouseTfsaMonthly * 12, rate: facts.spouseTfsaReturn },
    ]);
    const rrspReturn = weightedRate([
      { weight: facts.rrsp + facts.rrspMonthly * 12, rate: facts.rrspReturn },
      { weight: facts.spouseRrsp + facts.spouseRrspMonthly * 12, rate: facts.spouseRrspReturn },
    ]);
    const nonRegReturn = weightedRate([
      { weight: facts.nonReg + facts.nonRegMonthly * 12, rate: facts.nonRegReturn },
      { weight: facts.spouseNonReg + facts.spouseNonRegMonthly * 12, rate: facts.spouseNonRegReturn },
    ]);
    portfolio = projectPortfolio({
      currentAge: facts.age,
      retirementAge: facts.retirementAge ?? 200,
      years: span,
      inflationRate: inflation / 100,
      savingsReturn: clientBlend,
      retirementReturn: clientBlend,
      useAccountReturns: true,
      tfsaReturn,
      rrspReturn,
      nonRegReturn,
      desiredIncomeToday: desired,
      tfsaAnnual: (mode === "recommended" ? monthly.tfsa : facts.tfsaMonthly + facts.spouseTfsaMonthly) * 12,
      rrspAnnual: (mode === "recommended" ? monthly.rrsp : facts.rrspMonthly + facts.spouseRrspMonthly) * 12,
      nonRegAnnual: (mode === "recommended" ? monthly.nonreg : facts.nonRegMonthly + facts.spouseNonRegMonthly) * 12,
      tfsaOpening: facts.tfsa + facts.spouseTfsa,
      rrspOpening: facts.rrsp + facts.spouseRrsp,
      nonRegOpening: facts.nonReg + facts.spouseNonReg,
      otherOpening: facts.other + facts.spouseOther,
      otherReturn: weightedRate([
        { weight: facts.other, rate: facts.otherReturn },
        { weight: facts.spouseOther, rate: facts.spouseOtherReturn },
      ]),
      tfsaDepositsOverride: addLists(clientTfsaDeposits, spouseTfsaDeposits),
      rrspDepositsOverride: addLists(clientRrspDeposits, spouseRrspDeposits),
      tfsaNewRoom: addLists(clientTfsaNew, spouseTfsaNew),
      rrspNewRoom: addLists(clientRrspNew, spouseRrspNew),
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

  return { life, spouseLife, needPath, spouseNeedPath, portfolio, probate, clientTax, spouseTax, clientTaxLater, spouseTaxLater, accountPlan };
}

function readFacts() {
  const spouse = hasSpouse();
  return {
    spouse,
    province: $("province").value || "AB",
    qcVerification: $("qc-verification").checked,
    clientIncome: planningIncome("income-last"),
    spouseIncome: spouse ? planningIncome("spouse-income-last") : 0,
    spouseIncomeYears: num("spouse-income-years") || num("income-years"),
    spouseReplacement: (num("spouse-replacement-ratio") || num("replacement-ratio")) / 100,
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
    retirementAge: acceptedRetirementAge(),
    retirementReplacement: num("retirement-replacement") / 100,
    existingCoverage: num("existing-coverage"),
    spouseCoverage: spouse ? num("spouse-existing-coverage") : 0,
    estate: num("estate-value"),
    coverTax: document.querySelector('input[name="cover-tax"]:checked')?.value !== "no",
    rollover: $("rrsp-rollover").checked,
    inflation: inflationPercent(),
    cpp: num("cpp-annual"),
    oas: num("oas-annual"),
    spouseCpp: spouse ? num("spouse-cpp") : 0,
    spouseOas: spouse ? num("spouse-oas") : 0,
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
    spouseTfsa: spouse ? num("spouse-tfsa-balance") : 0,
    spouseTfsaMonthly: spouse ? num("spouse-tfsa-monthly") : 0,
    spouseTfsaRoom: spouse ? num("spouse-tfsa-room") : 0,
    spouseTfsaReturn: spouse ? num("spouse-tfsa-return") / 100 : 0,
    spouseRrsp: spouse ? num("spouse-rrsp-balance") : 0,
    spouseRrspMonthly: spouse ? num("spouse-rrsp-monthly") : 0,
    spouseRrspRoom: spouse ? num("spouse-rrsp-room") : 0,
    spouseRrspReturn: spouse ? num("spouse-rrsp-return") / 100 : 0,
    spouseNonReg: spouse ? num("spouse-nonreg-balance") : 0,
    spouseNonRegMonthly: spouse ? num("spouse-nonreg-monthly") : 0,
    spouseNonRegReturn: spouse ? num("spouse-nonreg-return") / 100 : 0,
    other: num("other-balance"),
    otherReturn: num("other-return") / 100,
    spouseOther: spouse ? num("spouse-other-balance") : 0,
    spouseOtherReturn: spouse ? num("spouse-other-return") / 100 : 0,
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
    const tipWidth = Math.min(280, Math.max(160, box.width - 8));
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

function incomeCaption(name, life, inflation, ratio, coverage) {
  const incomeYears = life.years;
  const firstYear = life.annualIncomeNeed;
  const lastYear = incomeYears > 1 ? firstYear * ((1 + inflation / 100) ** (incomeYears - 1)) : firstYear;
  if (incomeYears > 0) {
    return `${incomeYears} years at ${Math.round(ratio * 100)}% of ${name}'s income. Year 1 is ${formatDollars(firstYear)}. Year ${incomeYears} is ${formatDollars(lastYear)} after ${inflation}% inflation. Those years are added together, then the shared debts and final expenses. ${formatDollars(coverage)} of life insurance is already in place.`;
  }
  return `No years of income are left to replace. The need is the shared debts and final expenses. ${formatDollars(coverage)} of life insurance is already in place.`;
}

function fillBars(root, life) {
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

function deathLine(row, needPoint) {
  if (!row) return "";
  const after = Math.max(0, row.total - row.deathTax);
  const income = needPoint?.incomeCapital || 0;
  return `Age ${Math.round(row.age)}. Tax at death ${formatDollars(row.deathTax)}. Left after tax ${formatDollars(after)}. Income the household loses ${formatDollars(income)}.`;
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

function referenceKey() {
  const block = node("div", "mt-4 grid gap-6 sm:grid-cols-3 text-sm");
  block.dataset.referenceList = "true";
  const col = (title, lines) => {
    const wrap = node("div");
    wrap.append(node("p", "text-xs font-semibold uppercase tracking-[0.14em] text-golddim", title));
    const list = node("ul", "mt-2 space-y-1");
    for (const line of lines) list.append(node("li", "", line));
    wrap.append(list);
    return wrap;
  };
  block.append(
    col("Sections", [
      "1 Facts",
      "2 Life insurance",
      "3 Retirement",
      "4 Accounts",
      "5 If death comes early",
      "6 Recommendation",
      "7 New coverage",
      "8 After the recommendation",
      "9 Year by year",
    ]),
    col("Illustrations", [
      "1 If Client 1 dies",
      "2 If Client 1 dies, over time",
      "3 If Client 2 dies",
      "4 Savings if nothing changes",
      "5 The two paths",
      "6 Year by year",
    ]),
    col("Sliders", [
      "1 Early death, today",
      "2 TFSA",
      "3 RRSP",
      "4 Non-registered",
      "5 New life insurance",
      "6 Client 2's life insurance",
      "7 Disability, monthly",
      "8 Client 2's disability",
      "9 Critical illness months",
      "10 Early death, after",
      "11 Inflation",
      "12 Client 1 CPP",
      "13 Client 1 OAS",
      "14 Client 2 CPP",
      "15 Client 2 OAS",
    ]),
  );
  return block;
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
    node("p", "mt-10 max-w-md text-sm leading-6 text-inksoft", "The same section, illustration, and slider numbers are on the screen and in this plan. A missing number is the spouse's item."),
    referenceKey(),
  );
  root.append(cover);

  const household = planPage("Section 1 · Facts", "Household");
  const factsList = node("div", "mt-6");
  const rows = [
    ["Plan date", date],
    [clientName(), facts.age == null ? "Age not entered" : `Age ${facts.age}`],
    ["Employment income", formatDollars(num("income-last"))],
    ["Client 2", hasSpouse() ? spouseName() : "No"],
  ];
  if (hasSpouse()) {
    rows.push(
      [`${spouseName()} age`, facts.spouseAge == null ? "Not entered" : String(facts.spouseAge)],
      [`${spouseName()} employment income`, formatDollars(num("spouse-income-last"))],
      [`If ${spouseName()} dies, income to replace`, `${facts.spouseIncomeYears} years at ${Math.round(facts.spouseReplacement * 100)}%`],
      [`${spouseName()} CPP at ${cppStartAge(facts.retirementAge)}`, `${formatDollars(facts.spouseCpp)} a year`],
      [`${spouseName()} OAS at ${oasStartAge(facts.retirementAge)}`, `${formatDollars(facts.spouseOas)} a year`],
    );
  }
  rows.push(
    ["Children", childSummary()],
    [`If ${clientName()} dies, income to replace`, `${facts.incomeYears} years at ${Math.round(facts.replacement * 100)}% of their income`],
    ["Mortgage", formatDollars(facts.mortgage)],
    ["Other debts", formatDollars(facts.otherDebts)],
    ["Retirement age", String(facts.retirementAge)],
    ["Retirement income", `${Math.round(facts.retirementReplacement * 100)}% of income`],
    [`${clientName()} CPP at ${cppStartAge(facts.retirementAge)}`, `${formatDollars(facts.cpp)} a year`],
    [`${clientName()} OAS at ${oasStartAge(facts.retirementAge)}`, `${formatDollars(facts.oas)} a year`],
    [`${clientName()} TFSA`, `${formatDollars(facts.tfsa)} · ${formatDollars(facts.tfsaMonthly)} a month`],
    [`${clientName()} RRSP`, `${formatDollars(facts.rrsp)} · ${formatDollars(facts.rrspMonthly)} a month`],
    [`${clientName()} non-registered`, `${formatDollars(facts.nonReg)} · ${formatDollars(facts.nonRegMonthly)} a month`],
    [`${clientName()} other investments`, `${formatDollars(facts.other)} · ${Math.round(facts.otherReturn * 1000) / 10}%`],
  );
  if (hasSpouse()) {
    rows.push(
      [`${spouseName()} TFSA`, `${formatDollars(facts.spouseTfsa)} · ${formatDollars(facts.spouseTfsaMonthly)} a month`],
      [`${spouseName()} RRSP`, `${formatDollars(facts.spouseRrsp)} · ${formatDollars(facts.spouseRrspMonthly)} a month`],
      [`${spouseName()} non-registered`, `${formatDollars(facts.spouseNonReg)} · ${formatDollars(facts.spouseNonRegMonthly)} a month`],
      [`${spouseName()} other investments`, `${formatDollars(facts.spouseOther)} · ${Math.round(facts.spouseOtherReturn * 1000) / 10}%`],
    );
  }
  const markers = {
    [`If ${clientName()} dies, income to replace`]: "Section 2 · Life insurance",
    "Retirement age": "Section 3 · Retirement",
    [`${clientName()} TFSA`]: "Section 4 · Accounts",
  };
  for (const [label, value] of rows) {
    if (markers[label]) factsList.append(node("p", "ref-tag mt-6", markers[label]));
    factsList.append(planRow(label, value));
  }
  household.append(factsList);
  root.append(household);

  const insurance = planPage("Section 5 · Illustration 1", "Insurance need");
  insurance.append(node("p", "ref-tag mt-6", `Illustration 1 · If ${clientName()} dies`));
  insurance.append(node("p", "mt-2 font-serif text-5xl text-navydeep nums", formatDollars(current.life.capitalNeed)));
  insurance.append(node("p", "mt-2 text-sm text-inksoft", `${clientName()} · ${facts.incomeYears} years at ${Math.round(facts.replacement * 100)}% of their income · ${formatDollars(facts.existingCoverage)} already in place`));
  insurance.append(node("p", "mt-2 text-sm leading-6 text-inksoft", `Insurable need ${formatDollars(current.life.grossNeed)}. Insurance gap ${formatDollars(insuranceGapOf(current.life))}. ${gapNote(current.life)}`));
  insurance.append(node("p", "mt-2 text-sm leading-6 text-inksoft", taxSentence(current, facts)));
  insurance.append(node("p", "ref-tag mt-8", "Illustration 2 · Need over time"));
  const chart = node("div", "need-chart mt-2");
  insurance.append(chart);
  insurance.append(node("p", "mt-2 text-xs text-inksoft", "Solid line: insurable need at each age. Dashed line: insurance gap. Zero means coverage and assets already meet the need."));
  if (current.spouseLife) {
    insurance.append(node("p", "ref-tag mt-8", `Illustration 3 · If ${spouseName()} dies`));
    insurance.append(node("p", "mt-2 font-serif text-4xl text-navydeep nums", formatDollars(current.spouseLife.capitalNeed)));
    insurance.append(node("p", "mt-2 text-sm text-inksoft", `${spouseName()} · ${facts.spouseIncomeYears} years at ${Math.round(facts.spouseReplacement * 100)}% of their income · ${formatDollars(facts.spouseCoverage)} already in place`));
    insurance.append(node("p", "mt-2 text-sm leading-6 text-inksoft", `Insurable need ${formatDollars(current.spouseLife.grossNeed)}. Insurance gap ${formatDollars(insuranceGapOf(current.spouseLife))}. ${gapNote(current.spouseLife)}`));
    const spouseChart = node("div", "need-chart mt-6");
    insurance.append(spouseChart);
    drawSeries(spouseChart, seriesFromNeed(current.spouseNeedPath, `${spouseName()} insurance need`));
  }
  root.append(insurance);
  drawSeries(chart, seriesFromNeed(current.needPath, `${clientName()} insurance need`));

  const today = planPage("Section 5 · Illustration 4 · Slider 1", "Savings path");
  const nowRow = rowNearest(current.portfolio, earlyNow);
  today.append(node("p", "ref-tag mt-6", "Illustration 4 · Savings if nothing changes"));
  today.append(node("p", "mt-2 text-sm text-inksoft", deathLine(nowRow, needAt(current.needPath, earlyNow)) || "Add an age to see the path."));
  const wealth = node("div", "need-chart mt-6");
  today.append(wealth);
  root.append(today);
  drawSeries(wealth, seriesFromWealth(current.portfolio, earlyNow, "Savings if contributions stay where they are"));

  const advice = planPage("Sections 6 and 7 · Sliders 2–9", "What changes");
  advice.append(node("p", "mt-8 font-serif text-4xl text-navydeep nums", `${formatDollars(num("rec-tfsa") + num("rec-rrsp") + num("rec-nonreg"))} / month`));
  const adviceList = node("div", "mt-6");
  adviceList.append(
    planRow("TFSA", `${formatDollars(num("rec-tfsa"))} a month`),
    planRow("RRSP", `${formatDollars(num("rec-rrsp"))} a month`),
    planRow("Non-registered", `${formatDollars(num("rec-nonreg"))} a month`),
    planRow(`New life insurance, ${clientName()}`, formatDollars(num("rec-life"))),
  );
  if (hasSpouse()) adviceList.append(planRow(`New life insurance, ${spouseName()}`, formatDollars(num("rec-spouse-life"))));
  adviceList.append(
    planRow(`Disability benefit, ${clientName()}`, `${formatDollars(num("rec-disability"))} a month`),
    planRow(`Critical illness, ${clientName()}`, `${formatDollars(criticalIllnessLumpSum(facts.clientIncome, facts.replacement, num("ci-months")))} for ${num("ci-months")} months`),
  );
  if (hasSpouse()) {
    adviceList.append(
      planRow(`Disability benefit, ${spouseName()}`, `${formatDollars(num("rec-spouse-disability"))} a month`),
      planRow(`Critical illness, ${spouseName()}`, `${formatDollars(criticalIllnessLumpSum(facts.spouseIncome, facts.spouseReplacement, num("ci-months")))} for ${num("ci-months")} months`),
    );
  }
  advice.append(adviceList);
  advice.append(node("p", "mt-4 text-sm text-inksoft", "Each life insurance amount moves in $50,000 steps."));
  const tfsaPlan = accountRoomNote(recommended, "tfsa", "TFSA");
  const rrspPlan = accountRoomNote(recommended, "rrsp", "RRSP");
  if (tfsaPlan.text) advice.append(node("p", "mt-4 text-sm leading-6", tfsaPlan.text));
  if (rrspPlan.text) advice.append(node("p", "mt-2 text-sm leading-6", rrspPlan.text));
  root.append(advice);

  const after = planPage("Section 8 · Illustration 5 · Slider 10", "The two paths");
  after.append(node("p", "ref-tag mt-6", "Illustration 5 · The two paths"));
  const atRetireNow = rowNearest(current.portfolio, facts.retirementAge)?.total ?? 0;
  const atRetireNext = rowNearest(recommended.portfolio, facts.retirementAge)?.total ?? 0;
  after.append(node("p", "mt-8 text-sm text-inksoft", `At retirement: ${formatDollars(atRetireNow)} on the current path, ${formatDollars(atRetireNext)} after the recommendation.`));
  const compare = node("div", "need-chart mt-2");
  after.append(compare);
  const afterRow = rowNearest(recommended.portfolio, earlyAfter);
  after.append(node("p", "mt-4 text-sm text-inksoft", deathLine(afterRow, needAt(recommended.needPath, num("early-after")))));
  const still = Math.max(0, Math.round(current.life.capitalNeed) - Math.round(num("rec-life")));
  after.append(node("p", "mt-6 text-sm text-inksoft", "Life insurance need not covered"));
  after.append(node("p", "font-serif text-3xl text-navydeep nums", formatDollars(still)));
  after.append(node("p", "mt-1 text-sm text-inksoft", still <= 0
    ? `The new life insurance covers ${clientName()}'s illustrated need.`
    : `Illustrated need minus the new life insurance for ${clientName()}.`));
  after.append(node("p", "mt-10 text-xs leading-5 text-inksoft", "Illustration only. Not a policy, not a tax opinion, and not a specific contract. Figures stay in this tab and are not saved."));
  root.append(after);
  drawSeries(compare, compareSeries(current.portfolio, recommended.portfolio, earlyAfter));
}

function seriesFromNeed(points, aria) {
  return {
    aria,
    series: [
      { values: points.map((point) => point.insurableNeed), color: "#2f3744" },
      { values: points.map((point) => point.insuranceGap), color: "#a68a61", dash: "5 4", width: "2" },
    ],
    tipAt: (index) => {
      const point = points[index];
      const gap = point.insuranceGap <= 0
        ? "Insurance gap $0. Coverage and assets already meet the need."
        : `Insurance gap ${formatDollars(point.insuranceGap)}. Dashed line.`;
      const lines = [
        `Age ${point.age}`,
        `Insurable need ${formatDollars(point.insurableNeed)}. Solid line.`,
        gap,
      ];
      if (point.mortgageLeft > 0) lines.push(`Mortgage still owing ${formatDollars(point.mortgageLeft)}.`);
      return lines;
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
      const after = Math.max(0, row.total - row.deathTax);
      return [
        `Age ${Math.round(row.age)}`,
        formatDollars(row.total),
        "Savings if nothing changes.",
        `Tax at death ${formatDollars(row.deathTax)}. Left after tax ${formatDollars(after)}.`,
      ];
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
      `After the recommendation ${formatDollars(nextValues[index] || 0)}. Solid line.`,
      `Today's path ${formatDollars(currentValues[index] || 0)}. Dashed line.`,
    ],
  };
}

function taxSentence(model, facts) {
  const client = model?.clientTax;
  if (!client) return "";
  const lines = [
    `${clientName()}: RRSP tax ${formatDollars(client.rrspTax)}, non-registered ${formatDollars(client.nonRegTax)}, other investments ${formatDollars(client.otherTax)}, tax on the probate value ${formatDollars(client.estateTax)}`,
  ];
  if (model.spouseTax) {
    lines.push(`${spouseName()}: RRSP tax ${formatDollars(model.spouseTax.rrspTax)}, non-registered ${formatDollars(model.spouseTax.nonRegTax)}, other investments ${formatDollars(model.spouseTax.otherTax)}`);
  }
  if (model.clientTaxLater) {
    lines.push(`In 10 years, ${clientName()}'s tax on the RRSP, non-registered account, and other investments is ${formatDollars(model.clientTaxLater.rrspTax + model.clientTaxLater.nonRegTax + model.clientTaxLater.otherTax)}`);
  }
  if (model.spouseTaxLater) {
    lines.push(`In 10 years, ${spouseName()}'s tax on those accounts is ${formatDollars(model.spouseTaxLater.rrspTax + model.spouseTaxLater.nonRegTax + model.spouseTaxLater.otherTax)}`);
  }
  lines.push(`Probate ${formatDollars(model.probate.fee)}`);
  lines.push(facts.coverTax ? "The life insurance need includes these." : "The life insurance need leaves these out.");
  return lines.join(". ");
}

function depositLine(name, account, deposits, asked) {
  if (!deposits || (asked <= 0 && !(deposits[0] > 0))) return "";
  const first = deposits[0] || 0;
  const yearOf = (index) => tfsaContributionLimit.taxYear + index;
  if (first + 0.5 < asked && first <= 0.5) {
    const next = deposits.findIndex((amount, index) => index > 0 && amount > 0.5);
    const later = next > 0 ? ` In ${yearOf(next)} the deposit is ${formatDollars(deposits[next])}.` : "";
    return `${name}'s ${account} is maxed. Nothing more goes in this year.${later}`;
  }
  if (first + 0.5 < asked) return `${name}'s ${account} room allows ${formatDollars(first)} this year, not ${formatDollars(asked)}.`;
  const drop = deposits.findIndex((amount, index) => index > 0 && amount + 0.5 < asked);
  if (drop > 0) return `${name}'s ${account} covers ${formatDollars(asked)} a year through ${yearOf(drop) - 1}, then comes down to ${formatDollars(deposits[drop])}.`;
  return `${name}'s ${account} room covers ${formatDollars(asked)} a year.`;
}

function accountRoomNote(model, key, account) {
  const plan = model?.accountPlan?.[key];
  if (!plan) return { text: "", limited: false, maxed: false };
  const lines = [
    depositLine(clientName(), account, plan.client, plan.clientWant),
    depositLine(spouseName(), account, plan.spouse, plan.spouseWant),
  ].filter(Boolean);
  const text = lines.join(" ");
  return {
    text,
    limited: /maxed|not |comes down/.test(text),
    maxed: text.includes("maxed"),
  };
}

function roomNote(portfolio, annualWant, key) {
  const name = key === "tfsa" ? "TFSA" : "RRSP";
  const field = key === "tfsa" ? "tfsaIn" : "rrspIn";
  const saving = (portfolio?.rows || []).filter((row) => !row.retired);
  if (!saving.length || annualWant <= 0) return { text: "", limited: false, maxed: false };
  const schedule = describeDeposits(portfolio.rows).accounts[key];
  const thisYear = saving[0][field] || 0;
  const shortNow = thisYear + 0.5 < annualWant;
  const shortLater = saving.find((row, index) => index > 0 && (row[field] || 0) + 0.5 < annualWant);
  if (!shortNow && !shortLater) {
    return {
      text: `${name} room covers ${formatDollars(annualWant)} a year through retirement.`,
      limited: false,
      maxed: false,
    };
  }
  if (shortNow && thisYear <= 0.5) {
    if (schedule.laterOffset <= 0) {
      return { text: `${name} is maxed. Nothing more goes in before retirement.`, limited: true, maxed: true };
    }
    const fitsAgain = schedule.later + 0.5 >= annualWant;
    const next = fitsAgain
      ? ` In ${schedule.calendarYear} the new room covers ${formatDollars(annualWant)} again, and that contribution continues.`
      : ` In ${schedule.calendarYear} the deposit is the new room, ${formatDollars(schedule.later)}. After that it follows each year's maximum, not the slider.`;
    return { text: `${name} is maxed. Nothing more goes in this year.${next}`, limited: true, maxed: true };
  }
  if (shortNow) {
    const next = schedule.laterOffset > 0
      ? ` In ${schedule.calendarYear} it is ${formatDollars(schedule.later)}, and it stays at each year's maximum after that.`
      : "";
    return {
      text: `${name} is maxed for this slider. Room allows ${formatDollars(thisYear)} this year, not ${formatDollars(annualWant)}.${next}`,
      limited: true,
      maxed: true,
    };
  }
  return {
    text: `The ${name} amount is ${formatDollars(annualWant)} a year. Room covers that through ${shortLater.calendarYear - 1}. In ${shortLater.calendarYear} the deposit comes down to ${formatDollars(shortLater[field])}, and it follows the projected maximum after that.`,
    limited: true,
    maxed: false,
  };
}

function showRoomNote(id, note) {
  const element = $(id);
  element.textContent = note.text;
  element.className = note.limited
    ? "mt-2 rounded-sm border border-gold bg-paperdim px-3 py-2 text-sm leading-6 text-navydeep"
    : "mt-2 text-sm leading-6 text-inksoft";
}

function tableCell(label, value, className) {
  const cell = document.createElement("td");
  cell.className = className;
  cell.dataset.label = label;
  const amount = document.createElement("span");
  amount.className = "nums shrink-0";
  amount.textContent = value;
  cell.append(amount);
  return cell;
}

function renderProjectionTable(portfolio, earlyAge, facts) {
  const table = $("portfolio-table");
  const note = $("projection-note");
  const rows = portfolio?.rows || [];
  table.replaceChildren();
  if (!rows.length) {
    note.textContent = "Add an age to see the year-by-year projection.";
    return;
  }
  const spouse = facts.spouse && facts.spouseAge != null;
  const labels = ["Year", "Age"];
  if (spouse) labels.push(`${spouseName()} age`);
  labels.push("TFSA entered", "TFSA deposited", "RRSP entered", "RRSP deposited", "Non-reg in", "TFSA", "RRSP", "Non-reg", "Other", "Total", "CPP and OAS", "From the accounts", "Tax on withdrawal", "Tax if death");
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const label of labels) {
    const cell = document.createElement("th");
    cell.className = "whitespace-nowrap border-b border-line px-2 py-2 text-left font-medium";
    cell.textContent = label;
    headRow.append(cell);
  }
  head.append(headRow);
  const body = document.createElement("tbody");
  const tfsaWant = num("rec-tfsa") * 12;
  const rrspWant = num("rec-rrsp") * 12;
  const startAge = rows[0].age;
  for (const row of rows) {
    const death = earlyAge != null && Math.round(row.age) === Math.round(earlyAge);
    const tr = document.createElement("tr");
    if (death) tr.className = "death-row";
    const values = [[String(row.calendarYear), ""], [String(Math.round(row.age)), ""]];
    if (spouse) values.push([String(Math.round(facts.spouseAge + (row.age - startAge))), ""]);
    values.push(
      [formatDollars(row.retired ? 0 : tfsaWant), ""],
      [formatDollars(row.tfsaIn), !row.retired && row.tfsaIn + 0.5 < tfsaWant ? "room-short" : ""],
      [formatDollars(row.retired ? 0 : rrspWant), ""],
      [formatDollars(row.rrspIn), !row.retired && row.rrspIn + 0.5 < rrspWant ? "room-short" : ""],
      [formatDollars(row.nonRegIn), ""],
      [formatDollars(row.tfsa), ""],
      [formatDollars(row.rrsp), ""],
      [formatDollars(row.nonReg), ""],
      [formatDollars(row.other), ""],
      [formatDollars(row.total), ""],
      [formatDollars(row.pension), ""],
      [formatDollars(row.withdrawal), ""],
      [formatDollars(row.tax), ""],
      [formatDollars(row.deathTax), death ? "death-tax" : ""],
    );
    values.forEach(([value, extra], index) => {
      tr.append(tableCell(labels[index], value, `whitespace-nowrap border-b border-line px-2 py-1 ${extra}`));
    });
    body.append(tr);
  }
  table.append(head, body);
  note.textContent = "TFSA entered and RRSP entered are the amounts on the sliders. Each deposit is that amount or the room still available, whichever is smaller. A gold figure is below what was entered because the room ran out. Scroll sideways for every year. Future TFSA room uses the published limits and Slider 11. At retirement the deposits stop. CPP and OAS are the amounts in Section 3, raised with that same inflation, and they cover part of the income. The accounts withdraw the rest. The red row is the early-death age. That tax is shown beside the balance. It is not taken off the path that continues.";
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
  applyNames();
  const spouse = hasSpouse();
  $("spouse-fields").classList.toggle("hidden", !spouse);
  $("spouse-accounts").classList.toggle("hidden", !spouse);
  $("spouse-death").classList.toggle("hidden", !spouse);
  $("spouse-need-block").classList.toggle("hidden", !spouse);
  $("rec-spouse-life-wrap").classList.toggle("hidden", !spouse);
  $("rec-spouse-disability-wrap").classList.toggle("hidden", !spouse);
  $("spouse-ci-line").classList.toggle("hidden", !spouse);
  $("spouse-cpp-wrap").classList.toggle("hidden", !spouse);
  $("spouse-oas-wrap").classList.toggle("hidden", !spouse);
  $("after-spouse-life-wrap").classList.toggle("hidden", !spouse);
  $("rollover-wrap").classList.toggle("hidden", !spouse);
  $("dependant-extra").classList.toggle("hidden", dependantCount() === 0);
  $("qc-wrap").classList.toggle("hidden", $("province").value !== "QC");
  syncRecommendations();
  syncPensions();

  const facts = readFacts();
  const current = buildPath(facts, null, "current");
  placeBenefit("life", "rec-life", "rec-life-slider", current.life.capitalNeed, Math.max(current.life.capitalNeed, 2000000));
  if (current.spouseLife) placeBenefit("spouseLife", "rec-spouse-life", "rec-spouse-life-slider", current.spouseLife.capitalNeed, Math.max(current.spouseLife.capitalNeed, 2000000));
  const disability = disabilityMonthlyBenefit(facts.clientIncome, facts.replacement);
  const spouseDisability = disabilityMonthlyBenefit(facts.spouseIncome, facts.spouseReplacement);
  placeBenefit("disability", "rec-disability", "rec-disability-slider", disability, Math.max(disability, facts.clientIncome / 12));
  placeBenefit("spouseDisability", "rec-spouse-disability", "rec-spouse-disability-slider", spouseDisability, Math.max(spouseDisability, facts.spouseIncome / 12));
  const months = Math.max(0, Math.min(36, num("ci-months")));
  $("ci-amount").textContent = formatDollars(criticalIllnessLumpSum(facts.clientIncome, facts.replacement, months));
  $("spouse-ci-amount").textContent = formatDollars(criticalIllnessLumpSum(facts.spouseIncome, facts.spouseReplacement, months));
  $("disability-hint").textContent = disabilityBreakdown(clientName(), facts.clientIncome, facts.replacement, disability);
  $("spouse-disability-hint").textContent = hasSpouse()
    ? disabilityBreakdown(spouseName(), facts.spouseIncome, facts.spouseReplacement, spouseDisability)
    : "";
  const recommended = buildPath(facts, { tfsa: num("rec-tfsa"), rrsp: num("rec-rrsp"), nonreg: num("rec-nonreg") }, "recommended");

  $("life-figure").textContent = formatDollars(current.life.capitalNeed);
  $("sticky-life").textContent = formatDollars(current.life.capitalNeed);
  $("tax-probate-note").textContent = taxSentence(current, facts);
  $("life-caption").textContent = incomeCaption(clientName(), current.life, facts.inflation, facts.replacement, facts.existingCoverage);
  showNeedFigures("", current.life);
  showNeedFigures("spouse", current.spouseLife);
  const todayPath = $("today-path");
  if (todayPath) {
    const atRetire = rowNearest(current.portfolio, facts.retirementAge);
    todayPath.textContent = `If nothing changes, savings at retirement are ${formatDollars(atRetire?.total || 0)}.`;
  }
  fillBars($("need-bars"), current.life);
  drawSeries($("need-chart"), seriesFromNeed(current.needPath, `${clientName()} insurance need over time`));
  if (current.spouseLife) {
    $("spouse-life-figure").textContent = formatDollars(current.spouseLife.capitalNeed);
    $("spouse-life-caption").textContent = incomeCaption(spouseName(), current.spouseLife, facts.inflation, facts.spouseReplacement, facts.spouseCoverage);
    fillBars($("spouse-need-bars"), current.spouseLife);
    drawSeries($("spouse-need-chart"), seriesFromNeed(current.spouseNeedPath, `${spouseName()} insurance need over time`));
  }

  const earlyNow = placeRange("early-now", facts.age, endAge(facts.age), "earlyNow");
  {
    const nowRow = rowNearest(current.portfolio, earlyNow);
    const nowText = deathLine(nowRow, needAt(current.needPath, earlyNow))
      || "Enter an age in the facts. This slider then picks the age of death.";
    $("early-now-readout").textContent = nowText;
    $("early-now").title = nowText;
  }
  drawSeries($("wealth-chart"), seriesFromWealth(current.portfolio, earlyNow, "Savings if monthly contributions stay where they are"));

  const monthly = num("rec-tfsa") + num("rec-rrsp") + num("rec-nonreg");
  $("sticky-monthly").textContent = formatDollars(monthly);
  $("compare-today").textContent = formatDollars(facts.tfsaMonthly + facts.spouseTfsaMonthly + facts.rrspMonthly + facts.spouseRrspMonthly + facts.nonRegMonthly + facts.spouseNonRegMonthly);
  $("compare-rec").textContent = formatDollars(monthly);
  $("retire-today").textContent = formatDollars(rowNearest(current.portfolio, facts.retirementAge)?.total ?? 0);
  $("retire-rec").textContent = formatDollars(rowNearest(recommended.portfolio, facts.retirementAge)?.total ?? 0);
  const earlyAfter = placeRange("early-after", facts.age, endAge(facts.age), "earlyAfter");
  {
    const afterRow = rowNearest(recommended.portfolio, earlyAfter);
    const afterText = deathLine(afterRow, needAt(recommended.needPath, earlyAfter))
      || "Enter an age in the facts. This slider then picks the age of death.";
    $("early-after-readout").textContent = afterText;
    $("early-after").title = afterText;
  }
  drawSeries($("compare-chart"), compareSeries(current.portfolio, recommended.portfolio, earlyAfter));
  const tfsaRoom = accountRoomNote(recommended, "tfsa", "TFSA");
  const rrspRoom = accountRoomNote(recommended, "rrsp", "RRSP");
  showRoomNote("rec-tfsa-note", tfsaRoom);
  showRoomNote("rec-rrsp-note", rrspRoom);
  renderProjectionTable(recommended.portfolio, earlyAfter, facts);
  const roundedNeed = roundLife(current.life.capitalNeed);
  const still = Math.max(0, roundedNeed - roundLife(num("rec-life")));
  $("after-life").textContent = formatDollars(still);
  $("after-life-note").textContent = still <= 0
    ? `The new life insurance covers the illustrated need, rounded to the nearest $50,000 (${formatDollars(roundedNeed)}).`
    : `Illustrated need rounded to the nearest $50,000 (${formatDollars(roundedNeed)}) minus the new life insurance.`;
  if (current.spouseLife) {
    const spouseRounded = roundLife(current.spouseLife.capitalNeed);
    const spouseStill = Math.max(0, spouseRounded - roundLife(num("rec-spouse-life")));
    $("after-spouse-life").textContent = formatDollars(spouseStill);
    $("after-spouse-life-note").textContent = spouseStill <= 0
      ? `The new life insurance covers the illustrated need, rounded to the nearest $50,000 (${formatDollars(spouseRounded)}).`
      : `Illustrated need rounded to the nearest $50,000 (${formatDollars(spouseRounded)}) minus the new life insurance.`;
  }

  renderPlan(facts, current, recommended, earlyNow, earlyAfter);
}

function loadSample() {
  if (!confirm("Replace this plan with the sample household?")) return;
  fillDefaults();
  $("client-name").value = "Alex Morgan";
  $("client-age").value = "42";
  $("income-last").value = "95000";
  document.querySelector('input[name="spouse"][value="yes"]').checked = true;
  $("spouse-name").value = "Jordan Morgan";
  $("spouse-age").value = "40";
  $("spouse-income-last").value = "45000";
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
  $("other-balance").value = "80000";
  $("other-return").value = "3";
  $("estate-value").value = "200000";
  $("spouse-tfsa-balance").value = "15000";
  $("spouse-tfsa-monthly").value = "100";
  $("spouse-tfsa-room").value = "8000";
  $("spouse-tfsa-return").value = "5";
  $("spouse-rrsp-balance").value = "25000";
  $("spouse-rrsp-monthly").value = "150";
  $("spouse-rrsp-room").value = "6000";
  $("spouse-rrsp-return").value = "5";
  $("spouse-nonreg-balance").value = "10000";
  $("spouse-nonreg-monthly").value = "50";
  $("spouse-nonreg-return").value = "4";
  $("spouse-other-balance").value = "40000";
  $("spouse-other-return").value = "3";
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
  $("reference-key").append(referenceKey());
  render();
  const trail = $("crumb-trail");
  const updateCrumb = () => {
    const marks = [...document.querySelectorAll("[data-crumb]")].filter((mark) => mark.getClientRects().length > 0);
    let current = marks[0];
    for (const mark of marks) {
      if (mark.getBoundingClientRect().top <= 150) current = mark;
    }
    if (current) trail.textContent = current.dataset.crumb;
  };
  document.addEventListener("scroll", updateCrumb, { passive: true });
  updateCrumb();
  $("worksheet").addEventListener("input", (event) => {
    const id = event.target.id;
    if (id === "rec-tfsa" || id === "rec-tfsa-slider") dirty.tfsa = true;
    if (id === "rec-rrsp" || id === "rec-rrsp-slider") dirty.rrsp = true;
    if (id === "rec-nonreg" || id === "rec-nonreg-slider") dirty.nonreg = true;
    if (id === "rec-life" || id === "rec-life-slider") dirty.life = true;
    if (id === "rec-spouse-life" || id === "rec-spouse-life-slider") dirty.spouseLife = true;
    if (id === "rec-disability" || id === "rec-disability-slider") dirty.disability = true;
    if (id === "rec-spouse-disability" || id === "rec-spouse-disability-slider") dirty.spouseDisability = true;
    if (id === "cpp-annual" || id === "cpp-slider") dirty.cpp = true;
    if (id === "oas-annual" || id === "oas-slider") dirty.oas = true;
    if (id === "spouse-cpp" || id === "spouse-cpp-slider") dirty.spouseCpp = true;
    if (id === "spouse-oas" || id === "spouse-oas-slider") dirty.spouseOas = true;
    if (id === "early-now") dirty.earlyNow = true;
    if (id === "early-after") dirty.earlyAfter = true;
    pairSlider(event.target);
    render();
  });
  $("worksheet").addEventListener("change", (event) => {
    const id = event.target.id;
    if (id === "rec-life" || id === "rec-spouse-life") {
      event.target.value = moneyOrBlank(roundLife(readMoney(event.target.value)));
      if (id === "rec-life") dirty.life = true;
      if (id === "rec-spouse-life") dirty.spouseLife = true;
    }
    if (event.target.type === "radio" || event.target.type === "checkbox" || event.target.tagName === "SELECT" || id === "rec-life" || id === "rec-spouse-life") render();
  });
  $("retirement-age").addEventListener("blur", () => {
    const entered = num("retirement-age");
    const accepted = acceptedRetirementAge();
    if (entered === accepted) return;
    const floor = retirementFloor();
    $("retirement-age").value = String(accepted);
    render();
    const note = $("retirement-age-note");
    if (!note) return;
    if (entered > 0 && entered < floor) {
      note.textContent = `Retirement age has to be at least ${floor}. The plan uses ${accepted}.`;
    } else if (entered > MAX_RETIREMENT_AGE) {
      note.textContent = `The plan stops at age ${MAX_RETIREMENT_AGE}. It uses ${accepted}.`;
    }
  });
  $("worksheet").addEventListener("submit", (event) => event.preventDefault());
  $("print-plan").addEventListener("click", () => window.print());
  $("sample-case").addEventListener("click", loadSample);
  $("clear-plan").addEventListener("click", clearPlan);
}

init();
