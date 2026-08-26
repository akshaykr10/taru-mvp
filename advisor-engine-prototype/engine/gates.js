/**
 * Gate checks. These run before any goal-based investment advice and, when
 * triggered, outrank every other recommendation regardless of what the
 * family actually asked about.
 *
 * Both multipliers below (6 months expenses, income-replacement multiple)
 * are placeholder defaults, not citations. Before this goes near a real
 * family, an RIA/CFP needs to confirm or replace these against a published
 * standard — see README "Open assumptions".
 */

const EMERGENCY_FUND_MONTHS = 6;

function emergencyFundGate(profile) {
  const required = profile.expenses.monthly * EMERGENCY_FUND_MONTHS;
  const gap = Math.max(0, required - profile.liquidReserves);
  return {
    rule: "emergency_fund_v1",
    monthsCovered: EMERGENCY_FUND_MONTHS,
    required: round2(required),
    current: profile.liquidReserves,
    gap: round2(gap),
    triggered: gap > 0,
  };
}

// Income-replacement multiple scales with dependents. Capped at 15x.
function termMultiplier(dependents) {
  return Math.min(10 + dependents * 2, 15);
}

// Flat per-dependent health benchmark (placeholder — no city-tier
// adjustment yet, see README).
const HEALTH_COVER_PER_PERSON = 500000;

function insuranceGate(profile) {
  const multiplier = termMultiplier(profile.dependents);
  const termRequired = profile.income.annual * multiplier;
  const termGap = Math.max(0, termRequired - profile.insurance.term);

  const familySize = profile.dependents + 1; // +1 for the earning parent
  const healthRequired = familySize * HEALTH_COVER_PER_PERSON;
  const healthGap = Math.max(0, healthRequired - profile.insurance.health);

  return {
    rule: "insurance_adequacy_v1",
    term: {
      multiplier,
      required: round2(termRequired),
      current: profile.insurance.term,
      gap: round2(termGap),
    },
    health: {
      benchmarkPerPerson: HEALTH_COVER_PER_PERSON,
      required: round2(healthRequired),
      current: profile.insurance.health,
      gap: round2(healthGap),
    },
    triggered: termGap > 0 || healthGap > 0,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { emergencyFundGate, insuranceGate, EMERGENCY_FUND_MONTHS, HEALTH_COVER_PER_PERSON };
