import { taxBrackets } from "../../data/tax-brackets.js";

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

export function taxOnIncome(income, provinceCode, year = latestTaxYear()) {
  const federalBrackets = taxBrackets.federal[year];
  const provincialBrackets = taxBrackets.provinces[provinceCode]?.[year];
  if (!federalBrackets || !provincialBrackets) return null;
  let federal = bracketTax(income, federalBrackets);
  if (provinceCode === "QC") federal *= 1 - taxBrackets.quebecAbatement;
  let provincial = bracketTax(income, provincialBrackets);
  if (provinceCode === "ON") provincial = ontarioSurtax(provincial, year);
  return Math.round((federal + provincial) * 100) / 100;
}

export function marginalRate(income, provinceCode, year = latestTaxYear()) {
  const base = taxOnIncome(income, provinceCode, year);
  const up = taxOnIncome(income + 1000, provinceCode, year);
  if (base == null || up == null) return null;
  return Math.round(((up - base) / 1000) * 10000) / 10000;
}

export function taxOnInclusion(baseIncome, inclusion, provinceCode, year = latestTaxYear()) {
  const without = taxOnIncome(baseIncome, provinceCode, year);
  const withInclusion = taxOnIncome(baseIncome + inclusion, provinceCode, year);
  if (without == null || withInclusion == null) return null;
  const tax = Math.max(0, Math.round((withInclusion - without) * 100) / 100);
  const rate = inclusion > 0 ? tax / inclusion : 0;
  return { tax, rate };
}
