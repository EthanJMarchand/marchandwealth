// Stable reference codes for the financial plan page.
// Same codes appear on screen and on the printed plan.
// Sections: A–H. Figures: Fig. D1, Fig. F1, …. Sliders: S.1–S.13. Table: Table F3.

export const planRefs = {
  A: { kind: "section", title: "What belongs in this plan?" },
  B: { kind: "section", title: "Plan" },
  C: { kind: "section", title: "Household" },
  D: { kind: "section", title: "Life insurance gap (if a person dies)" },
  "S.1": { kind: "slider", title: "Years of income to replace", control: "income-years-slider" },
  "Fig. D1": { kind: "illustration", title: "Life insurance gap over time — Person 1", node: "need-chart" },
  "Fig. D2": { kind: "illustration", title: "Life insurance gap over time — Person 2", node: "partner-need-chart" },
  E: { kind: "section", title: "Disability and critical illness" },
  "S.2": { kind: "slider", title: "Disability income percent", control: "disability-ratio-slider" },
  "S.3": { kind: "slider", title: "Critical illness income percent", control: "ci-ratio-slider" },
  "S.4": { kind: "slider", title: "Critical illness recovery months", control: "ci-months-slider" },
  F: { kind: "section", title: "Retirement" },
  "S.5": { kind: "slider", title: "Desired after-tax retirement income", control: "desired-income-slider" },
  "S.6": { kind: "slider", title: "Inflation assumption", control: "inflation-slider" },
  "Fig. F1": { kind: "illustration", title: "Buying power if income never rises", node: "income-erosion" },
  "S.7": { kind: "slider", title: "Return while saving", control: "real-return-slider" },
  "S.8": { kind: "slider", title: "Return on other assets", control: "other-return-slider" },
  "S.9": { kind: "slider", title: "Return in retirement", control: "retirement-return-slider" },
  "S.10": { kind: "slider", title: "TFSA contribution, monthly", control: "tfsa-contribution-slider" },
  "S.11": { kind: "slider", title: "RRSP contribution, monthly", control: "rrsp-contribution-slider" },
  "S.12": { kind: "slider", title: "Non-registered contribution, monthly", control: "nonreg-contribution-slider" },
  "Fig. F2": { kind: "illustration", title: "Balances from this year to the end of the plan", node: "wealth-chart" },
  "S.13": { kind: "slider", title: "Age if death comes at this point", control: "early-death-age" },
  "Table F3": { kind: "table", title: "Portfolio year-by-year", node: "portfolio-table" },
  G: { kind: "section", title: "Tax and probate on death" },
  H: { kind: "section", title: "Assumptions you can change for this case" },
  Summary: { kind: "section", title: "Plan summary" },
};
