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

// Each person's CPP counts from the later of retirement and age 60.
// OAS counts from that person's age 65. Amounts are today's dollars;
// the caller raises them with inflation.
// The recovery screen uses today's OAS threshold against today's pension income.
function pensionCash({
  retired,
  age,
  partnerAge,
  clientCpp,
  clientOas,
  partnerCpp,
  partnerOas,
  otherIncome,
  threshold,
  rate,
}) {
  if (!retired) return 0;
  const cpp = age >= 60 ? Math.max(0, clientCpp) : 0;
  let oas = age >= 65 ? Math.max(0, clientOas) : 0;
  const proxy = Math.max(0, otherIncome) + cpp + oas;
  if (threshold > 0 && proxy > threshold) {
    oas -= Math.min(oas, rate * (proxy - threshold));
  }
  const spouseCpp = partnerAge != null && partnerAge >= 60 ? Math.max(0, partnerCpp) : 0;
  const spouseOas = partnerAge != null && partnerAge >= 65 ? Math.max(0, partnerOas) : 0;
  return cpp + oas + spouseCpp + spouseOas;
}

// Year-by-year balances. Contributions are capped by room. At retirement,
// contributions stop. CPP and OAS cover part of the after-tax income, and the
// accounts withdraw the rest, from the RRSP, then non-registered, then the TFSA, then other assets.
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
    const portfolioRate = retired ? retirementReturn : savingsReturn;
    tfsa = grow(tfsa, portfolioRate);
    rrsp = grow(rrsp, portfolioRate);
    nonReg = grow(nonReg, portfolioRate);
    other = grow(other, otherReturn);
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
      partnerAge: Number.isFinite(partnerAge) ? partnerAge + year : null,
      clientCpp: clientCppToday,
      clientOas: clientOasToday,
      partnerCpp: partnerCppToday,
      partnerOas: partnerOasToday,
      otherIncome: otherIncomeToday,
      threshold: oasRecoveryThreshold,
      rate: oasRecoveryRate,
    });
    const pensionNominal = pension * factor;
    const otherNominal = Math.max(0, otherIncomeToday) * factor;
    const pensionTax = taxNominal(otherNominal, pensionNominal, factor, province);
    const afterTaxPension = Math.max(0, pensionNominal - pensionTax);
    const target = retired ? Math.max(0, desiredIncomeToday) * factor : 0;
    let need = Math.max(0, target - afterTaxPension);
    let tax = 0;
    let base = otherNominal + pensionNominal;
    const rrspTake = takeTaxable({ balance: rrsp, acb: 0, kind: "rrsp", need, base, factor, province });
    rrsp = rrspTake.balance;
    need = Math.max(0, need - rrspTake.net);
    tax += rrspTake.tax;
    base = rrspTake.base;
    const nonRegTake = takeTaxable({ balance: nonReg, acb: nonRegAcb, kind: "nonReg", need, base, factor, province });
    nonReg = nonRegTake.balance;
    nonRegAcb = nonRegTake.acb;
    need = Math.max(0, need - nonRegTake.net);
    tax += nonRegTake.tax;
    base = nonRegTake.base;
    const tfsaTake = Math.min(tfsa, need);
    tfsa -= tfsaTake;
    need -= tfsaTake;
    const otherTake = takeTaxable({ balance: other, acb: otherAcb, kind: "other", need, base, factor, province });
    other = otherTake.balance;
    otherAcb = otherTake.acb;
    need = Math.max(0, need - otherTake.net);
    tax += otherTake.tax;

    const deathBase = retired ? otherNominal + pensionNominal : Math.max(0, workingIncomeToday) * factor;
    const deathInclusion = (rollover ? 0 : rrsp)
      + Math.max(0, nonReg - nonRegAcb) * CAPITAL_GAINS_INCLUSION
      + Math.max(0, other - otherAcb) * CAPITAL_GAINS_INCLUSION;
    const deathTax = taxNominal(deathBase, deathInclusion, factor, province);
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
      pension: pensionNominal,
      withdrawal: Math.max(0, target - afterTaxPension - need),
      tax,
      deathTax,
      tfsa,
      rrsp,
      nonReg,
      other,
      total,
      short,
    });
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
