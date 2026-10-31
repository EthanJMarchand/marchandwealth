// Investor profiles shared by the investor questionnaire, client intake, and financial plan.
// Score bands follow the Equitable Investor Profile Questionnaire (0–50 points).
// saving and retirement are the default estimated rates of return, in percent, not reduced by inflation.
// A return while saving maps back to a profile at the midpoints between neighbouring saving rates.
(function (root) {
  const PROFILES = [
    {
      key: "minimal-risk", level: 1, name: "Minimal Risk", min: 0, max: 7, equity: 0, fixed: 100, saving: 3, retirement: 3,
      summary: "Protect what you have, with little to no risk.",
      points: [
        "Your focus is keeping your money safe, not growing it.",
        "Suits a very low comfort with risk, or money you will need soon.",
        "Typical choices: money market funds, daily interest accounts, or guaranteed interest accounts.",
      ],
    },
    {
      key: "conservative", level: 2, name: "Conservative", min: 8, max: 16, equity: 20, fixed: 80, saving: 4, retirement: 3,
      summary: "Stable and income-focused, with a little growth.",
      points: [
        "You prefer stable, income-producing investments with minimal risk.",
        "A small amount of growth helps offset inflation.",
        "Most of the portfolio is in fixed income, with limited exposure to equities.",
      ],
    },
    {
      key: "moderate-conservative", level: 3, name: "Moderate Conservative", min: 17, max: 25, equity: 40, fixed: 60, saving: 5, retirement: 4,
      summary: "Income and modest growth, leaning toward stability.",
      points: [
        "You want a balance of income and modest growth, with a cautious approach to risk.",
        "You accept some market ups and downs for better returns than a fully conservative portfolio.",
        "The portfolio mixes fixed income and equities, leaning toward stability.",
      ],
    },
    {
      key: "balanced", level: 4, name: "Balanced", min: 26, max: 34, equity: 60, fixed: 40, saving: 6, retirement: 5,
      summary: "An even approach to growth and income.",
      points: [
        "You want a balanced approach between growth and income.",
        "You can tolerate moderate market swings to reach long-term goals.",
        "A healthy mix of equities and fixed income supports steady growth.",
      ],
    },
    {
      key: "growth", level: 5, name: "Growth", min: 35, max: 42, equity: 80, fixed: 20, saving: 7, retirement: 6,
      summary: "Long-term growth, comfortable with higher risk.",
      points: [
        "You are focused on long-term growth and comfortable with higher risk.",
        "You can handle short-term market swings in pursuit of stronger returns.",
        "Most of the portfolio is in equities, with a small portion in fixed income for stability.",
      ],
    },
    {
      key: "aggressive-growth", level: 6, name: "Aggressive Growth", min: 43, max: 50, equity: 100, fixed: 0, saving: 8, retirement: 7,
      summary: "Maximum long-term growth, through big ups and downs.",
      points: [
        "You aim to maximize long-term returns, even with big ups and downs.",
        "You are comfortable with high risk and a portfolio fully in equities.",
        "Best suited to a long time horizon and a strong tolerance for risk.",
      ],
    },
  ];

  function profileByKey(key) {
    return PROFILES.find((p) => p.key === key) || null;
  }

  function profileForReturn(percent) {
    const rate = Number(percent);
    if (!Number.isFinite(rate)) return null;
    for (let i = 0; i < PROFILES.length - 1; i += 1) {
      if (rate < (PROFILES[i].saving + PROFILES[i + 1].saving) / 2) return PROFILES[i];
    }
    return PROFILES[PROFILES.length - 1];
  }

  function describe(profile) {
    return `${profile.name}: ${profile.equity}% equity, ${profile.fixed}% fixed income`;
  }

  const api = { PROFILES, profileByKey, profileForReturn, describe };
  root.MarchandInvestorProfiles = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
