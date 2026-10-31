import { taxBrackets } from "../../data/tax-brackets.js";
import { taxCredits } from "../../data/tax-credits.js";

export function latestTaxYear() {
  return Math.max(...Object.keys(taxBrackets.federal).map(Number));
}

function bracketTax(income, brackets) {
  let remaining = Math.max(0, income);
  let cursor = 0;
  let tax = 0;
  for (const bracket of brackets) {
    const width = bracket.upTo == null ? remaining : Math.max(0, bracket.upTo - cursor);
    const slice = Math.min(remaining, width);
    tax += slice * bracket.rate;
    remaining -= slice;
    cursor = bracket.upTo ?? cursor + slice;
    if (remaining <= 0) break;
  }
  return tax;
}

function ontarioSurtax(provincialTax, year) {
  const bands = taxBrackets.ontarioSurtax[year];
  if (!bands) return provincialTax;
  let surtax = 0;
  for (const band of bands) {
    if (provincialTax > band.above) surtax += (provincialTax - band.above) * band.rate;
  }
  return provincialTax + surtax;
}

function basicAmount(rules, income) {
  if (rules.basicFrom == null || income <= rules.basicFrom) return rules.basic;
  if (income >= rules.basicTo) return rules.basicFloor;
  const share = (income - rules.basicFrom) / (rules.basicTo - rules.basicFrom);
  return rules.basic - (rules.basic - rules.basicFloor) * share;
}

// Credit amounts for one jurisdiction, before the lowest rate is applied.
// age is the person's age at the end of the year; 0 means unknown, so no age credits.
function creditAmount(rules, reductionRate, income, age, pensionIncome) {
  if (!rules) return 0;
  const senior = age >= 65;
  const reduction = Math.max(0, income - rules.ageThreshold) * (rules.ageReductionRate ?? reductionRate);
  const ageAmount = senior ? rules.age : 0;
  const pensionAmount = Math.min(rules.pension, Math.max(0, pensionIncome) * (rules.pensionGrossUp ?? 1));
  let amount = basicAmount(rules, income) + (senior ? rules.seniorSupplement ?? 0 : 0);
  if (rules.pensionReduced) amount += Math.max(0, ageAmount + pensionAmount - reduction);
  else amount += Math.max(0, ageAmount - reduction) + pensionAmount;
  return amount;
}

// Income tax after the basic personal, age, and pension income credits. Other credits
// (CPP and EI contributions, the Canada employment amount, provincial low-income
// reductions, the Ontario Health Premium) are not modelled.
export function taxOnIncome(income, provinceCode, year = latestTaxYear(), { age = 0, pensionIncome = 0 } = {}) {
  const federalBrackets = taxBrackets.federal[year];
  const provincialBrackets = taxBrackets.provinces[provinceCode]?.[year];
  if (!federalBrackets || !provincialBrackets) return null;
  const amount = Math.max(0, income);
  const credits = taxCredits[year];
  const federalCredit = credits ? creditAmount(credits.federal, credits.ageReductionRate, amount, age, pensionIncome) * federalBrackets[0].rate : 0;
  const provincialCredit = credits
    ? creditAmount(credits.provinces[provinceCode], credits.ageReductionRate, amount, age, pensionIncome) * provincialBrackets[0].rate
    : 0;
  let federal = Math.max(0, bracketTax(amount, federalBrackets) - federalCredit);
  if (provinceCode === "QC") federal *= 1 - taxBrackets.quebecAbatement;
  let provincial = Math.max(0, bracketTax(amount, provincialBrackets) - provincialCredit);
  if (provinceCode === "ON") provincial = ontarioSurtax(provincial, year);
  return Math.round((federal + provincial) * 100) / 100;
}

export function marginalRate(income, provinceCode, year = latestTaxYear(), person = {}) {
  const base = taxOnIncome(income, provinceCode, year, person);
  const up = taxOnIncome(income + 1000, provinceCode, year, person);
  if (base == null || up == null) return null;
  return Math.round(((up - base) / 1000) * 10000) / 10000;
}

// Tax added by an inclusion on top of base income. basePension is eligible pension
// income already in the base; inclusionIsPension adds the inclusion to it.
export function taxOnInclusion(baseIncome, inclusion, provinceCode, year = latestTaxYear(), { age = 0, basePension = 0, inclusionIsPension = false } = {}) {
  const without = taxOnIncome(baseIncome, provinceCode, year, { age, pensionIncome: basePension });
  const withPension = basePension + (inclusionIsPension ? Math.max(0, inclusion) : 0);
  const withInclusion = taxOnIncome(baseIncome + inclusion, provinceCode, year, { age, pensionIncome: withPension });
  if (without == null || withInclusion == null) return null;
  const tax = Math.max(0, Math.round((withInclusion - without) * 100) / 100);
  const rate = inclusion > 0 ? tax / inclusion : 0;
  return { tax, rate };
}
