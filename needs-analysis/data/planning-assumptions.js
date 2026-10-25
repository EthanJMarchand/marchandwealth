// Defaults for a new worksheet. These are planning choices, not CRA or insurer figures.
// A case can override them. Figures are in today's dollars.
// Inflation is the slider, stored from data/inflation-canada.js. It is not a discount rate.
// realReturnBeforeRetirement is the default estimated rate of return while saving.
// realReturnInRetirement is the default estimated rate of return in retirement.
// Neither rate is reduced by inflation.
// Life insurance income replacement is income times the percent times the years. It is not discounted.

export const planningAssumptions = {
  survivorIncomeReplacement: 0.7,
  dependantIndependenceAge: 22,
  finalExpenses: 15000,
  educationFundPerDependant: 25000,
  retirementIncomeReplacement: 0.7,
  realReturnBeforeRetirement: 0.03,
  realReturnInRetirement: 0.03,
  childLifeInsuranceNeed: 25000,
  childCriticalIllnessNeed: 25000,
};
