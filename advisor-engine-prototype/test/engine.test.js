const test = require("node:test");
const assert = require("node:assert/strict");

const { runRecommendation } = require("../engine");
const { emergencyFundGate, insuranceGate } = require("../engine/gates");
const { runRiskModel } = require("../engine/riskModel");
const { requiredMonthlySip } = require("../engine/goalGap");
const { explain, validateNumericFidelity } = require("../engine/explain");
const fixtures = require("../fixtures/families");

// --- Emergency fund gate ---

test("emergency fund gate triggers when reserves fall short", () => {
  const result = emergencyFundGate(fixtures.noEmergencyFundSingleIncome);
  assert.equal(result.triggered, true);
  assert.equal(result.required, 60000 * 6);
  assert.equal(result.gap, 60000 * 6 - 50000);
});

test("emergency fund gate does not trigger when reserves are sufficient", () => {
  const result = emergencyFundGate(fixtures.wellCoveredLongHorizon);
  assert.equal(result.triggered, false);
  assert.equal(result.gap, 0);
});

// --- Insurance gate ---

test("insurance gate term multiplier scales with dependents, capped at 15x", () => {
  const zeroDep = insuranceGate({ ...fixtures.highCapacityLowTolerance, dependents: 0 });
  const twoDep = insuranceGate({ ...fixtures.uninsuredHighEarner, dependents: 2 });
  const manyDep = insuranceGate({ ...fixtures.uninsuredHighEarner, dependents: 10 });

  assert.equal(zeroDep.term.multiplier, 10);
  assert.equal(twoDep.term.multiplier, 14);
  assert.equal(manyDep.term.multiplier, 15); // capped
});

test("insurance gate triggers on an underinsured family", () => {
  const result = insuranceGate(fixtures.uninsuredHighEarner);
  assert.equal(result.triggered, true);
  assert.ok(result.term.gap > 0);
  assert.ok(result.health.gap > 0);
});

test("insurance gate does not trigger on an adequately insured family", () => {
  const result = insuranceGate(fixtures.wellCoveredLongHorizon);
  assert.equal(result.triggered, false);
});

// --- Risk model: capacity vs tolerance bounding ---

test("bound band is pulled down by a more conservative stated tolerance than computed capacity", () => {
  const result = runRiskModel(fixtures.highCapacityLowTolerance, 20);
  assert.equal(result.capacityBand, "high"); // long horizon, stable income, no dependents
  assert.equal(result.toleranceBand, "low");
  assert.equal(result.boundBand, "low"); // bound = min(capacity, tolerance)
  assert.ok(result.note && result.note.includes("Bound to low"));
});

test("bound band equals capacity when tolerance is not more conservative", () => {
  const result = runRiskModel(fixtures.wellCoveredLongHorizon, 20);
  assert.equal(result.boundBand, result.capacityBand <= result.toleranceBand ? result.capacityBand : result.toleranceBand);
});

// --- Goal gap SIP calculation ---

test("required SIP is zero when current progress already exceeds target at every return band", () => {
  const sip = requiredMonthlySip(100000, 5, 500000, 0.09);
  assert.equal(sip, 0);
});

test("required SIP decreases as horizon lengthens, for the same target and progress", () => {
  const shortHorizon = requiredMonthlySip(2000000, 5, 300000, 0.09);
  const longHorizon = requiredMonthlySip(2000000, 15, 300000, 0.09);
  assert.ok(longHorizon < shortHorizon, `expected longer horizon to need a smaller SIP (${longHorizon} vs ${shortHorizon})`);
});

test("required SIP decreases as current progress increases, all else equal", () => {
  const lowProgress = requiredMonthlySip(2000000, 10, 100000, 0.09);
  const highProgress = requiredMonthlySip(2000000, 10, 1000000, 0.09);
  assert.ok(highProgress < lowProgress);
});

