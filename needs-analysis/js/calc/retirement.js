import { annuityPayment, futureValue, presentValue, presentValueOfAnnuity, savingsForFutureValue } from "./money.js";

// Amounts are in today's dollars. The savings return and the retirement return
// are the estimated rates from the worksheet, used as entered. Inflation is not
// taken off either rate. Public pensions are amounts the advisor entered.
// OAS repayment is a screen: 15% of (client share + CPP + gross OAS − threshold),
// capped at the OAS entered. It uses the threshold stored for the current year
// against today's-dollar income, so it is not a future-year forecast.
export function calculateRetirement({
  years,
  desiredRetirementIncome,
  clientRetirementIncome,
  cppAnnual,
  oasAnnual,
  partnerCppAnnual,
  partnerOasAnnual,
  retirementAssets,
  savingsReturn,
  retirementReturn,
  retirementYears,
  legacyAtDeath = 0,
  recoveryThreshold,
  recoveryTaxRate,
}) {
  const horizon = Math.max(0, years);
  const desired = Math.max(0, desiredRetirementIncome);
  const cpp = Math.max(0, cppAnnual);
  const oasGross = Math.max(0, oasAnnual);
  const partnerCpp = Math.max(0, partnerCppAnnual);
  const partnerOas = Math.max(0, partnerOasAnnual);
  const netIncomeProxy = Math.max(0, clientRetirementIncome) + cpp + oasGross;
  let oasRepayment = 0;
  if (recoveryThreshold > 0 && netIncomeProxy > recoveryThreshold) {
    oasRepayment = Math.min(oasGross, recoveryTaxRate * (netIncomeProxy - recoveryThreshold));
  }
  const oasNet = oasGross - oasRepayment;
  const pensionIncome = cpp + oasNet + partnerCpp + partnerOas;
  const annualGap = Math.max(0, desired - pensionIncome);
  const drawYears = Math.max(0, retirementYears);
  const drawRate = Number.isFinite(retirementReturn) ? retirementReturn : 0;
  const legacy = Math.max(0, legacyAtDeath);
  const legacyAtRetirement = presentValue(legacy, drawRate, drawYears);
  const incomeCapital = presentValueOfAnnuity(annualGap, drawRate, drawYears);
  const capitalNeeded = incomeCapital + legacyAtRetirement;
  const assetsAtRetirement = futureValue(Math.max(0, retirementAssets), savingsReturn, horizon);
  // Capacity if the surplus above the legacy were spent. The plan withdraws annualGap
  // and leaves any larger balance invested, so this is not the illustrated income.
  const spendableAssets = Math.max(0, assetsAtRetirement - legacyAtRetirement);
  const incomeFromAssets = annuityPayment(spendableAssets, drawRate, drawYears);
  const annualShortfall = Math.max(0, annualGap - incomeFromAssets);
  const capitalShortfall = Math.max(0, capitalNeeded - assetsAtRetirement);

  return {
    years: horizon,
    desired,
    cpp,
    oasGross,
    oasRepayment,
    oasNet,
    partnerCpp,
    partnerOas,
    pensionIncome,
    annualGap,
    retirementReturn: drawRate,
    retirementYears: drawYears,
    legacyAtDeath: legacy,
    legacyAtRetirement,
    incomeCapital,
    capitalNeeded,
    assetsAtRetirement,
    incomeFromAssets,
    annualShortfall,
    monthlyShortfall: annualShortfall / 12,
    capitalShortfall,
    annualSavings: horizon > 0 ? savingsForFutureValue(capitalShortfall, savingsReturn, horizon) : capitalShortfall,
  };
}
