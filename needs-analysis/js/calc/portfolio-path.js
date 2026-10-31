import { CAPITAL_GAINS_INCLUSION } from "./death-tax.js";
import { taxOnInclusion } from "./tax.js";

function grow(balance, rate) {
  if (balance <= 0) return 0;
  if (!(rate > -1)) return 0;
  return balance * (1 + rate);
}

function taxNominal(nominalBase, nominalInclusion, factor, province) {
  if (nominalInclusion <= 0) return 0;
  const scale = factor > 0 ? factor : 1;
  const result = taxOnInclusion(nominalBase / scale, nominalInclusion / scale, province);
  return result ? result.tax * scale : 0;
}

// The slider is the most someone would contribute. Unused room carries forward.
// Once that room is gone, a year is limited to the new room arriving that year.
export function depositsOverYears({ desiredAnnual, openingRoom, newRoomByYear = [], years }) {
  let available = Math.max(0, openingRoom);
  const want = Math.max(0, desiredAnnual);
  const deposits = [];
  const count = Math.max(0, years);
  for (let year = 0; year < count; year += 1) {
    if (year > 0) available += Math.max(0, newRoomByYear[year - 1] || 0);
    const deposit = Math.min(want, available);
    available -= deposit;
    deposits.push(deposit);
  }
  return deposits;
}

function inclusionFor(taken, balance, acb, kind) {
  if (taken <= 0 || balance <= 0) return 0;
  if (kind === "rrsp") return taken;
  const gain = Math.max(0, balance - acb);
  return taken * (gain / balance) * CAPITAL_GAINS_INCLUSION;
}

function takeTaxable({ balance, acb, kind, need, base, factor, province }) {
  if (need <= 0 || balance <= 0) return { taken: 0, tax: 0, net: 0, balance, acb, base };
  const taxOn = (taken) => taxNominal(base, inclusionFor(taken, balance, acb, kind), factor, province);
  const netOf = (taken) => taken - taxOn(taken);
  let taken = balance;
  if (netOf(balance) > need) {
    let low = 0;
    let high = balance;
    for (let step = 0; step < 28; step += 1) {
      const mid = (low + high) / 2;
      if (netOf(mid) >= need) high = mid;
      else low = mid;
    }
    taken = high;
  }
  const tax = taxOn(taken);
  const acbLeft = balance > 0 ? acb * ((balance - taken) / balance) : 0;
  return {
    taken,
    tax,
    net: taken - tax,
    balance: balance - taken,
    acb: acbLeft,
    base: base + inclusionFor(taken, balance, acb, kind),
  };
}

// After CPP and OAS, the after-tax shortfall is taken from Other, non-registered,
// and RRSP in proportion to those balances so they run down together. The TFSA
// is not touched until that pool is gone.
export function withdrawProRataTaxable({
  other,
  otherAcb,
  nonReg,
  nonRegAcb,
  rrsp,
  need,
  base,
  factor,
  province,
}) {
  let tax = 0;
  let remaining = Math.max(0, need);
  let nextBase = base;
  let otherBal = Math.max(0, other);
  let otherBasis = Math.max(0, otherAcb);
  let nonRegBal = Math.max(0, nonReg);
  let nonRegBasis = Math.max(0, nonRegAcb);
  let rrspBal = Math.max(0, rrsp);

  for (let pass = 0; pass < 4 && remaining > 0.5; pass += 1) {
    const pool = otherBal + nonRegBal + rrspBal;
    if (pool <= 0) break;
    const otherNeed = remaining * (otherBal / pool);
    const nonRegNeed = remaining * (nonRegBal / pool);
    const rrspNeed = remaining * (rrspBal / pool);

    const otherTake = takeTaxable({
      balance: otherBal,
      acb: otherBasis,
      kind: "other",
      need: otherNeed,
      base: nextBase,
      factor,
      province,
    });
    otherBal = otherTake.balance;
    otherBasis = otherTake.acb;
    tax += otherTake.tax;
    nextBase = otherTake.base;

    const nonRegTake = takeTaxable({
      balance: nonRegBal,
      acb: nonRegBasis,
      kind: "nonReg",
      need: nonRegNeed,
      base: nextBase,
      factor,
      province,
    });
    nonRegBal = nonRegTake.balance;
    nonRegBasis = nonRegTake.acb;
    tax += nonRegTake.tax;
    nextBase = nonRegTake.base;

    const rrspTake = takeTaxable({
      balance: rrspBal,
      acb: 0,
      kind: "rrsp",
      need: rrspNeed,
      base: nextBase,
      factor,
      province,
    });
    rrspBal = rrspTake.balance;
    tax += rrspTake.tax;
    nextBase = rrspTake.base;

    remaining = Math.max(0, remaining - otherTake.net - nonRegTake.net - rrspTake.net);
  }

  return {
    other: otherBal,
    otherAcb: otherBasis,
    nonReg: nonRegBal,
    nonRegAcb: nonRegBasis,
    rrsp: rrspBal,
    need: remaining,
    tax,
    base: nextBase,
  };
}

