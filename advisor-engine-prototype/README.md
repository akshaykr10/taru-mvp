# Advisor Engine Prototype

Standalone prototype of the deterministic recommendation engine described in `AI_Advisor_Recommendation_Engine_Vision.md`. Not wired into the Taru app, not touching Supabase, not on any route. This is a rules-engine sandbox to prove the calculation logic and the audit-trail structure before anything gets a UI, an LLM, or a real family's data.

## What's actually implemented

Emergency fund gate, insurance adequacy gate (term + health), risk capacity scoring bounded by stated tolerance, per-goal gap calculation across three return bands, a horizon-based allocation glide path capped by the risk bound, and a feasibility pass that allocates a limited monthly surplus across competing goals by priority. All of it runs through one orchestrator (`engine/index.js`) that returns a single versioned, structured recommendation object.

There's also a template-based explanation generator (`engine/explain.js`) and a numeric-fidelity validator that checks generated text against the engine's own output. The template is not the point, the validator is. When this layer eventually gets replaced by an LLM to make the prose sound natural, the validator has to survive that swap intact, and any explanation that fails it should never reach a family.

## What's NOT implemented, on purpose

Tax-aware sell logic, specific fund selection criteria (expense ratio / tracking error / manager tenure screens), rebalancing deviation triggers, and life-event-driven profile updates are all still just prose in the design doc, not code. They were left out of this slice deliberately, per the "narrow first slice" plan, rather than building the full surface area before anything's been reviewed.

## Run it

```
cd advisor-engine
node --test test/engine.test.js
```

19 tests, all passing as of this prototype. They cover gate triggering and non-triggering, the multiplier cap on the insurance gate, capacity-vs-tolerance bounding (including the case where tolerance pulls allocation down despite high computed capacity), goal-gap math cross-checked against an independently computed benchmark, feasibility/priority ordering across competing goals, and the numeric-fidelity validator catching a deliberately fabricated number.

Two real bugs surfaced during testing and got fixed, not glossed over: a test fixture had insurance cover that looked "adequate" by eye but was actually short by the formula's own math (fixed the fixture, not the formula, since the formula was right), and a hand-estimated "plausible range" for a SIP calculation was wrong because it didn't account for how much a current balance's compounding reduces the required contribution (replaced with an independently cross-checked exact benchmark instead of a guessed range).

## Open assumptions that need real review before this touches a family

The 6-month emergency fund threshold, the 10–15x income-replacement multiplier for term insurance, the flat ₹5L-per-person health cover benchmark, the three return assumption bands (6/9/12%), and the horizon-to-equity glide path buckets are all illustrative placeholders. None of them are wrong exactly, they're reasonable defaults, but none of them are cited against a published standard yet. Before any of this is used for a real recommendation, a registered RIA/CFP needs to either confirm these or replace them with sourced figures, and that review needs to happen on a schedule going forward, not just once.

The capacity-vs-tolerance bounding rule (lower of the two wins) is a values decision about paternalism, not a mathematical fact. It's implemented as a hard bound here because that's the more defensible default, but it should be a decision your RIA partner explicitly signs off on rather than something that ships because nobody argued about it.

## Versioning

Every rule module tags its output with a rule ID and the orchestrator stamps the whole recommendation with `engineVersion`. That's the minimum needed for the audit trail described in the design doc — know which version of which rule produced which number, for any recommendation, at any point later.
