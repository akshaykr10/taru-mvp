/**
 * Orchestrator. Runs a validated family profile through every rule module
 * and returns one structured, versioned recommendation object. This is the
 * ONLY output the explanation layer (see explain.js) is allowed to read
 * numbers from — nothing downstream of this file may introduce a new
 * number.
 */

const { validateProfile } = require("./profile");
const { emergencyFundGate, insuranceGate } = require("./gates");
const { runRiskModel } = require("./riskModel");
const { goalGap } = require("./goalGap");
const { allocationForGoal } = require("./allocation");
const { assessFeasibility } = require("./feasibility");

const ENGINE_VERSION = "0.1.0";

function runRecommendation(profile) {
  const { valid, errors } = validateProfile(profile);
  if (!valid) {
    throw new Error(`Invalid profile: ${errors.join("; ")}`);
  }

  const emergencyFund = emergencyFundGate(profile);
  const insurance = insuranceGate(profile);

  const nearestGoalHorizon = Math.min(...profile.goals.map((g) => g.horizonYears));
  const risk = runRiskModel(profile, nearestGoalHorizon);

  const goalResults = profile.goals.map((goal) => {
    const gap = goalGap(goal);
    const allocation = allocationForGoal(goal.horizonYears, risk.boundBand);
    return { ...gap, allocation };
  });

  const feasibility = assessFeasibility(goalResults, profile.monthlyInvestableSurplus, profile.goals);

  return {
    engineVersion: ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    familyId: profile.familyId,
    gates: {
      emergencyFund,
      insurance,
      anyTriggered: emergencyFund.triggered || insurance.triggered,
    },
    risk,
    goals: goalResults,
    feasibility,
    priorityNote: (emergencyFund.triggered || insurance.triggered)
      ? "Gate checks triggered. Emergency fund and/or insurance gaps should be shown to the family as the top recommendation, ahead of goal-based investing, even though goal calculations are included below."
      : null,
  };
}

module.exports = { runRecommendation, ENGINE_VERSION };
