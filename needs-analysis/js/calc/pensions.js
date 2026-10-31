// CPP averages earnings over the contributory period, from 18 to the month the pension
// starts, after dropping the lowest 17% of those years. The pension starts at the later
// of retirement and 60, capped at 70. A full share needs work in the other 83%.
export const CPP_DROPOUT = 0.17;

export function cppCareerShare(stopAge) {
  if (!Number.isFinite(stopAge)) return 0;
  const start = Math.min(70, Math.max(60, Math.floor(stopAge)));
  const worked = Math.max(0, Math.min(stopAge, start) - 18);
  const counted = (start - 18) * (1 - CPP_DROPOUT);
  return Math.min(1, worked / counted);
}

export function estimateCpp(averageIncome, ympe, maxAnnual, careerShare = 0) {
  if (ympe <= 0 || maxAnnual <= 0) return 0;
  const earningsRatio = Math.min(1, Math.max(0, averageIncome) / ympe);
  const share = Math.min(1, Math.max(0, careerShare));
  return Math.round(earningsRatio * share * maxAnnual * 100) / 100;
}

// OAS needs at least 10 years in Canada after 18; 40 years is the full pension.
export function estimateOas(yearsInCanadaAfter18, maxAnnual) {
  const years = Math.min(40, Math.max(0, Math.floor(yearsInCanadaAfter18)));
  if (years < 10) return 0;
  return Math.round((years / 40) * Math.max(0, maxAnnual) * 100) / 100;
}

export function residenceYearsFromAge(age) {
  if (!Number.isFinite(age)) return 0;
  return Math.max(0, Math.min(40, Math.floor(age - 18)));
}
