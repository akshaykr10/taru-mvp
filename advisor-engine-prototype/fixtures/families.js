/**
 * Synthetic test families spanning edge cases. None of this is real data.
 */

const uninsuredHighEarner = {
  familyId: "fam_uninsured_high_earner",
  income: { annual: 2400000, stability: "high" },
  expenses: { monthly: 80000 },
  dependents: 2,
  liquidReserves: 600000, // >= 6 months expenses, so this gate should pass
  insurance: { term: 500000, health: 300000 }, // both inadequate
  riskTolerance: "medium",
  monthlyInvestableSurplus: 40000,
  goals: [
    { id: "g1", name: "Child education", targetAmount: 4000000, horizonYears: 12, currentProgress: 500000, priority: 1 },
  ],
};

const noEmergencyFundSingleIncome = {
  familyId: "fam_no_emergency_fund",
  income: { annual: 1200000, stability: "medium" },
  expenses: { monthly: 60000 },
  dependents: 1,
  liquidReserves: 50000, // well short of 6 months (360000)
  insurance: { term: 1500000, health: 1000000 }, // adequate
  riskTolerance: "medium",
  monthlyInvestableSurplus: 20000,
  goals: [
    { id: "g1", name: "House down payment", targetAmount: 2000000, horizonYears: 5, currentProgress: 300000, priority: 1 },
  ],
};

const wellCoveredLongHorizon = {
  familyId: "fam_well_covered",
  income: { annual: 3000000, stability: "high" },
  expenses: { monthly: 100000 },
  dependents: 2,
  liquidReserves: 900000, // > 6 months expenses (600000), with surplus
  insurance: { term: 45000000, health: 1500000 }, // adequate at 14x (10 + 2 dependents*2) on 30L income
  riskTolerance: "high",
  monthlyInvestableSurplus: 60000,
  goals: [
    { id: "g1", name: "Retirement", targetAmount: 30000000, horizonYears: 20, currentProgress: 4000000, priority: 1 },
  ],
};

// High computed capacity (long horizon, stable income, few dependents) but
// LOW stated tolerance -- tests that the bound band pulls equity down even
// though horizon alone would push it to 85%.
const highCapacityLowTolerance = {
  familyId: "fam_high_capacity_low_tolerance",
  income: { annual: 2800000, stability: "high" },
  expenses: { monthly: 70000 },
  dependents: 0,
  liquidReserves: 700000,
  insurance: { term: 3500000, health: 1000000 },
  riskTolerance: "low",
  monthlyInvestableSurplus: 50000,
  goals: [
    { id: "g1", name: "Long-horizon wealth building", targetAmount: 15000000, horizonYears: 20, currentProgress: 1000000, priority: 1 },
  ],
};

// Two goals competing for a surplus that can't fund both at the moderate
// band -- tests the feasibility/priority logic.
const competingGoals = {
  familyId: "fam_competing_goals",
  income: { annual: 1800000, stability: "medium" },
  expenses: { monthly: 70000 },
  dependents: 1,
  liquidReserves: 500000,
  insurance: { term: 2500000, health: 1000000 },
  riskTolerance: "medium",
  monthlyInvestableSurplus: 25000,
  goals: [
    { id: "g1", name: "Child education", targetAmount: 5000000, horizonYears: 10, currentProgress: 300000, priority: 1 },
    { id: "g2", name: "World trip", targetAmount: 1500000, horizonYears: 3, currentProgress: 100000, priority: 2 },
  ],
};

module.exports = {
  uninsuredHighEarner,
  noEmergencyFundSingleIncome,
  wellCoveredLongHorizon,
  highCapacityLowTolerance,
  competingGoals,
};
