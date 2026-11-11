import test from 'node:test'
import assert from 'node:assert/strict'

// Ordem de valores do Truco Goiano: APENAS do 5 ao 10, com Manilhas Fixas nos 10
// Cartas normais: 5 < 6 < 7 (sem 7♥ nem 7♦) < 8 < 9
// Manilhas Fixas: 10♦ < 10♠ < 10♥ < 10♣ (Zap)
const TRUCO_CARD_VALUES = ['5', '6', '7', '8', '9', '10']
const FIXED_MANILHA = '10'
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

function getCardPower(card, manilhaVal = FIXED_MANILHA) {
  if (!card || card.covered) return 0
  const isManilha = card.value === manilhaVal
  if (isManilha) {
    const suitPower = SUIT_ORDER.indexOf(card.suit)
    return 100 + suitPower
  }
  const normalIndex = ['5', '6', '7', '8', '9'].indexOf(card.value)
  return normalIndex >= 0 ? normalIndex + 1 : 0
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

function canTeamShoutTruco(teamScore) {
  // Quem tem 11 pontos NÃO pode trucar
  return teamScore < 11
}

function evaluateTrucoShoutPenalty(teamScore) {
  // Se trucar com 11 pontos, perde imediatamente o jogo (adversário faz 12)
  if (teamScore >= 11) {
    return { illegal: true, winnerPoints: 12 }
  }
  return { illegal: false }
}

test('Baralho do Truco Goiano: 22 cartas no total, contendo APENAS do 5 ao 10, sem 7 de copas nem 7 de ouros', () => {
  const deck = createTrucoDeck()
  assert.equal(deck.length, 22)

  // Verifica que não existem cartas fora do intervalo de 5 a 10 (ex: 4, Q, J, K, A, 2, 3)
  const invalidValues = ['4', 'Q', 'J', 'K', 'A', '2', '3']
  invalidValues.forEach((v) => {
    assert.equal(deck.some((c) => c.value === v), false)
  })

  // Verifica que NÃO existe 7 de copas nem 7 de ouros
  assert.equal(deck.some((c) => c.value === '7' && c.suit === 'hearts'), false)
  assert.equal(deck.some((c) => c.value === '7' && c.suit === 'diamonds'), false)

  // Verifica que existem apenas 7 de espadas e 7 de paus
  assert.equal(deck.some((c) => c.value === '7' && c.suit === 'spades'), true)
  assert.equal(deck.some((c) => c.value === '7' && c.suit === 'clubs'), true)
  assert.equal(deck.filter((c) => c.value === '7').length, 2)

  // Verifica 4 naipes para 5, 6, 8, 9, 10
  ;['5', '6', '8', '9', '10'].forEach((val) => {
    assert.equal(deck.filter((c) => c.value === val).length, 4)
  })
})

test('Manilhas são FIXAS: é sempre os 10, com Zap (Paus) > Copeta (Copas) > Espadilha (Espadas) > Pica-fumo (Ouros)', () => {
  const zap = { value: '10', suit: 'clubs' }
  const copeta = { value: '10', suit: 'hearts' }
  const espadilha = { value: '10', suit: 'spades' }
  const picaFumo = { value: '10', suit: 'diamonds' }
  const nove = { value: '9', suit: 'hearts' }

  assert.ok(getCardPower(zap) > getCardPower(copeta))
  assert.ok(getCardPower(copeta) > getCardPower(espadilha))
  assert.ok(getCardPower(espadilha) > getCardPower(picaFumo))
  assert.ok(getCardPower(picaFumo) > getCardPower(nove))
})

test('Ordem de força das cartas normais no Truco Goiano: 5 < 6 < 7 < 8 < 9', () => {
  const c5 = { value: '5', suit: 'spades' }
  const c6 = { value: '6', suit: 'spades' }
  const c7 = { value: '7', suit: 'spades' }
  const c8 = { value: '8', suit: 'spades' }
  const c9 = { value: '9', suit: 'spades' }

  assert.ok(getCardPower(c5) < getCardPower(c6))
  assert.ok(getCardPower(c6) < getCardPower(c7))
  assert.ok(getCardPower(c7) < getCardPower(c8))
  assert.ok(getCardPower(c8) < getCardPower(c9))
})

test('Regra de Mão de 11: quem tem 11 pontos NÃO pode trucar; se trucar perde o jogo', () => {
  // Equipe com menos de 11 pontos pode trucar
  assert.equal(canTeamShoutTruco(10), true)
  assert.equal(canTeamShoutTruco(0), true)

  // Equipe com 11 pontos NÃO pode trucar
  assert.equal(canTeamShoutTruco(11), false)

  // Se trucar com 11 pontos: falta grave que encerra a partida
  const penalty = evaluateTrucoShoutPenalty(11)
  assert.equal(penalty.illegal, true)
  assert.equal(penalty.winnerPoints, 12)
})

test('Pontos ao Correr do Truco: correr do Truco dá apenas 1 tento (e não 2)', () => {
  assert.equal(getFoldPoints(3), 1)
  assert.equal(getFoldPoints(6), 3)
  assert.equal(getFoldPoints(9), 6)
  assert.equal(getFoldPoints(12), 9)
})

test('Carta Coberta / Cega: tem força 0 e perde qualquer disputa', () => {
  const coberta = { value: '10', suit: 'clubs', covered: true }
  const cincoNormal = { value: '5', suit: 'diamonds', covered: false }

  assert.equal(getCardPower(coberta), 0)
  assert.ok(getCardPower(cincoNormal) > getCardPower(coberta))
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
