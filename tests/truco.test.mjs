import test from 'node:test'
import assert from 'node:assert/strict'

// Ordem de valores do Truco Goiano: 5 < 6 < 7 < 8 < 9 < 10 < Q < J < K < A < 2 < 3
const TRUCO_CARD_VALUES = ['5', '6', '7', '8', '9', '10', 'Q', 'J', 'K', 'A', '2', '3']
const SUIT_ORDER = ['diamonds', 'spades', 'hearts', 'clubs']

function createTrucoDeck() {
  const deck = []
  const suits = ['spades', 'hearts', 'diamonds', 'clubs']
  TRUCO_CARD_VALUES.forEach((val) => {
    suits.forEach((suit) => {
      // Truco Goiano: Não usa 7 de copas nem 7 de ouros
      if (val === '7' && (suit === 'hearts' || suit === 'diamonds')) return
      deck.push({ id: `${val}_${suit}`, value: val, suit })
    })
  })
  return deck
}

function getManilhaValue(viraVal) {
  const idx = TRUCO_CARD_VALUES.indexOf(String(viraVal).toUpperCase())
  if (idx < 0) return '5'
  return TRUCO_CARD_VALUES[(idx + 1) % TRUCO_CARD_VALUES.length]
}

function getCardPower(card, manilhaVal) {
  if (!card || card.covered) return 0
  const isManilha = card.value === manilhaVal
  if (isManilha) {
    const suitPower = SUIT_ORDER.indexOf(card.suit)
    return 100 + suitPower
  }
  return TRUCO_CARD_VALUES.indexOf(card.value) + 1
}

function evaluateHandWinner(tricks) {
  const [t1, t2, t3] = tricks
  if (!t1) return null

  const usWins = tricks.filter((t) => t === 'us').length
  const themWins = tricks.filter((t) => t === 'them').length
  if (usWins >= 2) return 'us'
  if (themWins >= 2) return 'them'

  if (t1 === 'tied' && t2) {
    if (t2 !== 'tied') return t2
    if (t3 && t3 !== 'tied') return t3
    if (t3 === 'tied') return 'tied_hand'
  }

  if (t2 === 'tied') return t1
  if (t3 === 'tied') return t1
  if (t3 && t3 !== 'tied') return t3

  return null
}

function getFoldPoints(pendingLevel) {
  if (pendingLevel === 3) return 1
  if (pendingLevel === 6) return 3
  if (pendingLevel === 9) return 6
  if (pendingLevel === 12) return 9
  return 1
}

test('Baralho do Truco Goiano: 46 cartas, sem 7 de copas nem 7 de ouros', () => {
  const deck = createTrucoDeck()
  assert.equal(deck.length, 46)

  // Verifica que NÃO existe 7 de copas nem 7 de ouros
  assert.equal(deck.some((c) => c.value === '7' && c.suit === 'hearts'), false)
  assert.equal(deck.some((c) => c.value === '7' && c.suit === 'diamonds'), false)

  // Verifica que existem 7 de espadas e 7 de paus
  assert.equal(deck.some((c) => c.value === '7' && c.suit === 'spades'), true)
  assert.equal(deck.some((c) => c.value === '7' && c.suit === 'clubs'), true)

  // Verifica presença de 8, 9, 10
  assert.equal(deck.filter((c) => c.value === '8').length, 4)
  assert.equal(deck.filter((c) => c.value === '9').length, 4)
  assert.equal(deck.filter((c) => c.value === '10').length, 4)
})

test('Ordem de força das cartas normais no Truco Goiano: 5 < 6 < 7 < 8 < 9 < 10 < Q < J < K < A < 2 < 3', () => {
  const manilha = '4' // Nenhuma manilha em jogo
  const c5 = { value: '5', suit: 'spades' }
  const c6 = { value: '6', suit: 'spades' }
  const c7 = { value: '7', suit: 'spades' }
  const c8 = { value: '8', suit: 'spades' }
  const c9 = { value: '9', suit: 'spades' }
  const c10 = { value: '10', suit: 'spades' }
  const cQ = { value: 'Q', suit: 'spades' }
  const cJ = { value: 'J', suit: 'spades' }
  const cK = { value: 'K', suit: 'spades' }
  const cA = { value: 'A', suit: 'spades' }
  const c2 = { value: '2', suit: 'spades' }
  const c3 = { value: '3', suit: 'spades' }

  assert.ok(getCardPower(c5, manilha) < getCardPower(c6, manilha))
  assert.ok(getCardPower(c6, manilha) < getCardPower(c7, manilha))
  assert.ok(getCardPower(c7, manilha) < getCardPower(c8, manilha))
  assert.ok(getCardPower(c8, manilha) < getCardPower(c9, manilha))
  assert.ok(getCardPower(c9, manilha) < getCardPower(c10, manilha))
  assert.ok(getCardPower(c10, manilha) < getCardPower(cQ, manilha))
  assert.ok(getCardPower(cQ, manilha) < getCardPower(cJ, manilha))
  assert.ok(getCardPower(cJ, manilha) < getCardPower(cK, manilha))
  assert.ok(getCardPower(cK, manilha) < getCardPower(cA, manilha))
  assert.ok(getCardPower(cA, manilha) < getCardPower(c2, manilha))
  assert.ok(getCardPower(c2, manilha) < getCardPower(c3, manilha))
})

