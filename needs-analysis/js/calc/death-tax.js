import { inflate } from "./inflation.js";
import { futureValue } from "./money.js";
import { taxOnInclusion } from "./tax.js";

// Half of a capital gain is included in income. The cost base is counted as zero,
// so the whole balance is the gain.
export const CAPITAL_GAINS_INCLUSION = 0.5;

function sliceTax(baseIncome, inclusion, province) {
  if (inclusion <= 0) return { tax: 0, rate: 0 };
  const result = taxOnInclusion(baseIncome, inclusion, province);
  return result ?? { tax: 0, rate: 0 };
}

// Tax if death is `years` from now. Non-registered and RRSP balances grow at the
// savings return. The estate value rises with inflation. A rollover drops the RRSP.
export function deathTaxAtYear({
  income,
  rrsp = 0,
  nonReg = 0,
  estate = 0,
  other = 0,
  otherReturn,
  rollover = false,
  province,
  savingsReturn = 0,
  inflationPercent = 0,
  years = 0,
}) {
  const elapsed = Math.max(0, years || 0);
  const baseIncome = Math.max(0, income);
  const otherRate = Number.isFinite(otherReturn) ? otherReturn : savingsReturn;
  const otherCost = Math.max(0, other);
  const otherGrown = futureValue(otherCost, otherRate, elapsed);
  const rrspBalance = rollover ? 0 : futureValue(Math.max(0, rrsp), savingsReturn, elapsed);
  const nonRegBalance = futureValue(Math.max(0, nonReg), savingsReturn, elapsed);
  const estateValue = inflate(Math.max(0, estate), inflationPercent, elapsed);
  const nonRegInclusion = nonRegBalance * CAPITAL_GAINS_INCLUSION;
  const otherInclusion = Math.max(0, otherGrown - otherCost) * CAPITAL_GAINS_INCLUSION;
  const estateInclusion = estateValue * CAPITAL_GAINS_INCLUSION;
  const nonRegSlice = sliceTax(baseIncome, nonRegInclusion, province);
  const otherSlice = sliceTax(baseIncome + nonRegInclusion, otherInclusion, province);
  const estateSlice = sliceTax(baseIncome + nonRegInclusion + otherInclusion, estateInclusion, province);
  const rrspSlice = sliceTax(baseIncome + nonRegInclusion + otherInclusion + estateInclusion, rrspBalance, province);
  return {
    rolledOver: Boolean(rollover),
    rrspBalance,
    nonRegBalance,
    otherBalance: otherGrown,
    estateValue,
    nonRegInclusion,
    otherInclusion,
    estateInclusion,
    rrspInclusion: rrspBalance,
    nonRegTax: nonRegSlice.tax,
    otherTax: otherSlice.tax,
    estateTax: estateSlice.tax,
    rrspTax: rrspSlice.tax,
    rrspRate: rrspSlice.rate,
    total: nonRegSlice.tax + otherSlice.tax + estateSlice.tax + rrspSlice.tax,
  };
}
