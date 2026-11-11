import test from 'node:test'
import assert from 'node:assert/strict'

const TRUCO_CARD_VALUES = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3']
const SUIT_ORDER = ['diamonds', 'spades', 'hearts', 'clubs']

function getManilhaValue(viraVal) {
  const idx = TRUCO_CARD_VALUES.indexOf(String(viraVal).toUpperCase())
  if (idx < 0) return '4'
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

test('Manilha dinâmica do Truco Goiano: vira define a manilha superior', () => {
  assert.equal(getManilhaValue('7'), 'Q')
  assert.equal(getManilhaValue('Q'), 'J')
  assert.equal(getManilhaValue('J'), 'K')
  assert.equal(getManilhaValue('K'), 'A')
  assert.equal(getManilhaValue('A'), '2')
  assert.equal(getManilhaValue('2'), '3')
  assert.equal(getManilhaValue('3'), '4')
  assert.equal(getManilhaValue('4'), '5')
})

test('Hierarquia das Manilhas: Zap (Paus) > Copeta (Copas) > Espadilha (Espadas) > Pica-fumo (Ouros)', () => {
  const manilha = 'Q'
  const zap = { value: 'Q', suit: 'clubs' }
  const copeta = { value: 'Q', suit: 'hearts' }
  const espadilha = { value: 'Q', suit: 'spades' }
  const picaFumo = { value: 'Q', suit: 'diamonds' }
  const tres = { value: '3', suit: 'hearts' }

  assert.ok(getCardPower(zap, manilha) > getCardPower(copeta, manilha))
  assert.ok(getCardPower(copeta, manilha) > getCardPower(espadilha, manilha))
  assert.ok(getCardPower(espadilha, manilha) > getCardPower(picaFumo, manilha))
  assert.ok(getCardPower(picaFumo, manilha) > getCardPower(tres, manilha))
})

test('Carta Coberta / Cega: tem força 0 e perde qualquer disputa', () => {
  const manilha = '7'
  const coberta = { value: '3', suit: 'clubs', covered: true }
  const quatroNormal = { value: '4', suit: 'diamonds', covered: false }

  assert.equal(getCardPower(coberta, manilha), 0)
  assert.ok(getCardPower(quatroNormal, manilha) > getCardPower(coberta, manilha))
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
