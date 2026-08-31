import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Public, non-auth-gated routes from src/App.jsx — sourced from the shared
// manifest (also used by the known-routes edge function) so the two never
// drift apart.
// Excluded on purpose (see route-manifest.mjs for the full list):
//   /app                      — client-side auth redirect, no static content to render
//   /app/signup /app/login /app/verify-email — duplicate aliases of the canonical paths below
//   /parent/* and /app/parent/* — behind RequireParentAuth (Supabase login required)
//   /child/:token              — token-gated; no valid static token to render against
//   *                          — catch-all redirect, not a real page
const { prerenderedRoutes: routes } = await import('./route-manifest.mjs')

let Prerenderer, PuppeteerRenderer

try {
  ;({ default: Prerenderer } = await import('@prerenderer/prerenderer'))
  ;({ default: PuppeteerRenderer } = await import('@prerenderer/renderer-puppeteer'))
} catch (e) {
  console.error('[prerender] required packages failed to load:', e.stack)
  process.exit(1)
}

// Netlify's Linux build image has no persisted cache for puppeteer's own
// downloaded Chrome (that download also doesn't happen there — see
// PUPPETEER_SKIP_DOWNLOAD in netlify.toml), which used to fail every build
// silently. @sparticuz/chromium ships a compiled headless Chromium binary
// as part of the npm package itself, so there's nothing to download or
// cache between builds — point puppeteer at it directly.
// Locally (Windows/macOS dev), @sparticuz/chromium only ships a Linux
// binary, so fall back to puppeteer's own bundled Chrome as before.
let launchOptions = {}
if (process.platform === 'linux') {
  const { default: chromium } = await import('@sparticuz/chromium')
  launchOptions = {
    executablePath: await chromium.executablePath(),
    args: chromium.args,
    headless: chromium.headless,
  }
}

try {
  const prerenderer = new Prerenderer({
    staticDir: join(__dirname, 'dist'),
    // maxConcurrentRoutes defaults to 0 (unlimited) — with this many routes that opens
    // one headless-Chrome tab per route at once. Under that CPU contention, some tabs'
    // React/Helmet effects don't finish committing before the fixed renderAfterTime
    // window closes and the page gets captured mid-render (nondeterministic — a
    // different subset of routes loses its <head> tags on every run). Rendering
    // routes one at a time removes the contention entirely.
    // skipThirdPartyRequests aborts any request that isn't to the local static server —
    // without it, every prerender run actually loads gtag.js/Google Ads/Meta Pixel and
    // fires real conversion/pageview events from the headless browser.
    renderer: new PuppeteerRenderer({
      renderAfterTime: 2000,
      maxConcurrentRoutes: 1,
      skipThirdPartyRequests: true,
      launchOptions,
    }),
  })

  await prerenderer.initialize()
  const renderedRoutes = await prerenderer.renderRoutes(routes)
  await prerenderer.destroy()

  // A prerenderer that silently returns fewer pages than requested is the
  // same failure mode as the swallowed exception this replaces — catch it
  // explicitly instead of letting a partial dist/ pass as success.
  if (renderedRoutes.length !== routes.length) {
    throw new Error(
      `Expected ${routes.length} prerendered routes, got ${renderedRoutes.length}`
    )
  }

  for (const route of renderedRoutes) {
    const outputDir = join(__dirname, 'dist', route.route)
    mkdirSync(outputDir, { recursive: true })
    writeFileSync(join(outputDir, 'index.html'), route.html)
    console.log(`Prerendered: ${route.route}`)
  }

  console.log(`Prerendering complete: ${renderedRoutes.length} pages.`)
} catch (e) {
  // A failed prerender means the deploy would silently ship the SPA shell
  // for every route instead of real content — that must fail the build,
  // not log a warning nobody reads and report success.
  console.error('[prerender] failed:', e.stack)
  process.exit(1)
}