test("required SIP for a known 10-year / 9% case matches an independently computed benchmark", () => {
  // 20L target, 10 year horizon, 3L already invested, 9% assumed return.
  // Cross-checked independently: FV of the 3L headstart at 9%/12 compounded
  // over 120 months is about 7.35L, leaving about 12.65L to close via SIP,
  // which at a 193.5 annuity factor works out to about Rs 6,535/month. A
  // version of this formula with no headstart (pure SIP from zero) should
  // need close to Rs 10,335/month -- asserting both catches a regression in
  // either the FV step or the annuity step, not just one.
  const withHeadstart = requiredMonthlySip(2000000, 10, 300000, 0.09);
  const fromZero = requiredMonthlySip(2000000, 10, 0, 0.09);

  assert.ok(Math.abs(withHeadstart - 6535) < 5, `expected ~6535, got ${withHeadstart}`);
  assert.ok(Math.abs(fromZero - 10335) < 5, `expected ~10335, got ${fromZero}`);
  assert.ok(withHeadstart < fromZero, "a headstart should always reduce the required SIP");
});

test("goal gap calculation is deterministic across repeated calls", () => {
  const a = requiredMonthlySip(2000000, 10, 300000, 0.09);
  const b = requiredMonthlySip(2000000, 10, 300000, 0.09);
  assert.equal(a, b);
});

// --- Allocation bounded by risk band ---

test("full recommendation caps equity allocation when tolerance is more conservative than capacity", () => {
  const rec = runRecommendation(fixtures.highCapacityLowTolerance);
  const goal = rec.goals[0];
  assert.equal(rec.risk.boundBand, "low");
  assert.equal(goal.allocation.allocation.equity, 40); // capped, not the 85% a 20-year horizon alone would give
  assert.equal(goal.allocation.cappedByRiskBand, true);
});

// --- Feasibility / priority across competing goals ---

test("feasibility marks a lower-priority goal as partially or un-fundable when surplus is insufficient", () => {
  const rec = runRecommendation(fixtures.competingGoals);
  const [top, second] = rec.feasibility.goals; // sorted by priority
  assert.equal(top.priority, 1);
  assert.equal(second.priority, 2);
  assert.ok(
    second.status === "partially_fundable" || second.status === "unfunded",
    `expected second-priority goal to be constrained, got ${second.status}`
  );
});

// --- Gate triggering surfaces correctly in the full orchestrated output ---

test("full recommendation flags gates as top priority ahead of goal advice", () => {
  const rec = runRecommendation(fixtures.uninsuredHighEarner);
  assert.equal(rec.gates.anyTriggered, true);
  assert.ok(rec.priorityNote);
});

test("full recommendation has no priority note when no gates trigger", () => {
  const rec = runRecommendation(fixtures.wellCoveredLongHorizon);
  assert.equal(rec.gates.anyTriggered, false);
  assert.equal(rec.priorityNote, null);
});

// --- Explanation layer numeric fidelity ---

test("template-generated explanation passes its own numeric fidelity check", () => {
  const rec = runRecommendation(fixtures.uninsuredHighEarner);
  const text = explain(rec);
  const validation = validateNumericFidelity(text, rec);
  assert.equal(validation.valid, true, `unmatched numbers: ${JSON.stringify(validation.unmatchedNumbers)}`);
});

test("numeric fidelity check catches a fabricated number that isn't in the source data", () => {
  const rec = runRecommendation(fixtures.wellCoveredLongHorizon);
  const tamperedText = explain(rec) + "\n\nAlso, you should expect a guaranteed 47% return next year.";
  const validation = validateNumericFidelity(tamperedText, rec);
  assert.equal(validation.valid, false);
  assert.ok(validation.unmatchedNumbers.includes(47));
});

// --- Profile validation ---

test("runRecommendation throws a clear error on an invalid profile instead of silently proceeding", () => {
  assert.throws(() => runRecommendation({ familyId: "bad" }), /Invalid profile/);
});
