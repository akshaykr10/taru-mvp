/**
 * frontend/src/config.js
 *
 * App-wide feature configuration.
 * Edit this file to change feature prominence or behaviour — do not hardcode
 * config values in individual components.
 */

// ── Invest CTA prominence ──────────────────────────────────────────────────────
//
// Controls where and how the "Invest with Taru" coming-soon surface appears
// in the parent dashboard. Change this single value to dial the CTA up or down.
//
// Valid values:
//   'hidden'  — surface is not rendered anywhere. Use before demand research
//               on the target market is complete.
//   'footer'  — a quiet single-line prompt at the bottom of the dashboard,
//               below task approvals. Present but not competing with the
//               working product. DEFAULT.
//   'card'    — a full card with title and a sentence of copy, slotted between
//               the child overview and the weekly learning section. More visible;
//               use when pilot data shows genuine invest intent.
//   'primary' — top of dashboard, above the portfolio card. Maximum visibility;
//               only appropriate when empanelment is imminent and demand is
//               validated on the broad target market (not just the pilot network).
//
// Survey context (n=35, pilot network, May 2026): pull is strongly toward
// learning/conversation, not investing-through-Taru. Keep at 'footer' until
// research on the actual target market says otherwise.
// See brief section 5 and open item #1 in CLAUDE.md.

export const INVEST_CTA_PROMINENCE = 'footer'
