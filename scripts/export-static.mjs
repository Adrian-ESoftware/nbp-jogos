import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicOutDir = path.join(rootDir, '.output', 'public')
const basePath = (process.env.VITE_BASE_PATH || '/').replace(/\/$/, '')

function fixAssetBasePaths(html) {
  if (!basePath) return html
  return html
    .replace(/(href|src)="\/assets\//g, `$1="${basePath}/assets/`)
    .replace(/(href|src)="\/images\//g, `$1="${basePath}/images/`)
    .replace(/(href|src)="\/games\//g, `$1="${basePath}/games/`)
}

async function waitForServer(url, timeoutMs = 10000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok || res.status === 404) return
    } catch {}
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error(`Servidor SSR não respondeu em ${url}`)
}

async function main() {
  const catalog = JSON.parse(readFileSync(path.join(rootDir, 'src', 'data', 'games.json'), 'utf8'))
  const routes = ['/', '/about']
  for (const game of catalog.games) {
    if (game.status === 'published') {
      routes.push(`/jogos/${game.id}`)
    }
  }

  const port = 4199
  const serverProc = spawn('node', ['.output/server/index.mjs'], {
    cwd: rootDir,
    env: { ...process.env, PORT: String(port), NITRO_PORT: String(port) },
    stdio: 'pipe',
  })

  try {
    const baseUrl = `http://127.0.0.1:${port}`
    await waitForServer(`${baseUrl}/`)

    for (const route of routes) {
      let res = await fetch(`${baseUrl}${basePath}${route}`)
      if (!res.ok) {
        res = await fetch(`${baseUrl}${route}`)
      }
      const rawHtml = await res.text()
      const html = fixAssetBasePaths(rawHtml)

      if (route === '/') {
        writeFileSync(path.join(publicOutDir, 'index.html'), html)
        writeFileSync(path.join(publicOutDir, '404.html'), html)
        console.log('[Static Export] Gerado: index.html e 404.html')
      } else {
        const destDir = path.join(publicOutDir, route.replace(/^\//, ''))
        mkdirSync(destDir, { recursive: true })
        writeFileSync(path.join(destDir, 'index.html'), html)
        console.log(`[Static Export] Gerado: ${route.slice(1)}/index.html`)
      }
    }

    writeFileSync(path.join(publicOutDir, '.nojekyll'), '')
    console.log('[Static Export] Exportação estática para GitHub Pages concluída em .output/public!')
  } finally {
    serverProc.kill('SIGTERM')
  }
}

main()
