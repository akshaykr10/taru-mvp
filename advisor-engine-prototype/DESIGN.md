# AI Wealth Advisor — Recommendation Engine & Family Communication Framework

**Status: forward-looking design exploration. Not part of Taru Phase 0. Assumes SEBI RIA clearance is resolved (registration or a registered-RIA partnership) before any of this ships.**

## 1. Core Architecture Principle

The engine has to be split into two layers that never blur into each other. Layer one is a deterministic, versioned rules engine that takes a family's data and produces a recommendation: an allocation, a gap number, a rebalance flag. No LLM sits in that decision path. Layer two is an LLM that takes the engine's structured output and turns it into prose the family can read, but it cannot introduce a number the engine didn't produce and cannot soften, override, or reframe a recommendation the engine made.

The reason for the split isn't elegance, it's liability and auditability. If a family asks why they got a specific recommendation, you need to point to a rule and a version number, not a model's internal state at generation time. This also makes the "is the advice sound" question tractable at all, which is otherwise close to unanswerable for a pure LLM system. The catch: "the LLM cannot introduce new numbers" is only a real control if it's enforced by a validation step outside the model, checking the generated text against the source numbers before anything reaches the family. Prompting it not to hallucinate is not a control. It's a hope.

## 2. Family Profile Intake

Inputs the engine needs: goals with target amount, target date, and priority tier; household income structure and stability (salaried single income, salaried dual income, business income, mixed); existing portfolio, pulled via CASParser or entered manually; outstanding debt and EMI burden; number and age of dependents; existing insurance coverage, term life and health separately; liquid emergency reserves; and a risk tolerance questionnaire, administered as its own instrument, not inferred from the rest.

Keep tolerance and capacity separate at intake. Self-reported risk appetite and actual capacity to absorb a loss are frequently different things, and collapsing them into one number is one of the more common ways retail advice goes wrong.

## 3. Two Gate Checks Before Any Investment Advice

Emergency fund gate: if liquid reserves don't cover three to six months of expenses, that becomes the top recommendation regardless of what goal-based question the family came in with. Goal-based recommendations still generate, but flagged secondary.

Insurance adequacy gate: term coverage checked against an income-replacement multiple, typically ten to fifteen times annual income depending on dependents and existing liabilities, and health coverage checked against family size and city-tier cost benchmarks. A family that's under-insured relative to these gates sees that surfaced before any SIP or allocation advice. Leading with an equity allocation recommendation for an uninsured family isn't sophisticated advice, it's advice that ignores the actual biggest risk to the household.

## 4. Risk Capacity vs Risk Tolerance

Capacity is computed, not asked: a function of time horizon, income stability, dependents, and liquid net worth after the emergency fund is set aside. Tolerance is self-reported from the questionnaire. The binding rule: final allocation is bounded by whichever of the two is lower.

Flag this explicitly rather than letting it hide in the code: this is a values choice about paternalism, not a math fact. Some advisors let a family's stated higher tolerance push allocation above what capacity alone would suggest. Whichever way you decide, it should be a documented, reviewed decision your RIA partner signs off on, not an implicit default that ends up in production because nobody debated it.

## 5. Goal-Gap Engine

For each goal, compute the required monthly contribution from target amount, time horizon, current progress, and a return assumption. Use bands, conservative, moderate, aggressive, never a single point estimate, and disclose which band is driving which number. Output a funding gap or surplus per goal. When multiple goals compete for limited monthly capacity, resolve the conflict using the priority tier set at intake rather than an engine-invented ranking.

## 6. Asset Allocation Model

Glide path logic bucketed by time horizon, then moderated by the capacity/tolerance bound from section four. This should map to published frameworks, SEBI-compliant model portfolios, standard life-cycle allocation research, rather than allocation math invented in-house. Inventing your own curve is a fast way to be systematically wrong in a manner nobody notices until a bad year exposes it.

## 7. Portfolio Construction

Map allocation percentages to instrument categories first, large-cap equity, mid/small-cap, debt duration bucket, gold or other hedge, rather than jumping straight to specific fund picks. If you move to specific fund selection later, that needs its own published, rule-based screen: expense ratio thresholds, tracking error bounds for index options, tenure and consistency screens for active funds. Fund selection should be auditable the same way allocation is, not a black-box preference.

## 8. Monitoring and Rebalancing Triggers

Use deviation-band triggers, allocation drifting past a set threshold from target, rather than relying only on calendar reviews. Add triggers tied to life events captured through profile updates: new dependent, job change, goal date change. Every trigger needs to generate a message that distinguishes what actually happened, market movement, a profile change, or a goal timeline change. Conflating these in the family-facing message erodes trust quickly, because it stops being clear whether the world changed or their situation changed.

## 9. Tax-Aware Logic

Bake LTCG/STCG treatment, holding period awareness, and harvesting opportunities into any sell recommendation. Tax drag is one of the most common places generic advice quietly underperforms without anyone noticing.

## 10. Explanation Layer Design

The LLM receives the engine's structured output plus the family profile and generates prose from it. Hard constraints: it cannot introduce a number that didn't come from the engine, it cannot downplay or reframe a gate check because the family seems price-sensitive or resistant, and every generated explanation gets validated programmatically against the source numbers before it's shown. This is the single highest-risk point in the whole system for trust to break: an LLM smoothing over an uncomfortable recommendation because it's optimizing for a response that reads well rather than one that's accurate.

## 11. Family Communication Principles

Lead with the goal in the family's own language, not the mechanism, "you're on track for the 2034 goal" rather than "your equity allocation is 65%." Show ranges, not false precision. Explain specifically what changed and why for every update. Give the family the lever, not just the answer, "increasing monthly contribution by this much closes the gap" rather than just stating the gap. Never use urgency or fear framing to push a contribution increase.

This is the same discipline already built into Penny's voice rules on the child side of Taru, just recalibrated for an adult audience that can, and should, see the underlying math if they ask for it.

## 12. Audit and Verification Architecture

Every recommendation run stores an input snapshot, the engine version that produced the output, the output itself, and the specific framework or benchmark the allocation logic drew from. This is what makes "is this advice sound" answerable at all: the engine layer gets unit tested against published benchmarks and periodically reviewed by a registered RIA or CFP, the explanation layer gets checked for numeric fidelity against the engine's output, and the two are auditable independently.

Nobody is verifying "was this good advice" in any absolute sense, that's not knowable in advance for a human advisor either. What's actually verifiable is narrower and more honest: does the engine's logic match its stated methodology, and does the explanation match the engine.

## 13. Where This Design Is Still Weak

The capacity-versus-tolerance bound in section four encodes a paternalism judgment that needs to be a reviewed decision, not a default that ships because nobody argued about it.

Return assumption bands are still assumptions. Nothing here protects against a bad multi-year assumption baked into the engine at launch quietly becoming wrong over time. This needs a scheduled review mechanism for the assumptions themselves, not just a bug-report-triggered one.

The "no new numbers" constraint on the explanation layer requires real engineering, structured output validation outside the model, to actually hold. Without that check, it's a prompt instruction, which is not the same thing as a guarantee.

The entire design assumes an ongoing, real relationship with a registered RIA signing off on methodology, not a one-time compliance check at launch. If that relationship lapses or was never substantive, the audit trail is a paper exercise with no legal weight behind it.
