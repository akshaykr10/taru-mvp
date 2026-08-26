/**
 * Risk capacity (computed) vs risk tolerance (self-reported). The bound
 * band is the lower of the two — this is a deliberate paternalism choice,
 * not a math fact. Flagged in README as something that needs RIA sign-off,
 * not a silent default.
 */

const BAND_ORDER = { low: 0, medium: 1, high: 2 };

function capacityScore(profile, nearestGoalHorizonYears) {
  const horizonScore = Math.min(nearestGoalHorizonYears, 20) / 20 * 40; // max 40

  const stabilityScores = { high: 30, medium: 18, low: 8 };
  const incomeStabilityScore = stabilityScores[profile.income.stability];

  const dependentsScore = Math.max(0, 20 - profile.dependents * 5); // max 20

  const annualExpenses = profile.expenses.monthly * 12;
  const liquidAfterEmergencyFund = Math.max(
    0,
    profile.liquidReserves - profile.expenses.monthly * 6
  );
  const liquidityRatio = annualExpenses > 0 ? liquidAfterEmergencyFund / annualExpenses : 0;
  const liquidityScore = Math.min(liquidityRatio * 20, 10); // max 10

  const total = horizonScore + incomeStabilityScore + dependentsScore + liquidityScore;
  return Math.min(Math.round(total), 100);
}

function bandFromScore(score) {
  if (score <= 35) return "low";
  if (score <= 65) return "medium";
  return "high";
}

function boundBand(capacityBand, toleranceBand) {
  return BAND_ORDER[capacityBand] <= BAND_ORDER[toleranceBand] ? capacityBand : toleranceBand;
}

function runRiskModel(profile, nearestGoalHorizonYears) {
  const score = capacityScore(profile, nearestGoalHorizonYears);
  const capacityBand = bandFromScore(score);
  const toleranceBand = profile.riskTolerance;
  const bound = boundBand(capacityBand, toleranceBand);

  return {
    rule: "risk_capacity_v1",
    capacityScore: score,
    capacityBand,
    toleranceBand,
    boundBand: bound,
    note: bound !== capacityBand
      ? `Bound to ${bound} band because stated tolerance (${toleranceBand}) is more conservative than computed capacity (${capacityBand}).`
      : bound !== toleranceBand
      ? `Bound to ${bound} band because computed capacity (${capacityBand}) is more conservative than stated tolerance (${toleranceBand}).`
      : null,
  };
}

module.exports = { runRiskModel, capacityScore, bandFromScore, boundBand, BAND_ORDER };
