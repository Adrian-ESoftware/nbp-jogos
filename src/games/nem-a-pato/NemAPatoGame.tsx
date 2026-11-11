import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Volume2,
  VolumeX,
  Trophy,
  Users,
  Flame,
  ShieldAlert,
  Clock,
  ArrowUp,
  Check,
  Bot,
  Play,
  Plus,
  RefreshCw,
  Copy,
  Info,
  Crown,
  SlidersHorizontal,
  X,
  Bird,
  Glasses,
  Search,
  Siren,
  Medal,
  LogIn,
  Wifi,
  WifiOff,
  UserCheck
} from 'lucide-react'
import type {
  TriviaCard,
  Player,
  Bid,
  RevealInfo,
  HistoryItem,
  DuckAvatar,
  GameStateSync,
  P2PGameAction
} from './types'
import { fetchCardsDatabase, FALLBACK_CARDS } from './cards'
import { decideBotTurn, BOT_NAMES } from './bot'
import { sound } from './sound'
import { loadNBPRoom, generateRoomCode, normalizeRoomCode } from './p2p'

const AVATARS: DuckAvatar[] = ['🦆', '🕶️', '🕵️', '🎩', '🤿', '👑', '🤖', '🤠']

function renderAvatarIcon(avatar: DuckAvatar, className = 'w-5 h-5') {
  switch (avatar) {
    case '🕶️':
      return <Glasses className={className} />
    case '🕵️':
      return <Search className={className} />
    case '👑':
      return <Crown className={className} />
    case '🤖':
      return <Bot className={className} />
    case '🤠':
      return <ShieldAlert className={className} />
    case '🎩':
    case '🤿':
    case '🦆':
    default:
      return <Bird className={className} />
  }
}

