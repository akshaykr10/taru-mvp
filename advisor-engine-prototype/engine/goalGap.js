/**
 * Goal-gap calculator. Never returns a single number — always conservative /
 * moderate / aggressive bands, because a single point estimate implies a
 * certainty this doesn't have.
 *
 * Return assumptions are illustrative placeholders (see README). They need
 * to be reviewed on a schedule, not just when someone notices they're stale.
 */

const RETURN_ASSUMPTIONS = {
  conservative: 0.06,
  moderate: 0.09,
  aggressive: 0.12,
};

// Required monthly SIP to close the gap between a future-valued current
// balance and the target, using the standard future-value-of-an-ordinary-
// annuity formula solved for PMT.
function requiredMonthlySip(targetAmount, horizonYears, currentProgress, annualRate) {
  const n = Math.round(horizonYears * 12);
  const r = annualRate / 12;

  const fvOfCurrent = currentProgress * Math.pow(1 + r, n);
  const remaining = targetAmount - fvOfCurrent;

  if (remaining <= 0) return 0;
  if (n === 0) return remaining;

  const annuityFactor = r === 0 ? n : (Math.pow(1 + r, n) - 1) / r;
  return remaining / annuityFactor;
}

function goalGap(goal) {
  const bands = {};
  for (const [label, rate] of Object.entries(RETURN_ASSUMPTIONS)) {
    bands[label] = round2(
      requiredMonthlySip(goal.targetAmount, goal.horizonYears, goal.currentProgress, rate)
    );
  }

  return {
    rule: "goal_gap_v1",
    goalId: goal.id,
    goalName: goal.name,
    targetAmount: goal.targetAmount,
    horizonYears: goal.horizonYears,
    currentProgress: goal.currentProgress,
    returnAssumptions: RETURN_ASSUMPTIONS,
    requiredMonthlySip: bands,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { goalGap, requiredMonthlySip, RETURN_ASSUMPTIONS };