const clampAge = (age, low, high) => Math.min(high, Math.max(low, Math.floor(age)));

// CPP drops 0.6% a month before 65 and rises 0.7% a month after, to age 70.
function cppStartFactor(startAge) {
  const start = clampAge(startAge, 60, 70);
  return start < 65 ? 1 - 0.072 * (65 - start) : 1 + 0.084 * (start - 65);
}

// OAS rises 0.6% a month for each month deferred past 65, to age 70, and 10% at 75.
function oasFactor(startAge, age) {
  const start = clampAge(startAge, 65, 70);
  return (1 + 0.072 * (start - 65)) * (age >= 75 ? 1.1 : 1);
}

// CPP and OAS amounts are the age-65 figures in today's dollars; the caller raises them
// with inflation. Each person starts CPP at the later of retirement and 60, and OAS at the
// later of retirement and 65, both capped at 70. The spouse retires with Person 1.
// The recovery screen uses today's OAS threshold against today's pension income.
function pensionCash({
  retired,
  age,
  retireAge,
  partnerAge,
  partnerRetireAge,
  clientCpp,
  clientOas,
  partnerCpp,
  partnerOas,
  otherIncome,
  threshold,
  rate,
}) {
  if (!retired) return { client: 0, spouse: 0 };
  const cppStart = clampAge(retireAge, 60, 70);
  const oasStart = clampAge(retireAge, 65, 70);
  const cpp = age >= cppStart ? Math.max(0, clientCpp) * cppStartFactor(cppStart) : 0;
  let oas = age >= oasStart ? Math.max(0, clientOas) * oasFactor(oasStart, age) : 0;
  const proxy = Math.max(0, otherIncome) + cpp + oas;
  if (threshold > 0 && proxy > threshold) {
    oas -= Math.min(oas, rate * (proxy - threshold));
  }
  let spouse = 0;
  if (partnerAge != null) {
    const spouseCppStart = clampAge(partnerRetireAge, 60, 70);
    const spouseOasStart = clampAge(partnerRetireAge, 65, 70);
    if (partnerAge >= spouseCppStart) spouse += Math.max(0, partnerCpp) * cppStartFactor(spouseCppStart);
    if (partnerAge >= spouseOasStart) spouse += Math.max(0, partnerOas) * oasFactor(spouseOasStart, partnerAge);
  }
  return { client: cpp + oas, spouse };
}

