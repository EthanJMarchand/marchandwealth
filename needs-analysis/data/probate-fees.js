// Probate and estate-administration fees by province and territory.
// Edit the numbers in this file when a schedule changes. The worksheet reads this file only.
// These are court fees on value that actually passes through the estate. They are not an inheritance tax.
// Named-beneficiary life insurance, TFSAs, and RRSPs usually bypass probate. An RRSP can still be taxable.
// Sources are named on each province. Confirm the schedule before relying on a fee.

export const provinceOrder = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];

export const probateFees = {
  asOf: "2026-07",
  provinces: {
    AB: {
      name: "Alberta",
      kind: "tiers",
      tiers: [
        { upTo: 10000, fee: 35 },
        { upTo: 25000, fee: 135 },
        { upTo: 125000, fee: 275 },
        { upTo: 250000, fee: 400 },
        { upTo: null, fee: 525 },
      ],
      note: "Court fee under the Surrogate Rules. The fee is capped. Alberta has no inheritance tax.",
      source: "Alberta Surrogate Rules, Schedule 2",
    },
    BC: {
      name: "British Columbia",
      kind: "marginal",
      base: 0,
      baseCovers: 25000,
      bands: [
        { upTo: 50000, perThousand: 6 },
        { upTo: null, perThousand: 14 },
      ],
      filingFee: 200,
      filingFeeWhenAbove: 25000,
      note: "Probate fee under the Probate Fee Act, plus a $200 court filing fee when the estate is over $25,000. Each partial $1,000 is charged as a full $1,000.",
      source: "Probate Fee Act, SBC 1999, c. 4, and B.C. Supreme Court Civil Rules filing fees",
    },
    MB: {
      name: "Manitoba",
      kind: "flat",
      fee: 0,
      note: "Manitoba abolished the value-based probate fee on November 6, 2020. A separate court filing charge may still apply and is not in this file.",
      source: "The Court Services Fees Regulation, amendment repealing probate fees",
    },
    NB: {
      name: "New Brunswick",
      kind: "marginal",
      base: 200,
      baseCovers: 20000,
      bands: [
        { upTo: 100000, perThousand: 5 },
        { upTo: null, perThousand: 15 },
      ],
      note: "Schedule in force June 12, 2026. $200 on the first $20,000, $5 per $1,000 from there to $100,000, and $15 per $1,000 above $100,000.",
      source: "New Brunswick Probate Court Act, as amended June 12, 2026",
    },
    NL: {
      name: "Newfoundland and Labrador",
      kind: "perUnit",
      base: 60,
      baseCovers: 1000,
      unit: 100,
      rate: 0.6,
      note: "$60 on the first $1,000, then $0.60 per $100 above that.",
      source: "Supreme Court of Newfoundland and Labrador probate fees",
    },
    NS: {
      name: "Nova Scotia",
      kind: "tiersPlus",
      tiers: [
        { upTo: 10000, fee: 85.6 },
        { upTo: 25000, fee: 215.2 },
        { upTo: 50000, fee: 358.15 },
        { upTo: 100000, fee: 1002.65 },
      ],
      excessOver: 100000,
      perThousand: 16.95,
      note: "Tiered fee through $100,000, then $16.95 per $1,000 above $100,000.",
      source: "Nova Scotia Probate Act regulations, court fee schedule",
    },
    NT: {
      name: "Northwest Territories",
      kind: "tiers",
      tiers: [
        { upTo: 10000, fee: 30 },
        { upTo: 25000, fee: 110 },
        { upTo: 125000, fee: 215 },
        { upTo: 250000, fee: 325 },
        { upTo: null, fee: 435 },
      ],
      note: "Court fee. The top tier is a flat fee, not a percentage.",
      source: "Court Services Fees Regulations, R-120-93",
    },
    NU: {
      name: "Nunavut",
      kind: "tiers",
      tiers: [
        { upTo: 10000, fee: 30 },
        { upTo: 25000, fee: 110 },
        { upTo: 125000, fee: 215 },
        { upTo: 250000, fee: 325 },
        { upTo: null, fee: 425 },
      ],
      note: "Court fee under Schedule C. The top tier is a flat fee.",
      source: "Court Fees Regulations, R-042-2021, Schedule C",
    },
    ON: {
      name: "Ontario",
      kind: "marginal",
      base: 0,
      baseCovers: 50000,
      bands: [{ upTo: null, perThousand: 15 }],
      note: "Estate administration tax. Nothing on the first $50,000. $15 per $1,000, or part, above that. There is no cap.",
      source: "Estate Administration Tax Act, 1998",
    },
    PE: {
      name: "Prince Edward Island",
      kind: "tiersPlus",
      tiers: [
        { upTo: 10000, fee: 50 },
        { upTo: 25000, fee: 100 },
        { upTo: 50000, fee: 200 },
        { upTo: 100000, fee: 400 },
      ],
      excessOver: 100000,
      perThousand: 4,
      note: "Tiered fee through $100,000, then $4 per $1,000 above $100,000.",
      source: "Prince Edward Island Probate Act regulations",
    },
    QC: {
      name: "Quebec",
      kind: "flat",
      fee: 0,
      verificationFee: 243,
      note: "Quebec has no probate tax. A notarial will is not verified by the court. Other wills may need court verification. The verification amount is a 2026 secondary figure: edit it here if the court fee changes.",
      source: "Civil Code of Québec; 2026 court verification figure from published estate-fee summaries",
    },
    SK: {
      name: "Saskatchewan",
      kind: "marginal",
      base: 0,
      baseCovers: 0,
      bands: [{ upTo: null, perThousand: 7 }],
      note: "$7 per $1,000 of estate value, with each partial $1,000 charged as a full $1,000. There is no cap.",
      source: "The Administration of Estates Act and Saskatchewan probate fee schedule",
    },
    YT: {
      name: "Yukon",
      kind: "tiers",
      tiers: [
        { upTo: 25000, fee: 0 },
        { upTo: null, fee: 140 },
      ],
      note: "No fee at $25,000 or below. A flat $140 above that.",
      source: "Yukon Rules of Court, probate fees",
    },
  },
};
