import { useState, useEffect, useMemo } from "react";
import { BACKEND_URL } from "../lib/api";
import {
  DEGREE_TYPES,
  EDU_COST_MATRIX,
  EDU_TIERS,
  BENCHMARKS,
  INFLATION,
  MILESTONE_META,
  PROPERTY_TIERS,
  PROPERTY_TYPES,
  PROPERTY_CONFIGS,
  PROPERTY_COST_MATRIX,
  DOWNPAYMENT_PCT,
} from "../config/calculatorConfig";

// ─── ASSET DEFINITIONS ───────────────────────────────────────────────────────

const ASSET_DEFS = [
  { key: "cash",      label: "Cash / Savings account", defaultRate: 4,    rateEditable: true  },
  { key: "fd",        label: "Fixed deposit",           defaultRate: 6.5,  rateEditable: true  },
  { key: "ppf",       label: "PPF",                     defaultRate: 7.1,  rateEditable: false },
  { key: "equity_mf", label: "Equity mutual funds",     defaultRate: 11,   rateEditable: true  },
  { key: "gold",      label: "Gold",                    defaultRate: 7,    rateEditable: true  },
  { key: "stocks",    label: "Direct stocks",           defaultRate: 12,   rateEditable: true  },
  { key: "other",     label: "Other investments",       defaultRate: 8,    rateEditable: true  },
];

const INIT_ASSETS      = { cash: "", fd: "", ppf: "", equity_mf: "", gold: "", stocks: "", other: "" };
const INIT_ASSET_RATES = { cash: "4", fd: "6.5", equity_mf: "11", gold: "7", stocks: "12", other: "8" };
const GOAL_DEFAULT_AGE = { mar: 25, house: 30, startup: 28 };
const GOAL_AGE_RANGE   = { mar: [20, 35], house: [25, 45], startup: [23, 40] };

// ─── EMAIL VALIDATION (inline — no backend import) ───────────────────────────

function isValidEmail(value) {
  if (typeof value !== "string") return false;
  const parts = value.trim().split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  return local.length > 0 && domain.includes(".") && domain.length > 3;
}

// ─── MATH ────────────────────────────────────────────────────────────────────

function fmtINR(n) {
  const r = Math.round(Math.abs(n));
  if (r >= 10000000) return "₹" + (r / 10000000).toFixed(2) + " Cr";
  if (r >= 100000)   return "₹" + (r / 100000).toFixed(1) + " L";
  return "₹" + r.toLocaleString("en-IN");
}

function fv(pv, y, r) { return pv * Math.pow(1 + r, y); }

function sipFV(m, y, r, stepUpPct = 0) {
  const n = y * 12;
  if (n <= 0) return 0;
  if (stepUpPct === 0) {
    const mr = r / 12;
    if (mr === 0) return m * n;
    return m * ((Math.pow(1 + mr, n) - 1) / mr) * (1 + mr);
  }
  let corpus = 0, monthly = m;
  for (let yr = 0; yr < y; yr++) {
    const mr = r / 12;
    const yearCorpus = mr === 0 ? monthly * 12 : monthly * ((Math.pow(1 + mr, 12) - 1) / mr) * (1 + mr);
    corpus = corpus * Math.pow(1 + r, 1) + yearCorpus;
    monthly *= (1 + stepUpPct / 100);
  }
  return corpus;
}

function sipNeeded(corpus, y, r) {
  const mr = r / 12, n = y * 12;
  if (mr === 0 || n === 0) return corpus / Math.max(n, 1);
  return corpus / (((Math.pow(1 + mr, n) - 1) / mr) * (1 + mr));
}

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────