// Year-by-year balances. Contributions are capped by room. At retirement,
// contributions stop. CPP and OAS cover part of the after-tax income, and the
// accounts make up the shortfall from Other, non-registered, and RRSP in
// proportion to those balances. The TFSA is used only after that pool is gone.
export function projectPortfolio({
  currentAge,
  retirementAge,
  years,
  inflationRate = 0,
  savingsReturn = 0,
  retirementReturn = 0,
  otherReturn = 0,
  desiredIncomeToday = 0,
  tfsaAnnual = 0,
  rrspAnnual = 0,
  nonRegAnnual = 0,
  tfsaOpening = 0,
  rrspOpening = 0,
  nonRegOpening = 0,
  otherOpening = 0,
  tfsaRoomNow = 0,
  rrspRoomNow = 0,
  tfsaNewRoom = [],
  rrspNewRoom = [],
  province = "AB",
  clientCppToday = 0,
  clientOasToday = 0,
  partnerCppToday = 0,
  partnerOasToday = 0,
  partnerAge = null,
  otherIncomeToday = 0,
  oasRecoveryThreshold = 0,
  oasRecoveryRate = 0,
  workingIncomeToday = 0,
  rollover = false,
  startYear = 2026,
}) {
  const span = Math.max(0, Math.round(years));
  const ageNow = Number(currentAge);
  const retire = Number(retirementAge);
  const inflation = Number.isFinite(inflationRate) ? inflationRate : 0;
  const savingYears = Number.isFinite(ageNow) && Number.isFinite(retire) ? Math.max(0, retire - ageNow) : 0;
  const tfsaDeposits = depositsOverYears({ desiredAnnual: tfsaAnnual, openingRoom: tfsaRoomNow, newRoomByYear: tfsaNewRoom, years: savingYears });
  const rrspDeposits = depositsOverYears({ desiredAnnual: rrspAnnual, openingRoom: rrspRoomNow, newRoomByYear: rrspNewRoom, years: savingYears });
  let tfsa = Math.max(0, tfsaOpening);
  let rrsp = Math.max(0, rrspOpening);
  let nonReg = Math.max(0, nonRegOpening);
  let nonRegAcb = 0;
  let other = Math.max(0, otherOpening);
  let otherAcb = other;
  const rows = [];
  let depletedAge = null;

  for (let year = 0; year <= span; year += 1) {
    const age = ageNow + year;
    const retired = Number.isFinite(retire) && age >= retire;
    const factor = (1 + inflation) ** year;
    // Start-of-year balances: year 0 is today's opening amounts. Growth is
    // applied after this row so the table does not invent a year of return
    // before the plan begins.
    let tfsaIn = 0;
    let rrspIn = 0;
    let nonRegIn = 0;
    if (!retired) {
      tfsaIn = tfsaDeposits[year] || 0;
      rrspIn = rrspDeposits[year] || 0;
      nonRegIn = Math.max(0, nonRegAnnual);
      tfsa += tfsaIn;
      rrsp += rrspIn;
      nonReg += nonRegIn;
      nonRegAcb += nonRegIn;
    }

    const pension = pensionCash({
      retired,
      age,
      retireAge: retire,
      partnerAge: Number.isFinite(partnerAge) ? partnerAge + year : null,
      partnerRetireAge: Number.isFinite(partnerAge) ? partnerAge + (retire - ageNow) : null,
      clientCpp: clientCppToday,
      clientOas: clientOasToday,
      partnerCpp: partnerCppToday,
      partnerOas: partnerOasToday,
      otherIncome: otherIncomeToday,
      threshold: oasRecoveryThreshold,
      rate: oasRecoveryRate,
    });
    const clientPensionNominal = pension.client * factor;
    const pensionNominal = (pension.client + pension.spouse) * factor;
    const otherNominal = retired ? Math.max(0, otherIncomeToday) * factor : 0;
    const incomeTax = taxNominal(0, pensionNominal + otherNominal, factor, province);
    const afterTaxIncome = Math.max(0, pensionNominal + otherNominal - incomeTax);
    // Requested after-tax income, raised with inflation from today's dollars.
    // CPP, OAS, and other income are kept in full even when they exceed that
    // request; accounts only top up a shortfall.
    const incomeRequested = retired ? Math.max(0, desiredIncomeToday) * factor : 0;

    // Tax if death this year is on the balances before retirement withdrawals.
    // With a spousal rollover the RRSP is left out; without one it is taxed in full.
    // TFSA is never in this tax. Non-registered and other assets tax only the gain.
    const rrspAtDeath = rrsp;
    const nonRegAtDeath = nonReg;
    const otherAtDeath = other;
    const nonRegGainAtDeath = Math.max(0, nonReg - nonRegAcb);
    const otherGainAtDeath = Math.max(0, other - otherAcb);
    const totalAtDeath = tfsa + rrsp + nonReg + other;
    const deathBase = retired ? otherNominal + clientPensionNominal : Math.max(0, workingIncomeToday) * factor;
    const deathInclusion = (rollover ? 0 : rrspAtDeath)
      + nonRegGainAtDeath * CAPITAL_GAINS_INCLUSION
      + otherGainAtDeath * CAPITAL_GAINS_INCLUSION;
    const deathTax = taxNominal(deathBase, deathInclusion, factor, province);

    let need = Math.max(0, incomeRequested - afterTaxIncome);
    let tax = 0;
    let base = otherNominal + pensionNominal;
    const taxable = withdrawProRataTaxable({
      other,
      otherAcb,
      nonReg,
      nonRegAcb,
      rrsp,
      need,
      base,
      factor,
      province,
    });
    other = taxable.other;
    otherAcb = taxable.otherAcb;
    nonReg = taxable.nonReg;
    nonRegAcb = taxable.nonRegAcb;
    rrsp = taxable.rrsp;
    need = taxable.need;
    tax += taxable.tax;
    base = taxable.base;
    const tfsaTake = Math.min(tfsa, need);
    tfsa -= tfsaTake;
    need -= tfsaTake;

    const withdrawal = Math.max(0, incomeRequested - afterTaxIncome - need);
    const incomeTaken = afterTaxIncome + withdrawal;
    const total = tfsa + rrsp + nonReg + other;
    const short = retired && need > 1;
    if (short && depletedAge == null) depletedAge = age;
    rows.push({
      year,
      calendarYear: startYear + year,
      age,
      retired,
      tfsaIn,
      rrspIn,
      nonRegIn,
      incomeRequested,
      pension: pensionNominal,
      pensionNet: afterTaxIncome,
      withdrawal,
      incomeTaken,
      tax,
      deathTax,
      rrspAtDeath,
      nonRegAtDeath,
      otherAtDeath,
      nonRegGainAtDeath,
      otherGainAtDeath,
      totalAtDeath,
      tfsa,
      rrsp,
      nonReg,
      other,
      total,
      short,
    });

    if (year === span) continue;
    const portfolioRate = retired ? retirementReturn : savingsReturn;
    tfsa = grow(tfsa, portfolioRate);
    rrsp = grow(rrsp, portfolioRate);
    nonReg = grow(nonReg, portfolioRate);
    other = grow(other, otherReturn);
  }

  const savingRows = rows.filter((row) => !row.retired);
  const firstDeposit = savingRows[0];
  const wantedTfsa = Math.max(0, tfsaAnnual);
  const wantedRrsp = Math.max(0, rrspAnnual);
  return {
    rows,
    depletedAge,
    ending: rows.length ? rows[rows.length - 1].total : 0,
    deposits: {
      tfsa: firstDeposit ? firstDeposit.tfsaIn : 0,
      rrsp: firstDeposit ? firstDeposit.rrspIn : 0,
      nonReg: firstDeposit ? firstDeposit.nonRegIn : 0,
      tfsaLimited: savingRows.some((row) => row.tfsaIn + 0.5 < wantedTfsa),
      rrspLimited: savingRows.some((row) => row.rrspIn + 0.5 < wantedRrsp),
    },
    monthly: {
      tfsa: Math.max(0, tfsaAnnual) / 12,
      rrsp: Math.max(0, rrspAnnual) / 12,
      nonReg: Math.max(0, nonRegAnnual) / 12,
    },
  };
}

