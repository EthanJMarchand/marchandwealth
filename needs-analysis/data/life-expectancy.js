// Life expectancy at birth, Canada. Add a year when Statistics Canada releases it.
// The worksheet starts the "likely age at death" at the latest "both" figure, rounded to a whole year.
// Source: https://www150.statcan.gc.ca/n1/daily-quotidien/241204/dq241204a-eng.htm

export const lifeExpectancy = {
  sourceUrl: "https://www150.statcan.gc.ca/n1/daily-quotidien/241204/dq241204a-eng.htm",
  year: 2023,
  canada: {
    2019: { both: 82.2 },
    2022: { both: 81.3 },
    2023: { both: 81.7, male: 79.5, female: 83.9 },
  },
};
