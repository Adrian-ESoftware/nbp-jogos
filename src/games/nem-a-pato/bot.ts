import type { Player, TriviaCard, Bid } from './types'

export interface BotDecision {
  action: 'bid' | 'challenge'
  value?: number
  isDouble?: boolean
  reasoning?: string
}

export const BOT_NAMES = [
  { name: 'Pato Donald', avatar: '🦆', personality: 'cautious' as const },
  { name: 'Pato Blefador', avatar: '🕶️', personality: 'bluffer' as const },
  { name: 'Sherlock Patos', avatar: '🕵️', personality: 'detective' as const },
  { name: 'Xerife Quack', avatar: '🤠', personality: 'sheriff' as const },
  { name: 'Pato Majestoso', avatar: '👑', personality: 'bluffer' as const },
  { name: 'Cyborg Duck', avatar: '🤖', personality: 'detective' as const },
]

export function decideBotTurn(
  bot: Player,
  card: TriviaCard,
  bids: Bid[]
): BotDecision {
  const currentBid = bids.length > 0 ? bids[bids.length - 1].value : 0
  const realAnswer = card.answer
  const personality = bot.personality || 'detective'

  // Estimate bot's perception of real answer with imperfect noise
  // Bots have an approximate perception of the truth with some error variance
  let perceptionVariance = 0.25 // +/- 25%
  if (personality === 'detective') perceptionVariance = 0.15
  if (personality === 'bluffer') perceptionVariance = 0.40
  if (personality === 'cautious') perceptionVariance = 0.20

  const errorFactor = 1 + (Math.random() * (perceptionVariance * 2) - perceptionVariance)
  const estimatedAnswer = Math.max(1, Math.round(realAnswer * errorFactor))

  // If no bid yet, make opening conservative bid
  if (currentBid === 0) {
    let openingBid = 1
    if (estimatedAnswer > 500) {
      openingBid = Math.max(1, Math.round(estimatedAnswer * 0.15))
    } else if (estimatedAnswer > 50) {
      openingBid = Math.max(1, Math.round(estimatedAnswer * 0.25))
    } else if (estimatedAnswer > 10) {
      openingBid = Math.max(1, Math.round(estimatedAnswer * 0.35))
    } else {
      openingBid = 1
    }
    return { action: 'bid', value: openingBid, isDouble: false }
  }

  // Calculate danger ratio (current bid vs estimated answer)
  const dangerRatio = currentBid / Math.max(1, estimatedAnswer)

  // Decide whether to CHALLENGE ("NEM A PATO!")
  let challengeProbability = 0

  if (currentBid > realAnswer) {
    // Current bid ACTUALLY exceeded the answer
    challengeProbability = 0.55 + Math.min(0.40, (currentBid - realAnswer) / Math.max(1, realAnswer))
  } else if (dangerRatio >= 0.95) {
    challengeProbability = 0.70
  } else if (dangerRatio >= 0.80) {
    challengeProbability = 0.40
  } else if (dangerRatio >= 0.65) {
    challengeProbability = 0.20
  } else {
    challengeProbability = 0.05
  }

  // Personality adjustments
  if (personality === 'cautious') challengeProbability += 0.20
  if (personality === 'bluffer') challengeProbability -= 0.15
  if (personality === 'sheriff' && bids.length > 0 && bids[bids.length - 1].isDouble) {
    challengeProbability += 0.30
  }

  if (Math.random() < challengeProbability && bids.length > 0) {
    return { action: 'challenge', reasoning: 'Acho que você exagerou!' }
  }

  // Otherwise, place a higher bid
  const doubleValue = currentBid * 2
  const canDouble = doubleValue <= estimatedAnswer * 1.15

  // Bluffer bots love to double
  if (personality === 'bluffer' && canDouble && Math.random() < 0.45) {
    return { action: 'bid', value: doubleValue, isDouble: true }
  }

  // Calculate increment
  let increment = 1
  const remainingEstimate = Math.max(1, estimatedAnswer - currentBid)

  if (personality === 'cautious') {
    increment = Math.max(1, Math.min(5, Math.ceil(remainingEstimate * 0.1)))
  } else if (personality === 'detective') {
    increment = Math.max(1, Math.round(remainingEstimate * 0.25))
  } else {
    increment = Math.max(2, Math.round(remainingEstimate * 0.35))
  }

  const nextValue = currentBid + increment
  return { action: 'bid', value: nextValue, isDouble: false }
}
