/**
 * Explanation layer prototype.
 *
 * This is template-based, not an LLM call — deliberately, for this
 * prototype. The point isn't the prose quality, it's proving out the
 * control: a numeric-fidelity validator that checks every number appearing
 * in generated text against the engine's own output. When this layer is
 * later replaced with an LLM (to make the prose read naturally instead of
 * like a template), the validator is what has to survive that swap
 * unchanged. If an LLM-generated explanation fails validateNumericFidelity,
 * it must not be shown to the family — regenerate or fall back to the
 * template.
 */

function explain(recommendation) {
  const lines = [];

  if (recommendation.gates.emergencyFund.triggered) {
    const g = recommendation.gates.emergencyFund;
    lines.push(
      `Before anything else: your emergency fund is short by ₹${g.gap.toLocaleString("en-IN")}. ` +
      `You have ₹${g.current.toLocaleString("en-IN")} set aside against a target of ₹${g.required.toLocaleString("en-IN")} ` +
      `(${g.monthsCovered} months of expenses).`
    );
  }

  if (recommendation.gates.insurance.triggered) {
    const ins = recommendation.gates.insurance;
    if (ins.term.gap > 0) {
      lines.push(
        `Your term life cover is ₹${ins.term.gap.toLocaleString("en-IN")} short of the recommended ` +
        `₹${ins.term.required.toLocaleString("en-IN")}.`
      );
    }
    if (ins.health.gap > 0) {
      lines.push(
        `Your health cover is ₹${ins.health.gap.toLocaleString("en-IN")} short of the recommended ` +
        `₹${ins.health.required.toLocaleString("en-IN")}.`
      );
    }
  }

  for (const goal of recommendation.goals) {
    const feasible = recommendation.feasibility.goals.find((f) => f.goalId === goal.goalId);
    lines.push(
      `For "${goal.goalName}" (₹${goal.targetAmount.toLocaleString("en-IN")} in ${goal.horizonYears} years): ` +
      `closing the gap needs roughly ₹${goal.requiredMonthlySip.moderate.toLocaleString("en-IN")}/month ` +
      `at a moderate return assumption, in a mix of ${goal.allocation.allocation.equity}% equity / ` +
      `${goal.allocation.allocation.debt}% debt${goal.allocation.allocation.gold ? ` / ${goal.allocation.allocation.gold}% gold` : ""}. ` +
      `Based on your current monthly surplus, this goal is currently ${feasible.status.replace(/_/g, " ")}.`
    );
  }

  return lines.join("\n\n");
}

// Pulls every number out of a block of text and checks each one appears
// somewhere in the flattened set of numbers from the source recommendation.
// This can't prove the text is *correct*, only that it isn't inventing
// figures the engine never produced — that's the specific failure mode
// this exists to catch.
function validateNumericFidelity(text, recommendation) {
  const textNumbers = extractNumbers(text);
  const sourceNumbers = new Set(flattenNumbers(recommendation).map((n) => roundForCompare(n)));

  const unmatched = textNumbers.filter((n) => !sourceNumbers.has(roundForCompare(n)));

  return {
    valid: unmatched.length === 0,
    unmatchedNumbers: unmatched,
  };
}

function extractNumbers(text) {
  const matches = text.match(/[\d,]+(\.\d+)?/g) || [];
  return matches
    .map((m) => parseFloat(m.replace(/,/g, "")))
    .filter((n) => !Number.isNaN(n) && n !== 0); // 0 and small integers (like "6 months") are too noisy to police usefully
}

function flattenNumbers(obj, acc = []) {
  if (typeof obj === "number") {
    acc.push(obj);
  } else if (Array.isArray(obj)) {
    obj.forEach((v) => flattenNumbers(v, acc));
  } else if (obj && typeof obj === "object") {
    Object.values(obj).forEach((v) => flattenNumbers(v, acc));
  }
  return acc;
}

function roundForCompare(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { explain, validateNumericFidelity };
