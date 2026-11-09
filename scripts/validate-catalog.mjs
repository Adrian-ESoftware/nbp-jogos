import { readFile, stat } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { parseCatalog } from '../src/lib/catalog-schema.mjs'

try {
  const manifest = JSON.parse(await readFile(new URL('../src/data/games.json', import.meta.url), 'utf8'))
  const { games } = parseCatalog(manifest)
  const publicDir = resolve('public')
  for (const game of games.filter((item) => item.status === 'published')) {
    for (const path of [game.entry, game.assets.cover, game.assets.banner, game.assets.icon].filter(Boolean)) {
      const file = resolve(publicDir, `.${path}`)
      if (!file.startsWith(`${publicDir}${sep}`) || !(await stat(file).catch(() => null))?.isFile()) throw new Error(`${game.id}: arquivo não encontrado em public${path}`)
    }
  }
  console.log(`Catálogo válido: ${games.length} jogo(s), ${games.filter((game) => game.status === 'published').length} publicado(s).`)
} catch (error) {
  console.error(`Catálogo inválido: ${error.message}`)
  process.exitCode = 1
}
