/*
 * ============================================================
 * TFSA ANNUAL DOLLAR LIMITS — EDIT THIS FILE EACH YEAR
 * ============================================================
 * This is the only file that needs to change as new years pass.
 *
 * Every fall, the CRA / Department of Finance Canada announces the
 * TFSA dollar limit for the following calendar year. When that
 * happens, add ONE new line to the object below in the format:
 *
 *   2027: 7000,   <-- year: dollar amount
 *
 * Nothing else on the site needs to be touched — the calculator on
 * tfsa-calculator.html reads directly from this object to work out
 * lifetime contribution room and ongoing savings room.
 *
 * Source for the values already entered: Canada Revenue Agency /
 * Department of Finance Canada TFSA annual limit announcements.
 * https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/tax-free-savings-account/contributing/calculate-room.html
 */
const TFSA_ANNUAL_LIMITS = {
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
  2026: 7000
  // 2027: 0000,  <-- uncomment and set once the CRA announces next year's limit
};
