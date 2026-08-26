/**
 * Asset allocation model: a horizon-based glide path, capped by the bound
 * risk band from riskModel.js. The bound band can only pull equity exposure
 * down from what horizon alone would suggest, never push it up — capacity
 * and tolerance are a ceiling, not a floor.
 *
 * Base glide path buckets are illustrative and need to be checked against a
 * published framework (SEBI model portfolios, standard life-cycle research)
 * before this is used for a real recommendation. See README.
 */

function baseEquityForHorizon(horizonYears) {
  if (horizonYears < 3) return 20;
  if (horizonYears < 7) return 50;
  if (horizonYears < 15) return 70;
  return 85;
}

const BAND_EQUITY_CAP = {
  low: 40,
  medium: 65,
  high: 100, // no additional cap beyond horizon
};

function allocationForGoal(horizonYears, boundBand) {
  const base = baseEquityForHorizon(horizonYears);
  const cap = BAND_EQUITY_CAP[boundBand];
  const equity = Math.min(base, cap);

  const gold = equity > 50 ? 5 : 0;
  const debt = 100 - equity - gold;

  return {
    rule: "allocation_glidepath_v1",
    horizonYears,
    boundBand,
    baseEquityFromHorizon: base,
    cappedByRiskBand: base > cap,
    allocation: { equity, debt, gold },
  };
}

module.exports = { allocationForGoal, baseEquityForHorizon, BAND_EQUITY_CAP };
