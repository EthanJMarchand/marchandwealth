import assert from "node:assert/strict";
import { canadaInflation } from "../data/inflation-canada.js";
import { cppAmounts } from "../data/cpp-amounts.js";
import { oasAmounts } from "../data/oas-amounts.js";
import { planningAssumptions as assumptions } from "../data/planning-assumptions.js";
import { provinceOrder, probateFees } from "../data/probate-fees.js";
import { rrspLimits } from "../data/rrsp-limits.js";
import { tfsaAnnualLimits, tfsaContributionLimit } from "../data/tfsa-contribution-limit.js";
import { allocationOutcome, accountCoversGoal, requiredOutOfPocket } from "../js/calc/allocation.js";
import { projectFutureRoom, tfsaLimitForYear } from "../js/calc/contribution-room.js";
import { deflate, inflate, purchasingPowerPath, roundPercent, trailingAverage } from "../js/calc/inflation.js";
import { groupLimitYears, tfsaRoomEarned } from "../js/calc/tfsa-room.js";
import { deathTaxAtYear } from "../js/calc/death-tax.js";
import { calculateLifeNeed, endOfLifeFloor } from "../js/calc/life-need.js";
import { annuityPayment, presentValue, presentValueOfAnnuity, readMoney, savingsForFutureValue } from "../js/calc/money.js";
import { incomeReplacementYears, incomeYearsAtAge, projectLifeNeed } from "../js/calc/need-path.js";
import { CPP_FULL_CAREER_YEARS, cppContributionYears, estimateCpp, estimateOas } from "../js/calc/pensions.js";
import { calculateProbate } from "../js/calc/probate.js";
import { criticalIllnessLumpSum, disabilityMonthlyBenefit } from "../js/calc/protection.js";
import { calculateRetirement, taxableRetirementIncome } from "../js/calc/retirement.js";
import { depositsOverYears, describeDeposits, projectPortfolio } from "../js/calc/portfolio-path.js";
import { balanceAfterWithdrawals, balanceAtAge, wealthPath } from "../js/calc/wealth-path.js";
import { taxOnIncome, taxOnInclusion } from "../js/calc/tax.js";

