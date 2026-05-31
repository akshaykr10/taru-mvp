/**
 * narrationGuard.js
 *
 * Single chokepoint for all portfolio-aware Penny message generation.
 *
 * As an AMFI MFD, Taru educates — it does not give advice on specific
 * securities. This module enforces that line in code.
 *
 * USAGE
 *   const { guardNarration } = require('./lib/narrationGuard')
 *   const safe = guardNarration(candidateText, 'growth_happened')
 *   // safe is always a renderable string — never throws, never crashes the child's screen.
 *
 * ALLOW-LIST OF INTENTS
 *   New categories require explicit addition here and compliance review before shipping.
 *   growth_happened       — portfolio value increased; celebrate the habit, not the number
 *   dip_is_normal         — portfolio value decreased; normalise volatility
 *   streak_milestone      — goal progress milestone or task/week streak
 *   save_regularly        — reinforce consistent saving behaviour
 *   generic_encouragement — non-portfolio encouragement; safe for all contexts
 *
 * WHAT IS STRIPPED (best-effort sanitisation — returns cleaned text, does not reject)
 *   • ISINs: exactly 2 uppercase letters + 10 uppercase alphanumeric characters
 *   • AMC / fund house names: matched ONLY when followed within 0–3 words by a fund
 *     qualifier (Fund, Funds, MF, Mutual, AMC). Bare AMC names without a qualifier are
 *     NOT stripped — "Tata truck", "Axis Bank", "Union statement" are left untouched.
 *     Trade-off: a bare "HDFC" with no qualifier is not stripped; that is acceptable
 *     because a bare AMC name without "Fund/MF/Mutual" does not identify a specific scheme.
 *     Regexes are compiled once at module load for efficiency.
 *
 * WHAT IS REJECTED (whole message → SAFE_FALLBACK + console.warn, never throws)
 *   • Return projections: percentage ranges, return-adjacent percentages,
 *     year-count forecasts at a named rate (e.g. "at 10% for 30 years")
 *   • Advisory phrases: explicit buy/sell/hold implications or comparative rankings
 *   • Unknown intents
 *   • null, undefined, or empty text
 *
 * COMPLIANCE NOTE FOR AKSHAY
 *   The allow-list of intents and the advisory patterns below define the compliance
 *   boundary in code. A human reviewer should confirm these match the permissions
 *   under your AMFI MFD licence before this ships to production.
 *   Flagged borderline: "have historically" phrasing (Week 32 app_text_15) is not
 *   caught by these patterns — it requires editorial / compliance judgement.
 */

'use strict'

// ── Allow-list of message intents ─────────────────────────────────────────────

const VALID_INTENTS = new Set([
  'growth_happened',
  'dip_is_normal',
  'streak_milestone',
  'save_regularly',
  'generic_encouragement',
])

// ── Safe fallback ─────────────────────────────────────────────────────────────
// Used whenever a message is rejected for any reason.
// Must be return-neutral — the fallback fires for dip scenarios too, so it
// cannot imply positive portfolio movement. "Penny's keeping an eye on things"
// is directionally neutral and age-appropriate.
// Must remain compliant: no fund names, return projections, or advisory phrases.

const SAFE_FALLBACK =
  `Penny's keeping an eye on things. Check back after your next learning week.`

// ── AMC / fund house names — qualifier-required matching ─────────────────────
// Design choice: option (a) from review.
// Each entry is matched ONLY when followed within 0–3 words by a fund qualifier
// (Fund, Funds, MF, Mutual, AMC). This prevents stripping common words that
// happen to be AMC names: "Tata truck", "Axis Bank", "Union statement", "LIC policy"
// are all left untouched. "Tata Large Cap Fund", "Axis Bluechip Fund", "LIC MF" are stripped.
//
// Pattern per entry: \bNAME(?:\s+\w+){0,3}\s+(?:Fund|Funds|MF|Mutual|AMC)\b
// Sorted longest-first so multi-word names ("Motilal Oswal", "Parag Parikh") are
// matched before their shorter prefixes ("Motilal", "Parag").
//
// To add a new AMC: append the fund house name to RAW_AMC_NAMES. Do not remove entries.

