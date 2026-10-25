import { inflate } from "./inflation.js";
import { endOfLifeFloor } from "./life-need.js";

// Years of income to replace if death is at deathAge: from today until retirement,
// or until that death if it comes before retirement.
export function incomeReplacementYears(currentAge, retirementAge, deathAge) {
  if (![currentAge, retirementAge, deathAge].every((value) => Number.isFinite(value))) return 0;
  return Math.max(0, Math.min(retirementAge, deathAge) - currentAge);
}

// The years chosen stay in place until retirement is that close, then drop
// one year for each year of age. Age 30, retire at 70, 15 years of income:
// 15 years through age 55, 14 years at 56, and 5 years at 65.
export function incomeYearsAtAge(age, chosenYears, retirementAge) {
  const chosen = Math.max(0, chosenYears);
  if (!Number.isFinite(age) || !Number.isFinite(retirementAge)) return chosen;
  return Math.min(chosen, Math.max(0, retirementAge - age));
}

function mortgageRemaining(balance, yearsLeft, elapsed) {
  const principal = Math.max(0, balance);
  const term = Math.max(0, yearsLeft);
  if (principal === 0) return 0;
  if (term === 0) return principal;
  if (elapsed >= term) return 0;
  return principal * ((term - elapsed) / term);
}

function futureMortgageRemaining(amount, startYear, amortization, elapsed) {
  if (amount <= 0 || elapsed < startYear) return 0;
  return mortgageRemaining(amount, amortization, elapsed - startYear);
}

export function lifeNeedAtYear({
  elapsed,
  incomeYearsAtStart,
  currentAge,
  retirementAge,
  deathAge,
  personalIncome,
  replacementRatio,
  dependantAges,
  plannedChildren,
  independenceAge,
  educationPerDependant,
  mortgage,
  mortgageYears,
  otherDebts,
  futureMortgage,
  yearsUntilPurchase,
  amortizationYears,
  finalExpenses,
  probateFee = 0,
  deathTax = 0,
  taxAtYear,
  inflationPercent = 0,
  existingLifeInsurance,
  assetsAtDeath,
}) {
  const age = currentAge + elapsed;
  const years = Number.isFinite(incomeYearsAtStart)
    ? incomeYearsAtAge(age, incomeYearsAtStart, retirementAge)
    : incomeReplacementYears(age, retirementAge, deathAge);
  const annual = Math.max(0, personalIncome) * Math.max(0, replacementRatio);
  const priceRise = elapsed > 0 ? inflate(1, inflationPercent, elapsed) : 1;
  const incomeCapital = annual * years * priceRise;
  const mortgageLeft = mortgageRemaining(mortgage, mortgageYears, elapsed);
  const plannedLeft = futureMortgageRemaining(futureMortgage, yearsUntilPurchase, amortizationYears, elapsed);
  let educationCount = dependantAges.filter((childAge) => Number.isFinite(childAge) && childAge + elapsed < independenceAge).length;
  const spacing = 2;
  for (let index = 0; index < plannedChildren; index += 1) {
    const birthYear = 1 + index * spacing;
    if (elapsed >= birthYear && elapsed - birthYear < independenceAge) educationCount += 1;
  }
  const educationCapital = educationCount * Math.max(0, educationPerDependant) * priceRise;
  const debts = mortgageLeft + Math.max(0, otherDebts);
  const tax = typeof taxAtYear === "function"
    ? Math.max(0, taxAtYear(elapsed) || 0)
    : Math.max(0, deathTax);
  const floor = endOfLifeFloor(finalExpenses, probateFee, inflationPercent, elapsed) + tax;
  const gross = incomeCapital + debts + educationCapital + floor;
  const offsets = Math.max(0, existingLifeInsurance) + Math.max(0, assetsAtDeath);
  return {
    elapsed,
    age,
    years,
    incomeCapital,
    mortgageLeft,
    plannedLeft,
    educationCount,
    educationCapital,
    debts,
    deathTax: tax,
    floor,
    capitalNeed: Math.max(floor, gross - offsets),
  };
}

export function projectLifeNeed(input, untilAge) {
  const start = input.currentAge;
  const end = Math.max(start, untilAge);
  const points = [];
  for (let age = Math.floor(start); age <= end; age += 1) {
    points.push(lifeNeedAtYear({ ...input, elapsed: age - start }));
  }
  return points;
}
