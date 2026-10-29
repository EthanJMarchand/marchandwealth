// A full age-65 CPP takes about 39 years at the YMPE: the span from 18 to 65,
// after the general 17% dropout. One year at the cap is not that history.
export const CPP_FULL_CAREER_YEARS = 39;

export function cppContributionYears(age) {
  if (!Number.isFinite(age)) return 0;
  return Math.max(0, Math.floor(age - 18));
}

export function estimateCpp(averageIncome, ympe, maxAnnual, contributionYears = 0) {
  if (ympe <= 0 || maxAnnual <= 0) return 0;
  const earningsRatio = Math.min(1, Math.max(0, averageIncome) / ympe);
  const careerRatio = Math.min(1, Math.max(0, contributionYears) / CPP_FULL_CAREER_YEARS);
  return Math.round(earningsRatio * careerRatio * maxAnnual * 100) / 100;
}

export function estimateOas(yearsInCanadaAfter18, maxAnnual) {
  const years = Math.min(40, Math.max(0, yearsInCanadaAfter18));
  return Math.round((years / 40) * Math.max(0, maxAnnual) * 100) / 100;
}

export function residenceYearsFromAge(age) {
  if (!Number.isFinite(age)) return 0;
  return Math.max(0, Math.min(40, Math.floor(age - 18)));
}

// Assumes last year's employment income keeps going until retirement, and contributions
// stop at 65. Someone already past 65 keeps the years already earned.
export function projectedCppYears(age, retirementAge) {
  if (Number.isFinite(age) && age > 65) return cppContributionYears(age);
  const retire = Number.isFinite(retirementAge) ? retirementAge : 65;
  const end = Math.max(Number.isFinite(age) ? age : 18, Math.min(Math.max(retire, 18), 65));
  return Math.max(0, Math.floor(end - 18));
}

// Assumes residence in Canada from 18 through the later of retirement and 65.
export function projectedOasYears(age, retirementAge) {
  if (Number.isFinite(age) && age >= 65) return residenceYearsFromAge(age);
  const retire = Number.isFinite(retirementAge) ? retirementAge : 65;
  const end = Math.max(Number.isFinite(age) ? age : 18, retire, 65);
  return Math.min(40, Math.max(0, Math.floor(end - 18)));
}
