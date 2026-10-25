import { futureValue } from "./money.js";

// Splits one stream of out-of-pocket savings between the TFSA and the RRSP.
// The RRSP tax refund is invested back into the RRSP, up to the room available.
// What does not fit in either account goes to non-registered.
// Current room is used first. Projected new room arrives in later years and is not counted twice.
// TFSA and RRSP balances grow at the estimated savings return, used as entered.
// Non-registered growth uses the after-tax rate passed in.
// Future room is still brought back to today's dollars by the inflation assumption.

function emptyYear() {
  return {
    tfsa: 0,
    rrsp: 0,
    clientTfsa: 0,
    partnerTfsa: 0,
    clientRrsp: 0,
    partnerRrsp: 0,
    rrspFromSavings: 0,
    unsheltered: 0,
    nonReg: 0,
    refund: 0,
  };
}

function grow(balance, rate) {
  if (balance <= 0) return 0;
  if (rate <= -1) return 0;
  return balance * (1 + rate);
}

export function allocationOutcome({
  annualSavings,
  rrspShare,
  years,
  savingsReturn,
  inflationRate,
  currentTfsaBalance,
  currentRrspBalance,
  currentNonRegBalance = 0,
  nonRegReturn,
  currentTfsaRoom,
  currentRrspRoom,
  currentClientTfsaRoom,
  currentPartnerTfsaRoom,
  currentClientRrspRoom,
  currentPartnerRrspRoom,
  futureYears,
  taxNow,
  currentAge = null,
}) {
  const count = Math.max(0, Math.floor(years));
  const share = Math.min(1, Math.max(0, rrspShare));
  const savings = Math.max(0, annualSavings);
  const splitRooms = currentClientTfsaRoom != null || currentPartnerTfsaRoom != null
    || currentClientRrspRoom != null || currentPartnerRrspRoom != null;
  let clientTfsaRoom = Math.max(0, splitRooms ? currentClientTfsaRoom || 0 : currentTfsaRoom);
  let partnerTfsaRoom = Math.max(0, splitRooms ? currentPartnerTfsaRoom || 0 : 0);
  let clientRrspRoom = Math.max(0, splitRooms ? currentClientRrspRoom || 0 : currentRrspRoom);
  let partnerRrspRoom = Math.max(0, splitRooms ? currentPartnerRrspRoom || 0 : 0);
  let tfsa = Math.max(0, currentTfsaBalance);
  let rrsp = Math.max(0, currentRrspBalance);
  let nonReg = Math.max(0, currentNonRegBalance);
  let tfsaDeposits = 0;
  let rrspDeposits = 0;
  let unshelteredDeposits = 0;
  let thisYear = emptyYear();
  const yearly = [];
  const balancesByAge = [];
  const tax = Number.isFinite(taxNow) ? Math.min(0.8, Math.max(0, taxNow)) : 0;
  const grossUp = tax > 0 && tax < 1;
  const registeredRate = Number.isFinite(savingsReturn) ? savingsReturn : 0;
  const taxableRate = Number.isFinite(nonRegReturn) ? nonRegReturn : registeredRate;
  const schedule = futureYears || [];
  let usedJanuaryRoom = false;

  function addArriving(arriving, elapsed) {
    const deflator = (1 + inflationRate) ** elapsed;
    if (!arriving || deflator <= 0) return;
    clientTfsaRoom += (arriving.clientTfsa || 0) / deflator;
    partnerTfsaRoom += (arriving.partnerTfsa || 0) / deflator;
    clientRrspRoom += (arriving.clientRrsp || 0) / deflator;
    partnerRrspRoom += (arriving.partnerRrsp || 0) / deflator;
  }

  function takeTfsa(want) {
    const client = Math.min(Math.max(0, want), clientTfsaRoom);
    clientTfsaRoom -= client;
    const partner = Math.min(Math.max(0, want - client), partnerTfsaRoom);
    partnerTfsaRoom -= partner;
    return { client, partner, total: client + partner };
  }

  function takeRrsp(want) {
    const client = Math.min(Math.max(0, want), clientRrspRoom);
    clientRrspRoom -= client;
    const partner = Math.min(Math.max(0, want - client), partnerRrspRoom);
    partnerRrspRoom -= partner;
    return { client, partner, total: client + partner };
  }

  for (let index = 0; index < count; index += 1) {
    if (index === 0) {
      const openRoom = clientTfsaRoom + partnerTfsaRoom + clientRrspRoom + partnerRrspRoom;
      if (openRoom <= 0 && schedule[0]) {
        addArriving(schedule[0], 1);
        usedJanuaryRoom = true;
      }
    } else if (usedJanuaryRoom) {
      addArriving(schedule[index], index + 1);
    } else {
      addArriving(schedule[index - 1], index);
    }

    const pocketRrsp = savings * share;
    const pocketTfsa = savings * (1 - share);
    const preferredRrsp = takeRrsp(grossUp ? pocketRrsp / (1 - tax) : pocketRrsp);
    let clientRrsp = preferredRrsp.client;
    let partnerRrsp = preferredRrsp.partner;
    let spentOnRrsp = grossUp ? preferredRrsp.total * (1 - tax) : preferredRrsp.total;
    const preferredTfsa = takeTfsa(pocketTfsa + Math.max(0, pocketRrsp - spentOnRrsp));
    let clientTfsa = preferredTfsa.client;
    let partnerTfsa = preferredTfsa.partner;
    let pocketLeft = Math.max(0, savings - spentOnRrsp - preferredTfsa.total);
    const spillTfsa = takeTfsa(pocketLeft);
    clientTfsa += spillTfsa.client;
    partnerTfsa += spillTfsa.partner;
    pocketLeft -= spillTfsa.total;
    const spillRrsp = takeRrsp(grossUp ? pocketLeft / (1 - tax) : pocketLeft);
    clientRrsp += spillRrsp.client;
    partnerRrsp += spillRrsp.partner;
    const spillSpent = grossUp ? spillRrsp.total * (1 - tax) : spillRrsp.total;
    spentOnRrsp += spillSpent;
    pocketLeft -= spillSpent;
    const toRrsp = clientRrsp + partnerRrsp;
    const toTfsa = clientTfsa + partnerTfsa;
    const unsheltered = Math.max(0, pocketLeft);
    tfsa = grow(tfsa, registeredRate) + toTfsa;
    rrsp = grow(rrsp, registeredRate) + toRrsp;
    nonReg = grow(nonReg, taxableRate) + unsheltered;
    tfsaDeposits += toTfsa;
    rrspDeposits += toRrsp;
    unshelteredDeposits += unsheltered;
    const refund = grossUp ? toRrsp * tax : 0;
    const year = {
      tfsa: toTfsa,
      rrsp: toRrsp,
      clientTfsa,
      partnerTfsa,
      clientRrsp,
      partnerRrsp,
      rrspFromSavings: spentOnRrsp,
      unsheltered,
      nonReg: unsheltered,
      refund,
    };
    yearly.push(year);
    if (Number.isFinite(currentAge)) {
      balancesByAge.push({ age: currentAge + index + 1, tfsa, rrsp, nonReg });
    }
    if (index === 0) thisYear = year;
  }

  if (count === 0) thisYear = emptyYear();

  return {
    tfsa,
    rrsp,
    nonReg,
    tfsaDeposits,
    rrspDeposits,
    unshelteredDeposits,
    thisYear,
    yearly,
    balancesByAge,
    refund: thisYear.refund,
    rrspShare: share,
    usedJanuaryRoom,
  };
}

