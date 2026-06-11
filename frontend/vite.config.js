import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Only run prerendering during production builds
const isProd = process.env.NODE_ENV === 'production'

let prerenderPlugin = null
if (isProd) {
  const { default: Prerender } = await import('vite-plugin-prerender')
  const PuppeteerRenderer = (await import('vite-plugin-prerender/lib/renderer-puppeteer')).default

  prerenderPlugin = Prerender({
    staticDir: path.join(process.cwd(), 'dist'),
    routes: ['/'],
    renderer: new PuppeteerRenderer({
      renderAfterTime: 2000,
      headless: true,
    }),
    postProcess(renderedRoute) {
      // Fix asset paths for prerendered HTML
      renderedRoute.html = renderedRoute.html
        .replace(/href="\//g, 'href="/')
        .replace(/src="\//g, 'src="/')
      return renderedRoute
    }
  })
}

export default defineConfig({
  plugins: [
    react(),
    ...(prerenderPlugin ? [prerenderPlugin] : []),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
