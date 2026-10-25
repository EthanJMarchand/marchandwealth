// Future room is new room only. Current unused room is typed separately and is not added again here.
// TFSA limits already in the data file are used as published. Later years are the latest limit,
// compounded by the inflation assumption and rounded to the nearest $500.
// RRSP dollar limits already in the file are used as published. Later years grow at the
// average growth of the recent limits in the file, rounded to the nearest $10.

export function averageLimitGrowth(limitsByYear, lastSteps = 15) {
  const years = Object.keys(limitsByYear)
    .map(Number)
    .filter((year) => Number.isFinite(limitsByYear[year]))
    .sort((a, b) => a - b);
  if (years.length < 2) return 0;
  const recent = years.slice(-(lastSteps + 1));
  const first = limitsByYear[recent[0]];
  const last = limitsByYear[recent[recent.length - 1]];
  const span = recent[recent.length - 1] - recent[0];
  if (first <= 0 || span <= 0) return 0;
  return (last / first) ** (1 / span) - 1;
}

export function rrspDollarLimitForYear(year, limitsByYear, growth) {
  if (limitsByYear[year] != null) return limitsByYear[year];
  const years = Object.keys(limitsByYear).map(Number).sort((a, b) => a - b);
  if (!years.length) return 0;
  const last = years[years.length - 1];
  if (year < years[0]) return limitsByYear[years[0]];
  const steps = year - last;
  return Math.round((limitsByYear[last] * (1 + growth) ** steps) / 10) * 10;
}

export function tfsaLimitForYear(year, limitsByYear, taxYear, inflationRate) {
  if (limitsByYear[year] != null) return limitsByYear[year];
  const base = limitsByYear[taxYear];
  if (base == null || year < taxYear) return 0;
  const raw = base * (1 + inflationRate) ** (year - taxYear);
  return Math.max(500, Math.round(raw / 500) * 500);
}

function eligible(age, yearsAhead) {
  return Number.isFinite(age) && age + yearsAhead >= 18;
}

export function projectFutureRoom({
  yearsOfWork,
  taxYear,
  inflationRate,
  personalIncome,
  partnerIncome,
  hasPartner,
  clientAge,
  partnerAge,
  tfsaLimits,
  rrspLimitsByYear,
  rrspPercent,
}) {
  const growth = averageLimitGrowth(rrspLimitsByYear);
  const count = Math.max(0, Math.floor(yearsOfWork));
  const years = [];
  let clientRrsp = 0;
  let partnerRrsp = 0;
  let clientTfsa = 0;
  let partnerTfsa = 0;

  for (let index = 0; index < count; index += 1) {
    const yearsAhead = index + 1;
    const roomYear = taxYear + yearsAhead;
    const income = Math.max(0, personalIncome) * (1 + inflationRate) ** index;
    const partnerEarned = hasPartner ? Math.max(0, partnerIncome) * (1 + inflationRate) ** index : 0;
    const dollarLimit = rrspDollarLimitForYear(roomYear, rrspLimitsByYear, growth);
    const clientNew = Math.min(income * rrspPercent, dollarLimit);
    const partnerNew = hasPartner ? Math.min(partnerEarned * rrspPercent, dollarLimit) : 0;
    const tfsaLimit = tfsaLimitForYear(roomYear, tfsaLimits, taxYear, inflationRate);
    const clientTfsaNew = eligible(clientAge, yearsAhead) ? tfsaLimit : 0;
    const partnerTfsaNew = hasPartner && eligible(partnerAge, yearsAhead) ? tfsaLimit : 0;

    clientRrsp += clientNew;
    partnerRrsp += partnerNew;
    clientTfsa += clientTfsaNew;
    partnerTfsa += partnerTfsaNew;
    years.push({
      roomYear,
      dollarLimit,
      clientRrsp: clientNew,
      partnerRrsp: partnerNew,
      tfsaLimit,
      clientTfsa: clientTfsaNew,
      partnerTfsa: partnerTfsaNew,
    });
  }

  return {
    clientRrsp,
    partnerRrsp,
    clientTfsa,
    partnerTfsa,
    householdRrsp: clientRrsp + partnerRrsp,
    householdTfsa: clientTfsa + partnerTfsa,
    years,
    rrspGrowth: growth,
  };
}
