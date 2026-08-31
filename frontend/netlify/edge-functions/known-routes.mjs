// Returns a genuine HTTP 404 for any path that isn't a real route in the
// SPA (src/App.jsx) or a static asset — instead of silently falling
// through to the SPA shell with a 200, which is what netlify.toml's
// catch-all `/* -> /index.html status=200` redirect does on its own.
//
// Known-route matching (both prerendered and client-only routes, plus the
// /child/:token pattern) comes from ../../route-manifest.mjs — the same
// manifest prerender-run.mjs uses at build time, so this can't drift out
// of sync with the actual route list.

import { isKnownRoute } from '../../route-manifest.mjs'

// Any request for a path with a file extension (JS/CSS bundles, images,
// robots.txt, sitemap.xml, favicons, source maps, ...) is a static asset,
// not a page navigation — let Netlify's normal static-file handling serve
// or 404 it without us rewriting the status.
const STATIC_ASSET_RE = /\.[a-zA-Z0-9]+$/

// Matches /app itself and every /app/* alias (/app/login, /app/signup,
// /app/verify-email, /app/parent/*, /app/child/*). These are unintentionally
// crawlable duplicates of already-robots.txt-disallowed canonical routes
// (/login, /signup, /parent/*, /child/*) — robots.txt Disallow alone only
// stops crawling, it doesn't deindex a URL Google already has, so these get
// an explicit noindex signal here too. X-Robots-Tag (not a <meta> tag) is
// used deliberately: /app and its aliases are never prerendered, so a
// client-side Helmet noindex tag wouldn't appear in the raw response until
// after JS executes — this header is present on the very first byte.
const APP_ALIAS_RE = /^\/app(\/|$)/

function withNoindex(headers) {
  const h = new Headers(headers)
  h.set('X-Robots-Tag', 'noindex')
  return h
}

export default async (request, context) => {
  const { pathname } = new URL(request.url)

  if (STATIC_ASSET_RE.test(pathname)) {
    return context.next()
  }

  const isAppAlias = APP_ALIAS_RE.test(pathname)
  const response = await context.next()

  if (!isKnownRoute(pathname)) {
    return new Response(response.body, {
      status: 404,
      statusText: 'Not Found',
      headers: isAppAlias ? withNoindex(response.headers) : response.headers,
    })
  }

  if (isAppAlias) {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: withNoindex(response.headers),
    })
  }

  return response
}

export const config = { path: '/*' }
