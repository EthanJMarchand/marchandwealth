function grow(balance, rate) {
  if (balance <= 0) return 0;
  if (rate <= -1) return 0;
  return balance * (1 + rate);
}

// Balances from today through retirement, then through the likely age at death.
// Each retirement year withdraws the income gap only. Anything above that stays
// invested, so the balance can finish above the legacy. Saving-year rows come
// from the allocation. Withdrawals are proportional across the three accounts.
export function wealthPath({
  opening,
  balancesByAge = [],
  currentAge,
  retirementAge,
  deathAge,
  retirementReturn = 0,
  nonRegReturn = 0,
  annualWithdrawal = 0,
}) {
  const start = Number(currentAge);
  const end = Number(deathAge);
  const opened = {
    age: start,
    tfsa: Math.max(0, opening?.tfsa || 0),
    rrsp: Math.max(0, opening?.rrsp || 0),
    nonReg: Math.max(0, opening?.nonReg || 0),
  };
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [opened];

  const retire = Number.isFinite(Number(retirementAge)) ? Number(retirementAge) : end;
  const savingEnd = Math.min(end, retire);
  const points = [opened];
  for (const row of balancesByAge) {
    if (row.age > start && row.age <= savingEnd + 0.001) {
      points.push({
        age: row.age,
        tfsa: Math.max(0, row.tfsa),
        rrsp: Math.max(0, row.rrsp),
        nonReg: Math.max(0, row.nonReg),
      });
    }
  }

  const last = points[points.length - 1];
  if (end <= retire + 0.001 || last.age + 0.001 < retire) return points;

  const drawFrom = last.age;
  const drawYears = Math.round(end - drawFrom);
  if (drawYears <= 0) return points;

  let tfsa = last.tfsa;
  let rrsp = last.rrsp;
  let nonReg = last.nonReg;
  const annual = Math.max(0, annualWithdrawal);

  for (let year = 1; year <= drawYears; year += 1) {
    tfsa = grow(tfsa, retirementReturn);
    rrsp = grow(rrsp, retirementReturn);
    nonReg = grow(nonReg, nonRegReturn);
    const total = tfsa + rrsp + nonReg;
    const take = Math.min(annual, total);
    if (total > 0 && take > 0) {
      const keep = (total - take) / total;
      tfsa *= keep;
      rrsp *= keep;
      nonReg *= keep;
    }
    points.push({ age: drawFrom + year, tfsa, rrsp, nonReg });
  }
  return points;
}

// One pot, same rule as the chart: grow, withdraw the income gap, keep the rest.
export function balanceAfterWithdrawals(start, withdrawal, rate, years) {
  let balance = Math.max(0, start);
  const take = Math.max(0, withdrawal);
  const growth = Number.isFinite(rate) && rate > -1 ? 1 + rate : 0;
  const span = Math.max(0, Math.round(years));
  for (let year = 0; year < span; year += 1) {
    balance = Math.max(0, balance * growth - take);
  }
  return balance;
}

export function balanceAtAge(points, age) {
  if (!points.length) return null;
  return points.reduce((best, point) => (Math.abs(point.age - age) < Math.abs(best.age - age) ? point : best));
}
