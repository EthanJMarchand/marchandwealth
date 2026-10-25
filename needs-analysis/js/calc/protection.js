// Needs only. These amounts do not choose a policy, a rider, or a carrier.

export function criticalIllnessLumpSum(annualEarnedIncome, replacementRatio, months) {
  const annual = Math.max(0, annualEarnedIncome) * Math.max(0, replacementRatio);
  return annual * (Math.max(0, months) / 12);
}

export function disabilityMonthlyBenefit(annualIncome, replacementRatio) {
  return (Math.max(0, annualIncome) * Math.max(0, replacementRatio)) / 12;
}
