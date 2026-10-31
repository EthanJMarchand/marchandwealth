import assert from "node:assert/strict";
import { canadaInflation } from "../data/inflation-canada.js";
import { cppAmounts } from "../data/cpp-amounts.js";
import { oasAmounts } from "../data/oas-amounts.js";
import { planningAssumptions as assumptions } from "../data/planning-assumptions.js";
import { provinceOrder, probateFees } from "../data/probate-fees.js";
import { rrspLimits } from "../data/rrsp-limits.js";
import { tfsaAnnualLimits, tfsaContributionLimit } from "../data/tfsa-contribution-limit.js";
import { projectFutureRoom, tfsaLimitForYear } from "../js/calc/contribution-room.js";
import { deflate, inflate, purchasingPowerPath, roundPercent, trailingAverage } from "../js/calc/inflation.js";
import { groupLimitYears, tfsaRoomEarned } from "../js/calc/tfsa-room.js";
import { deathTaxAtYear } from "../js/calc/death-tax.js";
import { calculateLifeNeed, endOfLifeFloor } from "../js/calc/life-need.js";
import { annuityPayment, presentValue, presentValueOfAnnuity, readMoney, savingsForFutureValue } from "../js/calc/money.js";
import { incomeReplacementYears, incomeYearsAtAge, projectLifeNeed } from "../js/calc/need-path.js";
import { cppCareerShare, estimateCpp, estimateOas } from "../js/calc/pensions.js";
import { calculateProbate } from "../js/calc/probate.js";
import { criticalIllnessLumpSum, disabilityMonthlyBenefit } from "../js/calc/protection.js";
import { calculateRetirement } from "../js/calc/retirement.js";
import { depositsOverYears, describeDeposits, projectPortfolio, withdrawProRataTaxable } from "../js/calc/portfolio-path.js";
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

test("existing coverage can reduce the life insurance gap to zero, including final expenses", () => {
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
  assert.equal(covered.floor, 15750);
  assert.equal(covered.grossNeed, 15750);
  assert.equal(covered.capitalNeed, 0);
  assert.equal(covered.surplus, 200000 - 15750);
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
  assert.equal(covered.grossNeed, 15750 + today.total);
  assert.equal(covered.capitalNeed, 0);

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
  assert.equal(path[0].capitalNeed, 0);
  assert.ok(path[10].deathTax > path[0].deathTax);
  assert.equal(path[10].capitalNeed, 0);
});

test("education stays on the need path until each child reaches the independence age, then comes off", () => {
  const path = projectLifeNeed({
    currentAge: 42,
    retirementAge: 65,
    incomeYearsAtStart: 0,
    personalIncome: 0,
    replacementRatio: 0,
    dependantAges: [8, 11],
    plannedChildren: 0,
    independenceAge: 22,
    educationPerDependant: 25000,
    mortgage: 0,
    mortgageYears: 0,
    otherDebts: 0,
    futureMortgage: 0,
    yearsUntilPurchase: 0,
    amortizationYears: 0,
    finalExpenses: 0,
    probateFee: 0,
    inflationPercent: 0,
    existingLifeInsurance: 0,
    assetsAtDeath: 0,
  }, 60);
  assert.equal(path[0].age, 42);
  assert.equal(path[0].educationCount, 2);
  assert.equal(path[0].educationCapital, 50000);
  // Child aged 11 reaches 22 when the parent is 53.
  assert.equal(path[10].age, 52);
  assert.equal(path[10].educationCount, 2);
  assert.equal(path[10].educationCapital, 50000);
  assert.equal(path[11].age, 53);
  assert.equal(path[11].educationCount, 1);
  assert.equal(path[11].educationCapital, 25000);
  // Child aged 8 reaches 22 when the parent is 56.
  assert.equal(path[13].age, 55);
  assert.equal(path[13].educationCount, 1);
  assert.equal(path[14].age, 56);
  assert.equal(path[14].educationCount, 0);
  assert.equal(path[14].educationCapital, 0);
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
  // Work from 18 to 65: 47 years, 17% dropped, so the full share is reached.
  assert.equal(cppCareerShare(65), 1);
  // Retire at 60 and start then: 42 years, 34.86 counted, all worked.
  assert.equal(cppCareerShare(60), 1);
  // Stop at 50, start at 60: 32 years worked of 34.86 counted.
  assert.ok(Math.abs(cppCareerShare(50) - 32 / (42 * 0.83)) < 1e-9);
  assert.equal(estimateCpp(cppAmounts.ympe, cppAmounts.ympe, maxCpp, 1), maxCpp);
  assert.equal(estimateCpp(95000, cppAmounts.ympe, maxCpp, 1), maxCpp);
  assert.equal(estimateCpp(95000, cppAmounts.ympe, maxCpp, 0.5), Math.round(maxCpp * 0.5 * 100) / 100);
  assert.equal(estimateCpp(37300, cppAmounts.ympe, maxCpp, 1), Math.round(maxCpp * 0.5 * 100) / 100);
  assert.equal(estimateCpp(95000, cppAmounts.ympe, maxCpp), 0);
  const maxOas = oasAmounts.maxMonthlyAge65to74 * 12;
  assert.equal(estimateOas(40, maxOas), maxOas);
  assert.equal(estimateOas(24, maxOas), Math.round(maxOas * 0.6 * 100) / 100);
  assert.equal(estimateOas(10, maxOas), Math.round(maxOas * 0.25 * 100) / 100);
  assert.equal(estimateOas(9, maxOas), 0);
});

