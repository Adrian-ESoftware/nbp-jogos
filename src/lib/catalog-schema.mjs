const engines = ['html5', 'unity', 'godot', 'other']
const statuses = ['draft', 'published']
const modes = ['singleplayer', 'multiplayer']

function record(value, location) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${location}: esperado um objeto.`)
  return value
}
function keys(value, required, optional, location) {
  for (const key of required) if (!(key in value)) throw new Error(`${location}: campo obrigatório '${key}' ausente.`)
  for (const key of Object.keys(value)) if (!required.includes(key) && !optional.includes(key)) throw new Error(`${location}: campo desconhecido '${key}'.`)
}
function string(value, location, max = 160) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > max) throw new Error(`${location}: texto obrigatório com até ${max} caracteres, sem espaços nas extremidades.`)
  return value
}
function list(value, location, allowed) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${location}: informe ao menos um item.`)
  const result = value.map((item, index) => string(item, `${location}[${index}]`, 40))
  if (new Set(result.map((item) => item.toLocaleLowerCase('pt-BR'))).size !== result.length) throw new Error(`${location}: itens duplicados.`)
  if (allowed && result.some((item) => !allowed.includes(item))) throw new Error(`${location}: valores permitidos: ${allowed.join(', ')}.`)
  return result
}
function asset(value, id, location) {
  const path = string(value, location, 300)
  const prefix = `/games/${id}/`
  if (!path.startsWith(prefix) || !path.slice(prefix.length).split('/').every((segment) => segment !== '.' && segment !== '..' && /^[\p{L}\p{N}_. -]+$/u.test(segment))) {
    throw new Error(`${location}: use um caminho local dentro de ${prefix}, sem '..', parâmetros ou fragmentos.`)
  }
  return path
}

/** Validate the catalogue both in the app and in the build check. */
export function parseCatalog(input) {
  const data = record(input, 'Catálogo')
  keys(data, ['version', 'games'], [], 'Catálogo')
  if (data.version !== 1 || !Array.isArray(data.games)) throw new Error('Catálogo: versão ou lista de jogos inválida.')
  const ids = new Set()
  const games = data.games.map((raw, index) => {
    const at = `games[${index}]`
    const item = record(raw, at)
    keys(item, ['id', 'title', 'description', 'developer', 'genres', 'modes', 'status', 'featured', 'engine', 'assets', 'entry'], [], at)
    const id = string(item.id, `${at}.id`, 64)
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`${at}.id: use letras minúsculas, números e hífens.`)
    if (ids.has(id)) throw new Error(`${at}.id: '${id}' está duplicado.`)
    ids.add(id)
    const title = string(item.title, `${at}.title`, 100)
    const description = string(item.description, `${at}.description`, 500)
    const developer = string(item.developer, `${at}.developer`, 100)
    const genres = list(item.genres, `${at}.genres`)
    if (genres.some((genre) => ['todos', 'favoritos'].includes(genre.toLocaleLowerCase('pt-BR')))) throw new Error(`${at}.genres: 'Todos' e 'Favoritos' são reservados.`)
    const gameModes = list(item.modes, `${at}.modes`, modes)
    if (!statuses.includes(item.status)) throw new Error(`${at}.status: use draft ou published.`)
    if (typeof item.featured !== 'boolean') throw new Error(`${at}.featured: esperado true ou false.`)
    if (!engines.includes(item.engine)) throw new Error(`${at}.engine: use ${engines.join(', ')}.`)
    const assets = record(item.assets, `${at}.assets`)
    keys(assets, ['cover', 'banner'], ['icon'], `${at}.assets`)
    const cover = asset(assets.cover, id, `${at}.assets.cover`)
    const banner = asset(assets.banner, id, `${at}.assets.banner`)
    const icon = assets.icon === undefined ? undefined : asset(assets.icon, id, `${at}.assets.icon`)
    const entry = asset(item.entry, id, `${at}.entry`)
    if (!entry.toLowerCase().endsWith('.html')) throw new Error(`${at}.entry: informe um arquivo HTML exportado para web.`)
    return { id, title, description, developer, genres, modes: gameModes, status: item.status, featured: item.featured, engine: item.engine, assets: { cover, banner, ...(icon ? { icon } : {}) }, entry }
  })
  return { version: 1, games }
}
