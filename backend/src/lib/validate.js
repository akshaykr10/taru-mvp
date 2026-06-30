/**
 * Shared input validation helpers.
 * Used by waitlist.js, calculatorLeads.js, and any future route.
 */

function isValidEmail(value) {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  const parts = trimmed.split('@')
  if (parts.length !== 2) return false
  const [local, domain] = parts
  return local.length > 0 && domain.includes('.') && domain.length > 3
}

module.exports = { isValidEmail }
