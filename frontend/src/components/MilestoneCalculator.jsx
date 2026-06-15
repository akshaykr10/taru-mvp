import { useState, useEffect, useRef, useMemo } from "react";
import {
  DEGREE_TYPES,
  EDU_COST_MATRIX,
  EDU_TIERS,
  BENCHMARKS,
  INFLATION,
  RETURNS,
  RETURN_LABELS,
  MILESTONE_META,
  PROPERTY_TIERS,
  PROPERTY_TYPES,
  PROPERTY_CONFIGS,
  PROPERTY_COST_MATRIX,
  DOWNPAYMENT_PCT,
} from "../config/calculatorConfig";

// ─── MATH ────────────────────────────────────────────────────────────────────

function fmtINR(n) {
  const r = Math.round(Math.abs(n));
  if (r >= 10000000) return "₹" + (r / 10000000).toFixed(2) + " Cr";
  if (r >= 100000)   return "₹" + (r / 100000).toFixed(1) + " L";
  return "₹" + r.toLocaleString("en-IN");
}

function fv(pv, y, r)  { return pv * Math.pow(1 + r, y); }

function sipFV(m, y, r, stepUpPct = 0) {
  const n = y * 12;
  if (n <= 0) return 0;
  if (stepUpPct === 0) {
    const mr = r / 12;
    if (mr === 0) return m * n;
    return m * ((Math.pow(1 + mr, n) - 1) / mr) * (1 + mr);
  }
  // Step-up: annual increment
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

// ─── DESIGN TOKENS (CSS variables from tokens.css / landing.css) ─────────────

const base = {
  wrap:      { maxWidth: 560, margin: "0 auto", padding: "28px 18px", overflow: "hidden" },
  pBar:      { height: 3, background: "var(--border)", borderRadius: 2, marginBottom: 36 },
  pFill: w  => ({ height: "100%", width: w + "%", background: "var(--leaf)", borderRadius: 2, transition: "width 0.4s ease" }),
  stepLbl:   { fontSize: 12, color: "var(--sage)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 },
  h1:        { fontSize: 23, fontWeight: 600, color: "var(--forest)", marginBottom: 6, lineHeight: 1.25 },
  sub:       { fontSize: 15, color: "var(--sage)", marginBottom: 28, lineHeight: 1.65 },
  grid2:     { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 },
  card: s   => ({ border: s ? "2px solid var(--leaf)" : "1px solid var(--border)", borderRadius: 12, padding: "14px 15px", cursor: "pointer", background: s ? "var(--frost)" : "#fff", transition: "all 0.15s" }),
  cIcon:     { fontSize: 24, marginBottom: 8 },
  cTitle: s => ({ fontSize: 14, fontWeight: 600, color: s ? "var(--forest)" : "var(--ink)", marginBottom: 3 }),
  cSub:   s => ({ fontSize: 12, color: s ? "var(--moss)" : "var(--sage)", lineHeight: 1.4 }),
  cMeta:  s => ({ fontSize: 11, color: s ? "var(--moss)" : "var(--ink-30)", marginTop: 5 }),
  pill:   s => ({ display: "inline-block", border: s ? "2px solid var(--leaf)" : "1px solid var(--border)", borderRadius: 100, padding: "7px 13px", fontSize: 13, cursor: "pointer", color: s ? "var(--forest)" : "var(--sage)", background: s ? "var(--frost)" : "#fff", fontWeight: s ? 600 : 400, marginRight: 8, marginBottom: 8, transition: "all 0.15s" }),
  pgLbl:     { fontSize: 13, fontWeight: 600, color: "var(--forest)", marginBottom: 10 },
  slWrap:    { marginBottom: 22 },
  slRow:     { display: "flex", justifyContent: "space-between", fontSize: 14, color: "var(--sage)", marginBottom: 8 },
  slVal:     { fontWeight: 700, color: "var(--forest)" },
  slider:    { width: "100%", accentColor: "var(--leaf)", cursor: "pointer" },
  fldLbl:    { fontSize: 13, color: "var(--sage)", display: "block", marginBottom: 7, fontWeight: 500 },
  inp:       { width: "100%", padding: "11px 14px", fontSize: 15, border: "1px solid var(--border)", borderRadius: "var(--r-md)", background: "#fff", color: "var(--forest)", outline: "none", boxSizing: "border-box", marginBottom: 16, transition: "border-color 0.15s" },
  riskRow:   { display: "flex", gap: 8, marginBottom: 24 },
  riskP: s  => ({ flex: 1, border: s ? "2px solid var(--leaf)" : "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "10px 6px", fontSize: 12, fontWeight: s ? 700 : 400, cursor: "pointer", textAlign: "center", color: s ? "var(--forest)" : "var(--sage)", background: s ? "var(--frost)" : "#fff", lineHeight: 1.4 }),
  hint:      { fontSize: 12, color: "var(--ink-30)", marginBottom: 16, marginTop: -8, lineHeight: 1.5 },
  toggle:    { display: "flex", alignItems: "center", gap: 10, marginBottom: 20, cursor: "pointer" },
  toggleBox: on => ({ width: 38, height: 22, borderRadius: 11, background: on ? "var(--leaf)" : "var(--border)", position: "relative", transition: "background 0.2s", flexShrink: 0 }),
  toggleDot: on => ({ position: "absolute", top: 3, left: on ? 19 : 3, width: 16, height: 16, borderRadius: 8, background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }),
  toggleLbl: { fontSize: 13, color: "var(--sage)", fontWeight: 500 },
  infoBanner:{ background: "var(--frost)", border: "1px solid var(--leaf)", borderRadius: "var(--r-sm)", padding: "10px 14px", fontSize: 13, color: "var(--moss)", marginBottom: 20 },
};

const btnPrimary = (disabled) => ({
  marginTop: 6,
  ...(disabled ? { opacity: 0.4, pointerEvents: "none" } : {}),
});
const btnBack = { marginRight: 10, marginTop: 6 };

// ─── ANIMATED STEP WRAPPER ───────────────────────────────────────────────────

function StepWrap({ children, stepKey }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 20); return () => clearTimeout(t); }, []);
  return (
    <div style={{ opacity: visible ? 1 : 0, transform: visible ? "translateX(0)" : "translateX(24px)", transition: "opacity 0.28s ease, transform 0.28s ease" }}>
      {children}
    </div>
  );
}

// ─── LIVE RESULTS ENGINE ─────────────────────────────────────────────────────

function computeResults({ milestoneKeys, childAge, degreeType, eduTier, selections, existingSavings, monthlySIP, riskLevel, stepUpPct, stepUpEnabled, propertyTier, propertyType, propertyConfig, targetAges }) {
  const rate     = RETURNS[riskLevel];
  const existing = parseFloat(existingSavings) || 0;
  const monthly  = parseFloat(monthlySIP) || 0;
  const sup      = stepUpEnabled ? (parseFloat(stepUpPct) || 0) : 0;

  const rows = milestoneKeys.map(key => {
    let targetAge, todayCost, durationLabel;
    if (key === "edu") {
      const dt   = DEGREE_TYPES.find(d => d.key === degreeType);
      const tier = EDU_TIERS.find(t => t.key === eduTier);
      targetAge     = dt ? dt.startAge : 18;
      todayCost     = (degreeType && eduTier) ? (EDU_COST_MATRIX[degreeType]?.[eduTier] || 0) : 0;
      durationLabel = [dt?.label, tier?.label].filter(Boolean).join(" · ");
    } else if (key === "house") {
      targetAge = targetAges.house;
      todayCost = propertyTier && propertyType && propertyConfig
        ? (PROPERTY_COST_MATRIX[propertyTier]?.[propertyType]?.[propertyConfig] || 0) * DOWNPAYMENT_PCT
        : 0;
      const fullCost  = PROPERTY_COST_MATRIX[propertyTier]?.[propertyType]?.[propertyConfig] || 0;
      const typLabel  = PROPERTY_TYPES.find(t => t.key === propertyType)?.label || "";
      const cfgLabel  = PROPERTY_CONFIGS.find(c => c.key === propertyConfig)?.label || "";
      const tierLabel = PROPERTY_TIERS.find(t => t.key === propertyTier)?.label || "";
      durationLabel = `${cfgLabel} ${typLabel} · ${tierLabel} · 20% down payment on a ${fmtINR(fullCost)} property · when your child is ${targetAges.house}`;
    } else {
      targetAge     = targetAges[key];
      const selKey  = selections[key];
      const bench   = selKey ? BENCHMARKS[key].find(b => b.key === selKey) || BENCHMARKS[key][1] : BENCHMARKS[key][1];
      todayCost     = bench.cost;
      durationLabel = `${bench.label} · when your child is ${targetAges[key]}`;
    }

    const years  = Math.max(1, targetAge - childAge);
    const corpus = fv(todayCost, years, INFLATION[key === "edu" ? "edu" : key]);
    const share  = 1 / milestoneKeys.length;
    const onTrk  = fv(existing * share, years, rate) + sipFV(monthly * share, years, rate, sup);
    const gap    = Math.max(0, corpus - onTrk);
    const addSIP = gap > 0 ? sipNeeded(gap, years, rate) : 0;
    const pct    = Math.min(100, Math.round((onTrk / corpus) * 100));

    return { key, label: MILESTONE_META[key].label, icon: MILESTONE_META[key].icon, years, corpus, onTrack: Math.min(onTrk, corpus), gap, addSIP, durationLabel, todayCost, pct };
  });

  const totalCorpus  = rows.reduce((s, r) => s + r.corpus,  0);
  const totalOnTrack = rows.reduce((s, r) => s + r.onTrack, 0);
  const totalAddSIP  = rows.reduce((s, r) => s + r.addSIP,  0);
  const totalPct     = totalCorpus > 0 ? Math.min(100, Math.round((totalOnTrack / totalCorpus) * 100)) : 0;

  return { rows, totalCorpus, totalOnTrack, totalAddSIP, totalPct };
}

// ─── PROGRESS RING ───────────────────────────────────────────────────────────

function Ring({ pct, size = 80 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const ringColor = pct >= 100 ? "var(--leaf)" : pct > 50 ? "var(--amber)" : "var(--coral)";
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" style={{ stroke: "var(--border)" }} strokeWidth={6} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" style={{ stroke: ringColor }}
        strokeWidth={6} strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={0}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fontSize={13} fontWeight={700} style={{ fill: "var(--forest)" }}>{pct}%</text>
    </svg>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function TaruCalculator() {
  const [step,            setStep]           = useState(1);
  const [childAge,        setChildAge]       = useState(5);
  const [milestones,      setMilestones]     = useState({});
  const [degreeType,      setDegreeType]     = useState(null);
  const [eduTier,         setEduTier]        = useState(null);
  const [selections,      setSelections]     = useState({});
  const [existingSavings, setExistingSavings]= useState("0");
  const [monthlySIP,      setMonthlySIP]     = useState("5000");
  const [riskLevel,       setRiskLevel]      = useState(1);
  const [stepUpEnabled,   setStepUpEnabled]  = useState(false);
  const [stepUpPct,       setStepUpPct]      = useState("10");
  const [showResults,     setShowResults]    = useState(false);
  const [propertyTier,   setPropertyTier]   = useState(null);
  const [propertyType,   setPropertyType]   = useState(null);
  const [propertyConfig, setPropertyConfig] = useState(null);
  const [targetAges,     setTargetAges]     = useState({ mar: 25, house: 30, startup: 28 });

  const milestoneKeys = Object.keys(milestones);
  const hasEdu    = !!milestones["edu"];
  const hasOthers = ["mar","house","startup"].some(k => milestones[k]);

  const totalSteps = 1 + 1 + (hasEdu ? 2 : 0) + (hasOthers ? 1 : 0) + 1;
  const progress   = showResults ? 100 : (step / (totalSteps + 1)) * 95;

  function goTo(s) { setStep(s); }
  function nextFrom2() { if (hasEdu) goTo(3); else if (hasOthers) goTo(5); else goTo(6); }
  function backFrom3() { goTo(2); }
  function nextFrom3() { goTo(4); }
  function backFrom4() { goTo(3); }
  function nextFrom4() { if (hasOthers) goTo(5); else goTo(6); }
  function backFrom5() { if (hasEdu) goTo(4); else goTo(2); }
  function backFrom6() { if (hasOthers) goTo(5); else if (hasEdu) goTo(4); else goTo(2); }

  function getEduStartAge() { return DEGREE_TYPES.find(d => d.key === degreeType)?.startAge || 18; }

  function getPropertyCost() {
    if (!propertyTier || !propertyType || !propertyConfig) return 0;
    const full = PROPERTY_COST_MATRIX[propertyTier]?.[propertyType]?.[propertyConfig];
    return full ? full * DOWNPAYMENT_PCT : 0;
  }

  function getPropertyFullCost() {
    if (!propertyTier || !propertyType || !propertyConfig) return 0;
    return PROPERTY_COST_MATRIX[propertyTier]?.[propertyType]?.[propertyConfig] || 0;
  }

  const propertyCost  = getPropertyCost();
  const propertyLabel = propertyTier && propertyType && propertyConfig
    ? `${PROPERTY_CONFIGS.find(c => c.key === propertyConfig)?.label} in ${PROPERTY_TIERS.find(t => t.key === propertyTier)?.label}`
    : "";

  const live = useMemo(() => {
    if (!showResults || milestoneKeys.length === 0) return null;
    return computeResults({ milestoneKeys, childAge, degreeType, eduTier, selections, existingSavings, monthlySIP, riskLevel, stepUpPct, stepUpEnabled, propertyTier, propertyType, propertyConfig, targetAges });
  }, [showResults, milestoneKeys.join(","), childAge, degreeType, eduTier, JSON.stringify(selections), existingSavings, monthlySIP, riskLevel, stepUpPct, stepUpEnabled, propertyTier, propertyType, propertyConfig, JSON.stringify(targetAges)]);

  function reset() {
    setStep(1); setChildAge(5); setMilestones({}); setDegreeType(null); setEduTier(null);
    setSelections({}); setExistingSavings("0"); setMonthlySIP("5000");
    setRiskLevel(1); setStepUpEnabled(false); setStepUpPct("10"); setShowResults(false);
    setPropertyTier(null); setPropertyType(null); setPropertyConfig(null);
    setTargetAges({ mar: 25, house: 30, startup: 28 });
  }

  const edu3Ok = !!degreeType;
  const edu4Ok = !!degreeType && !!eduTier;

  // ── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div style={base.wrap}>
      {/* Progress bar */}
      <div style={base.pBar}><div style={base.pFill(progress)} /></div>

      {/* ── STEP 1: Age ── */}
      {!showResults && step === 1 && (
        <StepWrap stepKey="s1">
          <p style={base.stepLbl}>Step 1</p>
          <h2 style={base.h1}>How old is your child?</h2>
          <p style={base.sub}>This sets how many years you have to build the corpus.</p>
          <div style={base.slWrap}>
            <div style={base.slRow}><span>Child's current age</span><span style={base.slVal}>{childAge} {childAge === 1 ? "year" : "years"}</span></div>
            <input type="range" min={0} max={17} value={childAge} step={1} style={base.slider}
              onChange={e => setChildAge(parseInt(e.target.value))} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-30)", marginTop: 4 }}>
              <span>Newborn</span><span>17 years</span>
            </div>
          </div>
          <button className="btn primary" style={btnPrimary(false)} onClick={() => goTo(2)}>Continue →</button>
        </StepWrap>
      )}

      {/* ── STEP 2: Milestones ── */}
      {!showResults && step === 2 && (
        <StepWrap stepKey="s2">
          <p style={base.stepLbl}>Step 2</p>
          <h2 style={base.h1}>What are you saving for?</h2>
          <p style={base.sub}>Pick all that apply. Each milestone gets its own projection.</p>
          <div style={base.grid2}>
            {Object.entries(MILESTONE_META).map(([key, meta]) => (
              <div key={key} style={base.card(!!milestones[key])}
                onClick={() => {
                  setMilestones(prev => { const n={...prev}; n[key]?delete n[key]:n[key]=true; return n; });
                  if (key === "house") { setPropertyTier(null); setPropertyType(null); setPropertyConfig(null); }
                }}>
                <div style={base.cIcon}>{meta.icon}</div>
                <div style={base.cTitle(!!milestones[key])}>{meta.label}</div>
                <div style={base.cSub(!!milestones[key])}>{meta.sub}</div>
              </div>
            ))}
          </div>
          <button className="btn ghost" style={btnBack} onClick={() => goTo(1)}>← Back</button>
          <button className="btn primary" style={btnPrimary(milestoneKeys.length === 0)} disabled={milestoneKeys.length === 0} onClick={nextFrom2}>Continue →</button>
        </StepWrap>
      )}

      {/* ── STEP 3: Degree type ── */}
      {!showResults && step === 3 && hasEdu && (
        <StepWrap stepKey="s3">
          <p style={base.stepLbl}>Step 3 · Higher education</p>
          <h2 style={base.h1}>What degree are you planning for?</h2>
          <p style={base.sub}>This sets the target age and timeline for savings.</p>
          <div style={base.grid2}>
            {DEGREE_TYPES.map(dt => (
              <div key={dt.key} style={base.card(degreeType === dt.key)} onClick={() => setDegreeType(dt.key)}>
                <div style={base.cTitle(degreeType === dt.key)}>{dt.label}</div>
                <div style={base.cSub(degreeType === dt.key)}>{dt.sub}</div>
                <div style={base.cMeta(degreeType === dt.key)}>Starts at {dt.startAge} · {dt.years} yrs</div>
              </div>
            ))}
          </div>
          <button className="btn ghost" style={btnBack} onClick={backFrom3}>← Back</button>
          <button className="btn primary" style={btnPrimary(!edu3Ok)} disabled={!edu3Ok} onClick={nextFrom3}>Continue →</button>
        </StepWrap>
      )}

      {/* ── STEP 4: Institution tier ── */}
      {!showResults && step === 4 && hasEdu && (
        <StepWrap stepKey="s4">
          <p style={base.stepLbl}>Step 4 · Higher education</p>
          <h2 style={base.h1}>Which institution tier?</h2>
          <p style={base.sub}>We'll inflate today's cost at 8% per year to project the future amount.</p>
          {degreeType && (
            <div style={base.infoBanner}>
              {DEGREE_TYPES.find(d=>d.key===degreeType)?.label} · starts at age {getEduStartAge()} · {Math.max(1, getEduStartAge() - childAge)} years away
            </div>
          )}
          <div>
            {EDU_TIERS.map(t => {
              const cost = EDU_COST_MATRIX[degreeType]?.[t.key] || 0;
              return (
                <span key={t.key} style={base.pill(eduTier === t.key)} onClick={() => setEduTier(t.key)}>
                  {t.label}&nbsp;<span style={{ fontSize: 11, color: eduTier === t.key ? "var(--moss)" : "var(--ink-30)" }}>· {fmtINR(cost)} today</span>
                </span>
              );
            })}
          </div>
          <button className="btn ghost" style={btnBack} onClick={backFrom4}>← Back</button>
          <button className="btn primary" style={btnPrimary(!edu4Ok)} disabled={!edu4Ok} onClick={nextFrom4}>Continue →</button>
        </StepWrap>
      )}

      {/* ── STEP 5: Other milestones ── */}
      {!showResults && step === 5 && hasOthers && (
        <StepWrap stepKey="s5">
          <p style={base.stepLbl}>Step {hasEdu ? "5" : "3"}</p>
          <h2 style={base.h1}>A few more details</h2>
          <p style={base.sub}>Help us size the remaining milestones.</p>

          {["mar","house","startup"].filter(k => milestones[k]).map(key => {
            const sliderCfg = { mar: { min: 20, max: 35 }, house: { min: 25, max: 45 }, startup: { min: 23, max: 40 } };
            const { min, max } = sliderCfg[key];
            const tAge     = targetAges[key];
            const yearsAway = Math.max(1, tAge - childAge);
            return (
              <div key={key} style={{ marginBottom: 32 }}>

                {/* a) Section heading */}
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--forest)", marginBottom: 14 }}>
                  {MILESTONE_META[key].icon} {MILESTONE_META[key].label}
                </div>

                {/* b) Age slider */}
                <div style={base.slWrap}>
                  <div style={base.slRow}>
                    <span style={{ fontSize: 13, color: "var(--sage)" }}>When do you expect this milestone?</span>
                    <span style={{ ...base.slVal, fontSize: 13 }}>
                      When your child is {tAge} · {yearsAway} {yearsAway === 1 ? "year" : "years"} away
                    </span>
                  </div>
                  <input type="range" min={min} max={max} step={1} value={tAge} style={base.slider}
                    onChange={e => setTargetAges(prev => ({ ...prev, [key]: parseInt(e.target.value) }))} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-30)", marginTop: 4 }}>
                    <span>{min}</span><span>{max}</span>
                  </div>
                </div>

                {/* c) Detail options */}
                {key !== "house" && (
                  <div>
                    {BENCHMARKS[key].map(b => (
                      <span key={b.key} style={base.pill(selections[key] === b.key)}
                        onClick={() => setSelections(p => ({ ...p, [key]: b.key }))}>
                        {b.label}&nbsp;<span style={{ fontSize: 11, color: selections[key] === b.key ? "var(--moss)" : "var(--ink-30)" }}>· {fmtINR(b.cost)}</span>
                      </span>
                    ))}
                  </div>
                )}

                {key === "house" && (
                  <div>
                    {/* Level 1: City tier */}
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

                    {/* Level 2: Property type (shown after tier selected) */}
                    {propertyTier && (() => {
                      const isTypeDisabled = type =>
                        Object.values(PROPERTY_COST_MATRIX[propertyTier]?.[type] || {}).every(v => v === null);
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

                    {/* Level 3: Configuration (shown after type selected) */}
                    {propertyTier && propertyType && (
                      <>
                        <div style={{ ...base.pgLbl, marginTop: 4 }}>Configuration</div>
                        <div>
                          {PROPERTY_CONFIGS
                            .filter(c => PROPERTY_COST_MATRIX[propertyTier]?.[propertyType]?.[c.key] !== null)
                            .map(c => (
                              <span key={c.key} style={base.pill(propertyConfig === c.key)}
                                onClick={() => setPropertyConfig(c.key)}>
                                {c.label}
                              </span>
                            ))
                          }
                        </div>
                      </>
                    )}

                    {/* Summary banner after all 3 selected */}
                    {propertyCost > 0 && (
                      <div style={{ ...base.infoBanner, marginTop: 16, marginBottom: 0 }}>
                        20% down payment on a {fmtINR(getPropertyFullCost())} {PROPERTY_TYPES.find(t => t.key === propertyType)?.label}
                        {" · "}<strong>{fmtINR(propertyCost)} to save</strong>
                      </div>
                    )}
                  </div>
                )}

              </div>
            );
          })}

          <button className="btn ghost" style={btnBack} onClick={backFrom5}>← Back</button>
          <button
            className="btn primary"
            style={btnPrimary(milestones["house"] && propertyCost === 0)}
            disabled={milestones["house"] && propertyCost === 0}
            onClick={() => goTo(6)}>
            Continue →
          </button>
        </StepWrap>
      )}

      {/* ── STEP 6: Savings inputs ── */}
      {!showResults && step === 6 && (
        <StepWrap stepKey="s6">
          <p style={base.stepLbl}>Last step</p>
          <h2 style={base.h1}>What are you saving today?</h2>
          <p style={base.sub}>Zero is a perfectly valid answer.</p>

          <label style={base.fldLbl}>Already saved for this child (₹)</label>
          <input type="number" style={base.inp} placeholder="0" min={0} value={existingSavings}
            onChange={e => setExistingSavings(e.target.value)} />

          <label style={base.fldLbl}>Monthly SIP you can invest (₹)</label>
          <input type="number" style={base.inp} placeholder="5000" min={0} value={monthlySIP}
            onChange={e => setMonthlySIP(e.target.value)} />

          {/* Step-up SIP toggle */}
          <div style={base.toggle} onClick={() => setStepUpEnabled(p => !p)}>
            <div style={base.toggleBox(stepUpEnabled)}><div style={base.toggleDot(stepUpEnabled)} /></div>
            <span style={base.toggleLbl}>Step-up SIP — increase monthly investment every year</span>
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
                Your SIP grows from ₹{(parseFloat(monthlySIP)||0).toLocaleString("en-IN")} today to ₹{Math.round((parseFloat(monthlySIP)||0) * Math.pow(1 + parseFloat(stepUpPct)/100, 10)).toLocaleString("en-IN")} in 10 years — matching your income growth.
              </p>
            </div>
          )}

          <label style={{ ...base.fldLbl, marginBottom: 10 }}>Expected return on investment</label>
          <div style={base.riskRow}>
            {RETURN_LABELS.map((lbl, i) => (
              <div key={i} style={base.riskP(riskLevel === i)} onClick={() => setRiskLevel(i)}>{lbl}</div>
            ))}
          </div>

          <button className="btn ghost" style={btnBack} onClick={backFrom6}>← Back</button>
          <button className="btn primary" style={btnPrimary(false)} onClick={() => setShowResults(true)}>See my plan →</button>
        </StepWrap>
      )}

      {/* ── RESULTS (live) ── */}
      {showResults && live && (
        <StepWrap stepKey="results">
          <p style={base.stepLbl}>Your savings plan</p>
          <h2 style={base.h1}>Here's where you stand</h2>

          {/* Overall progress ring + summary */}
          <div style={{ display: "flex", gap: 16, alignItems: "center", background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 20px", marginBottom: 20 }}>
            <Ring pct={live.totalPct} size={80} />
            <div>
              <div style={{ fontSize: 12, color: "var(--sage)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Overall funding</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--forest)" }}>{fmtINR(live.totalOnTrack)} <span style={{ fontSize: 14, fontWeight: 400, color: "var(--ink-30)" }}>of {fmtINR(live.totalCorpus)}</span></div>
              <div style={{ fontSize: 13, color: "var(--sage)", marginTop: 3 }}>
                {live.totalPct < 50 ? "You have a significant gap to close." : live.totalPct < 90 ? "Good start — a small SIP boost will get you there." : "You're nearly fully funded across all milestones."}
              </div>
            </div>
          </div>

          {/* Per-milestone cards */}
          {live.rows.map(r => (
            <div key={r.key} style={{ border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, marginRight: 12 }}>
                  <div style={{ fontSize: 11, color: "var(--sage)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>{r.icon} {r.label} — in {r.years} yr{r.years !== 1 ? "s" : ""}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "var(--forest)" }}>{fmtINR(r.corpus)}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-30)", marginTop: 3 }}>{r.durationLabel} · today {fmtINR(r.todayCost)} @ {(INFLATION[r.key === "edu" ? "edu" : r.key]*100).toFixed(0)}% inflation</div>
                </div>
                <Ring pct={r.pct} size={60} />
              </div>
              {/* Progress bar */}
              <div style={{ marginTop: 12, height: 5, background: "var(--border)", borderRadius: 3 }}>
                <div style={{ height: "100%", width: r.pct + "%", borderRadius: 3, background: r.pct >= 100 ? "var(--leaf)" : r.pct > 50 ? "var(--amber)" : "var(--coral)", transition: "width 0.5s ease" }} />
              </div>
            </div>
          ))}

          {/* Gap / on-track card */}
          <div style={{ background: live.totalAddSIP > 0 ? "var(--amber-lt)" : "var(--frost)", border: `1.5px solid ${live.totalAddSIP > 0 ? "var(--amber)" : "var(--leaf)"}`, borderRadius: 14, padding: "20px 20px", marginBottom: 12, marginTop: 4 }}>
            {live.totalAddSIP > 0 ? (
              <>
                <div style={{ fontSize: 11, color: "var(--amber-dk)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Additional SIP needed to close the gap</div>
                <div style={{ fontSize: 30, fontWeight: 700, color: "var(--amber-dk)" }}>{fmtINR(Math.round(live.totalAddSIP))} <span style={{ fontSize: 16, fontWeight: 500 }}>/ month</span></div>
                <div style={{ fontSize: 13, color: "var(--amber-dk)", marginTop: 6, lineHeight: 1.5 }}>
                  On top of your current ₹{(parseFloat(monthlySIP)||0).toLocaleString("en-IN")}/month.
                  That's ₹{Math.round((parseFloat(monthlySIP)||0) + live.totalAddSIP).toLocaleString("en-IN")}/month total to fund all milestones on time.
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 11, color: "var(--moss)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>You are fully on track</div>
                <div style={{ fontSize: 30, fontWeight: 700, color: "var(--forest)" }}>No gap 🎉</div>
                <div style={{ fontSize: 13, color: "var(--moss)", marginTop: 6 }}>Your current savings rate covers all selected milestones.</div>
              </>
            )}
          </div>

          {/* Live what-if sliders */}
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 18px", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--forest)", marginBottom: 16 }}>What if I change my plan?</div>

            <div style={base.slWrap}>
              <div style={base.slRow}>
                <span style={{ fontSize: 13, color: "var(--sage)" }}>Monthly SIP</span>
                <span style={{ ...base.slVal, fontSize: 14, color: "var(--leaf)" }}>₹{(parseFloat(monthlySIP)||0).toLocaleString("en-IN")}</span>
              </div>
              <input type="range" min={0} max={100000} step={500} value={parseFloat(monthlySIP)||0} style={base.slider}
                onChange={e => setMonthlySIP(e.target.value)} />
            </div>

            <div style={base.slWrap}>
              <div style={base.slRow}>
                <span style={{ fontSize: 13, color: "var(--sage)" }}>Already saved</span>
                <span style={{ ...base.slVal, fontSize: 14, color: "var(--leaf)" }}>₹{(parseFloat(existingSavings)||0).toLocaleString("en-IN")}</span>
              </div>
              <input type="range" min={0} max={5000000} step={50000} value={parseFloat(existingSavings)||0} style={base.slider}
                onChange={e => setExistingSavings(e.target.value)} />
            </div>

            <div style={{ ...base.toggle, marginBottom: 0 }} onClick={() => setStepUpEnabled(p => !p)}>
              <div style={base.toggleBox(stepUpEnabled)}><div style={base.toggleDot(stepUpEnabled)} /></div>
              <span style={{ ...base.toggleLbl, fontSize: 12 }}>Step-up SIP by {stepUpPct}% / year</span>
            </div>
          </div>

          {/* CTA block */}
          <div style={{ background: "linear-gradient(135deg, var(--forest) 0%, var(--moss) 100%)", borderRadius: 16, padding: "24px 22px", marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>
              Ready to start?
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 8, lineHeight: 1.3 }}>
              {live.totalAddSIP > 0
                ? `Start a SIP of ${fmtINR(Math.round(live.totalAddSIP + (parseFloat(monthlySIP)||0)))} / month on Taru`
                : "You're on track — keep it going on Taru"}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 20, lineHeight: 1.5 }}>
              Taru invests in mutual funds for your child and teaches them about money — so the corpus you build today becomes a lesson they carry forever.
            </div>
            <a href="https://taru.money" target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", background: "#fff", color: "var(--forest)", fontWeight: 700, fontSize: 15, padding: "13px 28px", borderRadius: 10, textDecoration: "none", letterSpacing: "0.01em" }}>
              Invest on Taru →
            </a>
            <div style={{ marginTop: 14, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
              AMFI-registered MFD · No lock-in · Start with ₹500 / month
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
            <button className="btn ghost" style={{ flex: 1, textAlign: "center" }} onClick={() => setShowResults(false)}>← Edit plan</button>
            <button className="btn ghost" style={{ flex: 1, textAlign: "center" }} onClick={reset}>Start over</button>
          </div>

          <p style={{ fontSize: 11, color: "var(--ink-30)", marginTop: 16, lineHeight: 1.7 }}>
            Projections use today's benchmark costs inflated at 8% / yr for education and 6–7% for other milestones. Expected returns are illustrative. This is not financial advice.
          </p>
        </StepWrap>
      )}
    </div>
  );
}
