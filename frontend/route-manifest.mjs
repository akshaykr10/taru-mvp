// Single source of truth for which paths are real routes in the SPA
// (src/App.jsx). Consumed by:
//   - prerender-run.mjs (build time — decides what to prerender)
//   - netlify/edge-functions/known-routes.mjs (request time — decides what
//     gets a genuine 404 instead of falling through to the SPA shell)
//
// Kept as plain ESM with no Node built-ins so it can also be imported
// directly by the Deno-based edge function.

import { blogs } from './src/data/blogs.js'

// Public, non-auth-gated routes with real prerendered static HTML.
export const prerenderedRoutes = [
  '/',
  '/tax-calculator',
  '/calculator',
  '/blog',
  ...blogs.map((b) => `/blog/${b.slug}`),
  '/signup',
  '/login',
  '/verify-email',
  '/eula',
  '/forgot-password',
  '/reset-password',
  '/privacy',
  '/terms',
]

// Additional exact routes that are valid in the SPA but intentionally NOT
// prerendered: /app is a client-side auth redirect with no static content,
// the rest are /app/* aliases (duplicates of the canonical paths above) or
// auth-gated parent pages (behind RequireParentAuth, no valid content to
// render statically).
export const clientOnlyExactRoutes = [
  '/app',
  '/app/signup',
  '/app/login',
  '/app/verify-email',
  '/parent/onboarding',
  '/parent/dashboard',
  '/parent/portfolio',
  '/parent/settings',
  '/parent/coming-soon',
  '/app/parent/onboarding',
  '/app/parent/dashboard',
  '/app/parent/portfolio',
  '/app/parent/settings',
]

export const allExactRoutes = [...prerenderedRoutes, ...clientOnlyExactRoutes]

// /child/:token — token-gated, no valid static token to enumerate.
// Matches src/App.jsx's `:token` param: any single non-empty path segment.
export const dynamicRoutePatterns = [
  /^\/child\/[^/]+$/,
  /^\/app\/child\/[^/]+$/,
]

export function isKnownRoute(pathname) {
  const normalized =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname

  if (allExactRoutes.includes(normalized)) return true
  return dynamicRoutePatterns.some((re) => re.test(normalized))
}
