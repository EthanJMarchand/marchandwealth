// OAS maximums and the recovery-tax screen.
// Monthly maximums are for October to December 2026.
// Recovery thresholds are for the 2026 income year (July 2027 to June 2028 payment period).
// ESDC marks those 2026 thresholds as final from October.
// Sources:
// https://www.canada.ca/en/employment-social-development/programs/pensions/pension/statistics/2026-quarterly-october-december.html
// https://www.canada.ca/en/services/benefits/publicpensions/cpp/old-age-security/recovery-tax.html

export const oasAmounts = {
  period: "October to December 2026",
  incomeYear: 2026,
  maxMonthlyAge65to74: 762.5,
  maxMonthlyAge75andOver: 838.75,
  recoveryTaxRate: 0.15,
  recoveryThreshold: 95323,
  fullRecoveryIncomeAge65to74: 155320,
  fullRecoveryIncomeAge75andOver: 161320,
  maximumsUrl:
    "https://www.canada.ca/en/employment-social-development/programs/pensions/pension/statistics/2026-quarterly-october-december.html",
  recoveryUrl:
    "https://www.canada.ca/en/services/benefits/publicpensions/cpp/old-age-security/recovery-tax.html",
};
