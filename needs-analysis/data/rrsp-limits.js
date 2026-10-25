// RRSP dollar limits by contribution year. Add a year here when CRA announces it.
// The dollar limit is the most that can be deducted for that year.
// New room from one year's earned income is capped by the next year's dollar limit,
// then reduced by a pension adjustment. This file cannot see the pension adjustment.
// Source: https://www.canada.ca/en/revenue-agency/services/tax/registered-plans-administrators/pspa/mp-rrsp-dpsp-tfsa-limits-ympe.html

export const rrspDollarLimits = {
  1991: 11500,
  1992: 12500,
  1993: 12500,
  1994: 13500,
  1995: 14500,
  1996: 13500,
  1997: 13500,
  1998: 13500,
  1999: 13500,
  2000: 13500,
  2001: 13500,
  2002: 13500,
  2003: 14500,
  2004: 15500,
  2005: 16500,
  2006: 18000,
  2007: 19000,
  2008: 20000,
  2009: 21000,
  2010: 22000,
  2011: 22450,
  2012: 22970,
  2013: 23820,
  2014: 24270,
  2015: 24930,
  2016: 25370,
  2017: 26010,
  2018: 26230,
  2019: 26500,
  2020: 27230,
  2021: 27830,
  2022: 29210,
  2023: 30780,
  2024: 31560,
  2025: 32490,
  2026: 33810,
  2027: 35390,
};

export const rrspLimits = {
  contributionYear: 2026,
  dollarLimit: rrspDollarLimits[2026],
  nextYearDollarLimit: rrspDollarLimits[2027],
  earnedIncomePercent: 0.18,
  dollarLimits: rrspDollarLimits,
  sourceUrl:
    "https://www.canada.ca/en/revenue-agency/services/tax/registered-plans-administrators/pspa/mp-rrsp-dpsp-tfsa-limits-ympe.html",
};
