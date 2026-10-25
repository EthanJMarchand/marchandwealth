import { probateFees } from "../../data/probate-fees.js";

function thousandsOrPart(amount) {
  if (amount <= 0) return 0;
  return Math.ceil(amount / 1000 - 1e-9);
}

function tierFee(tiers, value) {
  for (const tier of tiers) {
    if (tier.upTo == null || value <= tier.upTo) return tier.fee;
  }
  return tiers[tiers.length - 1]?.fee ?? 0;
}

function marginalFee(province, value) {
  let fee = province.base || 0;
  let cursor = province.baseCovers || 0;
  if (value <= cursor) return fee;
  for (const band of province.bands) {
    const top = band.upTo == null ? value : Math.min(value, band.upTo);
    const portion = top - cursor;
    if (portion > 0) fee += thousandsOrPart(portion) * band.perThousand;
    cursor = top;
    if (band.upTo == null || value <= band.upTo) break;
  }
  return fee;
}

export function calculateProbate(code, estateValue, options = {}) {
  const province = probateFees.provinces[code];
  if (!province) {
    return {
      code,
      name: "Unknown",
      fee: 0,
      note: "Choose a province or territory.",
      source: "",
      asOf: probateFees.asOf,
      includedFilingFee: 0,
    };
  }

  const value = Math.max(0, Number(estateValue) || 0);
  let fee = 0;
  let includedFilingFee = 0;

  if (value > 0 && province.kind === "tiers") fee = tierFee(province.tiers, value);
  if (value > 0 && province.kind === "tiersPlus") {
    fee = value <= province.excessOver
      ? tierFee(province.tiers, value)
      : tierFee(province.tiers, province.excessOver) + thousandsOrPart(value - province.excessOver) * province.perThousand;
  }
  if (value > 0 && province.kind === "marginal") {
    fee = marginalFee(province, value);
    if (province.filingFee && value > province.filingFeeWhenAbove) {
      includedFilingFee = province.filingFee;
      fee += includedFilingFee;
    }
  }
  if (value > 0 && province.kind === "perUnit") {
    const extra = Math.max(0, value - province.baseCovers);
    const units = extra === 0 ? 0 : Math.ceil(extra / province.unit - 1e-9);
    fee = province.base + units * province.rate;
  }
  if (province.kind === "flat") {
    fee = options.courtVerification && province.verificationFee ? province.verificationFee : province.fee;
  }

  return {
    code,
    name: province.name,
    fee: Math.round(fee * 100) / 100,
    note: province.note,
    source: province.source,
    asOf: probateFees.asOf,
    includedFilingFee,
  };
}
