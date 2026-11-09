import manifest from '../data/games.json'
import { parseCatalog } from './catalog-schema.mjs'

export type { Game, GameMode } from './catalog-schema.mjs'

const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
export const withBase = (path: string) =>
  base && path.startsWith('/') && !path.startsWith(`${base}/`) ? `${base}${path}` : path

export const games = parseCatalog(manifest)
  .games.filter((game) => game.status === 'published')
  .map((game) => ({
    ...game,
    entry: withBase(game.entry),
    assets: {
      cover: withBase(game.assets.cover),
      banner: withBase(game.assets.banner),
      ...(game.assets.icon ? { icon: withBase(game.assets.icon) } : {}),
    },
  }))

export const featuredGames = games.filter((game) => game.featured).slice(0, 6)
export const genres = [...new Set(games.flatMap((game) => game.genres))].sort((a, b) =>
  a.localeCompare(b, 'pt-BR')
)
export const getGame = (id: string) => games.find((game) => game.id === id)
