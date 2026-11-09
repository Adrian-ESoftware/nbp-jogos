export type GameMode = 'singleplayer' | 'multiplayer'
export type Game = {
  id: string
  title: string
  description: string
  developer: string
  genres: string[]
  modes: GameMode[]
  status: 'draft' | 'published'
  featured: boolean
  engine: 'html5' | 'unity' | 'godot' | 'other'
  assets: { cover: string; banner: string; icon?: string }
  entry: string
}
export function parseCatalog(input: unknown): { version: 1; games: Game[] }
