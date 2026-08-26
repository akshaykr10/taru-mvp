/**
 * Ad-hoc runner. Edit `profile` below to any numbers you want and run:
 *   node playground.js
 * to see the full structured recommendation and the generated explanation,
 * without touching the test suite. Good for "what does the engine say about
 * a family that looks like X" without writing a formal test case.
 */

const { runRecommendation } = require("./engine");
const { explain, validateNumericFidelity } = require("./engine/explain");

const profile = {
  familyId: "playground_family",
  income: { annual: 1800000, stability: "medium" },     // edit me
  expenses: { monthly: 65000 },                          // edit me
  dependents: 1,                                         // edit me
  liquidReserves: 250000,                                // edit me
  insurance: { term: 2000000, health: 500000 },          // edit me
  riskTolerance: "medium",                               // "low" | "medium" | "high"
  monthlyInvestableSurplus: 22000,                        // edit me
  goals: [
    {
      id: "g1",
      name: "Child's college fund",
      targetAmount: 4500000,
      horizonYears: 11,
      currentProgress: 400000,
      priority: 1,
    },
    // add more goals here if you want to test competing-priority behavior
  ],
};

const recommendation = runRecommendation(profile);
console.log("=== STRUCTURED RECOMMENDATION ===");
console.log(JSON.stringify(recommendation, null, 2));

const text = explain(recommendation);
console.log("\n=== FAMILY-FACING EXPLANATION ===");
console.log(text);

const fidelity = validateNumericFidelity(text, recommendation);
console.log("\n=== FIDELITY CHECK ===");
console.log(fidelity.valid ? "PASS - every number in the text traces back to the engine." : `FAIL - unmatched numbers: ${fidelity.unmatchedNumbers}`);
