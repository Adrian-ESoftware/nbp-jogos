export type DifficultyLevel = 'facil' | 'medio' | 'dificil' | 'insano'
export type LetterState = 'correct' | 'present' | 'absent'

export interface TermoDataset {
  version: number
  description: string
  stats: {
    totalTargets: number
    facil: number
    medio: number
    dificil: number
    totalValidGuesses: number
  }
  targets: {
    facil: string[]
    medio: string[]
    dificil: string[]
  }
  validGuesses: string[]
  accentMap: Record<string, string>
}

export interface CountryEntry {
  id: string
  cca2: string
  cca3: string
  nome: string
  nomeOficial: string
  nomesAceitos: string[]
  capital: string
  continente: string
  subregiao: string
  populacao: number
  areaKm2: number
  coordenadas: { lat: number; lng: number }
  fronteiras: string[]
  independente: boolean
  membroONU: boolean
  nivel: 1 | 2 | 3 | 4
  dificuldade: DifficultyLevel
  bandeira: {
    svg: string
    emoji: string
    cores: string[]
    parecidas: string[]
  }
}

export interface BrazilStateEntry {
  uf: string
  id: string
  nome: string
  nomesAceitos: string[]
  capital: string
  regiao: string
  nivel: 1 | 2 | 3
  dificuldade: 'facil' | 'medio' | 'dificil'
  populacao: number
  areaKm2: number
  coordenadas: { lat: number; lng: number }
  fronteiras: string[]
  bandeira: {
    svg: string
    cores: string[]
  }
}

/**
 * Normaliza texto em português: minúsculas, sem acentos/til/cedilha e sem espaços extras.
 */
export function normalizePt(text: string): string {
  return text
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Avalia um palpite estilo Termo / Dueto / Quarteto respeitando letras repetidas.
 */
export function evaluateTermoGuess(guess: string, target: string): LetterState[] {
  const g = normalizePt(guess).split('')
  const t = normalizePt(target).split('')
  const len = t.length
  const result: LetterState[] = new Array(len).fill('absent')
  const remainingCounts: Record<string, number> = {}

  // 1ª passagem: letras na posição exata ('correct')
  for (let i = 0; i < len; i++) {
    if (g[i] === t[i]) {
      result[i] = 'correct'
    } else {
      remainingCounts[t[i]] = (remainingCounts[t[i]] || 0) + 1
    }
  }

  // 2ª passagem: letras presentes em outra posição ('present')
  for (let i = 0; i < len; i++) {
    if (result[i] === 'correct') continue
    const letter = g[i]
    if (remainingCounts[letter] && remainingCounts[letter] > 0) {
      result[i] = 'present'
      remainingCounts[letter]--
    }
  }

  return result
}

/**
 * Calcula a distância em quilômetros entre duas coordenadas (Fórmula de Haversine).
 * Usado para jogos estilo Worldle / Geografia.
 */
export function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371 // Raio médio da Terra em km
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c)
}

/**
 * Calcula a direção da bússola (cardeal + seta) do país chutado até o país-alvo.
 */
export function getCompassDirection(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): { bearing: number; cardinal: string; arrow: string } {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const toDeg = (rad: number) => (rad * 180) / Math.PI

  const dLng = toRad(toLng - fromLng)
  const lat1 = toRad(fromLat)
  const lat2 = toRad(toLat)

  const y = Math.sin(dLng) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360

  const directions = [
    { cardinal: 'N', arrow: '⬆️' },
    { cardinal: 'NE', arrow: '↗️' },
    { cardinal: 'L', arrow: '➡️' },
    { cardinal: 'SE', arrow: '↘️' },
    { cardinal: 'S', arrow: '⬇️' },
    { cardinal: 'SO', arrow: '↙️' },
    { cardinal: 'O', arrow: '⬅️' },
    { cardinal: 'NO', arrow: '↖️' },
  ]

  const index = Math.round(bearing / 45) % 8
  return {
    bearing: Math.round(bearing),
    ...directions[index],
  }
}

/**
 * Gerador pseudoaleatório determinístico a partir de uma string seed (ex: data do dia ou código da sala com amigos).
 */
export function createSeededRandom(seedInput: string): () => number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < seedInput.length; i++) {
    h ^= seedInput.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  let state = h >>> 0
  return function nextRandom() {
    state += 0x6d2b79f5
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Sorteia N itens únicos de uma lista usando uma seed determinística (ideal para Termo=1, Dueto=2, Quarteto=4).
 */
export function pickSeededItems<T>(items: readonly T[], count: number, seed: string): T[] {
  if (count <= 0 || items.length === 0) return []
  const rng = createSeededRandom(seed)
  const pool = [...items]
  const picked: T[] = []
  const limit = Math.min(count, pool.length)

  for (let i = 0; i < limit; i++) {
    const idx = Math.floor(rng() * (pool.length - i)) + i
    const temp = pool[i]
    pool[i] = pool[idx]
    pool[idx] = temp
    picked.push(pool[i])
  }

  return picked
}