test("combined tax uses federal and provincial brackets less the basic personal credits", () => {
  // Federal 16,696.01 - 16,452 x 14%; Alberta 8,776 - 22,769 x 8%.
  assert.equal(taxOnIncome(100000, "AB", 2026), 21347.21);
  const inclusion = taxOnInclusion(100000, 200000, "AB", 2026);
  assert.ok(inclusion.rate > 0.2);
  const quebec = taxOnIncome(100000, "QC", 2026);
  // Federal (16,696.01 - 2,303.28) less the 16.5% abatement; Quebec 16,282.75 - 18,952 x 14%.
  assert.equal(quebec, 25647.4);
  const ontario = taxOnIncome(300000, "ON", 2026);
  assert.ok(ontario > 110000);
});

test("seniors get the age and pension income credits, and the age amount fades with income", () => {
  // CPP and OAS only: basic and age credits. Federal 4,200 - (16,452 + 9,208) x 14%; Alberta 2,400 - (22,769 + 6,345) x 8%.
  assert.equal(taxOnIncome(30000, "AB", 2026, { age: 66 }), 678.48);
  // Under 65: no age amount. Federal 4,200 - 2,303.28; Alberta 2,400 - 1,821.52.
  assert.equal(taxOnIncome(30000, "AB", 2026, { age: 64 }), 2475.2);
  const withPension = taxOnIncome(30000, "AB", 2026, { age: 66, pensionIncome: 10000 });
  // Credits are non-refundable: Alberta's 70.88 can't go below zero, federal is 607.60 - 2,000 x 14%.
  assert.equal(withPension, 327.6);
  // Above $107,819 federal and $89,534 Alberta, the age amount is gone.
  assert.equal(taxOnIncome(120000, "AB", 2026, { age: 70 }), taxOnIncome(120000, "AB", 2026, { age: 50 }));
  assert.equal(taxOnIncome(15000, "AB", 2026, { age: 70 }), 0);
});

