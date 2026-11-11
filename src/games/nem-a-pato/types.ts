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

export interface GameStateSync {
  roomCode: string
  phase: 'lobby' | 'playing' | 'revealing' | 'gameover'
  round: number
  totalRounds: number
  turnDuration: number
  penaltyMode: 'ducks' | 'cards'
  players: Player[]
  activeCard: TriviaCard
  bids: Bid[]
  currentTurnIndex: number
  timeLeft: number
  revealInfo: RevealInfo | null
  history: HistoryItem[]
}

export type P2PGameAction =
  | { type: 'JOIN_REQUEST'; profile: { id: string; name: string; avatar?: DuckAvatar } }
  | { type: 'HEARTBEAT'; profile: { id: string; name: string; avatar?: DuckAvatar } }
  | { type: 'PEER_CONNECTED'; profile?: { id: string; name: string; avatar?: DuckAvatar } }
  | { type: 'PLAYER_LEFT'; playerId: string }
  | { type: 'UPDATE_PROFILE'; profile: { id: string; name: string; avatar: DuckAvatar } }
  | { type: 'BID'; value: number; isDouble: boolean; playerId?: string; playerName?: string }
  | { type: 'CHALLENGE'; playerId?: string; playerName?: string }
  | { type: 'TOAST'; message: string }
