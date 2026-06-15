import { Prerenderer } from '@prerenderer/prerenderer'
import PuppeteerRenderer from '@prerenderer/renderer-puppeteer'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

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
