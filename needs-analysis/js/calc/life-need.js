import { inflate } from "./inflation.js";

// Each year of income is paid, then the next year is higher by inflation.
// Year 1 is today's income. The last year has risen once for every year before it.
export function inflatedIncomeCapital(annualNeed, years, inflationPercent = 0) {
  const payment = Math.max(0, annualNeed);
  const count = Math.max(0, years);
  if (payment === 0 || count === 0) return 0;
  const rate = Number(inflationPercent) / 100;
  if (!(rate > 0)) return payment * count;
  return payment * (((1 + rate) ** count) - 1) / rate;
}

export function endOfLifeFloor(finalExpenses, probateFee, inflationPercent, years) {
  const elapsed = Math.max(0, years || 0);
  return inflate(Math.max(0, finalExpenses), inflationPercent, elapsed)
    + inflate(Math.max(0, probateFee), inflationPercent, elapsed);
}

export function calculateLifeNeed({
  personalIncome,
  replacementRatio,
  years,
  dependantAges,
  independenceAge,
  educationPerDependant,
  debts,
  finalExpenses,
  existingLifeInsurance,
  assetsAtDeath,
  probateFee = 0,
  deathTax = 0,
  inflationPercent = 0,
}) {
  const ages = dependantAges.filter((age) => Number.isFinite(age));
  const safeYears = Math.max(0, years);
  const annualIncomeNeed = Math.max(0, personalIncome) * Math.max(0, replacementRatio);
  const incomeCapital = inflatedIncomeCapital(annualIncomeNeed, safeYears, inflationPercent);
  const educationCount = ages.filter((age) => age < independenceAge).length;
  const educationCapital = educationCount * Math.max(0, educationPerDependant);
  const debtCapital = Math.max(0, debts);
  const tax = Math.max(0, deathTax);
  const floor = endOfLifeFloor(finalExpenses, probateFee, inflationPercent, 0) + tax;
  const grossNeed = incomeCapital + debtCapital + educationCapital + floor;
  const offsets = Math.max(0, existingLifeInsurance) + Math.max(0, assetsAtDeath);

  return {
    annualIncomeNeed,
    years: safeYears,
    incomeCapital,
    educationCount,
    educationCapital,
    debts: debtCapital,
    finalExpenses: Math.max(0, finalExpenses),
    probateFee: Math.max(0, probateFee),
    deathTax: tax,
    floor,
    grossNeed,
    existingLifeInsurance: Math.max(0, existingLifeInsurance),
    assetsAtDeath: Math.max(0, assetsAtDeath),
    offsets,
    capitalNeed: Math.max(floor, grossNeed - offsets),
    surplus: Math.max(0, offsets - (grossNeed - floor)),
  };
}
