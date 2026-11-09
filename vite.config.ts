import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import { readFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'

const config = defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  resolve: { tsconfigPaths: true },
  plugins: [
    {
      name: 'local-game-html',
      configureServer(server) {
        // Standalone game documents must bypass the application's SSR router.
        const root = resolve(server.config.publicDir, 'games')
        server.middlewares.use(async (req, res, next) => {
          const pathname = (req.url ?? '').split('?')[0]
          if (!pathname.startsWith('/games/') || !pathname.endsWith('.html')) return next()
          let file: string
          try { file = resolve(root, decodeURIComponent(pathname.slice('/games/'.length))) }
          catch { return next() }
          if (!file.startsWith(root + sep)) return next()
          try {
            const html = await readFile(file)
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.end(req.method === 'HEAD' ? undefined : html)
          } catch { next() }
        })
      },
    },
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
