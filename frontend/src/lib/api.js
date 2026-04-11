/**
 * Absolute backend base URL — import this everywhere instead of reading
 * import.meta.env directly.
 *
 * Why this file exists:
 *   If VITE_BACKEND_URL is missing from the deployment environment,
 *   import.meta.env.VITE_BACKEND_URL evaluates to `undefined`.
 *   Template literals then produce the string "undefined/api/...", which
 *   the browser treats as a relative path and prefixes with the current
 *   page URL — e.g. "/parent/undefined/api/casparser/parse-pdf".
 *   The || fallback guarantees a valid absolute URL in every environment.
 *
 * Netlify: set VITE_BACKEND_URL in Site settings → Environment variables.
 * Local dev: add VITE_BACKEND_URL=http://localhost:3001 to frontend/.env.local
 */
export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'
