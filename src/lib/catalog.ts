import manifest from '../data/games.json'
import { parseCatalog } from './catalog-schema.mjs'

export type { Game, GameMode } from './catalog-schema.mjs'
export const games = parseCatalog(manifest).games.filter((game) => game.status === 'published')
export const featuredGames = games.filter((game) => game.featured).slice(0, 6)
export const genres = [...new Set(games.flatMap((game) => game.genres))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
export const getGame = (id: string) => games.find((game) => game.id === id)
