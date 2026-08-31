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

export default async (request, context) => {
  const { pathname } = new URL(request.url)

  if (STATIC_ASSET_RE.test(pathname)) {
    return context.next()
  }

  if (isKnownRoute(pathname)) {
    return context.next()
  }

  const response = await context.next()
  return new Response(response.body, {
    status: 404,
    statusText: 'Not Found',
    headers: response.headers,
  })
}

export const config = { path: '/*' }