const RAW_AMC_NAMES = [
  'Mahindra Manulife',
  'Canara Robeco',
  'Baroda BNP Paribas',
  'Franklin Templeton',
  'Motilal Oswal',
  'Aditya Birla',
  'Mirae Asset',
  'Parag Parikh',
  'Nippon India',
  'WhiteOak Capital',
  'HDFC', 'Axis', 'SBI', 'Mirae', 'PPFAS',
  'UTI', 'ICICI', 'Nippon', 'Kotak', 'DSP', 'Franklin',
  'Motilal', 'ABSL', 'Sundaram', 'Edelweiss', 'Tata',
  'Quantum', 'PGIM', 'IDFC', 'Bandhan', 'Invesco',
  'Canara', 'Union', 'Navi', 'WhiteOak', 'Groww',
  'Baroda', 'LIC', 'ITI', 'NJ', 'Samco',
  'Parag',  // catch partial if "Parag Parikh" already consumed
]

// Compile regexes once at module load — sort longest name first to prevent
// a shorter prefix shadowing a longer match in the same pass.
const AMC_STRIP_RES = RAW_AMC_NAMES
  .slice()
  .sort((a, b) => b.length - a.length)
  .map(name => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(
      `\\b${escaped}(?:\\s+\\w+){0,3}\\s+(?:Fund|Funds|MF|Mutual|AMC)\\b`,
      'gi'
    )
  })

// ── ISIN pattern ──────────────────────────────────────────────────────────────
// Standard: 2 uppercase letters (country code) + 10 uppercase alphanumeric.
// ISINs are always uppercase in data — no case-insensitive flag needed.

const ISIN_RE = /\b[A-Z]{2}[A-Z0-9]{10}\b/g

// ── Return-projection patterns ────────────────────────────────────────────────
// A match on any one rejects the whole message.
//
//   RP_RANGE    — numeric range + %: "12–14%", "7-8%"
//   RP_ADJACENT — % + return vocabulary: "7.1% effective", "10% CAGR"
//   RP_AT_FOR   — "at N% for/over/per [time]": "at 10% for 30 years"
//   RP_GROWTH   — % tied to growth/yield/gain/compound: "10% growth"

const RETURN_PROJECTION_PATTERNS = [
  {
    re: /\d+[–—\-]\d+(\.\d+)?%/,
    label: 'percentage range (e.g. 12–14%)',
  },
  {
    re: /\d+(\.\d+)?%\s*(annually|per\s+year|p\.a\.|CAGR|nominal|return|post[\s-]?tax|effective|interest|tax[\s-]?free|yield)/i,
    label: 'return-adjacent percentage',
  },
  {
    re: /\bat\s+\d+(\.\d+)?%\s*(for|over|per)\b/i,
    label: '"at N% for/over/per" forecast',
  },
  {
    re: /\d+(\.\d+)?%\s*(growth|compound|gain)/i,
    label: 'percentage tied to growth/compound/gain',
  },
]

// ── Advisory phrases ──────────────────────────────────────────────────────────
// Matched as substrings, case-insensitive.
// "buy" is NOT listed here as a bare word — "your parents buy units every month"
// is clean educational copy describing SIP behaviour. Only directional buy
// triggers are listed: "buy more", "buy now".
//
// Phrase rationale (maps to disallowed column in CLAUDE.md):
//   'you should'         — explicit recommendation
//   'clear it before'    — "clear it before investing"
//   'requires equity'    — "long-term wealth requires equity exposure"
//   'must invest'        — explicit instruction
//   'outperformed'       — comparative performance ranking
//   'better than'        — comparative ranking
//   'best fund'          — superlative ranking
//   'ranking changes'    — "the ranking changes" comparative frame
//   'now is a good time' — timing recommendation
//   'you need to invest' — explicit instruction
//   'invest more'        — directional recommendation
//   'buy more'           — directional buy recommendation
//   'buy now'            — timing buy recommendation

const ADVISORY_PHRASES = [
  'you should',
  'clear it before',
  'requires equity',
  'must invest',
  'outperformed',
  'better than',
  'best fund',
  'ranking changes',
  'now is a good time',
  'you need to invest',
  'invest more',
  'buy more',
  'buy now',
]

