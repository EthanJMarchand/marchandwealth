import { inflate } from "./inflation.js";

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
  const incomeCapital = annualIncomeNeed * safeYears;
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