export function NemAPatoGame() {
  // Hydration safety flag
  const [isMounted, setIsMounted] = useState(false)

  // Local Player & Role
  const [isHost, setIsHost] = useState(true)
  const [myId, setMyId] = useState('p_local')
  const [myName, setMyName] = useState('Você (Pato Alpha)')
  const [myAvatar, setMyAvatar] = useState<DuckAvatar>('🦆')
  const [joinInputCode, setJoinInputCode] = useState('')
  const [connectionStatus, setConnectionStatus] = useState<{
    connected?: boolean
    connecting?: boolean
    isHost?: boolean
    roomCode?: string
    error?: string
  }>({})

  // Game Configuration & State
  const [phase, setPhase] = useState<'lobby' | 'playing' | 'revealing' | 'gameover'>('lobby')
  const [cards, setCards] = useState<TriviaCard[]>(FALLBACK_CARDS)
  const [round, setRound] = useState(1)
  const [totalRounds, setTotalRounds] = useState(10)
  const [turnDuration, setTurnDuration] = useState(25)
  const [penaltyMode, setPenaltyMode] = useState<'ducks' | 'cards'>('ducks')
  const [soundEnabled, setSoundEnabled] = useState(true)

  // Room & Players
  const [roomCode, setRoomCode] = useState('PATO-0000')
  const [players, setPlayers] = useState<Player[]>([
    { id: 'p_local', name: 'Você (Pato Alpha)', avatar: '🦆', isBot: false, isHost: true, ducksCount: 0, cardsCount: 0 },
    { id: 'b1', name: 'Pato Blefador', avatar: '🕶️', isBot: true, isHost: false, ducksCount: 0, cardsCount: 0, personality: 'bluffer' },
    { id: 'b2', name: 'Sherlock Patos', avatar: '🕵️', isBot: true, isHost: false, ducksCount: 0, cardsCount: 0, personality: 'detective' }
  ])

  // In-Round State
  const [activeCard, setActiveCard] = useState<TriviaCard>(FALLBACK_CARDS[0])
  const [bids, setBids] = useState<Bid[]>([])
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0)
  const [timeLeft, setTimeLeft] = useState(25)
  const [botThinking, setBotThinking] = useState(false)
  const [bidInput, setBidInput] = useState('')
  const [revealInfo, setRevealInfo] = useState<RevealInfo | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  // References for P2P Room and UI
  const bidsContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const roomRef = useRef<any>(null)
  const isHostRef = useRef(isHost)
  isHostRef.current = isHost

  // Keep latest state in ref for safe sync calls
  const stateRef = useRef({
    roomCode,
    phase,
    round,
    totalRounds,
    turnDuration,
    penaltyMode,
    players,
    activeCard,
    bids,
    currentTurnIndex,
    timeLeft,
    revealInfo,
    history
  })
  stateRef.current = {
    roomCode,
    phase,
    round,
    totalRounds,
    turnDuration,
    penaltyMode,
    players,
    activeCard,
    bids,
    currentTurnIndex,
    timeLeft,
    revealInfo,
    history
  }

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    const t = setTimeout(() => setToastMessage(null), 3200)
    return () => clearTimeout(t)
  }, [])

  // Auto-scroll ONLY the internal bids container
  useEffect(() => {
    if (bidsContainerRef.current) {
      bidsContainerRef.current.scrollTop = bidsContainerRef.current.scrollHeight
    }
  }, [bids])

  // Send authoritative state sync from Host to all connected clients
  const syncToClients = useCallback((override?: Partial<GameStateSync>) => {
    if (!roomRef.current || !isHostRef.current) return
    const current = { ...stateRef.current, ...override }
    try {
      roomRef.current.syncState({
        roomCode: current.roomCode,
        phase: current.phase,
        round: current.round,
        totalRounds: current.totalRounds,
        turnDuration: current.turnDuration,
        penaltyMode: current.penaltyMode,
        players: current.players,
        activeCard: current.activeCard,
        bids: current.bids,
        currentTurnIndex: current.currentTurnIndex,
        timeLeft: current.timeLeft,
        revealInfo: current.revealInfo,
        history: current.history
      })
    } catch {}
  }, [])

  // Apply state received from remote Host
  const applyRemoteState = useCallback((remote: GameStateSync) => {
    if (!remote) return
    if (remote.phase !== undefined) setPhase(remote.phase)
    if (remote.round !== undefined) setRound(remote.round)
    if (remote.totalRounds !== undefined) setTotalRounds(remote.totalRounds)
    if (remote.turnDuration !== undefined) setTurnDuration(remote.turnDuration)
    if (remote.penaltyMode !== undefined) setPenaltyMode(remote.penaltyMode)
    if (remote.players) setPlayers(remote.players)
    if (remote.activeCard) setActiveCard(remote.activeCard)
    if (remote.currentTurnIndex !== undefined) setCurrentTurnIndex(remote.currentTurnIndex)
    if (remote.timeLeft !== undefined) setTimeLeft(remote.timeLeft)
    if (remote.revealInfo !== undefined) setRevealInfo(remote.revealInfo)
    if (remote.history) setHistory(remote.history)

    if (remote.bids) {
      setBids((prev) => {
        if (remote.bids.length > prev.length) {
          const lastBid = remote.bids[remote.bids.length - 1]
          if (lastBid?.isDouble) sound.double()
          else sound.bid()
        }
        return remote.bids
      })
    }

    if (remote.phase === 'revealing' && stateRef.current.phase !== 'revealing') {
      sound.nemAPato()
    } else if (remote.phase === 'gameover' && stateRef.current.phase !== 'gameover') {
      sound.fanfare()
    }
  }, [])

  // Execute a Bid (Host authoritative)
  const executeBid = useCallback((playerId: string, value: number, isDouble = false) => {
    const s = stateRef.current
    const player = s.players.find((p) => p.id === playerId)
    if (!player) return

    const currentBidVal = s.bids.length > 0 ? s.bids[s.bids.length - 1].value : 0
    if (value <= currentBidVal && s.bids.length > 0) {
      showToast(`O palpite deve ser maior que ${currentBidVal}!`)
      return
    }

    const delta = s.bids.length > 0 ? value - currentBidVal : value

    if (isDouble) {
      sound.double()
    } else {
      sound.bid()
    }

    const newBid: Bid = {
      id: `${Date.now()}-${Math.random()}`,
      playerId: player.id,
      playerName: player.name,
      playerAvatar: player.avatar,
      value,
      isDouble,
      delta,
      timestamp: Date.now()
    }

    const nextIdx = (s.currentTurnIndex + 1) % s.players.length
    const nextBids = [...s.bids, newBid]
    const actionText = isDouble
      ? `${player.name} DOBROU o palpite para ${value.toLocaleString('pt-BR')} ${s.activeCard.unit}!`
      : `${player.name} chutou ${value.toLocaleString('pt-BR')} ${s.activeCard.unit} (+${delta.toLocaleString('pt-BR')})`

    const nextHistory: HistoryItem[] = [
      { id: `${Date.now()}-${Math.random()}`, type: isDouble ? 'double' : 'bid', text: actionText, timestamp: Date.now() },
      ...s.history.slice(0, 40)
    ]

    setBids(nextBids)
    setBidInput('')
    setCurrentTurnIndex(nextIdx)
    setTimeLeft(s.turnDuration)
    setHistory(nextHistory)

    syncToClients({
      bids: nextBids,
      currentTurnIndex: nextIdx,
      timeLeft: s.turnDuration,
      history: nextHistory
    })
  }, [showToast, syncToClients])

  // Handle "NEM A PATO!" Challenge (Host authoritative)
  const handleChallenge = useCallback((challengerId: string) => {
    const s = stateRef.current
    if (s.bids.length === 0) return

    sound.nemAPato()

    const challenger = s.players.find((p) => p.id === challengerId) || s.players[s.currentTurnIndex]
    const lastBid = s.bids[s.bids.length - 1]
    const bidder = s.players.find((p) => p.id === lastBid.playerId) || s.players[0]
    const realAnswer = s.activeCard.answer
    const bidValue = lastBid.value

    const exceeded = bidValue > realAnswer
    const penaltyPlayer = exceeded ? bidder : challenger
    const penaltyDucks = s.penaltyMode === 'ducks' ? s.activeCard.ducks : 1

    const updatedPlayers = s.players.map((p) => {
      if (p.id === penaltyPlayer.id) {
        return {
          ...p,
          ducksCount: p.ducksCount + penaltyDucks,
          cardsCount: p.cardsCount + 1
        }
      }
      return p
    })

    const newRevealInfo: RevealInfo = {
      bidder,
      challenger,
      bidValue,
      realAnswer,
      exceeded,
      penaltyPlayer,
      penaltyDucks,
      card: s.activeCard
    }

    const challengeLog = exceeded
      ? `NEM A PATO! ${bidder.name} EXAGEROU com ${bidValue.toLocaleString('pt-BR')} (Real: ${realAnswer.toLocaleString('pt-BR')})! Recebe +${penaltyDucks} patos!`
      : `NEM A PATO! ${challenger.name} DUVIDOU ERRADO! O chute ${bidValue.toLocaleString('pt-BR')} não passou de ${realAnswer.toLocaleString('pt-BR')}. Recebe +${penaltyDucks} patos!`

    const updatedHistory: HistoryItem[] = [
      { id: `${Date.now()}-${Math.random()}`, type: 'challenge', text: challengeLog, timestamp: Date.now() },
      ...s.history.slice(0, 40)
    ]

    setPlayers(updatedPlayers)
    setRevealInfo(newRevealInfo)
    setPhase('revealing')
    setHistory(updatedHistory)

    syncToClients({
      players: updatedPlayers,
      revealInfo: newRevealInfo,
      phase: 'revealing',
      history: updatedHistory
    })
  }, [syncToClients])

  // Handle timeout
  const handleTimeout = useCallback(() => {
    const s = stateRef.current
    if (s.phase !== 'playing') return
    const timedOutPlayer = s.players[s.currentTurnIndex] || s.players[0]
    showToast(`O tempo de ${timedOutPlayer.name} esgotou!`)

    if (s.bids.length > 0) {
      handleChallenge(timedOutPlayer.id)
    } else {
      executeBid(timedOutPlayer.id, 1, false)
    }
  }, [handleChallenge, executeBid, showToast])

  // Start a new match (Host)
  const startMatch = useCallback(() => {
    if (!isHostRef.current) return
    sound.quack()
    const s = stateRef.current
    const shuffled = [...cards].sort(() => Math.random() - 0.5)
    const firstCard = shuffled[0] || s.activeCard
    const resetPlayers = s.players.map((p) => ({ ...p, ducksCount: 0, cardsCount: 0 }))
    const startHistory: HistoryItem[] = [
      { id: `${Date.now()}-${Math.random()}`, type: 'info', text: `Partida iniciada com ${resetPlayers.length} patos no lago!`, timestamp: Date.now() }
    ]

    setCards(shuffled)
    setActiveCard(firstCard)
    setRound(1)
    setBids([])
    setHistory(startHistory)
    setPlayers(resetPlayers)
    setCurrentTurnIndex(0)
    setTimeLeft(s.turnDuration)
    setPhase('playing')

    syncToClients({
      activeCard: firstCard,
      round: 1,
      bids: [],
      history: startHistory,
      players: resetPlayers,
      currentTurnIndex: 0,
      timeLeft: s.turnDuration,
      phase: 'playing'
    })
  }, [cards, syncToClients])

  // Advance to Next Round (Host)
  const nextRound = useCallback(() => {
    if (!isHostRef.current) return
    const s = stateRef.current
    if (s.round >= s.totalRounds) {
      sound.fanfare()
      setPhase('gameover')
      syncToClients({ phase: 'gameover' })
      return
    }

    const nextCardIndex = s.round % cards.length
    const nextCard = cards[nextCardIndex] || cards[0]
    const nextRoundNum = s.round + 1
    const nextPlayerIndex = (s.currentTurnIndex + 1) % s.players.length

    const roundHistory: HistoryItem[] = [
      { id: `${Date.now()}-${Math.random()}`, type: 'info', text: `Rodada ${nextRoundNum} de ${s.totalRounds}: ${nextCard.category}`, timestamp: Date.now() },
      ...s.history
    ]

    setActiveCard(nextCard)
    setRound(nextRoundNum)
    setBids([])
    setRevealInfo(null)
    setPhase('playing')
    setTimeLeft(s.turnDuration)
    setCurrentTurnIndex(nextPlayerIndex)
    setHistory(roundHistory)

    syncToClients({
      activeCard: nextCard,
      round: nextRoundNum,
      bids: [],
      revealInfo: null,
      phase: 'playing',
      timeLeft: s.turnDuration,
      currentTurnIndex: nextPlayerIndex,
      history: roundHistory
    })
  }, [cards, syncToClients])

  // Setup / Host a room
  const setupAsHost = useCallback((codeToHost: string, NBPRoomClass: any) => {
    const normalized = normalizeRoomCode(codeToHost)
    setRoomCode(normalized)
    setIsHost(true)
    isHostRef.current = true

    if (roomRef.current) {
      try { roomRef.current.cleanup(true) } catch {}
    }

    const room = new NBPRoomClass({
      gameId: 'nem-a-pato',
      defaultPrefix: 'PATO',
      onStatus(st: any) {
        setConnectionStatus(st)
        if (st.connected) {
          try {
            const url = new URL(window.location.href)
            url.searchParams.set('room', st.roomCode)
            window.history.replaceState({}, '', url.toString())
          } catch {}
        }
      },
      onError(err: any) {
        if (err?.message) showToast(`⚠️ ${err.message}`)
      },
      onAction(action: P2PGameAction, senderProfile: any) {
        if (!action) return
        if (
          action.type === 'JOIN_REQUEST' ||
          action.type === 'HEARTBEAT' ||
          action.type === 'PEER_CONNECTED'
        ) {
          const prof = action.profile || senderProfile
          if (!prof?.id) return
          const currentList = stateRef.current.players
          const exists = currentList.find((p) => p.id === prof.id)
          if (!exists) {
            // Replace placeholder bot on first friend join if in lobby
            let newList = [...currentList]
            if (stateRef.current.phase === 'lobby') {
              const botIdx = newList.findIndex((p) => p.isBot && (p.id === 'b1' || p.id === 'b2'))
              if (botIdx !== -1 && newList.length > 2) {
                newList.splice(botIdx, 1)
              }
            }
            newList.push({
              id: prof.id,
              name: prof.name || 'Pato Convidado',
              avatar: prof.avatar || '🦆',
              isBot: false,
              isHost: false,
              ducksCount: 0,
              cardsCount: 0
            })
            setPlayers(newList)
            const joinMsg = `👋 ${prof.name} entrou no lago!`
            showToast(joinMsg)
            syncToClients({ players: newList })
          } else if (action.type === 'JOIN_REQUEST' && prof.name) {
            exists.name = prof.name
            if (prof.avatar) exists.avatar = prof.avatar
            setPlayers([...currentList])
            syncToClients({ players: [...currentList] })
          }
        } else if (action.type === 'UPDATE_PROFILE' && action.profile) {
          const currentList = stateRef.current.players
          const p = currentList.find((item) => item.id === action.profile.id)
          if (p) {
            p.name = action.profile.name
            p.avatar = action.profile.avatar
            setPlayers([...currentList])
            syncToClients({ players: [...currentList] })
          }
        } else if (action.type === 'BID') {
          const bidderId = action.playerId || senderProfile?.id
          if (bidderId) executeBid(bidderId, action.value, action.isDouble)
        } else if (action.type === 'CHALLENGE') {
          const challengerId = action.playerId || senderProfile?.id
          if (challengerId) handleChallenge(challengerId)
        } else if (action.type === 'PLAYER_LEFT') {
          const leftId = action.playerId || senderProfile?.id
          if (leftId) {
            const remaining = stateRef.current.players.filter((p) => p.id !== leftId)
            setPlayers(remaining)
            syncToClients({ players: remaining })
          }
        }
      }
    })

    roomRef.current = room
    const profile = room.profile || { id: 'p_host', name: 'Você (Pato Alpha)', avatar: '🦆' }
    setMyId(profile.id)
    setMyName(profile.name)
    setMyAvatar(profile.avatar || '🦆')

    // Initial Host player
    setPlayers((prev) => [
      {
        id: profile.id,
        name: profile.name,
        avatar: (profile.avatar as DuckAvatar) || '🦆',
        isBot: false,
        isHost: true,
        ducksCount: 0,
        cardsCount: 0
      },
      ...prev.filter((p) => p.isBot)
    ])

    room.hostRoom(normalized)
  }, [showToast, syncToClients, executeBid, handleChallenge])

  // Connect as Guest to a room
  const joinExistingRoom = useCallback((codeToJoin: string, NBPRoomClass: any) => {
    const normalized = normalizeRoomCode(codeToJoin)
    setRoomCode(normalized)
    setIsHost(false)
    isHostRef.current = false

    if (roomRef.current) {
      try { roomRef.current.cleanup(true) } catch {}
    }

    const room = new NBPRoomClass({
      gameId: 'nem-a-pato',
      defaultPrefix: 'PATO',
      onStatus(st: any) {
        setConnectionStatus(st)
      },
      onError(err: any) {
        if (err?.message) showToast(`⚠️ ${err.message}`)
      },
      onStateSync(remoteState: GameStateSync) {
        applyRemoteState(remoteState)
      },
      onAction(action: any) {
        if (action?.type === 'TOAST' && action.message) {
          showToast(action.message)
        }
      }
    })

    roomRef.current = room
    const profile = room.profile || { id: 'p_guest', name: 'Pato Convidado', avatar: '🦆' }
    setMyId(profile.id)
    setMyName(profile.name)
    setMyAvatar(profile.avatar || '🦆')

    showToast(`Conectando à sala ${normalized}...`)
    room.joinRoom(normalized)
  }, [showToast, applyRemoteState])

  // INITIAL MOUNT & P2P BOOTSTRAP (Runs strictly on client after hydration)
  useEffect(() => {
    setIsMounted(true)

    fetchCardsDatabase().then((db) => {
      if (db && db.length > 0) {
        setCards(db)
        setActiveCard(db[0])
      }
    })

    loadNBPRoom().then((NBPRoomClass) => {
      if (!NBPRoomClass) {
        console.warn('NBPRoom não pôde ser carregado; fallback solo ativo.')
        return
      }

      const params = new URLSearchParams(window.location.search)
      const joinParam = params.get('room') || params.get('sala')

      if (joinParam) {
        joinExistingRoom(joinParam, NBPRoomClass)
      } else {
        setupAsHost(generateRoomCode(), NBPRoomClass)
      }
    })

    return () => {
      if (roomRef.current) {
        try { roomRef.current.cleanup(true) } catch {}
      }
    }
  }, [joinExistingRoom, setupAsHost])

  // Turn Timer Interval (Driven by Host or local tick)
  useEffect(() => {
    if (phase !== 'playing' || turnDuration <= 0) return

    if (timeLeft <= 0) {
      if (isHostRef.current) handleTimeout()
      return
    }

    if (timeLeft <= 5) {
      sound.tick()
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const next = Math.max(0, prev - 1)
        if (isHostRef.current && next % 5 === 0) {
          syncToClients({ timeLeft: next })
        }
        return next
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [phase, timeLeft, turnDuration, handleTimeout, syncToClients])

  // Current active player
  const currentPlayer = players[currentTurnIndex] || players[0] || {
    id: 'unknown',
    name: 'Pato',
    avatar: '🦆',
    isBot: false,
    isHost: false,
    ducksCount: 0,
    cardsCount: 0
  }
  const isMyTurn = currentPlayer.id === myId && phase === 'playing'
  const currentBidValue = bids.length > 0 ? bids[bids.length - 1].value : 0

  // Bot Turn Handler (Host executes bots)
  useEffect(() => {
    if (!isHost || phase !== 'playing' || !currentPlayer.isBot || botThinking) return

    setBotThinking(true)
    const thinkingDelay = Math.floor(1200 + Math.random() * 1500)

    const botTimer = setTimeout(() => {
      const decision = decideBotTurn(currentPlayer, activeCard, bids)
      setBotThinking(false)

      if (decision.action === 'challenge') {
        handleChallenge(currentPlayer.id)
      } else if (decision.value !== undefined) {
        executeBid(currentPlayer.id, decision.value, decision.isDouble || false)
      }
    }, thinkingDelay)

    return () => {
      clearTimeout(botTimer)
      setBotThinking(false)
    }
  }, [isHost, phase, currentTurnIndex, currentPlayer, activeCard, bids, botThinking, handleChallenge, executeBid])

  // Handle Client / Host Bid dispatch
  const dispatchBid = useCallback((val: number, isDouble = false) => {
    if (val <= currentBidValue && bids.length > 0) {
      showToast(`O palpite deve ser maior que ${currentBidValue}!`)
      return
    }

    if (isHost) {
      executeBid(myId, val, isDouble)
    } else {
      roomRef.current?.sendToHost({
        type: 'BID',
        value: val,
        isDouble,
        playerId: myId,
        playerName: myName
      })
      setBidInput('')
      showToast('Palpite enviado!')
    }
  }, [currentBidValue, bids.length, isHost, executeBid, myId, myName, showToast])

  // Handle Client / Host Challenge dispatch
  const dispatchChallenge = useCallback(() => {
    if (bids.length === 0) return

    if (isHost) {
      handleChallenge(myId)
    } else {
      roomRef.current?.sendToHost({
        type: 'CHALLENGE',
        playerId: myId,
        playerName: myName
      })
      showToast('Desafio NEM A PATO enviado!')
    }
  }, [bids.length, isHost, handleChallenge, myId, myName, showToast])

  function handleManualBidSubmit(e: React.FormEvent) {
    e.preventDefault()
    const val = parseInt(bidInput.trim(), 10)
    if (isNaN(val) || val <= 0) {
      showToast('Digite um número inteiro válido!')
      return
    }
    dispatchBid(val, false)
  }

  function handleHelperAdd(inc: number) {
    const nextVal = currentBidValue + inc
    dispatchBid(nextVal, false)
  }

  function handleDouble() {
    if (bids.length === 0) return
    const nextVal = currentBidValue * 2
    dispatchBid(nextVal, true)
  }

  function addBot() {
    if (!isHost) {
      showToast('Apenas o Host pode adicionar bots.')
      return
    }
    if (players.length >= 8) {
      showToast('O lago já está cheio (máximo 8 patos)!')
      return
    }
    const available = BOT_NAMES.filter((b) => !players.some((p) => p.name === b.name))
    const pick = available[Math.floor(Math.random() * available.length)] || {
      name: `Pato #${players.length + 1}`,
      avatar: '🦆' as DuckAvatar,
      personality: 'detective' as const
    }

    const newBot: Player = {
      id: `bot-${Date.now()}`,
      name: pick.name,
      avatar: pick.avatar as DuckAvatar,
      isBot: true,
      isHost: false,
      ducksCount: 0,
      cardsCount: 0,
      personality: pick.personality
    }
    const updated = [...players, newBot]
    setPlayers(updated)
    sound.quack()
    showToast(`${pick.name} entrou no lago!`)
    syncToClients({ players: updated })
  }

  function removePlayer(id: string) {
    if (!isHost) {
      showToast('Apenas o Host pode remover participantes.')
      return
    }
    if (players.length <= 2) {
      showToast('Mínimo de 2 patos no jogo!')
      return
    }
    const updated = players.filter((p) => p.id !== id)
    setPlayers(updated)
    syncToClients({ players: updated })
  }

  function copyInviteLink() {
    if (typeof window === 'undefined') return
    const url = `${window.location.origin}/jogos/nem-a-pato?room=${roomCode}`
    navigator.clipboard?.writeText(url).catch(() => {})
    setCopiedLink(true)
    showToast('Link de convite copiado! Envie aos amigos.')
    setTimeout(() => setCopiedLink(false), 3000)
  }

  function handleSaveProfile(newName: string, newAvatar: DuckAvatar) {
    setMyName(newName)
    setMyAvatar(newAvatar)
    if (roomRef.current?.setPlayerName) {
      roomRef.current.setPlayerName(newName)
      roomRef.current.profile.avatar = newAvatar
    }
    if (isHost) {
      const updated = players.map((p) => (p.id === myId ? { ...p, name: newName, avatar: newAvatar } : p))
      setPlayers(updated)
      syncToClients({ players: updated })
    } else {
      roomRef.current?.sendToHost({
        type: 'UPDATE_PROFILE',
        profile: { id: myId, name: newName, avatar: newAvatar }
      })
    }
    showToast('Perfil atualizado!')
  }

  function handleManualJoinSubmit(e: React.FormEvent) {
    e.preventDefault()
    const code = joinInputCode.trim().toUpperCase()
    if (!code) {
      showToast('Digite o código da sala!')
      return
    }
    loadNBPRoom().then((NBPRoomClass) => {
      if (NBPRoomClass) {
        joinExistingRoom(code, NBPRoomClass)
        setDrawerOpen(false)
      }
    })
  }

  // Keyboard Shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (phase !== 'playing' || !isMyTurn) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if ((e.code === 'Space' || e.key.toLowerCase() === 'n') && bids.length > 0) {
        e.preventDefault()
        dispatchChallenge()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [phase, isMyTurn, bids, dispatchChallenge])

  // Podium rankings
  const rankedPlayers = [...players].sort((a, b) => a.ducksCount - b.ducksCount)
  const theBigDuck = [...players].sort((a, b) => b.ducksCount - a.ducksCount)[0] || players[0]

  // SSR / Initial Client Hydration Guard (Prevents React #418 Hydration Text Mismatch)
  if (!isMounted) {
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-[580px] bg-slate-950 text-slate-100 font-sans border border-slate-800/80 rounded-2xl shadow-2xl p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 animate-pulse">
            <Bird className="w-8 h-8 stroke-[2.25]" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white font-mono tracking-tight">NEM A PATO!</h2>
            <p className="text-xs text-slate-400 mt-1">Carregando o lago e preparando as cartas...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full h-full min-h-[580px] bg-slate-950 text-slate-100 font-sans select-none overflow-hidden relative border border-slate-800/80 rounded-2xl shadow-2xl">
      {/* Top Ambient Water Gradient Glow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(14,165,233,0.15),transparent_70%)]" />

      {/* Topbar Header */}
      <header className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.1, rotate: 10 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => sound.quack()}
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 cursor-pointer"
            title="Quack!"
          >
            <Bird className="w-6 h-6 stroke-[2.5]" />
          </motion.div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5 font-mono">
                NEM A PATO!
              </h2>
              <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">
                {isHost ? 'Host da Mesa' : 'Convidado P2P'}
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Chute alto, blefe com estilo e não pague o pato!</p>
          </div>
        </div>

        {/* Center Pill: Round & Room */}
        <div className="flex items-center gap-2">
          {phase === 'playing' && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700 text-xs font-semibold text-slate-300">
              <span className="text-amber-400 text-xs">RODADA</span>
              <strong className="text-white font-mono">{round} / {totalRounds}</strong>
            </div>
          )}

          <button
            type="button"
            onClick={copyInviteLink}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium text-slate-300 transition-colors"
            title="Clique para copiar o link de convite da sala"
          >
            <span className={`w-2 h-2 rounded-full ${connectionStatus.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'}`} />
            <span className="font-mono">{roomCode}</span>
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
          </button>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const enabled = sound.toggleSound()
              setSoundEnabled(enabled)
            }}
            className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 hover:text-white transition-colors border border-slate-700/50"
            title={soundEnabled ? 'Desativar Sons' : 'Ativar Sons'}
            aria-label="Controle de Som"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 hover:text-white transition-colors border border-slate-700/50"
            title="Configurações e Jogadores"
            aria-label="Configurações da Sala"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Body Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left/Center Area: Arena (Always overflow-hidden to prevent outer scrolling) */}
        <main className="flex-1 flex flex-col p-3 sm:p-4 overflow-hidden relative z-0 min-h-0">
          {/* LOBBY VIEW */}
          {phase === 'lobby' && (
            <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center relative overflow-hidden"
              >
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-inner">
                  <Bird className="w-9 h-9 stroke-[2.25]" />
                </div>
                <div className="inline-block px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 font-bold text-xs tracking-wider uppercase mb-2">
                  LAGO DOS PATOS · SALA {roomCode}
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
                  NEM A PATO!
                </h1>
                <p className="text-sm text-slate-300 mb-6 leading-relaxed">
                  Cada pato deve chutar um valor <strong>maior</strong> que o anterior sem estourar o número real. Acha que o amigo exagerou? Grite <strong>NEM A PATO!</strong>
                </p>

                {/* Quick Share Pill */}
                <div className="w-full mb-4">
                  <button
                    type="button"
                    onClick={copyInviteLink}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 transition-colors"
                  >
                    <Copy className="w-4 h-4 text-amber-400" />
                    <span>Copiar link de convite para amigos</span>
                  </button>
                </div>

                {/* Roster Tags */}
                <div className="w-full bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 mb-6">
                  <div className="flex items-center justify-between mb-3 text-xs text-slate-400 font-medium">
                    <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Patos na partida ({players.length}):</span>
                    {isHost && (
                      <button
                        type="button"
                        onClick={addBot}
                        className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 hover:underline"
                      >
                        <Plus className="w-3.5 h-3.5" /> Adicionar Bot
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {players.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700/70 text-xs text-slate-200"
                      >
                        <span className="p-1 rounded-md bg-slate-700/60 text-amber-300">{renderAvatarIcon(p.avatar, 'w-4 h-4')}</span>
                        <span className="font-semibold">{p.name}</span>
                        {p.id === myId && <span className="text-[10px] text-amber-400 font-bold">(Você)</span>}
                        {p.isBot && <Bot className="w-3 h-3 text-cyan-400" />}
                        {isHost && p.id !== myId && players.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removePlayer(p.id)}
                            className="text-slate-500 hover:text-rose-400 ml-1 p-0.5"
                            title="Remover"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Start Match CTA Button or Guest Waiting */}
                {isHost ? (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={startMatch}
                    className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-extrabold text-base tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all"
                  >
                    <Play className="w-5 h-5 fill-slate-950" />
                    INICIAR PARTIDA (GO!)
                  </motion.button>
                ) : (
                  <div className="w-full py-3.5 px-4 rounded-2xl bg-slate-800/80 border border-slate-700 text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 animate-pulse">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>Aguardando o líder (Host) iniciar a partida...</span>
                  </div>
                )}
              </motion.div>
            </div>
          )}

          {/* ACTIVE GAMEPLAY VIEW (Zero Outer Scroll, Fixed Layout) */}
          {phase === 'playing' && (
            <div className="flex-1 flex flex-col gap-3 max-w-5xl mx-auto w-full min-h-0 overflow-hidden">
              {/* Pinned Question Theme Card (Fixed at the top, ALWAYS visible) */}
              <motion.div
                key={activeCard.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', damping: 22 }}
                className="flex-shrink-0 bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-lg relative"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      {activeCard.category}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                      Rodada {round}/{totalRounds}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-300">
                      <span className="text-[10px] text-amber-400 uppercase hidden sm:inline">Penalidade:</span>
                      <span className="flex items-center gap-0.5">
                        {Array.from({ length: penaltyMode === 'ducks' ? activeCard.ducks : 1 }).map((_, i) => (
                          <Bird key={i} className="w-3.5 h-3.5 fill-amber-400/30 text-amber-400 inline-block" />
                        ))}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-xs">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Em:</span>
                      <strong className="text-amber-300 font-mono uppercase">{activeCard.unit}</strong>
                    </div>
                  </div>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                  {activeCard.question}
                </h3>
              </motion.div>

              {/* Arena Grid: Left = Bids Feed, Right = Controls & Status */}
              <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-3 overflow-hidden">
                {/* Left: Bids Escalada Timeline (Scrolls internally without moving the page) */}
                <div className="md:col-span-5 flex flex-col bg-slate-900/70 border border-slate-800/80 rounded-2xl p-3 min-h-0 overflow-hidden">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2 flex-shrink-0">
                    <span className="flex items-center gap-1.5">
                      <ArrowUp className="w-3.5 h-3.5 text-amber-400" />
                      ESCALADA DE CHUTES:
                    </span>
                    <span className="font-mono text-slate-400">{bids.length} chute(s)</span>
                  </div>

                  <div ref={bidsContainerRef} className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0 scroll-smooth">
                    {bids.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-slate-500 italic p-3 text-center">
                        Nenhum palpite ainda. O primeiro jogador pode chutar qualquer número inteiro positivo!
                      </div>
                    ) : (
                      bids.map((bid, idx) => (
                        <motion.div
                          key={bid.id}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`flex items-center justify-between p-2 rounded-xl border text-xs ${
                            bid.isDouble
                              ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                              : idx === bids.length - 1
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-100'
                              : 'bg-slate-800/40 border-slate-700/50 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="p-1 rounded-md bg-slate-800/80 text-amber-300 flex-shrink-0">
                              {renderAvatarIcon(bid.playerAvatar, 'w-3.5 h-3.5')}
                            </span>
                            <span className="font-semibold truncate">{bid.playerName}</span>
                            {bid.isDouble && (
                              <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 flex items-center gap-0.5 flex-shrink-0">
                                <Flame className="w-2.5 h-2.5 text-rose-400" /> 2x
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 font-mono flex-shrink-0">
                            <span className="text-slate-400 text-[10px]">(+{bid.delta.toLocaleString('pt-BR')})</span>
                            <strong className="text-sm font-bold text-white">
                              {bid.value.toLocaleString('pt-BR')}
                            </strong>
                            <span className="text-slate-400 text-[11px]">{activeCard.unit}</span>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right: Turn Status & Action Controls (Always anchored in place) */}
                <div className="md:col-span-7 flex flex-col justify-between gap-3 min-h-0 overflow-y-auto pr-0.5">
                  {/* Turn Status & Current Target */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 shadow-md flex-shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-300">
                          {renderAvatarIcon(currentPlayer.avatar, 'w-5 h-5')}
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900 animate-pulse" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                          {isMyTurn ? 'SUA VEZ DE JOGAR!' : 'VEZ DE:'}
                        </span>
                        <strong className="text-sm font-bold text-white truncate block">
                          {currentPlayer.name}
                          {botThinking && (
                            <span className="text-xs font-normal text-amber-400 animate-pulse ml-1">
                              (pensando...)
                            </span>
                          )}
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 font-semibold block uppercase">
                          A SUPERAR
                        </span>
                        <strong className="text-base font-mono text-amber-300">
                          {currentBidValue > 0 ? `${currentBidValue.toLocaleString('pt-BR')} ${activeCard.unit}` : '—'}
                        </strong>
                      </div>

                      {turnDuration > 0 && (
                        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border font-mono font-bold text-xs ${
                          timeLeft <= 5
                            ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-bounce'
                            : timeLeft <= 10
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                            : 'bg-slate-800 border-slate-700 text-slate-300'
                        }`}>
                          <Clock className="w-3 h-3" />
                          <span>{timeLeft}s</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Controls Card */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xl flex flex-col gap-2.5 flex-shrink-0">
                    {isMyTurn ? (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-xs text-amber-400 font-semibold">
                          <span>Diga um número MAIOR ou duvide:</span>
                          <span className="text-slate-400 text-[11px] hidden sm:inline">Enter = chutar</span>
                        </div>

                        {/* Form Input + Submit */}
                        <form onSubmit={handleManualBidSubmit} className="flex gap-2">
                          <input
                            ref={inputRef}
                            type="number"
                            inputMode="numeric"
                            min={currentBidValue + 1}
                            placeholder={currentBidValue > 0 ? `Maior que ${currentBidValue}...` : 'Digite o chute...'}
                            value={bidInput}
                            onChange={(e) => setBidInput(e.target.value)}
                            className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-amber-400 transition-colors"
                          />
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                          >
                            Chutar ↵
                          </motion.button>
                        </form>

                        {/* Quick Helper Chips */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {[1, 5, 10, 50, 100].map((inc) => (
                            <button
                              key={inc}
                              type="button"
                              onClick={() => handleHelperAdd(inc)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold font-mono transition-colors"
                            >
                              +{inc}
                            </button>
                          ))}

                          {bids.length > 0 && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              type="button"
                              onClick={handleDouble}
                              className="px-3 py-1 rounded-lg bg-gradient-to-r from-orange-600 to-rose-600 hover:from-orange-500 hover:to-rose-500 text-white text-xs font-extrabold flex items-center gap-1 shadow-md shadow-rose-600/30 ml-auto"
                            >
                              <Flame className="w-3 h-3 text-rose-400" /> DOBREI! (2x)
                            </motion.button>
                          )}
                        </div>

                        {/* THE BIG "NEM A PATO!" BUTTON */}
                        {bids.length > 0 && (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.96 }}
                            type="button"
                            onClick={dispatchChallenge}
                            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 via-red-500 to-rose-600 hover:from-rose-500 hover:to-red-400 text-white font-extrabold text-sm sm:text-base tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 border border-rose-400/40"
                          >
                            <Siren className="w-5 h-5 text-amber-300 animate-pulse" />
                            <span>NEM A PATO! (DUVIDO!)</span>
                          </motion.button>
                        )}
                      </div>
                    ) : (
                      <div className="py-4 text-center text-xs text-slate-400">
                        Aguardando a jogada de <strong className="text-white">{currentPlayer.name}</strong>...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Toast Alert */}
          <AnimatePresence>
            {toastMessage && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 text-xs font-semibold shadow-2xl z-50 flex items-center gap-2"
              >
                <Info className="w-4 h-4 text-amber-400" />
                <span>{toastMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Right Sidebar: Roster & History */}
        <aside className="w-full lg:w-80 bg-slate-900/60 border-t lg:border-t-0 lg:border-l border-slate-800/80 p-4 flex flex-col gap-4 overflow-y-auto">
          {/* Players Roster */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3 text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-amber-400" /> Patos no Lago ({players.length}):
              </span>
              <span className="text-[10px] text-slate-500 uppercase">Penalidade</span>
            </div>

            <div className="space-y-2">
              {players.map((p) => {
                const isTurn = phase === 'playing' && p.id === currentPlayer.id
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors ${
                      isTurn
                        ? 'bg-amber-500/10 border-amber-500/40 text-white'
                        : 'bg-slate-800/40 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded-lg bg-slate-800 text-amber-300">{renderAvatarIcon(p.avatar, 'w-4 h-4')}</span>
                      <div>
                        <div className="font-semibold flex items-center gap-1">
                          {p.name}
                          {p.id === myId && <span className="text-[9px] text-amber-400 font-bold">(Você)</span>}
                          {p.isBot && <Bot className="w-3 h-3 text-cyan-400" />}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {p.cardsCount} carta(s)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 font-mono font-bold text-amber-400">
                      <span>{p.ducksCount}</span>
                      <Bird className="w-3.5 h-3.5 fill-amber-400/30 text-amber-400" />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* History Feed */}
          <div className="flex-1 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col min-h-[160px]">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" /> Registro da Mesa
            </span>
            <div className="flex-1 overflow-y-auto space-y-1.5 text-xs text-slate-400 pr-1">
              {history.length === 0 ? (
                <span className="text-slate-500 italic text-[11px]">As jogadas e blefes aparecem aqui...</span>
              ) : (
                history.map((h) => (
                  <div
                    key={h.id}
                    className={`p-2 rounded-xl border text-[11px] leading-relaxed ${
                      h.type === 'challenge'
                        ? 'bg-rose-950/30 border-rose-500/30 text-rose-200 font-medium'
                        : h.type === 'double'
                        ? 'bg-orange-950/30 border-orange-500/30 text-orange-200'
                        : 'bg-slate-800/30 border-slate-800 text-slate-300'
                    }`}
                  >
                    {h.text}
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* REVEAL MODAL */}
      <AnimatePresence>
        {phase === 'revealing' && revealInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              className="max-w-lg w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden"
            >
              <div className="inline-block px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 font-extrabold text-xs tracking-wider uppercase mb-2">
                HORA DA VERDADE!
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-white mb-2">
                {revealInfo.card.question}
              </h2>

              {/* Side-by-Side Comparison */}
              <div className="grid grid-cols-2 gap-4 my-4 bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                    ÚLTIMO CHUTE ({revealInfo.bidder.name})
                  </span>
                  <div className="text-2xl font-mono font-bold text-amber-300">
                    {revealInfo.bidValue.toLocaleString('pt-BR')}
                  </div>
                  <span className="text-xs text-slate-400">{revealInfo.card.unit}</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                    DESAFIADOR
                  </span>
                  <div className="text-2xl font-bold text-rose-400">
                    NEM A PATO!
                  </div>
                  <span className="text-xs text-slate-400">{revealInfo.challenger.name}</span>
                </div>
              </div>

              {/* Real Answer Reveal */}
              <div className="my-5 p-5 rounded-2xl bg-gradient-to-b from-sky-950/40 to-slate-950 border border-sky-500/30">
                <span className="text-xs font-extrabold tracking-wider text-sky-300 uppercase block mb-1">
                  A RESPOSTA REAL É:
                </span>
                <div className="text-4xl font-extrabold text-white font-mono my-2 text-sky-400">
                  {revealInfo.realAnswer.toLocaleString('pt-BR')} <span className="text-base text-slate-300 font-sans">{revealInfo.card.unit}</span>
                </div>
                <p className="text-xs text-slate-300 mt-3 italic leading-relaxed px-2">
                  "{revealInfo.card.fact}"
                </p>
              </div>

              {/* Verdict */}
              <div className={`p-4 rounded-2xl border mb-6 text-sm font-semibold ${
                revealInfo.exceeded
                  ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                  : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              }`}>
                {revealInfo.exceeded ? (
                  <div>
                    <strong className="block text-base font-extrabold text-rose-400 mb-1">
                      EXAGEROU! PASSOU DO PONTO!
                    </strong>
                    <span>
                      {revealInfo.bidder.name} chutou {revealInfo.bidValue.toLocaleString('pt-BR')}, mas o valor real era {revealInfo.realAnswer.toLocaleString('pt-BR')}!
                      <br />
                      <strong>{revealInfo.bidder.name}</strong> leva a penalidade (+{revealInfo.penaltyDucks} patos)!
                    </span>
                  </div>
                ) : (
                  <div>
                    <strong className="block text-base font-extrabold text-emerald-400 mb-1">
                      NÃO PASSOU! O CHUTE ERA VÁLIDO!
                    </strong>
                    <span>
                      {revealInfo.challenger.name} duvidou errado! A resposta era {revealInfo.realAnswer.toLocaleString('pt-BR')}, então {revealInfo.bidValue.toLocaleString('pt-BR')} não estourou!
                      <br />
                      <strong>{revealInfo.challenger.name}</strong> leva a penalidade (+{revealInfo.penaltyDucks} patos)!
                    </span>
                  </div>
                )}
              </div>

              {isHost ? (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={nextRound}
                  className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  {round >= totalRounds ? (
                    <>
                      <Trophy className="w-5 h-5" />
                      <span>Ver Resultado Final</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 fill-slate-950" />
                      <span>Próxima Rodada</span>
                    </>
                  )}
                </motion.button>
              ) : (
                <div className="w-full py-3 px-4 rounded-2xl bg-slate-800 text-slate-300 font-semibold text-xs flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400 animate-spin" />
                  <span>Aguardando o líder iniciar a próxima rodada...</span>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* GAME OVER MODAL */}
      <AnimatePresence>
        {phase === 'gameover' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden"
            >
              <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
                <Trophy className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-extrabold text-white mb-1">FIM DA PARTIDA!</h2>
              <p className="text-xs text-slate-400 mb-6">
                Em <em>Nem a Pato!</em>, quem acumula <strong>menos patos</strong> é o grande vencedor!
              </p>

              {/* The Big Duck (Biggest Loser / Grande Pato) */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-950/50 to-slate-950 border border-rose-500/30 mb-6">
                <span className="text-xs text-rose-300 font-extrabold uppercase tracking-wider mb-1 flex items-center justify-center gap-1.5">
                  <Crown className="w-4 h-4 text-amber-400 inline" /> O GRANDE PATO DA VEZ (PAGOU O PATO!):
                </span>
                <div className="text-xl font-extrabold text-white flex items-center justify-center gap-2">
                  <span className="p-1 rounded-lg bg-slate-800 text-amber-400">{renderAvatarIcon(theBigDuck.avatar, 'w-5 h-5')}</span>
                  <span>{theBigDuck.name}</span>
                </div>
                <div className="text-xs font-mono text-rose-300 mt-1">
                  Acumulou {theBigDuck.ducksCount} patos e {theBigDuck.cardsCount} cartas de penalidade!
                </div>
              </div>

              {/* Leaderboard Table */}
              <div className="space-y-2 mb-6">
                {rankedPlayers.map((p, rank) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs ${
                      rank === 0
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm font-mono w-5 flex items-center justify-center">
                        {rank === 0 ? <Medal className="w-4 h-4 text-amber-400" /> : rank === 1 ? <Medal className="w-4 h-4 text-slate-300" /> : rank === 2 ? <Medal className="w-4 h-4 text-amber-600" /> : `#${rank + 1}`}
                      </span>
                      <span className="p-1 rounded-md bg-slate-800/60 text-slate-300">{renderAvatarIcon(p.avatar, 'w-4 h-4')}</span>
                      <span className="font-bold">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono font-bold text-amber-300">
                      <span>{p.ducksCount}</span>
                      <Bird className="w-3.5 h-3.5 fill-amber-400/30 text-amber-400" />
                    </div>
                  </div>
                ))}
              </div>

              {isHost ? (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    setPhase('lobby')
                    syncToClients({ phase: 'lobby' })
                  }}
                  className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  <RefreshCw className="w-4 h-4" /> Jogar Novamente
                </motion.button>
              ) : (
                <div className="text-xs text-slate-400 italic">
                  Aguardando o Host reiniciar a partida...
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DRAWER DE CONFIGURAÇÕES */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-sm h-full bg-slate-900 border-l border-slate-800 p-5 flex flex-col justify-between shadow-2xl overflow-y-auto"
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-amber-400" /> Configurações &amp; Sala
                  </h3>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  {/* Status da Conexão P2P */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {connectionStatus.connected ? (
                        <Wifi className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <WifiOff className="w-4 h-4 text-amber-400 animate-pulse" />
                      )}
                      <div>
                        <div className="font-bold text-white">
                          {connectionStatus.connected ? 'Conexão P2P Ativa' : 'Conectando ao Lago...'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {isHost ? 'Você é o Host (Mesa)' : 'Você é Convidado'} · Sala: {roomCode}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Seu Perfil (Nome & Avatar) */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <label className="text-slate-300 font-semibold block mb-2 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-amber-400" /> Seu Nome no Lago:
                    </label>
                    <input
                      type="text"
                      maxLength={18}
                      value={myName}
                      onChange={(e) => setMyName(e.target.value)}
                      onBlur={() => handleSaveProfile(myName, myAvatar)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-medium mb-3"
                    />

                    <label className="text-slate-400 font-semibold block mb-1">
                      Escolha seu Pato:
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {AVATARS.map((av) => (
                        <button
                          key={av}
                          type="button"
                          onClick={() => {
                            setMyAvatar(av)
                            handleSaveProfile(myName, av)
                          }}
                          className={`p-2 rounded-xl border flex items-center justify-center transition-colors ${
                            myAvatar === av
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                              : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                          }`}
                        >
                          {renderAvatarIcon(av, 'w-5 h-5')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Entrar em Outra Sala */}
                  <form onSubmit={handleManualJoinSubmit} className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <label className="text-slate-300 font-semibold block mb-1 flex items-center gap-1.5">
                      <LogIn className="w-3.5 h-3.5 text-amber-400" /> Conectar a Outra Sala:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={14}
                        placeholder="Ex: PATO-1234"
                        value={joinInputCode}
                        onChange={(e) => setJoinInputCode(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono uppercase text-xs"
                      />
                      <button
                        type="submit"
                        className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                      >
                        Entrar
                      </button>
                    </div>
                  </form>

                  {/* Configurações da Partida (Somente Host) */}
                  {isHost && (
                    <>
                      <div>
                        <label className="text-slate-400 font-semibold block mb-1">
                          Quantidade de Rodadas:
                        </label>
                        <select
                          value={totalRounds}
                          onChange={(e) => {
                            const val = Number(e.target.value)
                            setTotalRounds(val)
                            syncToClients({ totalRounds: val })
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-medium"
                        >
                          <option value={5}>5 Rodadas (Rápida)</option>
                          <option value={7}>7 Rodadas (Média)</option>
                          <option value={10}>10 Rodadas (Oficial)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-slate-400 font-semibold block mb-1">
                          Tempo por Turno:
                        </label>
                        <select
                          value={turnDuration}
                          onChange={(e) => {
                            const val = Number(e.target.value)
                            setTurnDuration(val)
                            syncToClients({ turnDuration: val })
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-medium"
                        >
                          <option value={15}>15 segundos (Pânico!)</option>
                          <option value={25}>25 segundos (Padrão)</option>
                          <option value={40}>40 segundos (Relax)</option>
                          <option value={0}>Sem tempo limite</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-slate-400 font-semibold block mb-1">
                          Sistema de Penalidade:
                        </label>
                        <select
                          value={penaltyMode}
                          onChange={(e) => {
                            const val = e.target.value as 'ducks' | 'cards'
                            setPenaltyMode(val)
                            syncToClients({ penaltyMode: val })
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-medium"
                        >
                          <option value="ducks">Patos das Cartas (1 a 3 patos)</option>
                          <option value="cards">1 Carta = 1 Ponto</option>
                        </select>
                      </div>

                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={addBot}
                          className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center justify-center gap-2 border border-slate-700"
                        >
                          <Bot className="w-4 h-4 text-cyan-400" /> Adicionar Mais um Bot
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setPhase('lobby')
                    setDrawerOpen(false)
                    if (isHost) syncToClients({ phase: 'lobby' })
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-semibold border border-rose-500/30"
                >
                  Reiniciar / Voltar ao Lobby
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