function goalParts(target) {
  if (target && typeof target === "object") {
    return {
      incomeCapital: Math.max(0, target.incomeCapital || 0),
      legacyCapital: Math.max(0, target.legacyCapital || 0),
    };
  }
  return { incomeCapital: Math.max(0, Number(target) || 0), legacyCapital: 0 };
}

// The legacy is an account balance that stays invested. RRSP tax applies to the
// income that is withdrawn, so only that portion of an RRSP is reduced by the rate.
export function accountCoversGoal({
  tfsa = 0,
  rrsp = 0,
  nonReg = 0,
  other = 0,
  futureTaxRate = 0,
  incomeCapital = 0,
  legacyCapital = 0,
}) {
  const rate = Number.isFinite(futureTaxRate) ? Math.min(1, Math.max(0, futureTaxRate)) : 0;
  const safeTfsa = Math.max(0, tfsa);
  const safeRrsp = Math.max(0, rrsp);
  const safeNonReg = Math.max(0, nonReg);
  const safeOther = Math.max(0, other);
  const account = safeTfsa + safeRrsp + safeNonReg + safeOther;
  const income = Math.max(0, incomeCapital);
  const legacy = Math.max(0, legacyCapital);
  if (account + 0.01 < legacy) return false;
  const afterTax = safeTfsa + safeNonReg + safeOther + safeRrsp * (1 - rate);
  const spendableLeft = account > 0 ? afterTax * Math.max(0, account - legacy) / account : 0;
  return spendableLeft + 0.01 >= income;
}

function wealthCovers(input, annualSavings, incomeCapital, legacyCapital) {
  const years = Math.max(0, input.years);
  const outcome = allocationOutcome({ ...input, annualSavings, years });
  const other = futureValue(Math.max(0, input.currentOtherBalance || 0), input.savingsReturn, years);
  return accountCoversGoal({
    tfsa: outcome.tfsa,
    rrsp: outcome.rrsp,
    nonReg: outcome.nonReg,
    other,
    futureTaxRate: input.futureTaxRate,
    incomeCapital,
    legacyCapital,
  });
}

// Out-of-pocket savings that leave enough for the income gap and the legacy balance.
export function requiredOutOfPocket(input, targetSpendable) {
  const { incomeCapital, legacyCapital } = goalParts(targetSpendable);
  if (wealthCovers(input, 0, incomeCapital, legacyCapital)) return 0;
  let low = 0;
  let high = Math.max(incomeCapital + legacyCapital, 1);
  let guard = 0;
  while (!wealthCovers(input, high, incomeCapital, legacyCapital) && guard < 16) {
    high *= 2;
    guard += 1;
  }
  for (let step = 0; step < 28; step += 1) {
    const mid = (low + high) / 2;
    if (wealthCovers(input, mid, incomeCapital, legacyCapital)) high = mid;
    else low = mid;
  }
  return high;
}
