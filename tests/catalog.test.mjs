import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCatalog } from '../src/lib/catalog-schema.mjs'

const game = {
  id: 'teste', title: 'Teste', description: 'Um jogo de teste.', developer: 'Equipe',
  genres: ['Aventura'], modes: ['singleplayer', 'multiplayer'], status: 'published',
  featured: true, engine: 'html5', assets: { cover: '/games/teste/capa.png', banner: '/games/teste/banner.png' },
  entry: '/games/teste/index.html',
}
const manifest = (games) => ({ version: 1, games })

test('accepts an empty catalogue and a complete game', () => {
  assert.deepEqual(parseCatalog(manifest([])).games, [])
  assert.equal(parseCatalog(manifest([game])).games[0].entry, game.entry)
})
test('rejects duplicate ids and invalid metadata', () => {
  assert.throws(() => parseCatalog(manifest([game, game])), /duplicado/)
  assert.throws(() => parseCatalog(manifest([{ ...game, modes: ['online'] }])), /valores permitidos/)
  assert.throws(() => parseCatalog(manifest([{ ...game, genres: ['Favoritos'] }])), /reservados/)
  assert.throws(() => parseCatalog(manifest([{ ...game, statuz: 'draft' }])), /desconhecido/)
})
test('rejects paths outside the game folder and non-HTML entry points', () => {
  for (const entry of ['https://example.com/index.html', '/games/outro/index.html', '/games/teste/../outro/index.html', '/games/teste/%2e%2e/index.html', '/games/teste/index.html?x=1', '/games/teste/game.exe']) {
    assert.throws(() => parseCatalog(manifest([{ ...game, entry }])), entry)
  }
})
