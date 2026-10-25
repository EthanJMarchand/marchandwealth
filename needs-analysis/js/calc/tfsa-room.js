// Lifetime TFSA room from the annual limits and the person's age.
// Room starts the year they turn 18, and not before the account existed.
// Age is treated as if the birthday has already happened this year.
// Residency and withdrawals are not in this estimate. Contributions already
// made are subtracted by the caller.

export function tfsaRoomEarned({
  age,
  taxYear,
  annualLimits,
  introducedYear = 2009,
  eligibilityAge = 18,
}) {
  const wholeAge = Math.floor(age);
  if (!Number.isFinite(wholeAge) || wholeAge < 0 || wholeAge > 120) {
    return { age: wholeAge, firstYear: null, turned18: null, years: [], total: 0, taxYear };
  }

  const turned18 = taxYear - wholeAge + eligibilityAge;
  const firstYear = Math.max(introducedYear, turned18);
  const years = [];
  for (let year = firstYear; year <= taxYear; year += 1) {
    const limit = annualLimits[year];
    if (Number.isFinite(limit)) years.push({ year, limit });
  }

  return {
    age: wholeAge,
    turned18,
    firstYear: years.length ? firstYear : null,
    years,
    total: years.reduce((sum, item) => sum + item.limit, 0),
    taxYear,
  };
}

export function groupLimitYears(years) {
  const groups = [];
  for (const item of years) {
    const last = groups[groups.length - 1];
    if (last && last.limit === item.limit && last.to === item.year - 1) {
      last.to = item.year;
    } else {
      groups.push({ from: item.year, to: item.year, limit: item.limit });
    }
  }
  return groups;
}

export function formatYearSpan(group) {
  return group.from === group.to ? String(group.from) : `${group.from}–${group.to}`;
}
