/**
 * Fire-and-forget activity event logger.
 * Never awaited — a failed write is acceptable for Phase 0.
 *
 * @param {'parent'|'child'} actorType
 * @param {string} eventType  - from the event taxonomy in CLAUDE.md
 * @param {object} [opts]
 * @param {string} [opts.section]   - route/tab visited
 * @param {object} [opts.metadata]  - IDs/slugs/week numbers only, never PII
 * @param {string} [opts.authToken] - Supabase JWT for parent events
 * @param {string} [opts.childToken]- signed child JWT for child events
 */
export function logActivity(actorType, eventType, opts = {}) {
  const { section, metadata, authToken, childToken } = opts

  const headers = { 'Content-Type': 'application/json' }
  if (authToken)  headers['Authorization']  = `Bearer ${authToken}`
  if (childToken) headers['X-Child-Token']  = childToken

  fetch(`${import.meta.env.VITE_API_BASE_URL}/api/activity`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ actor_type: actorType, event_type: eventType, section, metadata }),
  }).catch(() => {}) // intentional silent failure
}