test("critical illness is a lump sum and disability is a monthly amount", () => {
  assert.equal(criticalIllnessLumpSum(100000, 0.7, 12), 70000);
  assert.equal(criticalIllnessLumpSum(100000, 0.7, 18), 105000);
  assert.equal(disabilityMonthlyBenefit(120000, 0.7), 7000);
  assert.equal(disabilityMonthlyBenefit(120000, 0.9), 7000);
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

test("withdrawals take Other, non-registered, and RRSP together, and leave the TFSA until that pool is gone", () => {
  const path = projectPortfolio({
    currentAge: 65,
    retirementAge: 65,
    years: 0,
    desiredIncomeToday: 100000,
    inflationRate: 0,
    retirementReturn: 0,
    savingsReturn: 0,
    otherReturn: 0,
    rrspOpening: 200000,
    nonRegOpening: 300000,
    tfsaOpening: 50000,
    otherOpening: 500000,
    province: "AB",
  });
  const row = path.rows[0];
  assert.ok(row.other < 500000);
  assert.ok(row.nonReg < 300000);
  assert.ok(row.rrsp < 200000);
  assert.equal(row.tfsa, 50000);
  assert.ok(row.withdrawal >= 99999);

  // A $100k shortfall from $500k / $300k / $200k targets 50 / 30 / 20 of net.
  // Other and non-registered with full cost base have no gain tax; the RRSP is taxed, so its gross draw is larger.
  const proportional = withdrawProRataTaxable({
    other: 500000,
    otherAcb: 500000,
    nonReg: 300000,
    nonRegAcb: 300000,
    rrsp: 200000,
    need: 100000,
    base: 0,
    factor: 1,
    province: "AB",
  });
  assert.ok(Math.abs((500000 - proportional.other) - 50000) < 1);
  assert.ok(Math.abs((300000 - proportional.nonReg) - 30000) < 1);
  assert.ok((200000 - proportional.rrsp) >= 20000);
  assert.ok(proportional.need < 1);

  const tfsaLast = projectPortfolio({
    currentAge: 65,
    retirementAge: 65,
    years: 0,
    desiredIncomeToday: 10000,
    inflationRate: 0,
    retirementReturn: 0,
    savingsReturn: 0,
    otherReturn: 0,
    rrspOpening: 0,
    nonRegOpening: 0,
    tfsaOpening: 50000,
    otherOpening: 0,
    province: "AB",
  });
  assert.ok(tfsaLast.rows[0].tfsa < 50000);
  assert.ok(tfsaLast.rows[0].withdrawal >= 9999);
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

test("CPP waits until each person is 60, is reduced when it starts early, and a younger spouse is left out", () => {
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
  assert.equal(partnerCppOnly.rows[0].pension, 18000 + 10000 * 0.64);
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
  assert.equal(early.rows[0].pension, 10000 * 0.64);
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

test("retiring at 70 defers CPP and OAS for larger amounts, and OAS rises 10% at 75", () => {
  const deferred = projectPortfolio({
    currentAge: 70,
    retirementAge: 70,
    years: 5,
    clientCppToday: 10000,
    clientOasToday: 8000,
    inflationRate: 0,
    province: "AB",
  });
  assert.ok(Math.abs(deferred.rows[0].pension - (10000 * 1.42 + 8000 * 1.36)) < 0.01);
  assert.ok(Math.abs(deferred.rows[5].pension - (10000 * 1.42 + 8000 * 1.36 * 1.1)) < 0.01);
});

test("other retirement income reduces what the accounts withdraw", () => {
  const shared = {
    currentAge: 65,
    retirementAge: 65,
    years: 1,
    desiredIncomeToday: 40000,
    rrspOpening: 500000,
    inflationRate: 0,
    retirementReturn: 0,
    province: "AB",
  };
  const alone = projectPortfolio(shared);
  const pension = projectPortfolio({ ...shared, otherIncomeToday: 20000 });
  assert.ok(pension.rows[0].withdrawal < alone.rows[0].withdrawal - 15000);
  assert.ok(Math.abs(pension.rows[0].incomeTaken - 40000) < 1);
  // $20,000 of pension at 65 in Alberta is under the basic, age, and pension credits.
  assert.equal(pension.rows[0].otherNet, 20000);
  assert.equal(pension.rows[0].pensionNet, 0);
});

test("each spouse's CPP and OAS is taxed on that spouse's own return", () => {
  const shared = { currentAge: 65, retirementAge: 65, years: 0, inflationRate: 0, province: "AB" };
  const single = projectPortfolio({ ...shared, clientCppToday: 100000, clientOasToday: 20000 });
  const couple = projectPortfolio({
    ...shared,
    clientCppToday: 50000,
    clientOasToday: 10000,
    partnerCppToday: 50000,
    partnerOasToday: 10000,
    partnerAge: 65,
  });
  assert.equal(single.rows[0].pension, couple.rows[0].pension);
  assert.ok(couple.rows[0].pensionNet > single.rows[0].pensionNet + 1000);
});

test("a couple's RRIF withdrawals are split evenly between both returns", () => {
  const shared = {
    currentAge: 65,
    retirementAge: 65,
    years: 0,
    desiredIncomeToday: 90000,
    rrspOpening: 1500000,
    inflationRate: 0,
    retirementReturn: 0,
    province: "AB",
  };
  const single = projectPortfolio(shared);
  const couple = projectPortfolio({ ...shared, partnerAge: 65 });
  assert.ok(Math.abs(couple.rows[0].incomeTaken - 90000) < 1);
  // Two returns at $45,000 each, with age and pension credits, instead of one at $90,000.
  assert.ok(couple.rows[0].tax < single.rows[0].tax / 2);
});

test("RRSP withdrawals count toward the OAS recovery tax", () => {
  const shared = {
    currentAge: 66,
    retirementAge: 65,
    years: 0,
    clientCppToday: 18000,
    clientOasToday: 9000,
    rrspOpening: 3000000,
    inflationRate: 0,
    oasRecoveryThreshold: 95323,
    oasRecoveryRate: 0.15,
    province: "AB",
  };
  const modest = projectPortfolio({ ...shared, desiredIncomeToday: 30000 });
  const large = projectPortfolio({ ...shared, desiredIncomeToday: 120000 });
  assert.equal(modest.rows[0].pension, 27000);
  assert.ok(large.rows[0].pension < 27000 - 1000);
  assert.ok(Math.abs(large.rows[0].incomeTaken - 120000) < 1);
});

test("retirement income requested rises with inflation, and accounts only top up a shortfall after CPP and OAS", () => {
  const covered = projectPortfolio({
    currentAge: 70,
    retirementAge: 65,
    years: 2,
    desiredIncomeToday: 10000,
    clientCppToday: 20000,
    clientOasToday: 8000,
    inflationRate: 0,
    retirementReturn: 0,
    savingsReturn: 0,
    rrspOpening: 100000,
    province: "AB",
  });
  const row = covered.rows[0];
  assert.equal(row.incomeRequested, 10000);
  assert.ok(row.pensionNet > 10000);
  assert.equal(row.withdrawal, 0);
  assert.equal(row.incomeTaken, row.pensionNet);
  assert.equal(row.rrsp, 100000);

  const shortfall = projectPortfolio({
    currentAge: 65,
    retirementAge: 65,
    years: 2,
    desiredIncomeToday: 50000,
    clientCppToday: 10000,
    clientOasToday: 8000,
    inflationRate: 0.03,
    retirementReturn: 0,
    savingsReturn: 0,
    otherReturn: 0,
    otherOpening: 500000,
    province: "AB",
  });
  assert.equal(shortfall.rows[0].incomeRequested, 50000);
  assert.ok(shortfall.rows[0].withdrawal > 0);
  assert.ok(Math.abs(shortfall.rows[0].incomeTaken - (shortfall.rows[0].pensionNet + shortfall.rows[0].withdrawal)) < 0.01);
  assert.ok(Math.abs(shortfall.rows[0].incomeTaken - 50000) < 1);
  assert.ok(Math.abs(shortfall.rows[1].incomeRequested - 50000 * 1.03) < 0.01);
  assert.ok(shortfall.rows[1].incomeRequested > shortfall.rows[0].incomeRequested);
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

  // Year 0 is today's opening balance (no invented return). Growth shows on the next row.
  const grown = projectPortfolio({
    currentAge: 70,
    retirementAge: 70,
    years: 1,
    otherReturn: 0.1,
    retirementReturn: 0,
    savingsReturn: 0,
    inflationRate: 0,
    desiredIncomeToday: 70000,
    otherIncomeToday: 60000,
    otherOpening: 100000,
    province: "AB",
  });
  assert.equal(grown.rows[0].tax, 0);
  assert.ok(grown.rows[0].withdrawal > 0);
  assert.ok(Math.abs(grown.rows[0].other - (100000 - grown.rows[0].withdrawal)) < 0.01);
  assert.ok(grown.rows[1].tax > 0);

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

test("tax if death includes the full RRSP without a rollover, and leaves it out with a spousal rollover", () => {
  const shared = {
    currentAge: 65,
    retirementAge: 65,
    years: 0,
    desiredIncomeToday: 40000,
    inflationRate: 0,
    retirementReturn: 0,
    savingsReturn: 0,
    otherReturn: 0,
    rrspOpening: 200000,
    tfsaOpening: 50000,
    nonRegOpening: 0,
    otherOpening: 0,
    province: "AB",
  };
  const alone = projectPortfolio({ ...shared, rollover: false });
  const withSpouse = projectPortfolio({ ...shared, rollover: true });
  assert.ok(alone.rows[0].deathTax > 40000);
  assert.equal(withSpouse.rows[0].deathTax, 0);
  assert.ok(alone.rows[0].rrsp < 200000);
  // Death tax uses the RRSP before that year's withdrawal.
  assert.ok(alone.rows[0].deathTax > alone.rows[0].tax);
});

test("Table F3 year 0 keeps today's opening balances before any return is applied", () => {
  const path = projectPortfolio({
    currentAge: 42,
    retirementAge: 65,
    years: 1,
    savingsReturn: 0.05,
    otherReturn: 0.03,
    inflationRate: 0,
    desiredIncomeToday: 0,
    tfsaOpening: 40000,
    rrspOpening: 80000,
    nonRegOpening: 25000,
    otherOpening: 80000,
    province: "AB",
  });
  assert.equal(path.rows[0].tfsa, 40000);
  assert.equal(path.rows[0].rrsp, 80000);
  assert.equal(path.rows[0].nonReg, 25000);
  assert.equal(path.rows[0].other, 80000);
  assert.ok(Math.abs(path.rows[1].tfsa - 40000 * 1.05) < 0.01);
  assert.ok(Math.abs(path.rows[1].other - 80000 * 1.03) < 0.01);
});

if (failed > 0) {
  process.exitCode = 1;
}
