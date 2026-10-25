export function readMoney(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value ?? "").replace(/[$,\s]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return 0;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

export function formatDollars(value) {
  return formatMoney(Math.round(Number.isFinite(value) ? value : 0));
}

export function formatMoney(value) {
  const number = Number.isFinite(value) ? value : 0;
  const cents = Math.abs(number - Math.round(number)) > 0.001;
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(number);
}

export function presentValueOfAnnuity(payment, rate, years) {
  if (payment <= 0 || years <= 0) return 0;
  if (rate === 0) return payment * years;
  if (rate <= -1) return 0;
  return (payment * (1 - (1 + rate) ** -years)) / rate;
}

// Yearly income a lump sum can pay over `years` at `rate`.
export function annuityPayment(capital, rate, years) {
  if (capital <= 0 || years <= 0) return 0;
  if (rate === 0) return capital / years;
  if (rate <= -1) return 0;
  return (capital * rate) / (1 - (1 + rate) ** -years);
}

// What a future amount is worth today. Years of zero means the amount is due now.
export function presentValue(future, rate, years) {
  if (future <= 0) return 0;
  if (years <= 0) return future;
  if (rate <= -1) return 0;
  return future / (1 + rate) ** years;
}

export function futureValue(present, rate, years) {
  if (present <= 0) return 0;
  if (years <= 0) return present;
  if (rate <= -1) return 0;
  return present * (1 + rate) ** years;
}

// Level end-of-year savings that grow to `target` at the estimated rate.
export function savingsForFutureValue(target, rate, years) {
  if (target <= 0) return 0;
  if (years <= 0) return target;
  if (rate === 0) return target / years;
  if (rate <= -1) return 0;
  return (target * rate) / ((1 + rate) ** years - 1);
}
