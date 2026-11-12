import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = path.join(rootDir, 'public')

function loadPokemon() {
  const file = path.join(publicDir, 'games', 'pokemon-nbp', 'data', 'pokemon.json')
  return JSON.parse(readFileSync(file, 'utf8'))
}

test('Banco de Pokémon: exatamente todos os 1.025 Pokémon (Gerações 1 a 9) com SVGs locais', () => {
  const pokemons = loadPokemon()
  assert.equal(pokemons.length, 1025, 'Deve conter exatamente 1025 Pokémon')

  for (let i = 0; i < pokemons.length; i++) {
    const p = pokemons[i]
    assert.equal(p.id, i + 1, `ID do Pokémon ${p.name} deve ser ${i + 1}`)
    assert.ok(p.name && p.name.length > 0, `Nome inválido para Pokémon #${p.id}`)
    assert.ok(p.dex && p.dex.length >= 3, `Dex number deve ter >= 3 dígitos (#${p.id})`)
    assert.ok(Array.isArray(p.types) && p.types.length >= 1, `Tipos ausentes para ${p.name}`)
    assert.ok(p.gen >= 1 && p.gen <= 9, `Geração inválida para ${p.name}: ${p.gen}`)
    assert.ok(p.region && p.region.length > 0, `Região ausente para ${p.name}`)

    // Verifica que o SVG local existe
    const svgPath = path.join(publicDir, p.svg.replace(/^\//, ''))
    assert.ok(existsSync(svgPath), `Arquivo SVG ausente no disco: ${svgPath}`)
  }
})

test('Validação de Pokémon icônicos de todas as 9 Gerações', () => {
  const pokemons = loadPokemon()

  // Gen 1: Pikachu (#25)
  const pika = pokemons.find((p) => p.id === 25)
  assert.ok(pika && pika.name === 'Pikachu' && pika.gen === 1 && pika.region === 'Kanto')
  assert.ok(pika.types.includes('Elétrico'))

  // Gen 2: Ho-Oh (#250)
  const hooh = pokemons.find((p) => p.id === 250)
  assert.ok(hooh && hooh.name === 'Ho-Oh' && hooh.gen === 2 && hooh.region === 'Johto')

  // Gen 3: Rayquaza (#384)
  const ray = pokemons.find((p) => p.id === 384)
  assert.ok(ray && ray.name === 'Rayquaza' && ray.gen === 3 && ray.region === 'Hoenn')

  // Gen 4: Lucario (#448) & Arceus (#493)
  const lucario = pokemons.find((p) => p.id === 448)
  assert.ok(lucario && lucario.name === 'Lucario' && lucario.gen === 4 && lucario.region === 'Sinnoh')
  const arceus = pokemons.find((p) => p.id === 493)
  assert.ok(arceus && arceus.name === 'Arceus' && arceus.gen === 4)

  // Gen 5: Zoroark (#571)
  const zoro = pokemons.find((p) => p.id === 571)
  assert.ok(zoro && zoro.gen === 5 && zoro.region === 'Unova')

  // Gen 6: Greninja (#658)
  const greninja = pokemons.find((p) => p.id === 658)
  assert.ok(greninja && greninja.name === 'Greninja' && greninja.gen === 6 && greninja.region === 'Kalos')

  // Gen 7: Mimikyu (#778)
  const mimikyu = pokemons.find((p) => p.id === 778)
  assert.ok(mimikyu && mimikyu.gen === 7 && mimikyu.region === 'Alola')

  // Gen 8: Zacian (#888)
  const zacian = pokemons.find((p) => p.id === 888)
  assert.ok(zacian && zacian.gen === 8 && zacian.region === 'Galar')

  // Gen 9: Pecharunt (#1025)
  const pecharunt = pokemons.find((p) => p.id === 1025)
  assert.ok(pecharunt && pecharunt.name === 'Pecharunt' && pecharunt.gen === 9 && pecharunt.region === 'Paldea')
})

test('Assets do Jogo: entrypoint HTML, CSS, cover, banner e icon existem', () => {
  const gameDir = path.join(publicDir, 'games', 'pokemon-nbp')
  assert.ok(existsSync(path.join(gameDir, 'index.html')), 'index.html ausente')
  assert.ok(existsSync(path.join(gameDir, 'style.css')), 'style.css ausente')
  assert.ok(existsSync(path.join(gameDir, 'game.js')), 'game.js ausente')
  assert.ok(existsSync(path.join(gameDir, 'cover.svg')), 'cover.svg ausente')
  assert.ok(existsSync(path.join(gameDir, 'banner.svg')), 'banner.svg ausente')
  assert.ok(existsSync(path.join(gameDir, 'icon.svg')), 'icon.svg ausente')
})