const base = {
  wrap:    { maxWidth: 560, margin: "0 auto", padding: "28px 18px", overflow: "hidden" },
  pBar:    { height: 3, background: "var(--border)", borderRadius: 2, marginBottom: 36 },
  pFill: w => ({ height: "100%", width: w + "%", background: "var(--leaf)", borderRadius: 2, transition: "width 0.4s ease" }),
  stepLbl: { fontSize: 12, color: "var(--sage)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 },
  h1:      { fontSize: 23, fontWeight: 600, color: "var(--forest)", marginBottom: 6, lineHeight: 1.25 },
  sub:     { fontSize: 15, color: "var(--sage)", marginBottom: 28, lineHeight: 1.65 },
  grid2:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 },
  card: s  => ({ border: s ? "2px solid var(--leaf)" : "1px solid var(--border)", borderRadius: 12, padding: "14px 15px", cursor: "pointer", background: s ? "var(--frost)" : "#fff", transition: "all 0.15s" }),
  cIcon:   { fontSize: 24, marginBottom: 8 },
  cTitle: s => ({ fontSize: 14, fontWeight: 600, color: s ? "var(--forest)" : "var(--ink)", marginBottom: 3 }),
  cSub:   s => ({ fontSize: 12, color: s ? "var(--moss)" : "var(--sage)", lineHeight: 1.4 }),
  cMeta:  s => ({ fontSize: 11, color: s ? "var(--moss)" : "var(--ink-30)", marginTop: 5 }),
  pill:   s => ({ display: "inline-block", border: s ? "2px solid var(--leaf)" : "1px solid var(--border)", borderRadius: 100, padding: "7px 13px", fontSize: 13, cursor: "pointer", color: s ? "var(--forest)" : "var(--sage)", background: s ? "var(--frost)" : "#fff", fontWeight: s ? 600 : 400, marginRight: 8, marginBottom: 8, transition: "all 0.15s" }),
  pgLbl:   { fontSize: 13, fontWeight: 600, color: "var(--forest)", marginBottom: 10 },
  slWrap:  { marginBottom: 22 },
  slRow:   { display: "flex", justifyContent: "space-between", fontSize: 14, color: "var(--sage)", marginBottom: 8 },
  slVal:   { fontWeight: 700, color: "var(--forest)" },
  slider:  { width: "100%", accentColor: "var(--leaf)", cursor: "pointer" },
  fldLbl:  { fontSize: 13, color: "var(--sage)", display: "block", marginBottom: 7, fontWeight: 500 },
  inp:     { width: "100%", padding: "11px 14px", fontSize: 15, border: "1px solid var(--border)", borderRadius: "var(--r-md)", background: "#fff", color: "var(--forest)", outline: "none", boxSizing: "border-box", marginBottom: 16, transition: "border-color 0.15s" },
  hint:    { fontSize: 12, color: "var(--ink-30)", marginBottom: 16, marginTop: -8, lineHeight: 1.5 },
  toggle:  { display: "flex", alignItems: "center", gap: 10, marginBottom: 20, cursor: "pointer" },
  toggleBox: on => ({ width: 38, height: 22, borderRadius: 11, background: on ? "var(--leaf)" : "var(--border)", position: "relative", transition: "background 0.2s", flexShrink: 0 }),
  toggleDot: on => ({ position: "absolute", top: 3, left: on ? 19 : 3, width: 16, height: 16, borderRadius: 8, background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }),
  toggleLbl: { fontSize: 13, color: "var(--sage)", fontWeight: 500 },
  infoBanner: { background: "var(--frost)", border: "1px solid var(--leaf)", borderRadius: "var(--r-sm)", padding: "10px 14px", fontSize: 13, color: "var(--moss)", marginBottom: 20 },
};

const numInp = { padding: "8px 10px", fontSize: 14, border: "1px solid var(--border)", borderRadius: "var(--r-sm)", background: "#fff", color: "var(--forest)", outline: "none", boxSizing: "border-box", textAlign: "right" };
const rateInp = { ...numInp, width: "100%", padding: "8px 6px", fontSize: 13 };

// ─── ANIMATED STEP WRAPPER ───────────────────────────────────────────────────

function StepWrap({ children, stepKey }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      key={stepKey}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(24px)",
        transition: "opacity 0.28s ease, transform 0.28s ease",
      }}
    >
      {children}
    </div>
  );
}

// ─── PROGRESS RING ───────────────────────────────────────────────────────────

function Ring({ pct, size = 80 }) {
  const r    = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const col  = pct >= 100 ? "var(--leaf)" : pct > 50 ? "var(--amber)" : "var(--coral)";
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: "var(--border)" }} strokeWidth={6} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: col }}
        strokeWidth={6} strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={0} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em"
        fontSize={size < 70 ? 11 : 13} fontWeight={700}
        style={{ fill: "var(--forest)" }}>
        {pct}%
      </text>
    </svg>
  );
}

// ─── COMPUTATION ENGINE ──────────────────────────────────────────────────────

