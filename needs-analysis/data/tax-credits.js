// Non-refundable personal credits used by the tax estimate: the basic personal amount,
// the age amount, and the pension income amount. Each credit is the amount times the
// lowest bracket rate for that jurisdiction in tax-brackets.js.
// The age amount is reduced by 15% of net income above the threshold (Quebec: 18.75%,
// and it reduces the retirement income amount too, on family income).
// Add a year by copying the newest block when the TD1 forms are published.
// Sources (2026):
// CRA Forms TD1 and TD1AB to TD1YT, 2026 editions.
// https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/t4127-payroll-deductions-formulas/t4127-jan/t4127-jan-payroll-deductions-formulas-computer-programs.html
// Newfoundland and Labrador raised its basic amount to $13,094 on April 29, 2026 (CRA T4032NL, July 2026).
// Quebec: Revenu Québec, Employers: Principal Changes for 2026.

export const taxCredits = {
  2026: {
    ageReductionRate: 0.15,
    federal: { basic: 16452, basicFloor: 14829, basicFrom: 181440, basicTo: 258482, age: 9208, ageThreshold: 46432, pension: 2000 },
    provinces: {
      AB: { basic: 22769, age: 6345, ageThreshold: 47234, pension: 1753 },
      BC: { basic: 13216, age: 5927, ageThreshold: 44119, pension: 1000 },
      MB: { basic: 15780, basicFloor: 0, basicFrom: 200000, basicTo: 400000, age: 3728, ageThreshold: 27749, pension: 1000 },
      NB: { basic: 13664, age: 6158, ageThreshold: 45844, pension: 1000 },
      NL: { basic: 13094, age: 7142, ageThreshold: 39138, pension: 1000 },
      NS: { basic: 11932, age: 5826, ageThreshold: 30828, pension: 1173 },
      NT: { basic: 18198, age: 8902, ageThreshold: 46432, pension: 1000 },
      NU: { basic: 19659, age: 12550, ageThreshold: 46432, pension: 2000 },
      ON: { basic: 12989, age: 6342, ageThreshold: 47210, pension: 1796 },
      PE: { basic: 15000, age: 6510, ageThreshold: 36600, pension: 1000 },
      QC: { basic: 18952, age: 3986, ageThreshold: 42955, pension: 3541, pensionGrossUp: 1.25, ageReductionRate: 0.1875, pensionReduced: true },
      SK: { basic: 20381, age: 5901, ageThreshold: 43927, pension: 1000, seniorSupplement: 2569 },
      YT: { basic: 16452, basicFloor: 14829, basicFrom: 181440, basicTo: 258482, age: 9208, ageThreshold: 46432, pension: 2000 },
    },
  },
};
