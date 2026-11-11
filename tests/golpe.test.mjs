import test from 'node:test'
import assert from 'node:assert/strict'

// Módulo de regras puras do Golpe para testes de lógica
class CourtDeck {
  static create() {
    const chars = ['duke', 'assassin', 'captain', 'ambassador', 'contessa']
    const deck = []
    chars.forEach((c) => {
      for (let i = 0; i < 3; i++) {
        deck.push({ id: `${c}_${i + 1}`, character: c })
      }
    })
    return deck
  }
}

class CoupEngine {
  constructor(playerNames) {
    if (playerNames.length < 2 || playerNames.length > 6) {
      throw new Error('Coup requires 2 to 6 players')
    }
    this.deck = CourtDeck.create()
    // embaralhar controlado para testes
    this.treasury = 50
    this.turn = 0
    this.phase = 'playing'
    this.isTwoPlayers = playerNames.length === 2

    this.players = playerNames.map((name, idx) => {
      // 2 cartas por jogador
      const cards = [
        { ...this.deck.pop(), revealed: false },
        { ...this.deck.pop(), revealed: false },
      ]
      // Variante oficial 1v1: Jogador 1 começa com 1 moeda, Jogador 2 com 2 moedas
      const coins = this.isTwoPlayers ? (idx === 0 ? 1 : 2) : 2
      return {
        id: `p${idx + 1}`,
        name,
        coins,
        cards,
        eliminated: false,
      }
    })

    const totalGiven = this.players.reduce((sum, p) => sum + p.coins, 0)
    this.treasury -= totalGiven
  }

  get activePlayer() {
    return this.players[this.turn]
  }

  get alivePlayers() {
    return this.players.filter((p) => !p.eliminated)
  }

  canDeclareAction(actionId) {
    const p = this.activePlayer
    if (p.coins >= 10 && actionId !== 'coup') return false
    if (actionId === 'coup' && p.coins < 7) return false
    if (actionId === 'assassinate' && p.coins < 3) return false
    return true
  }

  loseInfluence(playerId, cardId) {
    const p = this.players.find((x) => x.id === playerId)
    if (!p) return
    const card = p.cards.find((c) => c.id === cardId)
    if (card && !card.revealed) {
      card.revealed = true
    }
    const remaining = p.cards.filter((c) => !c.revealed).length
    if (remaining === 0) {
      p.eliminated = true
      this.treasury += p.coins
      p.coins = 0
    }
    this.checkWinner()
  }

  checkWinner() {
    const alive = this.alivePlayers
    if (alive.length === 1) {
      this.phase = 'finished'
      this.winner = alive[0]
      return this.winner
    }
    return null
  }
}

test('Setup de Baralho: exatamente 15 cartas, 3 de cada um dos 5 personagens', () => {
  const deck = CourtDeck.create()
  assert.equal(deck.length, 15)
  const counts = deck.reduce((acc, c) => {
    acc[c.character] = (acc[c.character] || 0) + 1
    return acc
  }, {})
  assert.equal(counts.duke, 3)
  assert.equal(counts.assassin, 3)
  assert.equal(counts.captain, 3)
  assert.equal(counts.ambassador, 3)
  assert.equal(counts.contessa, 3)
})

test('Variante Oficial 1v1 (2 Jogadores): Jogador 1 inicia com 1 moeda e Jogador 2 com 2 moedas', () => {
  const game = new CoupEngine(['Nobre A', 'Nobre B'])
  assert.equal(game.players.length, 2)
  assert.equal(game.players[0].coins, 1)
  assert.equal(game.players[1].coins, 2)
  assert.equal(game.players[0].cards.length, 2)
  assert.equal(game.players[1].cards.length, 2)
})

test('Partida com 3 a 6 Jogadores: todos iniciam com 2 moedas e 2 cartas', () => {
  const game = new CoupEngine(['Nobre A', 'Nobre B', 'Nobre C', 'Nobre D'])
  assert.equal(game.players.length, 4)
  game.players.forEach((p) => {
    assert.equal(p.coins, 2)
    assert.equal(p.cards.length, 2)
  })
})

test('Regra de Ouro: Com 10 ou mais moedas é OBRIGATÓRIO dar Golpe de Estado', () => {
  const game = new CoupEngine(['Nobre A', 'Nobre B'])
  game.players[0].coins = 10
  assert.equal(game.canDeclareAction('income'), false)
  assert.equal(game.canDeclareAction('foreign_aid'), false)
  assert.equal(game.canDeclareAction('tax'), false)
  assert.equal(game.canDeclareAction('assassinate'), false)
  assert.equal(game.canDeclareAction('steal'), false)
  assert.equal(game.canDeclareAction('coup'), true)
})

test('Eliminação e Condição de Vitória: último com influência viva vence', () => {
  const game = new CoupEngine(['Nobre A', 'Nobre B'])
  const target = game.players[1]
  assert.equal(target.eliminated, false)

  // Perde a 1ª influência
  game.loseInfluence(target.id, target.cards[0].id)
  assert.equal(target.cards[0].revealed, true)
  assert.equal(target.cards[1].revealed, false)
  assert.equal(target.eliminated, false)
  assert.equal(game.phase, 'playing')

  // Perde a 2ª influência (Duplo Homicídio ou execução final)
  game.loseInfluence(target.id, target.cards[1].id)
  assert.equal(target.cards[1].revealed, true)
  assert.equal(target.eliminated, true)
  assert.equal(game.phase, 'finished')
  assert.equal(game.winner.id, game.players[0].id)
})
