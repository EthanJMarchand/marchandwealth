// TFSA dollar limits from the year the account was introduced.
// Add a new year here when CRA announces it. Room for a person is the sum of
// every year from the later of 2009 and the year they turn 18, through taxYear.
// Source: https://www.canada.ca/en/revenue-agency/services/tax/registered-plans-administrators/pspa/mp-rrsp-dpsp-tfsa-limits-ympe.html

export const tfsaAnnualLimits = {
  2009: 5000,
  2010: 5000,
  2011: 5000,
  2012: 5000,
  2013: 5500,
  2014: 5500,
  2015: 10000,
  2016: 5500,
  2017: 5500,
  2018: 5500,
  2019: 6000,
  2020: 6000,
  2021: 6000,
  2022: 6000,
  2023: 6500,
  2024: 7000,
  2025: 7000,
  2026: 7000,
};

export const tfsaContributionLimit = {
  introducedYear: 2009,
  eligibilityAge: 18,
  taxYear: 2026,
  annualDollarLimit: tfsaAnnualLimits[2026],
  annualLimits: tfsaAnnualLimits,
  sourceUrl:
    "https://www.canada.ca/en/revenue-agency/services/tax/registered-plans-administrators/pspa/mp-rrsp-dpsp-tfsa-limits-ympe.html",
};
