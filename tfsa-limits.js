// Updated every fall like clockwork — or like my New Year's resolutions, mostly on time.
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
};

// Combined federal + Alberta marginal tax brackets, by year. Best-effort
// reconstruction back to 2001 (the year Alberta moved to its modern
// bracket-on-taxable-income system) — verify against real CRA/Alberta
// tables before treating this as gospel, same as you'd sanity-check
// anything else with a dollar sign on it.
const TAX_BRACKETS_BY_YEAR = {
  2001: [ { upTo: 30750, rate: 26 }, { upTo: 61500, rate: 32 }, { upTo: 100000, rate: 36 }, { upTo: Infinity, rate: 39 } ],
  2002: [ { upTo: 31500, rate: 26 }, { upTo: 63000, rate: 32 }, { upTo: 102500, rate: 36 }, { upTo: Infinity, rate: 39 } ],
  2003: [ { upTo: 32250, rate: 26 }, { upTo: 64500, rate: 32 }, { upTo: 105000, rate: 36 }, { upTo: Infinity, rate: 39 } ],
  2004: [ { upTo: 33000, rate: 26 }, { upTo: 66250, rate: 32 }, { upTo: 107500, rate: 36 }, { upTo: Infinity, rate: 39 } ],
  2005: [ { upTo: 34000, rate: 26 }, { upTo: 68000, rate: 32 }, { upTo: 110250, rate: 36 }, { upTo: Infinity, rate: 39 } ],
  2006: [ { upTo: 34750, rate: 25 }, { upTo: 69500, rate: 32 }, { upTo: 113000, rate: 36 }, { upTo: Infinity, rate: 39 } ],
  2007: [ { upTo: 35750, rate: 25 }, { upTo: 71500, rate: 32 }, { upTo: 116000, rate: 36 }, { upTo: Infinity, rate: 39 } ],
  2008: [ { upTo: 36750, rate: 25 }, { upTo: 73250, rate: 32 }, { upTo: 119000, rate: 36 }, { upTo: Infinity, rate: 39 } ],
  2009: [ { upTo: 37500, rate: 25 }, { upTo: 75000, rate: 32 }, { upTo: 122000, rate: 36 }, { upTo: Infinity, rate: 39 } ],
  2010: [ { upTo: 38500, rate: 25 }, { upTo: 77000, rate: 32 }, { upTo: 125000, rate: 36 }, { upTo: Infinity, rate: 39 } ],
  2011: [ { upTo: 39500, rate: 25 }, { upTo: 79000, rate: 32 }, { upTo: 128000, rate: 36 }, { upTo: Infinity, rate: 39 } ],
  2012: [ { upTo: 40500, rate: 25 }, { upTo: 81000, rate: 32 }, { upTo: 131250, rate: 36 }, { upTo: Infinity, rate: 39 } ],
  2013: [ { upTo: 41500, rate: 25 }, { upTo: 83000, rate: 32 }, { upTo: 134500, rate: 36 }, { upTo: Infinity, rate: 39 } ],
  2014: [ { upTo: 42500, rate: 25 }, { upTo: 85000, rate: 32 }, { upTo: 138000, rate: 36 }, { upTo: Infinity, rate: 39 } ],
  2015: [ { upTo: 43500, rate: 25 }, { upTo: 87000, rate: 32 }, { upTo: 141500, rate: 36 }, { upTo: 205000, rate: 41 }, { upTo: Infinity, rate: 47 } ],
  2016: [ { upTo: 44500, rate: 25 }, { upTo: 89000, rate: 32 }, { upTo: 145000, rate: 36 }, { upTo: 210000, rate: 41 }, { upTo: Infinity, rate: 48 } ],
  2017: [ { upTo: 45750, rate: 25 }, { upTo: 91500, rate: 32 }, { upTo: 148500, rate: 36 }, { upTo: 215500, rate: 41 }, { upTo: Infinity, rate: 48 } ],
  2018: [ { upTo: 47000, rate: 25 }, { upTo: 94000, rate: 32 }, { upTo: 152500, rate: 36 }, { upTo: 221000, rate: 41 }, { upTo: Infinity, rate: 48 } ],
  2019: [ { upTo: 48000, rate: 25 }, { upTo: 96500, rate: 32 }, { upTo: 156500, rate: 36 }, { upTo: 226500, rate: 41 }, { upTo: Infinity, rate: 48 } ],
  2020: [ { upTo: 49250, rate: 25 }, { upTo: 99000, rate: 32 }, { upTo: 160500, rate: 36 }, { upTo: 232500, rate: 41 }, { upTo: Infinity, rate: 48 } ],
  2021: [ { upTo: 50500, rate: 25 }, { upTo: 101500, rate: 32 }, { upTo: 164500, rate: 36 }, { upTo: 238000, rate: 41 }, { upTo: Infinity, rate: 48 } ],
  2022: [ { upTo: 51750, rate: 25 }, { upTo: 104000, rate: 32 }, { upTo: 168500, rate: 36 }, { upTo: 244000, rate: 41 }, { upTo: Infinity, rate: 48 } ],
  2023: [ { upTo: 53000, rate: 25 }, { upTo: 106500, rate: 32 }, { upTo: 173000, rate: 36 }, { upTo: 250000, rate: 41 }, { upTo: Infinity, rate: 48 } ],
  2024: [ { upTo: 54250, rate: 25 }, { upTo: 109250, rate: 32 }, { upTo: 177500, rate: 36 }, { upTo: 256500, rate: 41 }, { upTo: Infinity, rate: 48 } ],
  // 2025 and 2026 verified directly against canada.ca and alberta.ca — everything
  // above this line is a reasoned approximation and still needs a real check.
  2025: [ { upTo: 57375, rate: 22.5 }, { upTo: 60000, rate: 28.5 }, { upTo: 114750, rate: 30.5 }, { upTo: 151234, rate: 36 }, { upTo: 177882, rate: 38 }, { upTo: 181481, rate: 41 }, { upTo: 241974, rate: 42 }, { upTo: 253414, rate: 43 }, { upTo: 362961, rate: 47 }, { upTo: Infinity, rate: 48 } ],
  2026: [ { upTo: 58523, rate: 22 }, { upTo: 61200, rate: 28.5 }, { upTo: 117045, rate: 30.5 }, { upTo: 154259, rate: 36 }, { upTo: 181440, rate: 38 }, { upTo: 185111, rate: 41 }, { upTo: 246813, rate: 42 }, { upTo: 258482, rate: 43 }, { upTo: 370220, rate: 47 }, { upTo: Infinity, rate: 48 } ]
};

// Single assumption used to project both personal income and tax-bracket
// thresholds forward: nobody's income or tax bracket is likely to fall in
// real terms over a multi-decade retirement projection, so both escalate
// at the same rate. That keeps a person's marginal rate constant in real
// terms for the whole horizon instead of drifting based on two separately
// fitted historical trends.
const COST_OF_LIVING_RATE = 0.025;

// Alberta average annual employment income, by year. Same verify-before-you-
// trust-it deal as the brackets above — StatsCan publishes the real numbers.
const AVERAGE_INCOME_BY_YEAR = {
  2001: 36000,
  2002: 37500,
  2003: 39000,
  2004: 40500,
  2005: 43000,
  2006: 46000,
  2007: 49500,
  2008: 52000,
  2009: 51000,
  2010: 52500,
  2011: 55000,
  2012: 57500,
  2013: 59500,
  2014: 61500,
  2015: 60000,
  2016: 58500,
  2017: 59500,
  2018: 61000,
  2019: 62500,
  2020: 61000,
  2021: 64000,
  2022: 68000,
  2023: 70500,
  2024: 72500,
  2025: 74500,
  2026: 76500
};
