import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

let Prerenderer, PuppeteerRenderer

try {
  ;({ Prerenderer } = await import('@prerenderer/prerenderer'))
  ;({ default: PuppeteerRenderer } = await import('@prerenderer/renderer-puppeteer'))
} catch (e) {
  console.warn('[prerender] packages not available, skipping:', e.message)
  process.exit(0)
}

try {
  const prerenderer = new Prerenderer({
    staticDir: join(__dirname, 'dist'),
    renderer: new PuppeteerRenderer({ renderAfterTime: 2000 }),
  })

  await prerenderer.initialize()
  const routes = await prerenderer.renderRoutes(['/', '/tax-calculator', '/calculator'])
  await prerenderer.destroy()

  for (const route of routes) {
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
