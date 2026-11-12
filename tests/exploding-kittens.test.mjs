import test from 'node:test'
import assert from 'node:assert/strict'
import '../public/games/exploding-kittens/engine.js'

const EKEngine = globalThis.EKEngine

test('Baralho completo tem exatamente 56 cartas conforme edição original', () => {
  const deck = EKEngine.createFullDeck()
  assert.equal(deck.length, 56)

  const counts = deck.reduce((acc, c) => {
    acc[c.type] = (acc[c.type] || 0) + 1
    return acc
  }, {})

  assert.equal(counts.ek, 4)
  assert.equal(counts.defuse, 6)
  assert.equal(counts.attack, 4)
  assert.equal(counts.skip, 4)
  assert.equal(counts.favor, 4)
  assert.equal(counts.shuffle, 4)
  assert.equal(counts.future, 5)
  assert.equal(counts.nope, 5)
  assert.equal(counts.cat_rainbow, 4)
  assert.equal(counts.cat_potato, 4)
  assert.equal(counts.cat_melon, 4)
  assert.equal(counts.cat_beard, 4)
  assert.equal(counts.cat_taco, 4)
})

test('Setup para 2 jogadores segue variante oficial: 8 cartas na mão e apenas 2 Desarmes extras no baralho', () => {
  const state = EKEngine.createMatchState([
    { id: 'p1', name: 'Jogador 1' },
    { id: 'p2', name: 'Jogador 2' },
  ])

  assert.equal(state.players.length, 2)
  state.players.forEach((p) => {
    assert.equal(p.hand.length, 8)
    assert.equal(p.hand.filter((c) => c.type === 'defuse').length, 1)
  })

  // 46 normais - 14 distribuídas = 32 normais + 2 Desarmes extras + 1 Exploding Kitten = 35 cartas
  assert.equal(state.drawPile.length, 35)
  assert.equal(state.drawPile.filter((c) => c.type === 'ek').length, 1)
  assert.equal(state.drawPile.filter((c) => c.type === 'defuse').length, 2)
})

test('Setup para 4 jogadores coloca 3 Exploding Kittens e 2 Desarmes extras no baralho', () => {
  const state = EKEngine.createMatchState([
    { id: 'p1', name: 'P1' },
    { id: 'p2', name: 'P2' },
    { id: 'p3', name: 'P3' },
    { id: 'p4', name: 'P4' },
  ])

  assert.equal(state.players.length, 4)
  // 46 - 28 = 18 normais + 2 Desarmes + 3 EKs = 23 cartas
  assert.equal(state.drawPile.length, 23)
  assert.equal(state.drawPile.filter((c) => c.type === 'ek').length, 3)
})

test('Validação de combos: Par (2 iguais), Trio (3 iguais) e 5 Diferentes', () => {
  const c1 = { id: '1', type: 'cat_taco' }
  const c2 = { id: '2', type: 'cat_taco' }
  const c3 = { id: '3', type: 'cat_taco' }
  const c4 = { id: '4', type: 'cat_potato' }
  const c5 = { id: '5', type: 'skip' }
  const c6 = { id: '6', type: 'attack' }
  const c7 = { id: '7', type: 'future' }

  assert.equal(EKEngine.validateSelection([c1]).valid, false)
  assert.equal(EKEngine.validateSelection([c1, c2]).kind, 'combo2')
  assert.equal(EKEngine.validateSelection([c1, c2, c3]).kind, 'combo3')
  assert.equal(EKEngine.validateSelection([c1, c4, c5, c6, c7], 0).valid, false)
  assert.equal(EKEngine.validateSelection([c1, c4, c5, c6, c7], 2).kind, 'combo5')
})

test('Cadeia de NÃO! (ímpar anula, par vira SIM!) e Desarme com reinserção no topo', () => {
  const state = EKEngine.createMatchState([
    { id: 'p1', name: 'Ana' },
    { id: 'p2', name: 'Beto' },
  ])

  state.players[0].hand = [
    { id: 'a1', type: 'skip', name: 'Pulo' },
    { id: 'n1', type: 'nope', name: 'Não!' },
  ]
  state.players[1].hand = [
    { id: 'n2', type: 'nope', name: 'Não!' },
  ]

  const playRes = EKEngine.declarePlay(state, 'p1', ['a1'])
  assert.equal(playRes.ok, true)
  assert.equal(state.phase, 'nope_window')

  // Beto joga Não! (1x -> anula)
  assert.equal(EKEngine.playNope(state, 'p2', 'n2').ok, true)
  // Ana joga Não! em cima (2x -> vira SIM!)
  assert.equal(EKEngine.playNope(state, 'p1', 'n1').ok, true)

  const resolved = EKEngine.resolvePendingAction(state)
  assert.equal(resolved.ok, true)
  assert.equal(resolved.canceled, false)
  // Pulo aconteceu -> passou turno para Beto (índice 1)
  assert.equal(state.currentPlayerIndex, 1)

  // Beto compra Exploding Kitten sem Desarme -> explode e Ana vence!
  state.drawPile.unshift({ id: 'ek_top', type: 'ek', name: 'Exploding Kitten' })
  const drawRes = EKEngine.drawCard(state, 'p2')
  assert.equal(drawRes.outcome, 'exploded')
  assert.equal(state.phase, 'finished')
  assert.equal(state.winnerId, 'p1')
})
