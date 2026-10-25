// The worksheet's starting inflation rate is the average of the latest 100 yearly rates in the data file.
// Add a year to data/inflation-canada.js and this average moves on its own.

export function orderedRates(annualPercent) {
  return Object.keys(annualPercent)
    .map((year) => ({ year: Number(year), percent: annualPercent[year] }))
    .filter((row) => Number.isFinite(row.year) && Number.isFinite(row.percent))
    .sort((a, b) => a.year - b.year);
}

export function trailingAverage(annualPercent, years = 100) {
  const rates = orderedRates(annualPercent);
  const slice = rates.slice(-Math.min(years, rates.length));
  if (!slice.length) return { average: 0, from: null, to: null, count: 0 };
  const average = slice.reduce((sum, row) => sum + row.percent, 0) / slice.length;
  return {
    average,
    from: slice[0].year,
    to: slice[slice.length - 1].year,
    count: slice.length,
  };
}

export function roundPercent(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function inflate(amount, percent, years) {
  if (!Number.isFinite(amount) || years <= 0) return amount;
  const rate = percent / 100;
  if (rate <= -1) return 0;
  return amount * (1 + rate) ** years;
}

export function deflate(amount, percent, years) {
  if (!Number.isFinite(amount) || years <= 0) return amount;
  const rate = percent / 100;
  if (rate <= -1) return 0;
  return amount / (1 + rate) ** years;
}

// Buying power of a yearly amount that never rises, stated in today's dollars.
export function purchasingPowerPath(amount, percent, years) {
  const yearly = Math.max(0, amount);
  const span = Math.max(0, Math.round(years));
  const points = [];
  for (let elapsed = 0; elapsed <= span; elapsed += 1) {
    points.push({ elapsed, buyingPower: deflate(yearly, percent, elapsed) });
  }
  return points;
}
