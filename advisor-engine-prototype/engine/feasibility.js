/**
 * When required SIPs across all goals (moderate band) exceed the family's
 * stated monthly surplus, allocate available surplus by priority (1 =
 * highest) and mark the rest as partially or fully unfunded. This is the
 * piece that turns a list of independent goal-gap numbers into something a
 * family can actually act on with a fixed monthly budget.
 */

function assessFeasibility(goalGapResults, monthlyInvestableSurplus, goals) {
  const priorityOrder = [...goals].sort((a, b) => a.priority - b.priority);
  let remaining = monthlyInvestableSurplus;
  const results = [];

  for (const goal of priorityOrder) {
    const gapResult = goalGapResults.find((g) => g.goalId === goal.id);
    const required = gapResult.requiredMonthlySip.moderate;

    let funded, shortfall, status;
    if (required <= 0) {
      funded = 0;
      shortfall = 0;
      status = "already_on_track";
    } else if (remaining >= required) {
      funded = required;
      shortfall = 0;
      status = "fully_fundable";
      remaining -= required;
    } else if (remaining > 0) {
      funded = remaining;
      shortfall = round2(required - remaining);
      status = "partially_fundable";
      remaining = 0;
    } else {
      funded = 0;
      shortfall = required;
      status = "unfunded";
    }

    results.push({
      goalId: goal.id,
      goalName: goal.name,
      priority: goal.priority,
      requiredMonthlySip: required,
      allocatedMonthlySip: round2(funded),
      shortfall,
      status,
    });
  }

  return {
    rule: "feasibility_v1",
    monthlyInvestableSurplus,
    remainingUnallocated: round2(Math.max(0, remaining)),
    goals: results,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { assessFeasibility };