test('Manilha dinâmica do Truco Goiano: vira define a manilha superior na sequência correta', () => {
  assert.equal(getManilhaValue('5'), '6')
  assert.equal(getManilhaValue('6'), '7')
  assert.equal(getManilhaValue('7'), '8')
  assert.equal(getManilhaValue('8'), '9')
  assert.equal(getManilhaValue('9'), '10')
  assert.equal(getManilhaValue('10'), 'Q')
  assert.equal(getManilhaValue('Q'), 'J')
  assert.equal(getManilhaValue('J'), 'K')
  assert.equal(getManilhaValue('K'), 'A')
  assert.equal(getManilhaValue('A'), '2')
  assert.equal(getManilhaValue('2'), '3')
  assert.equal(getManilhaValue('3'), '5')
})

test('Hierarquia das Manilhas: Zap (Paus) > Copeta (Copas) > Espadilha (Espadas) > Pica-fumo (Ouros)', () => {
  const manilha = '8'
  const zap = { value: '8', suit: 'clubs' }
  const copeta = { value: '8', suit: 'hearts' }
  const espadilha = { value: '8', suit: 'spades' }
  const picaFumo = { value: '8', suit: 'diamonds' }
  const tres = { value: '3', suit: 'hearts' }

  assert.ok(getCardPower(zap, manilha) > getCardPower(copeta, manilha))
  assert.ok(getCardPower(copeta, manilha) > getCardPower(espadilha, manilha))
  assert.ok(getCardPower(espadilha, manilha) > getCardPower(picaFumo, manilha))
  assert.ok(getCardPower(picaFumo, manilha) > getCardPower(tres, manilha))
})

test('Carta Coberta / Cega: tem força 0 e perde qualquer disputa', () => {
  const manilha = '8'
  const coberta = { value: '3', suit: 'clubs', covered: true }
  const cincoNormal = { value: '5', suit: 'diamonds', covered: false }

  assert.equal(getCardPower(coberta, manilha), 0)
  assert.ok(getCardPower(cincoNormal, manilha) > getCardPower(coberta, manilha))
})

test('Regra de Melhor de 3 com empates (canga)', () => {
  // Caso 1: 2 vitórias diretas
  assert.equal(evaluateHandWinner(['us', 'us']), 'us')
  assert.equal(evaluateHandWinner(['them', 'them']), 'them')

  // Caso 2: Empate na 1ª vaza -> Quem ganha a 2ª leva
  assert.equal(evaluateHandWinner(['tied', 'us']), 'us')
  assert.equal(evaluateHandWinner(['tied', 'them']), 'them')

  // Caso 3: Empate na 2ª vaza -> Quem fez a 1ª leva
  assert.equal(evaluateHandWinner(['us', 'tied']), 'us')
  assert.equal(evaluateHandWinner(['them', 'tied']), 'them')

  // Caso 4: 1x1 decidindo na 3ª
  assert.equal(evaluateHandWinner(['us', 'them', 'us']), 'us')
  assert.equal(evaluateHandWinner(['them', 'us', 'them']), 'them')
})

test('Pontos ao Correr do Truco: correr do Truco dá apenas 1 tento (e não 2)', () => {
  // Correr de Truco (3) -> 1 tento
  assert.equal(getFoldPoints(3), 1)

  // Correr de Seis (6) -> 3 tentos
  assert.equal(getFoldPoints(6), 3)

  // Correr de Nove (9) -> 6 tentos
  assert.equal(getFoldPoints(9), 6)

  // Correr de Doze (12) -> 9 tentos
  assert.equal(getFoldPoints(12), 9)
})
