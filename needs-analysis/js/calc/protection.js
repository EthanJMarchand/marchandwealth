// Needs only. These amounts do not choose a policy, a rider, or a carrier.

export function criticalIllnessLumpSum(annualEarnedIncome, replacementRatio, months) {
  const annual = Math.max(0, annualEarnedIncome) * Math.max(0, replacementRatio);
  return annual * (Math.max(0, months) / 12);
}

// Insurers typically cap individual disability income replacement at 70% of earned income.
export const DISABILITY_REPLACEMENT_CEILING = 0.7;

export function disabilityMonthlyBenefit(annualIncome, replacementRatio) {
  const ratio = Math.min(DISABILITY_REPLACEMENT_CEILING, Math.max(0, replacementRatio));
  return (Math.max(0, annualIncome) * ratio) / 12;
}