let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`ok  ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

test("TFSA history starts in 2009 and the current annual limit is the latest year", () => {
  assert.equal(tfsaAnnualLimits[2009], 5000);
  assert.equal(tfsaContributionLimit.introducedYear, 2009);
  assert.equal(tfsaContributionLimit.annualDollarLimit, tfsaAnnualLimits[tfsaContributionLimit.taxYear]);
  assert.equal(tfsaContributionLimit.annualDollarLimit, 7000);
});

test("unused TFSA room is every limit since the year the person turned 18", () => {
  const full = tfsaRoomEarned({
    age: 42,
    taxYear: 2026,
    annualLimits: tfsaAnnualLimits,
  });
  assert.equal(full.firstYear, 2009);
  assert.equal(full.years.length, 18);
  assert.equal(full.total, 109000);

  const newer = tfsaRoomEarned({
    age: 20,
    taxYear: 2026,
    annualLimits: tfsaAnnualLimits,
  });
  assert.equal(newer.firstYear, 2024);
  assert.equal(newer.total, 21000);

  const notYet = tfsaRoomEarned({
    age: 17,
    taxYear: 2026,
    annualLimits: tfsaAnnualLimits,
  });
  assert.equal(notYet.total, 0);
  assert.deepEqual(groupLimitYears(newer.years), [{ from: 2024, to: 2026, limit: 7000 }]);
});

test("reads money typed with dollars and commas", () => {
  assert.equal(readMoney("$95,000"), 95000);
  assert.equal(readMoney(""), 0);
  assert.equal(readMoney("nope"), 0);
});

test("present value is payment times years when the rate is zero", () => {
  assert.equal(presentValueOfAnnuity(1000, 0, 10), 10000);
});

test("income replacement is income times the percent times the years", () => {
  const result = calculateLifeNeed({
    personalIncome: 100000,
    replacementRatio: 0.7,
    years: 10,
    dependantAges: [],
    independenceAge: 22,
    educationPerDependant: 0,
    debts: 0,
    finalExpenses: 0,
    existingLifeInsurance: 0,
    assetsAtDeath: 0,
  });
  assert.equal(result.annualIncomeNeed, 70000);
  assert.equal(result.incomeCapital, 700000);
  assert.equal(result.capitalNeed, 700000);
});

test("life capital need adds income, debts, expenses, and education, then subtracts offsets", () => {
  const incomeCapital = 66500 * 14;
  const result = calculateLifeNeed({
    personalIncome: 95000,
    replacementRatio: 0.7,
    years: 14,
    dependantAges: [8, 11],
    independenceAge: 22,
    educationPerDependant: 25000,
    debts: 320000,
    finalExpenses: 15000,
    existingLifeInsurance: 100000,
    assetsAtDeath: 40000,
  });

  assert.equal(result.annualIncomeNeed, 66500);
  assert.equal(result.educationCount, 2);
  assert.equal(result.incomeCapital, incomeCapital);
  assert.equal(result.capitalNeed, incomeCapital + 320000 + 15000 + 50000 - 140000);
  assert.ok(result.capitalNeed > 0);
});

test("life need cannot go below zero when offsets cover the gross need", () => {
  const result = calculateLifeNeed({
    personalIncome: 0,
    replacementRatio: 0.7,
    years: 0,
    dependantAges: [],
    independenceAge: 22,
    educationPerDependant: 0,
    debts: 1000,
    finalExpenses: 0,
    existingLifeInsurance: 5000,
    assetsAtDeath: 0,
    discountRate: 0.03,
  });
  assert.equal(result.capitalNeed, 0);
  assert.equal(result.surplus, 4000);
});

test("life insurance need stays at least the inflated final expenses and probate", () => {
  const covered = calculateLifeNeed({
    personalIncome: 0,
    replacementRatio: 0.7,
    years: 0,
    dependantAges: [],
    independenceAge: 22,
    educationPerDependant: 0,
    debts: 0,
    finalExpenses: 15000,
    existingLifeInsurance: 200000,
    assetsAtDeath: 0,
    discountRate: 0.03,
    probateFee: 750,
  });
  assert.equal(covered.capitalNeed, 15750);
  assert.equal(endOfLifeFloor(15000, 750, 3, 10), inflate(15000, 3, 10) + inflate(750, 3, 10));
});

test("tax on a non-registered account, the estate, and an RRSP stays in the life insurance need and grows", () => {
  const shared = {
    income: 95000,
    rrsp: 80000,
    nonReg: 100000,
    estate: 200000,
    province: "AB",
    savingsReturn: 0.03,
    inflationPercent: 3,
  };
  const today = deathTaxAtYear({ ...shared, rollover: false, years: 0 });
  const rolled = deathTaxAtYear({ ...shared, rollover: true, years: 0 });
  const later = deathTaxAtYear({ ...shared, rollover: false, years: 10 });
  assert.equal(today.nonRegInclusion, 50000);
  assert.equal(today.estateInclusion, 100000);
  assert.equal(today.rrspInclusion, 80000);
  assert.ok(today.rrspTax > 0);
  assert.equal(rolled.rrspTax, 0);
  assert.equal(rolled.rrspInclusion, 0);
  assert.ok(rolled.nonRegTax > 0);
  assert.ok(rolled.estateTax > 0);
  assert.ok(today.total > rolled.total);
  assert.ok(later.rrspBalance > today.rrspBalance);
  assert.ok(later.estateValue > today.estateValue);
  assert.ok(later.total > today.total);

  const covered = calculateLifeNeed({
    personalIncome: 0,
    replacementRatio: 0.7,
    years: 0,
    dependantAges: [],
    independenceAge: 22,
    educationPerDependant: 0,
    debts: 0,
    finalExpenses: 15000,
    existingLifeInsurance: 500000,
    assetsAtDeath: 0,
    probateFee: 750,
    deathTax: today.total,
  });
  assert.equal(covered.deathTax, today.total);
  assert.equal(covered.capitalNeed, 15750 + today.total);

  const path = projectLifeNeed({
    currentAge: 40,
    retirementAge: 65,
    incomeYearsAtStart: 0,
    personalIncome: 0,
    replacementRatio: 0,
    dependantAges: [],
    plannedChildren: 0,
    independenceAge: 22,
    educationPerDependant: 0,
    mortgage: 0,
    mortgageYears: 0,
    otherDebts: 0,
    futureMortgage: 0,
    yearsUntilPurchase: 0,
    amortizationYears: 0,
    finalExpenses: 0,
    probateFee: 0,
    inflationPercent: 3,
    existingLifeInsurance: 500000,
    assetsAtDeath: 0,
    taxAtYear: (elapsed) => deathTaxAtYear({ ...shared, rollover: false, years: elapsed }).total,
  }, 50);
  assert.equal(path[0].deathTax, today.total);
  assert.equal(path[0].capitalNeed, today.total);
  assert.ok(path[10].deathTax > path[0].deathTax);
  assert.equal(path[10].capitalNeed, path[10].deathTax);
});

test("retirement savings fund only the gap after pensions, in today's dollars", () => {
  const result = calculateRetirement({
    years: 23,
    desiredRetirementIncome: 98000,
    clientRetirementIncome: 66500,
    cppAnnual: 0,
    oasAnnual: 0,
    partnerCppAnnual: 0,
    partnerOasAnnual: 0,
    retirementAssets: 120000,
    savingsReturn: assumptions.realReturnBeforeRetirement,
    retirementReturn: assumptions.realReturnInRetirement,
    retirementYears: 17,
    recoveryThreshold: oasAmounts.recoveryThreshold,
    recoveryTaxRate: oasAmounts.recoveryTaxRate,
    tfsaHolders: 2,
    tfsaAnnualDollarLimit: tfsaContributionLimit.annualDollarLimit,
    unusedTfsaRoom: 0,
    rrspRoomThisYear: 0,
    partnerRrspRoomThisYear: 0,
    personalEarnedIncome: 95000,
    partnerEarnedIncome: 45000,
    hasPartner: true,
    rrspEarnedIncomePercent: rrspLimits.earnedIncomePercent,
    rrspNextYearDollarLimit: rrspLimits.nextYearDollarLimit,
  });

  const capitalNeeded = presentValueOfAnnuity(98000, 0.03, 17);
  const shortfall = capitalNeeded - 120000 * 1.03 ** 23;
  assert.equal(result.annualGap, 98000);
  assert.equal(result.capitalNeeded, capitalNeeded);
  assert.equal(result.capitalShortfall, shortfall);
  assert.equal(result.annualSavings, savingsForFutureValue(shortfall, 0.03, 23));
});

test("estimated returns compound as entered and are not reduced by inflation", () => {
  const result = calculateRetirement({
    years: 10,
    desiredRetirementIncome: 10000,
    clientRetirementIncome: 10000,
    cppAnnual: 0,
    oasAnnual: 0,
    partnerCppAnnual: 0,
    partnerOasAnnual: 0,
    retirementAssets: 100000,
    savingsReturn: 0.05,
    retirementReturn: 0.05,
    retirementYears: 20,
    recoveryThreshold: 0,
    recoveryTaxRate: 0,
    tfsaHolders: 1,
    tfsaAnnualDollarLimit: 7000,
    unusedTfsaRoom: 0,
    rrspRoomThisYear: 0,
    partnerRrspRoomThisYear: 0,
    personalEarnedIncome: 0,
    partnerEarnedIncome: 0,
    hasPartner: false,
    rrspEarnedIncomePercent: 0.18,
    rrspNextYearDollarLimit: 33810,
  });
  assert.equal(result.assetsAtRetirement, 100000 * 1.05 ** 10);
  assert.equal(result.capitalNeeded, presentValueOfAnnuity(10000, 0.05, 20));
  assert.equal(result.incomeFromAssets, annuityPayment(100000 * 1.05 ** 10, 0.05, 20));
  assert.equal(result.legacyAtDeath, 0);
});

test("a legacy is still there at death, and no legacy means the plan ends at zero", () => {
  const shared = {
    years: 20,
    clientRetirementIncome: 0,
    cppAnnual: 0,
    oasAnnual: 0,
    partnerCppAnnual: 0,
    partnerOasAnnual: 0,
    retirementAssets: 0,
    savingsReturn: 0.05,
    retirementReturn: 0.05,
    retirementYears: 20,
    recoveryThreshold: 0,
    recoveryTaxRate: 0,
    tfsaHolders: 1,
    tfsaAnnualDollarLimit: 7000,
    unusedTfsaRoom: 0,
    rrspRoomThisYear: 0,
    partnerRrspRoomThisYear: 0,
    personalEarnedIncome: 0,
    partnerEarnedIncome: 0,
    hasPartner: false,
    rrspEarnedIncomePercent: 0.18,
    rrspNextYearDollarLimit: 33810,
  };
  const none = calculateRetirement({ ...shared, desiredRetirementIncome: 10000 });
  assert.equal(none.capitalNeeded, presentValueOfAnnuity(10000, 0.05, 20));
  assert.equal(none.legacyAtRetirement, 0);
  const legacy = 100000;
  const reserved = presentValue(legacy, 0.05, 20);
  const withLegacy = calculateRetirement({ ...shared, desiredRetirementIncome: 10000, legacyAtDeath: legacy });
  assert.equal(withLegacy.legacyAtRetirement, reserved);
  assert.equal(withLegacy.capitalNeeded, presentValueOfAnnuity(10000, 0.05, 20) + reserved);
  assert.equal(withLegacy.annualSavings, savingsForFutureValue(withLegacy.capitalNeeded, 0.05, 20));
  const covered = calculateRetirement({
    ...shared,
    desiredRetirementIncome: 10000,
    legacyAtDeath: legacy,
    retirementAssets: withLegacy.capitalNeeded,
    years: 0,
  });
  assert.equal(covered.capitalShortfall, 0);
  assert.equal(covered.incomeFromAssets, 10000);
});

test("OAS repayment is 15% of income above the threshold, capped at OAS", () => {
  const oas = oasAmounts.maxMonthlyAge65to74 * 12;
  const cpp = cppAmounts.maxMonthlyRetirementAt65 * 12;
  const result = calculateRetirement({
    years: 10,
    desiredRetirementIncome: 120000,
    clientRetirementIncome: 100000,
    cppAnnual: cpp,
    oasAnnual: oas,
    partnerCppAnnual: 0,
    partnerOasAnnual: 0,
    retirementAssets: 0,
    savingsReturn: 0.03,
    retirementReturn: 0.03,
    retirementYears: 20,
    recoveryThreshold: 95323,
    recoveryTaxRate: 0.15,
    tfsaHolders: 1,
    tfsaAnnualDollarLimit: 7000,
    unusedTfsaRoom: 0,
    rrspRoomThisYear: 0,
    partnerRrspRoomThisYear: 0,
    personalEarnedIncome: 0,
    partnerEarnedIncome: 0,
    hasPartner: false,
    rrspEarnedIncomePercent: 0.18,
    rrspNextYearDollarLimit: 35390,
  });

  const excess = 100000 + cpp + oas - 95323;
  assert.equal(result.oasRepayment, Math.min(oas, 0.15 * excess));
  assert.ok(result.oasRepayment < oas);
});

test("a large income goal does not claw back OAS when the taxable income is only CPP and OAS", () => {
  const oas = oasAmounts.maxMonthlyAge65to74 * 12;
  const cpp = cppAmounts.maxMonthlyRetirementAt65 * 12;
  const result = calculateRetirement({
    years: 10,
    desiredRetirementIncome: 200000,
    clientRetirementIncome: 0,
    cppAnnual: cpp,
    oasAnnual: oas,
    partnerCppAnnual: 0,
    partnerOasAnnual: 0,
    retirementAssets: 0,
    savingsReturn: 0.03,
    retirementReturn: 0.03,
    retirementYears: 20,
    recoveryThreshold: 95323,
    recoveryTaxRate: 0.15,
    tfsaHolders: 1,
    tfsaAnnualDollarLimit: 7000,
    unusedTfsaRoom: 0,
    rrspRoomThisYear: 0,
    partnerRrspRoomThisYear: 0,
    personalEarnedIncome: 0,
    partnerEarnedIncome: 0,
    hasPartner: false,
    rrspEarnedIncomePercent: 0.18,
    rrspNextYearDollarLimit: 35390,
  });
  assert.equal(result.oasRepayment, 0);
  assert.ok(cpp + oas < 95323);
});

test("OAS income counts RRSP withdrawals and half of non-registered withdrawals, and leaves TFSA withdrawals out", () => {
  assert.equal(taxableRetirementIncome({ otherTaxable: 10000, rrspWithdrawal: 40000, nonRegisteredWithdrawal: 20000 }), 60000);
  assert.equal(taxableRetirementIncome({}), 0);
});

test("already retired means the shortfall is a lump sum, not an annual savings plan", () => {
  const result = calculateRetirement({
    years: 0,
    desiredRetirementIncome: 40000,
    clientRetirementIncome: 40000,
    cppAnnual: 0,
    oasAnnual: 0,
    partnerCppAnnual: 0,
    partnerOasAnnual: 0,
    retirementAssets: 100000,
    savingsReturn: 0.03,
    retirementReturn: 0.03,
    retirementYears: 25,
    recoveryThreshold: 95323,
    recoveryTaxRate: 0.15,
    tfsaHolders: 1,
    tfsaAnnualDollarLimit: 7000,
    unusedTfsaRoom: 12000,
    rrspRoomThisYear: 5000,
    partnerRrspRoomThisYear: 9000,
    personalEarnedIncome: 200000,
    partnerEarnedIncome: 80000,
    hasPartner: false,
    rrspEarnedIncomePercent: 0.18,
    rrspNextYearDollarLimit: 35390,
  });

  const capitalNeeded = presentValueOfAnnuity(40000, 0.03, 25);
  assert.equal(result.capitalNeeded, capitalNeeded);
  assert.equal(result.annualSavings, capitalNeeded - 100000);
});

test("inflation starts from the latest 100 yearly rates in the file", () => {
  assert.equal(canadaInflation.annualPercent[2025], 2.1);
  assert.equal(canadaInflation.annualPercent[1915], 1.7);
  const history = trailingAverage(canadaInflation.annualPercent, 100);
  assert.equal(history.count, 100);
  assert.equal(history.from, 1926);
  assert.equal(history.to, 2025);
  assert.equal(roundPercent(history.average), 3);
  assert.equal(Math.round(inflate(1000, 3, 23)), Math.round(1000 * 1.03 ** 23));
  assert.equal(Math.round(deflate(inflate(50000, 3, 10), 3, 10)), 50000);
});

test("a fixed yearly income loses buying power each year", () => {
  const path = purchasingPowerPath(100000, 3, 25);
  assert.equal(path.length, 26);
  assert.equal(path[0].elapsed, 0);
  assert.equal(path[0].buyingPower, 100000);
  assert.equal(path[25].buyingPower, deflate(100000, 3, 25));
  assert.ok(path[10].buyingPower < path[9].buyingPower);
  assert.equal(purchasingPowerPath(80000, 0, 10)[10].buyingPower, 80000);
});

test("probate fees follow the provincial schedules", () => {
  assert.equal(provinceOrder.length, 13);
  assert.equal(calculateProbate("AB", 0).fee, 0);
  assert.equal(calculateProbate("AB", 10000).fee, 35);
  assert.equal(calculateProbate("AB", 250001).fee, 525);
  assert.equal(calculateProbate("ON", 100000).fee, 750);
  assert.equal(calculateProbate("ON", 500000).fee, 6750);
  assert.equal(calculateProbate("ON", 1000000).fee, 14250);
  assert.equal(calculateProbate("BC", 25000).fee, 0);
  assert.equal(calculateProbate("BC", 100000).fee, 1050);
  assert.equal(calculateProbate("BC", 500000).fee, 6650);
  assert.equal(calculateProbate("NB", 100000).fee, 600);
  assert.equal(calculateProbate("SK", 100000).fee, 700);
  assert.equal(calculateProbate("NS", 250000).fee, 3545.15);
  assert.equal(calculateProbate("PE", 200000).fee, 800);
  assert.equal(calculateProbate("NL", 100000).fee, 654);
  assert.equal(calculateProbate("MB", 1000000).fee, 0);
  assert.equal(calculateProbate("QC", 500000).fee, 0);
  assert.equal(calculateProbate("QC", 500000, { courtVerification: true }).fee, probateFees.provinces.QC.verificationFee);
  assert.equal(calculateProbate("YT", 25000).fee, 0);
  assert.equal(calculateProbate("YT", 25001).fee, 140);
  assert.equal(calculateProbate("NT", 300000).fee, 435);
  assert.equal(calculateProbate("NU", 300000).fee, 425);
});

test("future room uses published limits first and does not repeat current room", () => {
  assert.equal(tfsaLimitForYear(2027, tfsaAnnualLimits, 2026, 0.03), 7000);
  assert.equal(tfsaLimitForYear(2028, tfsaAnnualLimits, 2026, 0.03), 7500);
  const room = projectFutureRoom({
    yearsOfWork: 2,
    taxYear: 2026,
    inflationRate: 0.03,
    personalIncome: 95000,
    partnerIncome: 0,
    hasPartner: false,
    clientAge: 42,
    partnerAge: null,
    tfsaLimits: tfsaAnnualLimits,
    rrspLimitsByYear: rrspLimits.dollarLimits,
    rrspPercent: 0.18,
  });
  assert.equal(room.years[0].roomYear, 2027);
  assert.equal(room.years[0].clientRrsp, 17100);
  assert.equal(room.years[0].dollarLimit, 35390);
  assert.equal(room.clientTfsa, 7000 + 7500);
  assert.ok(room.years[1].dollarLimit > 35390);
  assert.equal(room.years[1].dollarLimit % 10, 0);
});

test("the TFSA and RRSP slider uses current room before projected room", () => {
  const capped = allocationOutcome({
    annualSavings: 10000,
    rrspShare: 0,
    years: 1,
    savingsReturn: 0,
    inflationRate: 0,
    currentTfsaBalance: 0,
    currentRrspBalance: 0,
    currentTfsaRoom: 6000,
    currentRrspRoom: 20000,
    futureYears: [],
    taxNow: null,
  });
  assert.equal(capped.thisYear.tfsa, 6000);
  assert.equal(capped.thisYear.rrsp, 4000);
  assert.equal(capped.thisYear.unsheltered, 0);
  assert.equal(capped.tfsa, 6000);

  const later = allocationOutcome({
    annualSavings: 1000,
    rrspShare: 1,
    years: 2,
    savingsReturn: 0,
    inflationRate: 0,
    currentTfsaBalance: 0,
    currentRrspBalance: 5000,
    currentTfsaRoom: 0,
    currentRrspRoom: 0,
    futureYears: [{ clientTfsa: 0, partnerTfsa: 0, clientRrsp: 4000, partnerRrsp: 0 }],
    taxNow: 0.3,
  });
  assert.equal(later.usedJanuaryRoom, true);
  assert.ok(Math.abs(later.thisYear.rrsp - 1000 / 0.7) < 0.001);
  assert.equal(later.thisYear.unsheltered, 0);
  assert.ok(Math.abs(later.rrspDeposits - (2000 / 0.7)) < 0.01);
  assert.ok(later.thisYear.refund > 0);
});

test("a maxed-out year uses January room, and non-registered is only the overflow", () => {
  const fits = allocationOutcome({
    annualSavings: 10000,
    rrspShare: 0,
    years: 1,
    savingsReturn: 0,
    inflationRate: 0,
    currentTfsaBalance: 0,
    currentRrspBalance: 0,
    currentClientTfsaRoom: 0,
    currentPartnerTfsaRoom: 0,
    currentClientRrspRoom: 0,
    currentPartnerRrspRoom: 0,
    futureYears: [{ clientTfsa: 7000, partnerTfsa: 0, clientRrsp: 17100, partnerRrsp: 0 }],
    taxNow: 0.4,
  });
  assert.equal(fits.usedJanuaryRoom, true);
  assert.equal(fits.thisYear.tfsa, 7000);
  assert.equal(fits.thisYear.rrsp, 5000);
  assert.equal(fits.thisYear.unsheltered, 0);

  const overflow = allocationOutcome({
    annualSavings: 40000,
    rrspShare: 0,
    years: 1,
    savingsReturn: 0,
    inflationRate: 0,
    currentTfsaBalance: 0,
    currentRrspBalance: 0,
    currentClientTfsaRoom: 0,
    currentPartnerTfsaRoom: 0,
    currentClientRrspRoom: 0,
    currentPartnerRrspRoom: 0,
    futureYears: [{ clientTfsa: 7000, partnerTfsa: 0, clientRrsp: 17100, partnerRrsp: 0 }],
    taxNow: 0.4,
  });
  assert.equal(overflow.thisYear.tfsa, 7000);
  assert.equal(overflow.thisYear.rrsp, 17100);
  assert.equal(overflow.thisYear.unsheltered, 22740);
});

test("TFSA and RRSP deposits stay inside each person's room, including the refund", () => {
  const blocked = allocationOutcome({
    annualSavings: 50000,
    rrspShare: 1,
    years: 2,
    savingsReturn: 0,
    inflationRate: 0,
    currentTfsaBalance: 0,
    currentRrspBalance: 0,
    currentClientTfsaRoom: 7000,
    currentPartnerTfsaRoom: 7000,
    currentClientRrspRoom: 3000,
    currentPartnerRrspRoom: 4000,
    futureYears: [{ clientTfsa: 7000, partnerTfsa: 7000, clientRrsp: 5000, partnerRrsp: 5000 }],
    taxNow: 0.4,
  });
  const first = blocked.thisYear;
  assert.equal(first.clientRrsp, 3000);
  assert.equal(first.partnerRrsp, 4000);
  assert.equal(first.rrsp, 7000);
  assert.equal(first.refund, 2800);
  assert.equal(first.rrspFromSavings, 4200);
  assert.equal(first.clientTfsa, 7000);
  assert.equal(first.partnerTfsa, 7000);
  assert.equal(first.unsheltered, 31800);
  const second = blocked.yearly[1];
  assert.equal(second.clientRrsp, 5000);
  assert.equal(second.partnerRrsp, 5000);
  assert.equal(second.clientTfsa, 7000);
  assert.equal(second.partnerTfsa, 7000);
  assert.ok(second.rrsp <= 10000);
  assert.equal(second.rrspFromSavings + second.refund, second.rrsp);
});

test("years of income run until retirement or an earlier death", () => {
  assert.equal(incomeReplacementYears(42, 65, 82), 23);
  assert.equal(incomeReplacementYears(42, 65, 50), 8);
  assert.equal(incomeReplacementYears(70, 65, 82), 0);
});

test("income replacement holds until retirement is that close", () => {
  assert.equal(incomeYearsAtAge(30, 15, 70), 15);
  assert.equal(incomeYearsAtAge(54, 15, 70), 15);
  assert.equal(incomeYearsAtAge(55, 15, 70), 15);
  assert.equal(incomeYearsAtAge(56, 15, 70), 14);
  assert.equal(incomeYearsAtAge(65, 15, 70), 5);
  assert.equal(incomeYearsAtAge(70, 15, 70), 0);
  const path = projectLifeNeed({
    currentAge: 30,
    retirementAge: 70,
    incomeYearsAtStart: 15,
    personalIncome: 100000,
    replacementRatio: 0.7,
    dependantAges: [],
    plannedChildren: 0,
    independenceAge: 22,
    educationPerDependant: 0,
    mortgage: 0,
    mortgageYears: 0,
    otherDebts: 0,
    futureMortgage: 0,
    yearsUntilPurchase: 0,
    amortizationYears: 0,
    finalExpenses: 0,
    existingLifeInsurance: 0,
    assetsAtDeath: 0,
  }, 70);
  assert.equal(path[0].years, 15);
  assert.equal(path[0].incomeCapital, 1050000);
  assert.equal(path[10].years, 15);
  assert.equal(path[10].incomeCapital, 1050000);
  assert.equal(path[25].age, 55);
  assert.equal(path[25].years, 15);
  assert.equal(path[26].age, 56);
  assert.equal(path[26].years, 14);
  assert.equal(path[35].age, 65);
  assert.equal(path[35].years, 5);
  assert.equal(path[40].age, 70);
  assert.equal(path[40].years, 0);
});

test("the chart inflates living costs through the likely age at death and pays the mortgage down in a straight line", () => {
  const path = projectLifeNeed({
    currentAge: 30,
    retirementAge: 70,
    incomeYearsAtStart: 15,
    personalIncome: 100000,
    replacementRatio: 0.7,
    dependantAges: [],
    plannedChildren: 0,
    independenceAge: 22,
    educationPerDependant: 25000,
    mortgage: 200000,
    mortgageYears: 20,
    otherDebts: 0,
    futureMortgage: 0,
    yearsUntilPurchase: 0,
    amortizationYears: 0,
    finalExpenses: 15000,
    probateFee: 0,
    inflationPercent: 3,
    existingLifeInsurance: 0,
    assetsAtDeath: 0,
  }, 82);
  assert.equal(path.at(-1).age, 82);
  assert.equal(path[0].incomeCapital, 1050000);
  assert.equal(path[0].mortgageLeft, 200000);
  assert.equal(path[0].floor, 15000);
  assert.equal(path[10].mortgageLeft, 100000);
  assert.equal(path[20].mortgageLeft, 0);
  assert.equal(path[10].years, 15);
  assert.equal(path[10].incomeCapital, 1050000 * 1.03 ** 10);
  assert.equal(path[10].floor, 15000 * 1.03 ** 10);
  const atDeath = path.at(-1);
  assert.equal(atDeath.years, 0);
  assert.equal(atDeath.mortgageLeft, 0);
  assert.equal(atDeath.floor, 15000 * 1.03 ** 52);
  assert.equal(atDeath.capitalNeed, atDeath.floor);
});

test("the insurance path pays the mortgage down, and a future house stays out of the need", () => {
  const shared = {
    currentAge: 40,
    retirementAge: 65,
    deathAge: 82,
    incomeYearsAtStart: 25,
    personalIncome: 0,
    replacementRatio: 0.7,
    savingsReturn: 0,
    dependantAges: [],
    plannedChildren: 0,
    independenceAge: 22,
    educationPerDependant: 0,
    otherDebts: 0,
    finalExpenses: 0,
    existingLifeInsurance: 0,
    assetsAtDeath: 0,
    futureMortgage: 0,
    yearsUntilPurchase: 0,
    amortizationYears: 25,
  };
  const paying = projectLifeNeed({ ...shared, mortgage: 100000, mortgageYears: 10 }, 50);
  assert.equal(paying[0].mortgageLeft, 100000);
  assert.equal(paying[10].mortgageLeft, 0);
  const buying = projectLifeNeed({
    ...shared,
    mortgage: 0,
    mortgageYears: 0,
    futureMortgage: 200000,
    yearsUntilPurchase: 5,
    amortizationYears: 25,
  }, 46);
  assert.equal(buying[4].plannedLeft, 0);
  assert.equal(buying[5].plannedLeft, 200000);
  assert.equal(buying[5].debts, 0);
  assert.equal(buying[5].capitalNeed, buying[4].capitalNeed);
});

test("CPP and OAS guesses use earnings and years in Canada", () => {
  const maxCpp = Math.round(cppAmounts.maxMonthlyRetirementAt65 * 12 * 100) / 100;
  const full = CPP_FULL_CAREER_YEARS;
  assert.equal(cppContributionYears(42), 24);
  assert.equal(estimateCpp(cppAmounts.ympe, cppAmounts.ympe, maxCpp, full), maxCpp);
  assert.equal(estimateCpp(95000, cppAmounts.ympe, maxCpp, full), maxCpp);
  assert.equal(estimateCpp(95000, cppAmounts.ympe, maxCpp, 24), Math.round(maxCpp * (24 / full) * 100) / 100);
  assert.ok(estimateCpp(95000, cppAmounts.ympe, maxCpp, 24) < maxCpp * 0.7);
  assert.equal(estimateCpp(37300, cppAmounts.ympe, maxCpp, full), Math.round(maxCpp * 0.5 * 100) / 100);
  assert.equal(estimateCpp(95000, cppAmounts.ympe, maxCpp), 0);
  const maxOas = oasAmounts.maxMonthlyAge65to74 * 12;
  assert.equal(estimateOas(40, maxOas), maxOas);
  assert.equal(estimateOas(24, maxOas), Math.round(maxOas * 0.6 * 100) / 100);
});

test("combined tax uses federal and provincial brackets", () => {
  assert.equal(taxOnIncome(100000, "AB", 2026), 25472.01);
  const inclusion = taxOnInclusion(100000, 200000, "AB", 2026);
  assert.ok(inclusion.rate > 0.2);
  const quebec = taxOnIncome(100000, "QC", 2026);
  assert.equal(quebec, 30223.91);
  const ontario = taxOnIncome(300000, "ON", 2026);
  assert.ok(ontario > 110000);
});

test("critical illness is a lump sum and disability is a monthly amount", () => {
  assert.equal(criticalIllnessLumpSum(100000, 0.7, 12), 70000);
  assert.equal(criticalIllnessLumpSum(100000, 0.7, 18), 105000);
  assert.equal(disabilityMonthlyBenefit(120000, 0.7), 7000);
});

test("withdrawing the income gap leaves a surplus above the legacy", () => {
  const spent = wealthPath({
    opening: { tfsa: 100000, rrsp: 0, nonReg: 0 },
    balancesByAge: [{ age: 65, tfsa: 100000, rrsp: 0, nonReg: 0 }],
    currentAge: 64,
    retirementAge: 65,
    deathAge: 67,
    retirementReturn: 0,
    nonRegReturn: 0,
    annualWithdrawal: 50000,
  });
  assert.equal(spent[0].age, 64);
  assert.equal(spent[spent.length - 1].age, 67);
  assert.equal(spent[spent.length - 1].tfsa, 0);

  const rate = 0.05;
  const years = 10;
  const gap = 10000;
  const legacy = 50000;
  const funded = presentValueOfAnnuity(gap, rate, years) + presentValue(legacy, rate, years);
  const exact = wealthPath({
    opening: { tfsa: funded, rrsp: 0, nonReg: 0 },
    balancesByAge: [{ age: 65, tfsa: funded, rrsp: 0, nonReg: 0 }],
    currentAge: 64,
    retirementAge: 65,
    deathAge: 75,
    retirementReturn: rate,
    nonRegReturn: rate,
    annualWithdrawal: gap,
  });
  assert.ok(Math.abs(exact[exact.length - 1].tfsa - legacy) < 1);

  const surplusStart = funded * 2;
  const surplus = wealthPath({
    opening: { tfsa: surplusStart, rrsp: 0, nonReg: 0 },
    balancesByAge: [{ age: 65, tfsa: surplusStart, rrsp: 0, nonReg: 0 }],
    currentAge: 64,
    retirementAge: 65,
    deathAge: 75,
    retirementReturn: rate,
    nonRegReturn: rate,
    annualWithdrawal: gap,
  });
  const left = surplus[surplus.length - 1].tfsa;
  assert.ok(left > legacy + funded);
  assert.ok(Math.abs(left - balanceAfterWithdrawals(surplusStart, gap, rate, years)) < 1);
});

test("RRSP tax applies to the income withdrawal, and the legacy stays an account balance", () => {
  assert.equal(accountCoversGoal({
    tfsa: 0, rrsp: 100000, nonReg: 0, other: 0, futureTaxRate: 0.25,
    incomeCapital: 75000, legacyCapital: 0,
  }), true);
  assert.equal(accountCoversGoal({
    tfsa: 0, rrsp: 100000, nonReg: 0, other: 0, futureTaxRate: 0.25,
    incomeCapital: 0, legacyCapital: 100000,
  }), true);
  assert.equal(accountCoversGoal({
    tfsa: 0, rrsp: 100000, nonReg: 0, other: 0, futureTaxRate: 0.25,
    incomeCapital: 75000, legacyCapital: 25000,
  }), false);
  assert.equal(accountCoversGoal({
    tfsa: 0, rrsp: 125000, nonReg: 0, other: 0, futureTaxRate: 0.25,
    incomeCapital: 75000, legacyCapital: 25000,
  }), true);
});

test("a TFSA balance is not taxed at death, and an RRSP balance is", () => {
  const tfsa = deathTaxAtYear({ income: 80000, rrsp: 0, nonReg: 0, estate: 0, province: "AB", years: 0 });
  const rrsp = deathTaxAtYear({ income: 80000, rrsp: 400000, nonReg: 0, estate: 0, province: "AB", years: 0 });
  assert.equal(tfsa.total, 0);
  assert.ok(rrsp.total > 100000);
  const path = wealthPath({
    opening: { tfsa: 0, rrsp: 400000, nonReg: 0 },
    balancesByAge: [],
    currentAge: 50,
    retirementAge: 65,
    deathAge: 50,
    retirementReturn: 0.03,
    nonRegReturn: 0.03,
  });
  assert.equal(balanceAtAge(path, 50).rrsp, 400000);
});

test("RRSP tax savings are invested back into the RRSP", () => {
  const shared = {
    annualSavings: 1000,
    rrspShare: 1,
    years: 1,
    savingsReturn: 0,
    inflationRate: 0,
    currentTfsaBalance: 0,
    currentRrspBalance: 0,
    currentTfsaRoom: 0,
    currentRrspRoom: 10000,
    futureYears: [],
  };
  const grossed = allocationOutcome({ ...shared, taxNow: 0.3 });
  const untaxed = allocationOutcome({ ...shared, taxNow: 0 });
  assert.equal(untaxed.thisYear.rrsp, 1000);
  assert.ok(Math.abs(grossed.thisYear.rrsp - 1000 / 0.7) < 0.001);
  assert.equal(Math.round(grossed.thisYear.refund), Math.round(grossed.thisYear.rrsp * 0.3));
});

test("the same goal costs less out of pocket when the RRSP refund is worth more than the tax at withdrawal", () => {
  const shared = {
    years: 20,
    savingsReturn: 0.05,
    inflationRate: 0,
    currentTfsaBalance: 0,
    currentRrspBalance: 0,
    currentNonRegBalance: 0,
    nonRegReturn: 0.05,
    currentTfsaRoom: 1000000,
    currentRrspRoom: 1000000,
    currentOtherBalance: 0,
    futureYears: [],
  };
  const target = 100000;
  const tfsa = requiredOutOfPocket({ ...shared, rrspShare: 0, taxNow: 0.4, futureTaxRate: 0 }, target);
  const rrsp = requiredOutOfPocket({ ...shared, rrspShare: 1, taxNow: 0.4, futureTaxRate: 0.2 }, target);
  assert.ok(Math.abs(tfsa - savingsForFutureValue(target, 0.05, 20)) < 1);
  const grossContribution = savingsForFutureValue(target / 0.8, 0.05, 20);
  assert.ok(Math.abs(rrsp - grossContribution * 0.6) < 1);
  assert.ok(rrsp < tfsa);
});

test("the schedule reports this year's deposit and when the room is binding", () => {
  const open = projectPortfolio({
    currentAge: 40,
    retirementAge: 42,
    years: 3,
    tfsaAnnual: 12000,
    tfsaRoomNow: 100000,
    tfsaNewRoom: [7000, 7000],
    province: "AB",
  });
  assert.equal(open.deposits.tfsa, 12000);
  assert.equal(open.deposits.tfsaLimited, false);

  const capped = projectPortfolio({
    currentAge: 40,
    retirementAge: 65,
    years: 5,
    tfsaAnnual: 24000,
    tfsaRoomNow: 0,
    tfsaNewRoom: [7000, 7000, 7000, 7000, 7000],
    province: "AB",
  });
  assert.equal(capped.deposits.tfsa, capped.rows[0].tfsaIn);
  assert.ok(capped.deposits.tfsa < 24000);
  assert.equal(capped.deposits.tfsaLimited, true);

  const nextYear = projectPortfolio({
    currentAge: 40,
    retirementAge: 65,
    years: 4,
    startYear: 2026,
    tfsaAnnual: 14000,
    rrspAnnual: 5000,
    tfsaRoomNow: 0,
    rrspRoomNow: 0,
    tfsaNewRoom: [14000, 14000, 14000],
    rrspNewRoom: [5000, 5000, 5000],
    province: "AB",
  });
  const described = describeDeposits(nextYear.rows);
  assert.equal(described.accounts.tfsa.thisYear, 0);
  assert.equal(described.accounts.tfsa.later, 14000);
  assert.equal(described.accounts.tfsa.laterOffset, 1);
  assert.equal(described.accounts.rrsp.later, 5000);
  assert.equal(described.accounts.rrsp.laterOffset, 1);
  assert.equal(described.headline.offset, 1);
  assert.equal(described.headline.annual, 19000);
  assert.equal(described.headline.calendarYear, 2027);
});

test("TFSA and RRSP deposits stay at the slider until room runs out", () => {
  const capped = depositsOverYears({
    desiredAnnual: 12000,
    openingRoom: 0,
    newRoomByYear: [8000, 8000, 15000],
    years: 4,
  });
  assert.deepEqual(capped, [0, 8000, 8000, 12000]);

  const bank = depositsOverYears({
    desiredAnnual: 12000,
    openingRoom: 50000,
    newRoomByYear: Array(8).fill(7000),
    years: 6,
  });
  assert.equal(bank[0], 12000);
  assert.ok(bank.every((amount) => amount <= 12000));
  assert.ok(bank[1] === 12000);
});

test("withdrawals come from the RRSP, then non-registered, then the TFSA, then other assets", () => {
  const path = projectPortfolio({
    currentAge: 65,
    retirementAge: 65,
    years: 0,
    desiredIncomeToday: 10000,
    rrspOpening: 200000,
    nonRegOpening: 80000,
    tfsaOpening: 50000,
    otherOpening: 40000,
    province: "AB",
  });
  const row = path.rows[0];
  assert.ok(row.rrsp < 200000);
  assert.equal(row.nonReg, 80000);
  assert.equal(row.tfsa, 50000);
  assert.equal(row.other, 40000);
  assert.ok(row.withdrawal >= 9999);
});

test("a surplus stays invested and a shortfall reaches zero", () => {
  const surplus = projectPortfolio({
    currentAge: 70,
    retirementAge: 70,
    years: 5,
    desiredIncomeToday: 1000,
    tfsaOpening: 100000,
    province: "AB",
  });
  assert.equal(surplus.depletedAge, null);
  assert.ok(surplus.ending > 90000);

  const short = projectPortfolio({
    currentAge: 70,
    retirementAge: 70,
    years: 5,
    desiredIncomeToday: 10000,
    tfsaOpening: 1000,
    province: "AB",
  });
  assert.equal(short.depletedAge, 70);
  assert.equal(short.rows[short.rows.length - 1].total, 0);
});

test("CPP and OAS reduce what the accounts withdraw", () => {
  const shared = {
    currentAge: 70,
    retirementAge: 65,
    years: 4,
    desiredIncomeToday: 30000,
    rrspOpening: 200000,
    inflationRate: 0,
    retirementReturn: 0,
    savingsReturn: 0,
    province: "AB",
  };
  const alone = projectPortfolio(shared);
  const helped = projectPortfolio({ ...shared, clientCppToday: 12000, clientOasToday: 8000 });
  assert.ok(helped.rows[0].pension >= 18000);
  assert.ok(helped.rows[0].withdrawal < alone.rows[0].withdrawal - 10000);
  assert.ok(helped.ending > alone.ending);
});

test("CPP waits until each person is 60, and a younger spouse is left out", () => {
  const shared = {
    currentAge: 65,
    retirementAge: 65,
    years: 0,
    clientCppToday: 10000,
    clientOasToday: 8000,
    partnerCppToday: 10000,
    partnerOasToday: 8000,
    inflationRate: 0,
    province: "AB",
  };
  const partnerTooYoung = projectPortfolio({ ...shared, partnerAge: 48 });
  assert.equal(partnerTooYoung.rows[0].pension, 18000);
  const partnerCppOnly = projectPortfolio({ ...shared, partnerAge: 60 });
  assert.equal(partnerCppOnly.rows[0].pension, 28000);
  const bothOfAge = projectPortfolio({ ...shared, partnerAge: 65 });
  assert.equal(bothOfAge.rows[0].pension, 36000);
  const clientTooYoung = projectPortfolio({
    currentAge: 55,
    retirementAge: 55,
    years: 0,
    clientCppToday: 10000,
    clientOasToday: 8000,
    inflationRate: 0,
    province: "AB",
  });
  assert.equal(clientTooYoung.rows[0].pension, 0);
});

test("OAS starts at 65 and CPP counts from retirement", () => {
  const early = projectPortfolio({
    currentAge: 62,
    retirementAge: 60,
    years: 0,
    desiredIncomeToday: 40000,
    clientCppToday: 10000,
    clientOasToday: 8000,
    inflationRate: 0,
    province: "AB",
  });
  assert.equal(early.rows[0].pension, 10000);
  const later = projectPortfolio({
    currentAge: 65,
    retirementAge: 65,
    years: 0,
    desiredIncomeToday: 40000,
    clientCppToday: 10000,
    clientOasToday: 8000,
    inflationRate: 0,
    province: "AB",
  });
  assert.equal(later.rows[0].pension, 18000);
});

test("only the growth on other assets is taxed, and a rollover drops the RRSP death tax", () => {
  const flat = projectPortfolio({
    currentAge: 70,
    retirementAge: 70,
    years: 0,
    desiredIncomeToday: 5000,
    otherOpening: 100000,
    province: "AB",
  });
  assert.equal(flat.rows[0].tax, 0);

  const grown = projectPortfolio({
    currentAge: 70,
    retirementAge: 70,
    years: 0,
    otherReturn: 0.1,
    desiredIncomeToday: 200000,
    otherOpening: 100000,
    province: "AB",
  });
  assert.ok(grown.rows[0].tax > 0);

  const shared = {
    currentAge: 50,
    retirementAge: 70,
    years: 0,
    rrspOpening: 100000,
    province: "AB",
    workingIncomeToday: 90000,
  };
  const taxed = projectPortfolio(shared);
  const rolled = projectPortfolio({ ...shared, rollover: true });
  assert.ok(taxed.rows[0].deathTax > rolled.rows[0].deathTax);
  assert.equal(rolled.rows[0].deathTax, 0);
});

if (failed > 0) {
  process.exitCode = 1;
}