// Single-word advisory terms matched with word-boundary anchors to prevent
// false positives in substrings ("selling" contains "sell"; "oversell" does too).
// Note: "buy" is intentionally absent — see ADVISORY_PHRASES comment above.

const ADVISORY_WORD_PATTERNS = [
  { re: /\bsell\b/i, label: '"sell"' },
]

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Strip ISINs and fund-qualified AMC names from text.
 * Returns the cleaned string; does not reject.
 * @param {string} text
 * @returns {string}
 */
function stripIdentifiers(text) {
  // 1. Replace ISINs (unambiguous — always stripped)
  let out = text.replace(ISIN_RE, '[fund]')

  // 2. Replace AMC-name + qualifier phrases (compiled regexes, longest-first)
  for (const re of AMC_STRIP_RES) {
    out = out.replace(re, '[fund manager fund]')
    // Reset lastIndex — regex is /gi so stateful if reused
    re.lastIndex = 0
  }

  return out
}

/**
 * Returns {found, label} if text contains a disallowed pattern, else {found: false}.
 * Operates on already-stripped text so residual AMC names don't mask advisory phrases.
 * @param {string} text
 * @returns {{ found: boolean, label?: string }}
 */
function findDisallowedContent(text) {
  for (const { re, label } of RETURN_PROJECTION_PATTERNS) {
    if (re.test(text)) return { found: true, label: `return projection — ${label}` }
  }

  const lower = text.toLowerCase()
  for (const phrase of ADVISORY_PHRASES) {
    if (lower.includes(phrase)) {
      return { found: true, label: `advisory phrase — "${phrase}"` }
    }
  }

  for (const { re, label } of ADVISORY_WORD_PATTERNS) {
    if (re.test(text)) return { found: true, label: `advisory word — ${label}` }
  }

  return { found: false }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * guardNarration(text, intent) → string
 *
 * Pass any Penny message that touches portfolio data through this function
 * before rendering it to a child.
 *
 * GUARANTEES:
 *   • Never throws — compliance failures must not crash the child's screen.
 *   • Always returns a non-empty renderable string.
 *   • The returned string contains no ISINs, fund-qualified AMC names,
 *     return projections, or advisory phrases.
 *
 * @param {string} text   — Candidate Penny message (may be raw template output)
 * @param {string} intent — Must be one of VALID_INTENTS
 * @returns {string}      — Compliant text safe to render in child-facing UI
 */
function guardNarration(text, intent) {
  try {
    // 1. Unknown intent — rejected before inspecting text
    if (!VALID_INTENTS.has(intent)) {
      console.warn(`[narrationGuard] REJECTED — unknown intent "${intent}". Returning safe fallback.`)
      return SAFE_FALLBACK
    }

    // 2. Explicit null / undefined guard
    if (text == null) {
      console.warn(`[narrationGuard] REJECTED — null or undefined text for intent "${intent}". Returning safe fallback.`)
      return SAFE_FALLBACK
    }

    // 3. Non-string or empty string
    if (typeof text !== 'string' || text.trim() === '') {
      console.warn(`[narrationGuard] REJECTED — non-string or empty text for intent "${intent}". Returning safe fallback.`)
      return SAFE_FALLBACK
    }

    // 4. Strip ISINs and fund-qualified AMC names
    const stripped = stripIdentifiers(text)

    // 5. Reject if stripped text contains return projections or advisory language
    const { found, label } = findDisallowedContent(stripped)
    if (found) {
      console.warn(`[narrationGuard] REJECTED — disallowed content (${label}) for intent "${intent}". Returning safe fallback.`)
      return SAFE_FALLBACK
    }

    // 6. Passed all checks — return stripped (clean) text
    return stripped

  } catch (err) {
    // Last-resort safety net — the guard itself must never propagate an exception
    console.error(`[narrationGuard] UNEXPECTED ERROR for intent "${intent}":`, err.message)
    return SAFE_FALLBACK
  }
}

module.exports = { guardNarration, VALID_INTENTS, SAFE_FALLBACK }
