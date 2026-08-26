/**
 * Family profile schema and validation.
 *
 * This is the only shape the rest of the engine trusts. Every downstream
 * module assumes a profile has already passed validateProfile() — none of
 * them re-check types themselves.
 */

const RISK_LEVELS = ["low", "medium", "high"];
const STABILITY_LEVELS = ["low", "medium", "high"];

function validateProfile(profile) {
  const errors = [];

  if (!profile || typeof profile !== "object") {
    return { valid: false, errors: ["profile must be an object"] };
  }

  const req = (path, val, type) => {
    if (val === undefined || val === null) errors.push(`${path} is required`);
    else if (type === "number" && (typeof val !== "number" || Number.isNaN(val))) errors.push(`${path} must be a number`);
    else if (type === "string" && typeof val !== "string") errors.push(`${path} must be a string`);
  };

  req("familyId", profile.familyId, "string");
  req("income.annual", profile.income?.annual, "number");
  req("income.stability", profile.income?.stability, "string");
  if (profile.income?.stability && !STABILITY_LEVELS.includes(profile.income.stability)) {
    errors.push(`income.stability must be one of ${STABILITY_LEVELS.join(", ")}`);
  }
  req("expenses.monthly", profile.expenses?.monthly, "number");
  req("dependents", profile.dependents, "number");
  req("liquidReserves", profile.liquidReserves, "number");
  req("insurance.term", profile.insurance?.term, "number");
  req("insurance.health", profile.insurance?.health, "number");
  req("riskTolerance", profile.riskTolerance, "string");
  if (profile.riskTolerance && !RISK_LEVELS.includes(profile.riskTolerance)) {
    errors.push(`riskTolerance must be one of ${RISK_LEVELS.join(", ")}`);
  }
  req("monthlyInvestableSurplus", profile.monthlyInvestableSurplus, "number");

  if (!Array.isArray(profile.goals) || profile.goals.length === 0) {
    errors.push("goals must be a non-empty array");
  } else {
    profile.goals.forEach((g, i) => {
      req(`goals[${i}].id`, g.id, "string");
      req(`goals[${i}].name`, g.name, "string");
      req(`goals[${i}].targetAmount`, g.targetAmount, "number");
      req(`goals[${i}].horizonYears`, g.horizonYears, "number");
      req(`goals[${i}].currentProgress`, g.currentProgress, "number");
      req(`goals[${i}].priority`, g.priority, "number");
    });
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateProfile, RISK_LEVELS, STABILITY_LEVELS };