function computeResults({
  goal, degreeType, eduTier, selection,
  effectiveTargetAge, years,
  assets, assetRates,
  monthlySIP, sipRate, stepUpEnabled, stepUpPct,
  propertyTier, propertyType, propertyConfig,
}) {
  let todayCost = 0;
  if (goal === "edu") {
    todayCost = (degreeType && eduTier) ? (EDU_COST_MATRIX[degreeType]?.[eduTier] || 0) : 0;
  } else if (goal === "house") {
    todayCost = (propertyTier && propertyType && propertyConfig)
      ? (PROPERTY_COST_MATRIX[propertyTier]?.[propertyType]?.[propertyConfig] || 0) * DOWNPAYMENT_PCT
      : 0;
  } else {
    const bench = selection
      ? BENCHMARKS[goal].find(b => b.key === selection)
      : BENCHMARKS[goal][1];
    todayCost = bench ? bench.cost : 0;
  }

  const corpus = fv(todayCost, years, INFLATION[goal]);

  const assetBreakdown = ASSET_DEFS.map(def => {
    const amt  = parseFloat(assets[def.key]) || 0;
    const rate = def.key === "ppf" ? 7.1 / 100 : (parseFloat(assetRates[def.key]) || 0) / 100;
    return { key: def.key, label: def.label, amount: amt, rate: rate * 100, futureValue: fv(amt, years, rate) };
  });

  const onTrackFromAssets = assetBreakdown.reduce((s, a) => s + a.futureValue, 0);

  const sipRateDecimal = (parseFloat(sipRate) || 0) / 100;
  const sup            = stepUpEnabled ? (parseFloat(stepUpPct) || 0) : 0;
  const onTrackFromSIP = sipFV(parseFloat(monthlySIP) || 0, years, sipRateDecimal, sup);

  const rawOnTrack = onTrackFromAssets + onTrackFromSIP;
  const onTrack    = Math.min(rawOnTrack, corpus);
  const gap        = Math.max(0, corpus - rawOnTrack);
  const addSIP     = gap > 0 ? sipNeeded(gap, years, sipRateDecimal) : 0;
  const pct        = corpus > 0 ? Math.min(100, Math.round((rawOnTrack / corpus) * 100)) : 0;

  return { todayCost, corpus, onTrackFromAssets, onTrackFromSIP, onTrack, gap, addSIP, pct, assetBreakdown };
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function TaruCalculator() {
  // ── Step / goal ────────────────────────────────────────────────────────────
  const [step,           setStep]          = useState(1);
  const [childAge,       setChildAge]      = useState(5);
  const [goal,           setGoal]          = useState(null);

  // ── Edu state ──────────────────────────────────────────────────────────────
  const [degreeType,     setDegreeType]    = useState(null);
  const [eduTier,        setEduTier]       = useState(null);

  // ── Non-edu state ──────────────────────────────────────────────────────────
  const [selection,      setSelection]     = useState(null);
  const [targetAge,      setTargetAge]     = useState(25);
  const [propertyTier,   setPropertyTier]  = useState(null);
  const [propertyType,   setPropertyType]  = useState(null);
  const [propertyConfig, setPropertyConfig]= useState(null);

  // ── Asset step ─────────────────────────────────────────────────────────────
  const [assets,         setAssets]        = useState({ ...INIT_ASSETS });
  const [assetRates,     setAssetRates]    = useState({ ...INIT_ASSET_RATES });
  const [monthlySIP,     setMonthlySIP]    = useState("5000");
  const [sipRate,        setSipRate]       = useState("11");
  const [stepUpEnabled,  setStepUpEnabled] = useState(false);
  const [stepUpPct,      setStepUpPct]     = useState("10");

  // ── Results / gate ─────────────────────────────────────────────────────────
  const [showResults,    setShowResults]   = useState(false);
  const [emailValue,     setEmailValue]    = useState("");
  const [consentGiven,   setConsentGiven]  = useState(false);
  const [emailError,     setEmailError]    = useState("");
  const [submitting,     setSubmitting]    = useState(false);
  const [emailSubmitted, setEmailSubmitted]= useState(false);

  // ── Derived ────────────────────────────────────────────────────────────────
  const isEdu      = goal === "edu";
  const totalSteps = isEdu ? 4 : 3;
  const progress   = showResults ? 100 : (step / totalSteps) * 95;

  const effectiveTargetAge = isEdu
    ? (DEGREE_TYPES.find(d => d.key === degreeType)?.startAge || 18)
    : targetAge;
  const years = Math.max(1, effectiveTargetAge - childAge);

  const propertyFullCost = (propertyTier && propertyType && propertyConfig)
    ? (PROPERTY_COST_MATRIX[propertyTier]?.[propertyType]?.[propertyConfig] || 0)
    : 0;
  const propertyCost = propertyFullCost * DOWNPAYMENT_PCT;

  // ── Navigation ─────────────────────────────────────────────────────────────
  function selectGoal(key) {
    setGoal(key);
    setDegreeType(null); setEduTier(null);
    setSelection(null);
    setPropertyTier(null); setPropertyType(null); setPropertyConfig(null);
    setTargetAge(GOAL_DEFAULT_AGE[key] ?? 25);
  }

  // ── Step validation ────────────────────────────────────────────────────────
  const step1Ok = !!goal;
  const step2Ok = isEdu
    ? !!degreeType
    : (goal !== "house" || propertyCost > 0);
  const step3Ok = !!eduTier;   // edu only

  // ── Computed results ───────────────────────────────────────────────────────
  const live = useMemo(() => {
    if (!showResults || !goal) return null;
    return computeResults({
      goal, degreeType, eduTier, selection,
      effectiveTargetAge, years,
      assets, assetRates,
      monthlySIP, sipRate, stepUpEnabled, stepUpPct,
      propertyTier, propertyType, propertyConfig,
    });
  }, [
    showResults, goal, degreeType, eduTier, selection,
    effectiveTargetAge, years,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(assets), JSON.stringify(assetRates),
    monthlySIP, sipRate, stepUpEnabled, stepUpPct,
    propertyTier, propertyType, propertyConfig,
  ]);

  // ── Goal detail for lead payload ───────────────────────────────────────────
  function buildGoalDetail() {
    if (goal === "edu")                        return { degree_type: degreeType, institution_tier: eduTier };
    if (goal === "mar" || goal === "startup")  return { benchmark: selection };
    if (goal === "house")                      return { property_tier: propertyTier, property_type: propertyType, property_config: propertyConfig };
    return {};
  }

  // ── Email submit ───────────────────────────────────────────────────────────
  async function handleEmailSubmit() {
    const trimmed = emailValue.trim().toLowerCase();
    if (!isValidEmail(trimmed)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    if (!consentGiven) {
      setEmailError("Please tick the box to agree to be contacted.");
      return;
    }
    if (!live) return;

    setEmailError("");
    setSubmitting(true);

    const params = new URLSearchParams(window.location.search);

    const body = {
      email:    trimmed,
      child_age: childAge,
      goal_key:  goal,
      goal_detail: buildGoalDetail(),
      target_age:    effectiveTargetAge,
      years_to_goal: years,
      today_cost:    live.todayCost,
      target_corpus: live.corpus,
      existing_savings_by_asset: {
        cash:      parseFloat(assets.cash)      || 0,
        fd:        parseFloat(assets.fd)        || 0,
        ppf:       parseFloat(assets.ppf)       || 0,
        equity_mf: parseFloat(assets.equity_mf) || 0,
        gold:      parseFloat(assets.gold)      || 0,
        stocks:    parseFloat(assets.stocks)    || 0,
        other:     parseFloat(assets.other)     || 0,
      },
      monthly_sip:             parseFloat(monthlySIP) || 0,
      step_up_enabled:         stepUpEnabled,
      step_up_pct:             stepUpEnabled ? parseFloat(stepUpPct) : null,
      on_track_corpus:         live.onTrack,
      gap:                     live.gap,
      required_additional_sip: live.addSIP,
      funding_pct:             live.pct,
      source:                  "calculator",
      consent_given:           true,
      utm_source:   params.get("utm_source")   || undefined,
      utm_medium:   params.get("utm_medium")   || undefined,
      utm_campaign: params.get("utm_campaign") || undefined,
    };

    try {
      const res  = await fetch(`${BACKEND_URL}/api/calculator-leads`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok || data.ok) {
        setEmailSubmitted(true);
      } else {
        setEmailError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setEmailError("Could not connect. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────────
  function reset() {
    setStep(1); setChildAge(5); setGoal(null);
    setDegreeType(null); setEduTier(null);
    setSelection(null); setTargetAge(25);
    setPropertyTier(null); setPropertyType(null); setPropertyConfig(null);
    setAssets({ ...INIT_ASSETS });
    setAssetRates({ ...INIT_ASSET_RATES });
    setMonthlySIP("5000"); setSipRate("11");
    setStepUpEnabled(false); setStepUpPct("10");
    setShowResults(false);
    setEmailValue(""); setConsentGiven(false);
    setEmailError(""); setSubmitting(false); setEmailSubmitted(false);
  }

  // ── Asset helpers ──────────────────────────────────────────────────────────
  function setAsset(key, val)     { setAssets(p     => ({ ...p, [key]: val })); }
  function setAssetRate(key, val) { setAssetRates(p => ({ ...p, [key]: val })); }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={base.wrap}>
      {/* Progress bar */}
      <div style={base.pBar}><div style={base.pFill(progress)} /></div>

      {/* ══════════════════════════════════════════════════════════════
          STEP 1 — Age + single-select goal
      ══════════════════════════════════════════════════════════════ */}
      {!showResults && step === 1 && (
        <StepWrap stepKey="s1">
          <p style={base.stepLbl}>Step 1 of {totalSteps || 3}</p>
          <h2 style={base.h1}>Tell us about your child and what you're saving for</h2>
          <p style={base.sub}>We'll calculate the exact monthly investment to get you there.</p>

          <div style={base.slWrap}>
            <div style={base.slRow}>
              <span>Child's current age</span>
              <span style={base.slVal}>{childAge} {childAge === 1 ? "year" : "years"}</span>
            </div>
            <input type="range" min={0} max={17} step={1} value={childAge} style={base.slider}
              onChange={e => setChildAge(parseInt(e.target.value))} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-30)", marginTop: 4 }}>
              <span>Newborn</span><span>17 years</span>
            </div>
          </div>

          <p style={{ ...base.fldLbl, marginBottom: 12 }}>What are you saving for?</p>
          <div style={base.grid2}>
            {Object.entries(MILESTONE_META).map(([key, meta]) => (
              <div key={key} style={base.card(goal === key)} onClick={() => selectGoal(key)}>
                <div style={base.cIcon}>{meta.icon}</div>
                <div style={base.cTitle(goal === key)}>{meta.label}</div>
                <div style={base.cSub(goal === key)}>{meta.sub}</div>
              </div>
            ))}
          </div>

          <button className="btn primary"
            style={!step1Ok ? { marginTop: 6, opacity: 0.4, pointerEvents: "none" } : { marginTop: 6 }}
            disabled={!step1Ok}
            onClick={() => setStep(2)}>
            Continue →
          </button>
        </StepWrap>
      )}

      {/* ══════════════════════════════════════════════════════════════
          STEP 2 (edu) — Degree type
      ══════════════════════════════════════════════════════════════ */}
      {!showResults && step === 2 && isEdu && (
        <StepWrap stepKey="s2-edu">
          <p style={base.stepLbl}>Step 2 of {totalSteps} · Higher education</p>
          <h2 style={base.h1}>What degree are you planning for?</h2>
          <p style={base.sub}>This sets the target age and timeline for your savings.</p>
          <div style={base.grid2}>
            {DEGREE_TYPES.map(dt => (
              <div key={dt.key} style={base.card(degreeType === dt.key)} onClick={() => setDegreeType(dt.key)}>
                <div style={base.cTitle(degreeType === dt.key)}>{dt.label}</div>
                <div style={base.cSub(degreeType === dt.key)}>{dt.sub}</div>
                <div style={base.cMeta(degreeType === dt.key)}>Starts at {dt.startAge} · {dt.years} yrs</div>
              </div>
            ))}
          </div>
          <button className="btn ghost" style={{ marginRight: 10, marginTop: 6 }} onClick={() => setStep(1)}>← Back</button>
          <button className="btn primary"
            style={!degreeType ? { marginTop: 6, opacity: 0.4, pointerEvents: "none" } : { marginTop: 6 }}
            disabled={!degreeType}
            onClick={() => setStep(3)}>
            Continue →
          </button>
        </StepWrap>
      )}

      {/* ══════════════════════════════════════════════════════════════
          STEP 2 (non-edu) — Goal sizing + target age
      ══════════════════════════════════════════════════════════════ */}
      {!showResults && step === 2 && !isEdu && goal && (
        <StepWrap stepKey="s2-other">
          <p style={base.stepLbl}>Step 2 of {totalSteps} · {MILESTONE_META[goal].label}</p>
          <h2 style={base.h1}>Let's size this milestone</h2>
          <p style={base.sub}>Adjust the target age and pick the scale that fits your plans.</p>

          {/* Target age slider */}
          <div style={base.slWrap}>
            <div style={base.slRow}>
              <span style={{ fontSize: 13 }}>When do you expect this?</span>
              <span style={{ ...base.slVal, fontSize: 13 }}>
                Age {targetAge} · {Math.max(1, targetAge - childAge)} yr{Math.max(1, targetAge - childAge) !== 1 ? "s" : ""} away
              </span>
            </div>
            <input type="range"
              min={GOAL_AGE_RANGE[goal]?.[0] ?? 20}
              max={GOAL_AGE_RANGE[goal]?.[1] ?? 40}
              step={1} value={targetAge} style={base.slider}
              onChange={e => setTargetAge(parseInt(e.target.value))} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-30)", marginTop: 4 }}>
              <span>{GOAL_AGE_RANGE[goal]?.[0]}</span>
              <span>{GOAL_AGE_RANGE[goal]?.[1]}</span>
            </div>
          </div>

          {/* Marriage / Startup — benchmark pills */}
          {(goal === "mar" || goal === "startup") && (
            <div style={{ marginBottom: 4 }}>
              <p style={{ ...base.fldLbl, marginBottom: 10 }}>Approximate scale</p>
              {BENCHMARKS[goal].map(b => (
                <span key={b.key} style={base.pill(selection === b.key)} onClick={() => setSelection(b.key)}>
                  {b.label}&nbsp;
                  <span style={{ fontSize: 11, color: selection === b.key ? "var(--moss)" : "var(--ink-30)" }}>
                    · {fmtINR(b.cost)}
                  </span>
                </span>
              ))}
            </div>
          )}

          {/* House — property drill-down */}
          {goal === "house" && (
            <div>
              <div style={base.pgLbl}>City tier</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                {PROPERTY_TIERS.map(t => (
                  <div key={t.key} style={base.card(propertyTier === t.key)}
                    onClick={() => { setPropertyTier(t.key); setPropertyType(null); setPropertyConfig(null); }}>
                    <div style={base.cTitle(propertyTier === t.key)}>{t.label}</div>
                    <div style={base.cSub(propertyTier === t.key)}>{t.sub}</div>
                  </div>
                ))}
              </div>

              {propertyTier && (() => {
                const isTypeDisabled = typeKey =>
                  Object.values(PROPERTY_COST_MATRIX[propertyTier]?.[typeKey] || {}).every(v => v === null);
                return (
                  <>
                    <div style={{ ...base.pgLbl, marginTop: 4 }}>Property type</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                      {PROPERTY_TYPES.map(t => {
                        const disabled = isTypeDisabled(t.key);
                        return (
                          <div key={t.key}
                            style={{ ...base.card(propertyType === t.key), ...(disabled ? { opacity: 0.35, cursor: "not-allowed" } : {}) }}
                            onClick={() => { if (!disabled) { setPropertyType(t.key); setPropertyConfig(null); } }}>
                            <div style={base.cTitle(propertyType === t.key)}>{t.label}</div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}

              {propertyTier && propertyType && (
                <>
                  <div style={{ ...base.pgLbl, marginTop: 4 }}>Configuration</div>
                  <div style={{ marginBottom: 16 }}>
                    {PROPERTY_CONFIGS
                      .filter(c => PROPERTY_COST_MATRIX[propertyTier]?.[propertyType]?.[c.key] !== null)
                      .map(c => (
                        <span key={c.key} style={base.pill(propertyConfig === c.key)}
                          onClick={() => setPropertyConfig(c.key)}>
                          {c.label}
                        </span>
                      ))}
                  </div>
                </>
              )}

              {propertyCost > 0 && (
                <div style={base.infoBanner}>
                  20% down payment on a {fmtINR(propertyFullCost)}{" "}
                  {PROPERTY_TYPES.find(t => t.key === propertyType)?.label}
                  {" · "}<strong>{fmtINR(propertyCost)} to save</strong>
                </div>
              )}
            </div>
          )}

          <button className="btn ghost" style={{ marginRight: 10, marginTop: 6 }} onClick={() => setStep(1)}>← Back</button>
          <button className="btn primary"
            style={!step2Ok ? { marginTop: 6, opacity: 0.4, pointerEvents: "none" } : { marginTop: 6 }}
            disabled={!step2Ok}
            onClick={() => setStep(4)}>
            Continue →
          </button>
        </StepWrap>
      )}

      {/* ══════════════════════════════════════════════════════════════
          STEP 3 (edu only) — Institution tier
      ══════════════════════════════════════════════════════════════ */}
      {!showResults && step === 3 && isEdu && (
        <StepWrap stepKey="s3-edu">
          <p style={base.stepLbl}>Step 3 of {totalSteps} · Higher education</p>
          <h2 style={base.h1}>Which institution tier?</h2>
          <p style={base.sub}>We'll inflate today's cost at 8% per year to project the future amount.</p>

          {degreeType && (
            <div style={base.infoBanner}>
              {DEGREE_TYPES.find(d => d.key === degreeType)?.label}
              {" · starts at age "}{effectiveTargetAge}
              {" · "}{Math.max(1, effectiveTargetAge - childAge)} years away
            </div>
          )}

          <div>
            {EDU_TIERS.map(t => {
              const cost = EDU_COST_MATRIX[degreeType]?.[t.key] || 0;
              return (
                <span key={t.key} style={base.pill(eduTier === t.key)} onClick={() => setEduTier(t.key)}>
                  {t.label}&nbsp;
                  <span style={{ fontSize: 11, color: eduTier === t.key ? "var(--moss)" : "var(--ink-30)" }}>
                    · {fmtINR(cost)} today
                  </span>
                </span>
              );
            })}
          </div>

          <button className="btn ghost" style={{ marginRight: 10, marginTop: 6 }} onClick={() => setStep(2)}>← Back</button>
          <button className="btn primary"
            style={!step3Ok ? { marginTop: 6, opacity: 0.4, pointerEvents: "none" } : { marginTop: 6 }}
            disabled={!step3Ok}
            onClick={() => setStep(4)}>
            Continue →
          </button>
        </StepWrap>
      )}

      {/* ══════════════════════════════════════════════════════════════
          STEP 4 — Asset breakdown + SIP
      ══════════════════════════════════════════════════════════════ */}
      {!showResults && step === 4 && (
        <StepWrap stepKey="s4">
          <p style={base.stepLbl}>Step {isEdu ? "4" : "3"} of {totalSteps} · Your savings</p>
          <h2 style={base.h1}>What are you already saving?</h2>
          <p style={base.sub}>Enter existing savings across each asset. Everything can be ₹0.</p>

          {/* Per-asset table */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 76px", gap: 8, marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 11, color: "var(--sage)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Asset</span>
              <span style={{ fontSize: 11, color: "var(--sage)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "right" }}>Amount (₹)</span>
              <span style={{ fontSize: 11, color: "var(--sage)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "right" }}>Return</span>
            </div>

            {ASSET_DEFS.map(def => (
              <div key={def.key} style={{ display: "grid", gridTemplateColumns: "1fr 130px 76px", gap: 8, alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: "var(--forest)", fontWeight: 500 }}>{def.label}</span>

                <input type="number" min={0} placeholder="0"
                  value={assets[def.key]}
                  onChange={e => setAsset(def.key, e.target.value)}
                  style={numInp} />

                {def.rateEditable ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <input type="number" min={0} max={30} step={0.1}
                      value={assetRates[def.key]}
                      onChange={e => setAssetRate(def.key, e.target.value)}
                      style={rateInp} />
                    <span style={{ fontSize: 12, color: "var(--sage)", flexShrink: 0 }}>%</span>
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: "var(--sage)", textAlign: "right", paddingRight: 2, lineHeight: 1.4 }}>
                    {def.defaultRate}%
                    <br />
                    <span style={{ fontSize: 10, color: "var(--ink-30)" }}>govt.</span>
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* SIP section */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20, marginBottom: 4 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--forest)", marginBottom: 16 }}>New monthly investment (SIP)</p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 76px", gap: 8, alignItems: "center", marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: "var(--forest)", fontWeight: 500 }}>Monthly SIP</label>
              <input type="number" min={0} placeholder="5000"
                value={monthlySIP}
                onChange={e => setMonthlySIP(e.target.value)}
                style={numInp} />
              <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                <input type="number" min={0} max={30} step={0.1}
                  value={sipRate}
                  onChange={e => setSipRate(e.target.value)}
                  style={rateInp} />
                <span style={{ fontSize: 12, color: "var(--sage)", flexShrink: 0 }}>%</span>
              </div>
            </div>

            <div style={base.toggle} onClick={() => setStepUpEnabled(p => !p)}>
              <div style={base.toggleBox(stepUpEnabled)}><div style={base.toggleDot(stepUpEnabled)} /></div>
              <span style={base.toggleLbl}>Step-up SIP — increase by a % every year</span>
            </div>

            {stepUpEnabled && (
              <div style={{ ...base.slWrap, marginTop: -8 }}>
                <div style={base.slRow}>
                  <span style={{ fontSize: 13, color: "var(--sage)" }}>Annual increase</span>
                  <span style={{ ...base.slVal, fontSize: 14 }}>{stepUpPct}% per year</span>
                </div>
                <input type="range" min={5} max={25} step={5} value={stepUpPct} style={base.slider}
                  onChange={e => setStepUpPct(e.target.value)} />
                <p style={{ ...base.hint, marginTop: 6 }}>
                  SIP grows from ₹{(parseFloat(monthlySIP) || 0).toLocaleString("en-IN")}/mo today
                  to ₹{Math.round((parseFloat(monthlySIP) || 0) * Math.pow(1 + parseFloat(stepUpPct) / 100, 10)).toLocaleString("en-IN")}/mo in 10 years.
                </p>
              </div>
            )}
          </div>

          <button className="btn ghost" style={{ marginRight: 10, marginTop: 6 }}
            onClick={() => isEdu ? setStep(3) : setStep(2)}>← Back</button>
          <button className="btn primary" style={{ marginTop: 6 }}
            onClick={() => setShowResults(true)}>
            See my results →
          </button>
        </StepWrap>
      )}

      {/* ══════════════════════════════════════════════════════════════
          RESULTS
      ══════════════════════════════════════════════════════════════ */}
      {showResults && live && goal && (
        <StepWrap stepKey="results">
          {/* ── UNGATED ─────────────────────────────────────────────── */}
          <p style={base.stepLbl}>Your results</p>
          <h2 style={base.h1}>Here's where you stand</h2>

          {/* Goal + corpus card */}
          <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: "20px 20px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1, marginRight: 16 }}>
                <div style={{ fontSize: 11, color: "var(--sage)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                  {MILESTONE_META[goal].icon} {MILESTONE_META[goal].label} · {years} yr{years !== 1 ? "s" : ""} away
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-30)", marginBottom: 6 }}>
                  Today's cost · {fmtINR(live.todayCost)} at {(INFLATION[goal] * 100).toFixed(0)}% inflation
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "var(--forest)", lineHeight: 1.15 }}>
                  {fmtINR(live.corpus)}
                </div>
                <div style={{ fontSize: 12, color: "var(--sage)", marginTop: 4 }}>
                  needed in {years} year{years !== 1 ? "s" : ""}
                </div>
              </div>
              <Ring pct={live.pct} size={80} />
            </div>
            <div style={{ marginTop: 14, height: 5, background: "var(--border)", borderRadius: 3 }}>
              <div style={{
                height: "100%", width: live.pct + "%", borderRadius: 3,
                background: live.pct >= 100 ? "var(--leaf)" : live.pct > 50 ? "var(--amber)" : "var(--coral)",
                transition: "width 0.5s ease",
              }} />
            </div>
            <p style={{ fontSize: 13, color: "var(--sage)", marginTop: 10 }}>
              {live.pct < 50
                ? "There's a gap to close — and a clear way to do it."
                : live.pct < 90
                  ? "Good start — a small SIP boost will get you there."
                  : "You're nearly fully funded for this milestone."}
            </p>
          </div>

          {/* ── EMAIL GATE ─────────────────────────────────────────── */}
          {!emailSubmitted ? (
            <div style={{ background: "var(--frost)", border: "1px solid var(--leaf)", borderRadius: 14, padding: "22px 22px", marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--forest)", marginBottom: 6 }}>
                {live.pct < 90
                  ? "See the exact monthly SIP to close this gap"
                  : "Confirm you're on track"}
              </div>
              <p style={{ fontSize: 13, color: "var(--moss)", marginBottom: 18, lineHeight: 1.6 }}>
                {live.pct < 90
                  ? "We'll show you how much to invest — broken down by where your money should go."
                  : "We'll show you exactly how your savings and SIP are tracking, broken down by where your money is working."}
              </p>
              <input type="email" placeholder="your@email.com"
                value={emailValue}
                onChange={e => { setEmailValue(e.target.value); setEmailError(""); }}
                style={base.inp} />
              <label
                style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16, cursor: "pointer" }}
                onClick={() => setConsentGiven(p => !p)}>
                <div style={{
                  width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
                  border: consentGiven ? "none" : "1.5px solid var(--leaf)",
                  background: consentGiven ? "var(--leaf)" : "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s",
                }}>
                  {consentGiven && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span style={{ fontSize: 12, color: "var(--sage)", lineHeight: 1.5 }}>
                  I agree to be contacted by Taru with my personalised results. No spam — just your plan.
                </span>
              </label>
              {emailError && (
                <p style={{ fontSize: 12, color: "var(--coral)", marginBottom: 10, marginTop: -4 }}>{emailError}</p>
              )}
              <button className="btn primary"
                style={submitting || !emailValue ? { opacity: 0.4, pointerEvents: "none" } : {}}
                disabled={submitting || !emailValue}
                onClick={handleEmailSubmit}>
                {submitting ? "Sending…" : "Show me the full plan →"}
              </button>
            </div>
          ) : (
            /* ── GATED SECTION ──────────────────────────────────────── */
            <>
              {/* Required additional SIP */}
              <div style={{
                background: live.addSIP > 0 ? "var(--amber-lt)" : "var(--frost)",
                border: `1.5px solid ${live.addSIP > 0 ? "var(--amber)" : "var(--leaf)"}`,
                borderRadius: 14, padding: "20px 20px", marginBottom: 12,
              }}>
                {live.addSIP > 0 ? (
                  <>
                    <div style={{ fontSize: 11, color: "var(--amber-dk)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                      Additional SIP needed to close the gap
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 700, color: "var(--amber-dk)" }}>
                      {fmtINR(Math.round(live.addSIP))}{" "}
                      <span style={{ fontSize: 16, fontWeight: 500 }}>/ month</span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--amber-dk)", marginTop: 6, lineHeight: 1.5 }}>
                      On top of your current ₹{(parseFloat(monthlySIP) || 0).toLocaleString("en-IN")}/month.
                      {" "}Total: ₹{Math.round((parseFloat(monthlySIP) || 0) + live.addSIP).toLocaleString("en-IN")}/month to fund this milestone on time.
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 11, color: "var(--moss)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                      You are fully on track
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 700, color: "var(--forest)" }}>No gap 🎉</div>
                    <div style={{ fontSize: 13, color: "var(--moss)", marginTop: 6 }}>
                      Your current savings rate covers this milestone.
                    </div>
                  </>
                )}
                {live.gap > 0 && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "var(--amber-dk)", background: "rgba(239,159,39,0.08)", borderRadius: 8, padding: "8px 12px" }}>
                    Gap to close: <strong>{fmtINR(Math.round(live.gap))}</strong>
                  </div>
                )}
              </div>

              {/* Per-asset contribution breakdown */}
              {live.assetBreakdown.some(a => a.amount > 0) && (
                <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--forest)", marginBottom: 12 }}>
                    Where your existing savings work hardest
                  </div>
                  {live.assetBreakdown.filter(a => a.amount > 0).map((a, i, arr) => (
                    <div key={a.key} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      paddingBottom: 9, marginBottom: 9,
                      ...(i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}),
                    }}>
                      <div>
                        <div style={{ fontSize: 13, color: "var(--forest)", fontWeight: 500 }}>{a.label}</div>
                        <div style={{ fontSize: 11, color: "var(--sage)" }}>
                          {fmtINR(a.amount)} today · {a.rate.toFixed(1)}% / yr
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--forest)" }}>{fmtINR(Math.round(a.futureValue))}</div>
                        <div style={{ fontSize: 10, color: "var(--sage)" }}>in {years} yr{years !== 1 ? "s" : ""}</div>
                      </div>
                    </div>
                  ))}
                  {live.onTrackFromSIP > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 13, color: "var(--forest)", fontWeight: 500 }}>Monthly SIP</div>
                        <div style={{ fontSize: 11, color: "var(--sage)" }}>
                          ₹{(parseFloat(monthlySIP) || 0).toLocaleString("en-IN")}/mo · {sipRate}% / yr
                          {stepUpEnabled ? ` · step-up ${stepUpPct}%` : ""}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--forest)" }}>{fmtINR(Math.round(live.onTrackFromSIP))}</div>
                        <div style={{ fontSize: 10, color: "var(--sage)" }}>in {years} yr{years !== 1 ? "s" : ""}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* What-if sliders — local recompute only, no re-POST */}
              <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 18px", marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--forest)", marginBottom: 16 }}>
                  What if I change my plan?
                </div>

                <div style={{ fontSize: 11, color: "var(--sage)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                  Existing savings
                </div>
                {ASSET_DEFS.map(def => {
                  const amt   = parseFloat(assets[def.key]) || 0;
                  const slMax = Math.max(amt * 5, 1000000);
                  return (
                    <div key={def.key} style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                        <span style={{ color: "var(--sage)" }}>{def.label}</span>
                        <span style={{ fontWeight: 700, color: "var(--leaf)" }}>{fmtINR(amt)}</span>
                      </div>
                      <input type="range" min={0} max={slMax}
                        step={Math.max(1000, Math.round(slMax / 100))}
                        value={amt} style={base.slider}
                        onChange={e => setAsset(def.key, e.target.value)} />
                    </div>
                  );
                })}

                <div style={{ fontSize: 11, color: "var(--sage)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, marginTop: 4 }}>
                  Monthly SIP
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                    <span style={{ color: "var(--sage)" }}>Monthly SIP</span>
                    <span style={{ fontWeight: 700, color: "var(--leaf)" }}>₹{(parseFloat(monthlySIP) || 0).toLocaleString("en-IN")}</span>
                  </div>
                  <input type="range" min={0} max={100000} step={500}
                    value={parseFloat(monthlySIP) || 0} style={base.slider}
                    onChange={e => setMonthlySIP(e.target.value)} />
                </div>

                <div style={{ ...base.toggle, marginBottom: 0 }} onClick={() => setStepUpEnabled(p => !p)}>
                  <div style={base.toggleBox(stepUpEnabled)}><div style={base.toggleDot(stepUpEnabled)} /></div>
                  <span style={{ ...base.toggleLbl, fontSize: 12 }}>Step-up SIP by {stepUpPct}% / year</span>
                </div>
              </div>

              {/* CTA block */}
              <div style={{ background: "linear-gradient(135deg, var(--forest) 0%, var(--moss) 100%)", borderRadius: 16, padding: "24px 22px", marginBottom: 16, textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Ready to start?
                </div>
                <div style={{ fontSize: 19, fontWeight: 700, color: "#fff", marginBottom: 8, lineHeight: 1.3 }}>
                  {live.addSIP > 0
                    ? `Start a SIP of ${fmtINR(Math.round(live.addSIP + (parseFloat(monthlySIP) || 0)))} / month on Taru`
                    : "You're on track — keep it going on Taru"}
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 20, lineHeight: 1.55 }}>
                  Taru invests in mutual funds for your child and teaches them about money — so the corpus you build today becomes a lesson they carry forever.
                </div>
                <a href="https://taru.money/signup" target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-block", background: "#fff", color: "var(--forest)", fontWeight: 700, fontSize: 15, padding: "13px 28px", borderRadius: 10, textDecoration: "none" }}>
                  Invest on Taru →
                </a>
                <div style={{ marginTop: 14, fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                  AMFI-registered MFD · No lock-in · Start with ₹500 / month
                </div>
              </div>
            </>
          )}

          {/* Bottom actions */}
          <div style={{ display: "flex", gap: 8, marginBottom: 4, marginTop: 4 }}>
            <button className="btn ghost" style={{ flex: 1, textAlign: "center" }}
              onClick={() => {
                setShowResults(false);
                setEmailSubmitted(false);
                setEmailValue(""); setEmailError(""); setConsentGiven(false);
              }}>
              ← Edit inputs
            </button>
            <button className="btn ghost" style={{ flex: 1, textAlign: "center" }} onClick={reset}>
              Start over
            </button>
          </div>

          <p style={{ fontSize: 11, color: "var(--ink-30)", marginTop: 16, lineHeight: 1.7 }}>
            Projections use today's benchmark costs inflated at the goal-specific rate (8% education, 7% property, 6% others). Per-asset returns are user-editable estimates. PPF rate of 7.1% is government-mandated and cannot be edited. This is not financial advice.
          </p>
        </StepWrap>
      )}
    </div>
  );
}
