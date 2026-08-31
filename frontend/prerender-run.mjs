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
  console.warn('[prerender] packages not available, skipping:', e.message)
  process.exit(0)
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
    renderer: new PuppeteerRenderer({ renderAfterTime: 2000, maxConcurrentRoutes: 1, skipThirdPartyRequests: true }),
  })

  await prerenderer.initialize()
  const renderedRoutes = await prerenderer.renderRoutes(routes)
  await prerenderer.destroy()

  for (const route of renderedRoutes) {
    const outputDir = join(__dirname, 'dist', route.route)
    mkdirSync(outputDir, { recursive: true })
    writeFileSync(join(outputDir, 'index.html'), route.html)
    console.log(`Prerendered: ${route.route}`)
  }

  console.log('Prerendering complete.')
} catch (e) {
  console.warn('[prerender] failed, skipping:', e.message)
  process.exit(0)
}
