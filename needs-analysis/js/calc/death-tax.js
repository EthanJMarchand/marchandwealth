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
  rollover = false,
  province,
  savingsReturn = 0,
  inflationPercent = 0,
  years = 0,
}) {
  const elapsed = Math.max(0, years || 0);
  const baseIncome = Math.max(0, income);
  const rrspBalance = rollover ? 0 : futureValue(Math.max(0, rrsp), savingsReturn, elapsed);
  const nonRegBalance = futureValue(Math.max(0, nonReg), savingsReturn, elapsed);
  const estateValue = inflate(Math.max(0, estate), inflationPercent, elapsed);
  const nonRegInclusion = nonRegBalance * CAPITAL_GAINS_INCLUSION;
  const estateInclusion = estateValue * CAPITAL_GAINS_INCLUSION;
  const nonRegSlice = sliceTax(baseIncome, nonRegInclusion, province);
  const estateSlice = sliceTax(baseIncome + nonRegInclusion, estateInclusion, province);
  const rrspSlice = sliceTax(baseIncome + nonRegInclusion + estateInclusion, rrspBalance, province);
  return {
    rolledOver: Boolean(rollover),
    rrspBalance,
    nonRegBalance,
    estateValue,
    nonRegInclusion,
    estateInclusion,
    rrspInclusion: rrspBalance,
    nonRegTax: nonRegSlice.tax,
    estateTax: estateSlice.tax,
    rrspTax: rrspSlice.tax,
    rrspRate: rrspSlice.rate,
    total: nonRegSlice.tax + estateSlice.tax + rrspSlice.tax,
  };
}
