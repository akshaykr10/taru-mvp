/**
 * narrationGuard.test.js
 *
 * Run with: node src/lib/narrationGuard.test.js
 * No test runner required — uses Node built-in assert.
 *
 * Tests prove:
 *   1. All 5 valid intents pass clean text through unchanged
 *   2. Unknown intent returns SAFE_FALLBACK and logs a warning
 *   3. AMC name WITH qualifier is stripped; bare AMC name is NOT stripped
 *   4. ISIN is stripped
 *   5. Return projection → SAFE_FALLBACK
 *   6. Advisory phrase → SAFE_FALLBACK
 *   7. null input → SAFE_FALLBACK
 *   8. Empty string → SAFE_FALLBACK
 *   9. Injection: fund_name containing a return projection → SAFE_FALLBACK
 */

'use strict'

const assert = require('assert/strict')
const { guardNarration, SAFE_FALLBACK } = require('./narrationGuard')

// ── Tiny test harness ─────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✓  ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗  ${name}`)
    console.error(`     ${err.message}`)
    failed++
  }
}

// Capture and restore console.warn so tests can assert on it without noise.
function captureWarn(fn) {
  const messages = []
  const original = console.warn
  console.warn = (...args) => messages.push(args.join(' '))
  try {
    fn()
  } finally {
    console.warn = original
  }
  return messages
}

// ── Test suite ────────────────────────────────────────────────────────────────

console.log('\nnarrationGuard — running tests\n')

// ── 1. All 5 valid intents pass clean text through unchanged ──────────────────

console.log('1. Valid intents — clean text passes through')

const CLEAN_TEXT = 'Your savings are growing steadily over time.'

test('growth_happened — clean text returned as-is', () => {
  assert.equal(guardNarration(CLEAN_TEXT, 'growth_happened'), CLEAN_TEXT)
})

test('dip_is_normal — clean text returned as-is', () => {
  assert.equal(guardNarration(CLEAN_TEXT, 'dip_is_normal'), CLEAN_TEXT)
})

test('streak_milestone — clean text returned as-is', () => {
  assert.equal(guardNarration(CLEAN_TEXT, 'streak_milestone'), CLEAN_TEXT)
})

test('save_regularly — clean text returned as-is', () => {
  assert.equal(guardNarration(CLEAN_TEXT, 'save_regularly'), CLEAN_TEXT)
})

test('generic_encouragement — clean text returned as-is', () => {
  assert.equal(guardNarration(CLEAN_TEXT, 'generic_encouragement'), CLEAN_TEXT)
})

// ── 2. Unknown intent → SAFE_FALLBACK + console.warn ─────────────────────────

console.log('\n2. Unknown intent')

test('unknown intent returns SAFE_FALLBACK', () => {
  const result = guardNarration(CLEAN_TEXT, 'make_it_rich')
  assert.equal(result, SAFE_FALLBACK)
})

test('unknown intent logs a warning containing the intent name', () => {
  const warnings = captureWarn(() => {
    guardNarration(CLEAN_TEXT, 'make_it_rich')
  })
  assert.ok(warnings.length > 0, 'expected at least one console.warn call')
  assert.ok(
    warnings.some(w => w.includes('make_it_rich')),
    `expected warning to mention the intent name; got: ${warnings.join(' | ')}`
  )
})

// ── 3. AMC name stripping ─────────────────────────────────────────────────────

console.log('\n3. AMC name stripping — qualifier required')

test('fund name with qualifier is stripped: "Axis Bluechip Fund"', () => {
  const input  = 'Your Axis Bluechip Fund has done well this month.'
  const result = guardNarration(input, 'growth_happened')
  assert.ok(
    !result.includes('Axis') && !result.includes('Bluechip'),
    `expected "Axis" and "Bluechip" to be stripped; got: "${result}"`
  )
})

test('bare "Axis" without fund qualifier is NOT stripped', () => {
  const input  = 'Saving is as sturdy as an Axis of a wheel.'
  const result = guardNarration(input, 'generic_encouragement')
  assert.ok(
    result.includes('Axis'),
    `expected bare "Axis" to be preserved; got: "${result}"`
  )
})

test('multi-word AMC with qualifier stripped: "Parag Parikh Flexi Cap Fund"', () => {
  const input  = 'The Parag Parikh Flexi Cap Fund is part of your portfolio.'
  const result = guardNarration(input, 'growth_happened')
  assert.ok(
    !result.includes('Parag') && !result.includes('Parikh'),
    `expected "Parag Parikh" to be stripped; got: "${result}"`
  )
})

// ── 4. ISIN stripping ─────────────────────────────────────────────────────────

console.log('\n4. ISIN stripping')

test('ISIN pattern is stripped from text', () => {
  // Valid ISIN: exactly 2 uppercase letters + 10 uppercase alphanumeric = 12 chars
  // INE123456789 = IN (2 letters) + E123456789 (10 alphanumeric) = 12 chars total
  const input  = 'The fund with ISIN INE123456789 is tracked in your garden.'
  const result = guardNarration(input, 'generic_encouragement')
  assert.ok(
    !result.includes('INE123456789'),
    `expected ISIN to be stripped; got: "${result}"`
  )
})

test('ISIN is replaced with [fund] token', () => {
  const input  = 'Holdings include IN0000000001 in your portfolio.'
  const result = guardNarration(input, 'generic_encouragement')
  assert.ok(
    result.includes('[fund]'),
    `expected "[fund]" replacement token; got: "${result}"`
  )
})

// ── 5. Return projection → SAFE_FALLBACK ─────────────────────────────────────

