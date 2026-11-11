export interface TriviaCard {
  id: number
  category: string
  question: string
  answer: number
  unit: string
  ducks: number
  fact: string
}

export type DuckAvatar = '🦆' | '🕶️' | '🕵️' | '🎩' | '🤿' | '👑' | '🤖' | '🤠'

export type BotPersonality = 'cautious' | 'bluffer' | 'detective' | 'sheriff'

export interface Player {
  id: string
  name: string
  avatar: DuckAvatar
  isBot: boolean
  isHost: boolean
  ducksCount: number
  cardsCount: number
  personality?: BotPersonality
}

export interface Bid {
  id: string
  playerId: string
  playerName: string
  playerAvatar: DuckAvatar
  value: number
  isDouble: boolean
  delta: number
  timestamp: number
}

export interface RevealInfo {
  bidder: Player
  challenger: Player
  bidValue: number
  realAnswer: number
  exceeded: boolean
  penaltyPlayer: Player
  penaltyDucks: number
  card: TriviaCard
}

export interface HistoryItem {
  id: string
  type: 'bid' | 'double' | 'challenge' | 'penalty' | 'info'
  text: string
  timestamp: number
}