function timingFor(saving, field) {
  const thisYear = saving[0]?.[field] || 0;
  const index = saving.findIndex((row, i) => i > 0 && Math.abs((row[field] || 0) - thisYear) > 0.5);
  if (index < 0) {
    return { thisYear, later: thisYear, laterOffset: 0, calendarYear: saving[0]?.calendarYear ?? null };
  }
  return {
    thisYear,
    later: saving[index][field] || 0,
    laterOffset: index,
    calendarYear: saving[index].calendarYear,
  };
}

// This year's deposit can be zero when the room is already used. The next
// change in the schedule is the amount to show, with the year it starts.
export function describeDeposits(rows) {
  const saving = (rows || []).filter((row) => !row.retired);
  const accounts = {
    tfsa: timingFor(saving, "tfsaIn"),
    rrsp: timingFor(saving, "rrspIn"),
    nonReg: timingFor(saving, "nonRegIn"),
  };
  const now = saving[0] ? saving[0].tfsaIn + saving[0].rrspIn + saving[0].nonRegIn : 0;
  let offset = 0;
  let annual = now;
  let calendarYear = saving[0]?.calendarYear ?? null;
  if (now <= 0.5) {
    const index = saving.findIndex((row, i) => i > 0 && row.tfsaIn + row.rrspIn + row.nonRegIn > 0.5);
    if (index > 0) {
      offset = index;
      annual = saving[index].tfsaIn + saving[index].rrspIn + saving[index].nonRegIn;
      calendarYear = saving[index].calendarYear;
    }
  }
  return { accounts, headline: { annual, offset, calendarYear } };
}