console.log('\n5. Return projections → rejection')

test('percentage range rejected: "12–14%"', () => {
  const input = 'Equity funds have returned 12–14% over this period.'
  assert.equal(guardNarration(input, 'growth_happened'), SAFE_FALLBACK)
})

test('return-adjacent percentage rejected: "12% annually"', () => {
  const input = 'At current rates of 12% annually, your money compounds well.'
  assert.equal(guardNarration(input, 'growth_happened'), SAFE_FALLBACK)
})

test('"at N% for/over" forecast rejected: "at 10% for 30 years"', () => {
  const input = 'Invested at 10% for 30 years, this doubles many times over.'
  assert.equal(guardNarration(input, 'save_regularly'), SAFE_FALLBACK)
})

test('percentage tied to growth rejected: "10% growth"', () => {
  const input = 'The portfolio showed 10% growth this quarter.'
  assert.equal(guardNarration(input, 'growth_happened'), SAFE_FALLBACK)
})

// ── 6. Advisory phrases → SAFE_FALLBACK ──────────────────────────────────────

console.log('\n6. Advisory phrases → rejection')

test('"you should" rejected', () => {
  const input = 'You should put more money into equity funds now.'
  assert.equal(guardNarration(input, 'save_regularly'), SAFE_FALLBACK)
})

test('"outperformed" rejected', () => {
  const input = 'This fund has outperformed its benchmark over 5 years.'
  assert.equal(guardNarration(input, 'growth_happened'), SAFE_FALLBACK)
})

test('"buy now" rejected', () => {
  const input = 'Prices are low — the best time to buy now is always early.'
  assert.equal(guardNarration(input, 'save_regularly'), SAFE_FALLBACK)
})

test('"sell" (standalone word) rejected', () => {
  const input = 'Some investors choose to sell when markets fall.'
  assert.equal(guardNarration(input, 'dip_is_normal'), SAFE_FALLBACK)
})

test('"selling" (substring of sell) is NOT rejected', () => {
  // "selling" must not trigger the \bsell\b word-boundary pattern
  const input = 'The idea of selling fears away is what good habits do.'
  const result = guardNarration(input, 'generic_encouragement')
  assert.notEqual(result, SAFE_FALLBACK,
    'expected "selling" not to trigger the sell word-boundary guard')
})

// ── 7. null input → SAFE_FALLBACK ────────────────────────────────────────────

console.log('\n7. null / undefined input')

test('null returns SAFE_FALLBACK', () => {
  assert.equal(guardNarration(null, 'generic_encouragement'), SAFE_FALLBACK)
})

test('undefined returns SAFE_FALLBACK', () => {
  assert.equal(guardNarration(undefined, 'generic_encouragement'), SAFE_FALLBACK)
})

// ── 8. Empty string → SAFE_FALLBACK ──────────────────────────────────────────

console.log('\n8. Empty / whitespace-only input')

test('empty string returns SAFE_FALLBACK', () => {
  assert.equal(guardNarration('', 'generic_encouragement'), SAFE_FALLBACK)
})

test('whitespace-only string returns SAFE_FALLBACK', () => {
  assert.equal(guardNarration('   ', 'generic_encouragement'), SAFE_FALLBACK)
})

// ── 9. Injection test ─────────────────────────────────────────────────────────
// Simulates a cas_funds row where fund_name has been crafted (or accidentally
// constructed) to include both an AMC name and a return projection.
// The fund name strips cleanly, but the return projection in the same string
// contaminates the message beyond salvage — the guard must return SAFE_FALLBACK,
// not the stripped version.

console.log('\n9. Injection: cas_funds fund_name containing a return projection')

test('fund_name with AMC + return projection → SAFE_FALLBACK (not stripped version)', () => {
  // This simulates what would happen if a developer built a Penny message directly
  // from a cas_funds.fund_name value without passing it through the guard first.
  const injectedFundName = 'Axis Bluechip Fund — your best bet at 14% returns'

  // The candidate message as a future developer might construct it:
  const candidateMessage = `Your ${injectedFundName} is part of your portfolio.`
  // → "Your Axis Bluechip Fund — your best bet at 14% returns is part of your portfolio."

  const result = guardNarration(candidateMessage, 'growth_happened')

  // After stripping, "Axis Bluechip Fund" → "[fund manager fund]", leaving:
  // "Your [fund manager fund] — your best bet at 14% returns is part of your portfolio."
  // "14% returns" matches the return-adjacent percentage pattern → reject → SAFE_FALLBACK.
  assert.equal(result, SAFE_FALLBACK,
    `expected SAFE_FALLBACK because return projection survives stripping; got: "${result}"`)
})

test('injection: verify the return projection in the stripped string is what causes rejection', () => {
  // Cross-check: the same string WITHOUT the return projection passes through
  // (with the AMC name stripped). Proves the rejection is specifically the % figure.
  const cleanFundRef = 'Axis Bluechip Fund is part of your portfolio.'
  const result = guardNarration(cleanFundRef, 'growth_happened')
  assert.notEqual(result, SAFE_FALLBACK,
    'expected clean fund reference (no return projection) to pass after stripping')
  assert.ok(
    !result.includes('Axis') && !result.includes('Bluechip'),
    `expected AMC name stripped from passing message; got: "${result}"`)
})

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(48)}`)
console.log(`  ${passed + failed} tests: ${passed} passed, ${failed} failed`)
console.log(`${'─'.repeat(48)}\n`)

if (failed > 0) {
  process.exit(1)
}
