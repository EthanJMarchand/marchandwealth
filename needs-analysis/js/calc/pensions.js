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

// Start-age adjustments from Canada.ca, "When to start your public pensions".
// CPP: −0.6% per month before 65, from age 60, and +0.7% per month after 65, to age 70.
// OAS cannot start before 65. It rises 0.6% per month after 65, to 36% at 70.
export const CPP_MIN_START = 60;
export const CPP_STANDARD_START = 65;
export const CPP_MAX_START = 70;
export const OAS_MIN_START = 65;
export const OAS_MAX_START = 70;

export function cppStartAge(retirementAge) {
  const age = Number(retirementAge);
  if (!Number.isFinite(age)) return CPP_STANDARD_START;
  return Math.min(CPP_MAX_START, Math.max(CPP_MIN_START, age));
}

export function oasStartAge(retirementAge) {
  const age = Number(retirementAge);
  if (!Number.isFinite(age)) return OAS_MIN_START;
  return Math.min(OAS_MAX_START, Math.max(OAS_MIN_START, age));
}

function startThousandths(months, earlyPerMonth, latePerMonth) {
  return months <= 0 ? months * earlyPerMonth : months * latePerMonth;
}

export function cppStartChangePercent(retirementAge) {
  const months = Math.round((cppStartAge(retirementAge) - CPP_STANDARD_START) * 12);
  return startThousandths(months, 6, 7) / 10;
}

export function oasStartChangePercent(retirementAge) {
  const months = Math.round((oasStartAge(retirementAge) - OAS_MIN_START) * 12);
  return Math.max(0, months) * 6 / 10;
}

function adjustForThousandths(amountAt65, thousandths) {
  return Math.round(Math.max(0, amountAt65) * (1000 + thousandths) / 10) / 100;
}

export function adjustCppForStart(amountAt65, retirementAge) {
  const months = Math.round((cppStartAge(retirementAge) - CPP_STANDARD_START) * 12);
  return adjustForThousandths(amountAt65, startThousandths(months, 6, 7));
}

export function adjustOasForStart(amountAt65, retirementAge) {
  const months = Math.max(0, Math.round((oasStartAge(retirementAge) - OAS_MIN_START) * 12));
  return adjustForThousandths(amountAt65, months * 6);
}
