import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Volume2,
  VolumeX,
  Trophy,
  Users,
  Check,
  Bot,
  Play,
  Plus,
  RefreshCw,
  Copy,
  Crown,
  SlidersHorizontal,
  X,
  Medal,
  LogIn,
  Wifi,
  WifiOff,
  UserCheck,
  Sparkles,
  ArrowRight,
  Flame,
  Clock
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
import { DuckAvatarIcon, RubberDuckToken } from './DuckAvatars'
import { HandFan, DARK_FELT_TEXTURE, LINEN_TEXTURE } from './PhysicalCard'
import { TriviaTableCard, TableBidPile } from './TableCards'
import { TactileTurnBadge, PlayerTokenCard } from './TactileHUD'
import { ParticleBurst } from './Particles'
import { FloatingAlerts, type FloatingAlertItem } from './FloatingAlerts'

const AVATARS: DuckAvatar[] = ['🦆', '🕶️', '🕵️', '🎩', '🤿', '👑', '🤖', '🤠']

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

  // Tactile "Game Juice" Visual States
  const [isShaking, setIsShaking] = useState(false)
  const [isSquashing, setIsSquashing] = useState(false)
  const [particleTrigger, setParticleTrigger] = useState<number | null>(null)
  const [particleType, setParticleType] = useState<'feather' | 'star' | 'mixed'>('mixed')
  const [floatingAlerts, setFloatingAlerts] = useState<FloatingAlertItem[]>([])

  // P2P NBPRoom reference
  const roomRef = useRef<any>(null)
  const isHostRef = useRef(isHost)
  isHostRef.current = isHost

  // Internal scroll & focus refs
  const bidsContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fast access to state in callbacks
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

  // Camera Shake trigger (120ms)
  const triggerCameraShake = useCallback(() => {
    setIsShaking(true)
    setTimeout(() => setIsShaking(false), 130)
  }, [])

  // Squash & Stretch trigger
  const triggerSquash = useCallback(() => {
    setIsSquashing(true)
    setTimeout(() => setIsSquashing(false), 450)
  }, [])

  // Floating Alert helper
  const addFloatingAlert = useCallback(
    (alert: Omit<FloatingAlertItem, 'id'>) => {
      const id = `${Date.now()}-${Math.random()}`
      setFloatingAlerts((prev) => [...prev.slice(-3), { ...alert, id }])
      setTimeout(() => {
        setFloatingAlerts((prev) => prev.filter((a) => a.id !== id))
      }, 1400)
    },
    []
  )

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    const t = setTimeout(() => setToastMessage(null), 3200)
    return () => clearTimeout(t)
  }, [])

  // Auto-scroll bids container
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
  const applyRemoteState = useCallback(
    (remote: GameStateSync) => {
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
            if (lastBid?.isDouble) {
              sound.double()
              addFloatingAlert({ text: 'DOBROU! 2X', type: 'double' })
            } else {
              sound.bid()
              addFloatingAlert({
                text: `+${lastBid.delta.toLocaleString('pt-BR')} ${remote.activeCard?.unit || ''}`,
                type: 'bid'
              })
            }
          }
          return remote.bids
        })
      }

      if (remote.phase === 'revealing' && stateRef.current.phase !== 'revealing') {
        sound.nemAPato()
        triggerCameraShake()
        triggerSquash()
        setParticleType('feather')
        setParticleTrigger(Date.now())
        addFloatingAlert({ text: 'NEM A PATO! 🦆', type: 'challenge' })
      } else if (remote.phase === 'gameover' && stateRef.current.phase !== 'gameover') {
        sound.fanfare()
        setParticleType('star')
        setParticleTrigger(Date.now())
      }
    },
    [addFloatingAlert, triggerCameraShake, triggerSquash]
  )

  // Execute a Bid (Host authoritative)
  const executeBid = useCallback(
    (playerId: string, value: number, isDouble = false) => {
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
        addFloatingAlert({ text: 'DOBROU! 2X 🔥', type: 'double' })
      } else {
        sound.bid()
        addFloatingAlert({
          text: `+${delta.toLocaleString('pt-BR')} ${s.activeCard.unit}`,
          type: 'bid'
        })
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
    },
    [showToast, syncToClients, addFloatingAlert]
  )

  // Handle "NEM A PATO!" Challenge (Host authoritative)
  const handleChallenge = useCallback(
    (challengerId: string) => {
      const s = stateRef.current
      if (s.bids.length === 0) return

      sound.nemAPato()
      triggerCameraShake()
      triggerSquash()
      setParticleType('feather')
      setParticleTrigger(Date.now())
      addFloatingAlert({ text: 'NEM A PATO! 🦆', type: 'challenge' })

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
    },
    [syncToClients, triggerCameraShake, triggerSquash, addFloatingAlert]
  )

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
      setParticleType('star')
      setParticleTrigger(Date.now())
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
            let newList = [...currentList]
            if (stateRef.current.phase === 'lobby') {
              const botIdx = newList.findIndex((p) => p.isBot && (p.id === 'b1' || p.id === 'b2'))
              if (botIdx !== -1 && newList.length > 2) {
                newList.splice(botIdx, 1)
              }
            }
            newList.push({
              id: prof.id,
              name: prof.name || `Pato #${newList.length + 1}`,
              avatar: prof.avatar || '🦆',
              isBot: false,
              isHost: false,
              ducksCount: 0,
              cardsCount: 0
            })
            setPlayers(newList)
            sound.quack()
            showToast(`${prof.name || 'Um novo pato'} mergulhou na sala!`)
            syncToClients({ players: newList })
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

  // Initial Mount & P2P bootstrap
  useEffect(() => {
    setIsMounted(true)

    fetchCardsDatabase().then((db) => {
      if (db && db.length > 0) {
        setCards(db)
        setActiveCard(db[0])
      }
    })

    loadNBPRoom().then((NBPRoomClass) => {
      if (!NBPRoomClass) return

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

  // Turn Timer Interval
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

  // Bot Turn Handler
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

  // Dispatch Bid from Client or Host
  const dispatchBid = useCallback(
    (val: number, isDouble = false) => {
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
    },
    [currentBidValue, bids.length, isHost, executeBid, myId, myName, showToast]
  )

  // Dispatch Challenge from Client or Host
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
    sound.click()
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
    sound.click()
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
    sound.click()
    if (typeof window === 'undefined') return
    const url = `${window.location.origin}/jogos/nem-a-pato?room=${roomCode}`
    navigator.clipboard?.writeText(url).catch(() => {})
    setCopiedLink(true)
    showToast('Link de convite copiado! Envie aos amigos.')
    setTimeout(() => setCopiedLink(false), 3000)
  }

  function handleSaveProfile(newName: string, newAvatar: DuckAvatar) {
    sound.click()
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
    sound.click()
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

  // Keyboard Shortcuts (Space or N to challenge)
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

  // Hand Cards configuration for Fan Layout
  const playerHandCards = [
    {
      id: 'card-1',
      label: '+1',
      subLabel: '+1 chute',
      value: '+1',
      type: 'add' as const,
      disabled: !isMyTurn,
      onClick: () => handleHelperAdd(1)
    },
    {
      id: 'card-5',
      label: '+5',
      subLabel: '+5 chutes',
      value: '+5',
      type: 'add' as const,
      disabled: !isMyTurn,
      onClick: () => handleHelperAdd(5)
    },
    {
      id: 'card-10',
      label: '+10',
      subLabel: '+10 chutes',
      value: '+10',
      type: 'add' as const,
      disabled: !isMyTurn,
      onClick: () => handleHelperAdd(10)
    },
    {
      id: 'card-50',
      label: '+50',
      subLabel: '+50 chutes',
      value: '+50',
      type: 'add' as const,
      disabled: !isMyTurn,
      onClick: () => handleHelperAdd(50)
    },
    ...(bids.length > 0
      ? [
          {
            id: 'card-double',
            label: '2X',
            subLabel: 'Dobrar valor',
            value: '2X',
            type: 'double' as const,
            disabled: !isMyTurn,
            onClick: handleDouble
          },
          {
            id: 'card-challenge',
            label: 'NEM A PATO',
            subLabel: 'Duvidar agora',
            value: 'DUVIDO',
            type: 'challenge' as const,
            disabled: !isMyTurn,
            onClick: dispatchChallenge
          }
        ]
      : [])
  ]

  // SSR hydration guard
  if (!isMounted) {
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-[580px] bg-slate-950 text-slate-100 font-sans border border-slate-800 rounded-3xl p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <RubberDuckToken className="w-14 h-14 animate-bounce" />
          <div>
            <h2 className="text-xl font-black text-amber-400 font-mono tracking-tight">NEM A PATO!</h2>
            <p className="text-xs text-slate-400 mt-1">Preparando o feltro da mesa de jogo...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col w-full h-full min-h-[580px] text-slate-100 select-none overflow-hidden relative border-[3.5px] border-slate-950 rounded-3xl shadow-[6px_8px_0px_#090d16] ${
        isShaking ? 'arena-shaking' : ''
      }`}
      style={{
        background: DARK_FELT_TEXTURE
      }}
    >
      {/* Inline styles for Camera Shake and Animations */}
      <style>{`
        @keyframes arena-camera-shake {
          0% { transform: translate(0, 0); }
          20% { transform: translate(-5px, 3px) rotate(-0.4deg); }
          40% { transform: translate(5px, -3px) rotate(0.4deg); }
          60% { transform: translate(-3px, 2px); }
          80% { transform: translate(3px, -2px); }
          100% { transform: translate(0, 0); }
        }
        .arena-shaking {
          animation: arena-camera-shake 120ms ease-in-out !important;
        }
      `}</style>

      {/* Dynamic Gravity Particles Layer */}
      <ParticleBurst triggerKey={particleTrigger} type={particleType} />

      {/* Animated Floating Numbers / Badges */}
      <FloatingAlerts alerts={floatingAlerts} />

      {/* Tabletop Overhead Spotlight Vignette */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: 'radial-gradient(circle at 50% 25%, rgba(254, 240, 138, 0.08) 0%, rgba(2, 6, 23, 0.45) 85%)'
        }}
      />

      {/* Top Header Bar: Wooden / Cartoony Table Border */}
      <header className="relative z-20 flex items-center justify-between px-4 py-2.5 bg-slate-950/90 border-b-[3px] border-slate-950 backdrop-blur-sm shadow-md">
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.1, rotate: 8 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => sound.quack()}
            className="w-10 h-10 rounded-2xl bg-amber-400 border-2 border-slate-950 flex items-center justify-center cursor-pointer shadow-[2.5px_2.5px_0px_#090d16]"
            title="Quack!"
          >
            <RubberDuckToken className="w-7 h-7" />
          </motion.div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-amber-300 drop-shadow-[0_2px_0_rgba(15,23,42,0.8)] font-mono">
                NEM A PATO!
              </h2>
              <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md bg-amber-400 text-slate-950 border border-slate-950 shadow-[1px_1px_0px_#090d16]">
                {isHost ? 'Host da Mesa' : 'Convidado P2P'}
              </span>
            </div>
            <p className="text-[11px] text-teal-200/80 font-medium hidden sm:block">
              Chute alto, blefe com estilo e não pague o pato!
            </p>
          </div>
        </div>

        {/* Center Pill: Round & Room Code */}
        <div className="flex items-center gap-2">
          {phase === 'playing' && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-400 text-slate-950 border-2 border-slate-950 font-black text-xs shadow-[2px_2px_0px_#090d16]">
              <span className="text-[10px] uppercase text-amber-950">RODADA</span>
              <strong className="font-mono text-xs">{round}/{totalRounds}</strong>
            </div>
          )}

          <button
            type="button"
            onClick={copyInviteLink}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border-2 border-slate-950 text-xs font-bold text-slate-200 transition-colors shadow-[2px_2px_0px_#090d16]"
            title="Clique para copiar o link de convite da sala"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                connectionStatus.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
              }`}
            />
            <span className="font-mono">{roomCode}</span>
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
          </button>
        </div>

        {/* Audio & Settings Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const enabled = sound.toggleSound()
              setSoundEnabled(enabled)
            }}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors border-2 border-slate-950 shadow-[2px_2px_0px_#090d16]"
            title={soundEnabled ? 'Desativar Sons' : 'Ativar Sons'}
            aria-label="Controle de Som"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          <button
            type="button"
            onClick={() => {
              sound.click()
              setDrawerOpen(true)
            }}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors border-2 border-slate-950 shadow-[2px_2px_0px_#090d16]"
            title="Configurações e Jogadores"
            aria-label="Configurações da Sala"
          >
            <SlidersHorizontal className="w-4 h-4 text-teal-300" />
          </button>
        </div>
      </header>

      {/* Main Arena Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative z-10">
        <main className="flex-1 flex flex-col p-3 sm:p-4 overflow-hidden relative min-h-0">
          {/* LOBBY VIEW */}
          {phase === 'lobby' && (
            <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, y: 25, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="max-w-md w-full rounded-3xl p-6 sm:p-7 flex flex-col items-center text-center relative border-[3.5px] border-slate-950 select-none shadow-[6px_8px_0px_#090d16]"
                style={{ background: LINEN_TEXTURE }}
              >
                <div className="w-16 h-16 rounded-3xl bg-amber-400 border-[3px] border-slate-950 flex items-center justify-center mb-3 shadow-[3px_3px_0px_#090d16]">
                  <RubberDuckToken className="w-11 h-11" />
                </div>

                <div className="inline-block px-3 py-1 rounded-xl bg-slate-950 text-amber-300 font-black text-xs tracking-wider uppercase mb-2 shadow-[2px_2px_0px_#090d16]">
                  LAGO DOS PATOS · SALA {roomCode}
                </div>

                <h1 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight leading-none mb-2">
                  NEM A PATO!
                </h1>

                <p className="text-xs sm:text-sm text-slate-700 font-semibold mb-5 leading-relaxed">
                  Cada pato deve chutar um valor <strong>maior</strong> sem estourar a resposta real. Acha que o amigo exagerou? Grite <strong>NEM A PATO!</strong>
                </p>

                {/* Share Link Button */}
                <button
                  type="button"
                  onClick={copyInviteLink}
                  className="w-full py-2.5 px-4 rounded-2xl bg-amber-100 hover:bg-amber-200 border-2 border-slate-950 text-xs font-black text-slate-900 flex items-center justify-center gap-2 mb-4 transition-colors shadow-[2.5px_2.5px_0px_#090d16]"
                >
                  <Copy className="w-4 h-4 text-amber-700" />
                  <span>Copiar link de convite para amigos</span>
                </button>

                {/* Players Roster in Lobby */}
                <div className="w-full bg-slate-900/10 border-2 border-slate-950 rounded-2xl p-3 mb-5">
                  <div className="flex items-center justify-between mb-2.5 text-xs text-slate-800 font-black">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Patos na partida ({players.length}):
                    </span>
                    {isHost && (
                      <button
                        type="button"
                        onClick={addBot}
                        className="text-amber-800 hover:text-amber-950 font-black flex items-center gap-1 hover:underline"
                      >
                        <Plus className="w-3.5 h-3.5" /> Adicionar Bot
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 justify-center">
                    {players.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border-2 border-slate-950 text-xs text-slate-900 font-bold shadow-[2px_2px_0px_#090d16]"
                      >
                        <DuckAvatarIcon avatar={p.avatar} className="w-5 h-5" />
                        <span className="truncate max-w-[110px]">{p.name}</span>
                        {p.id === myId && <span className="text-[9px] text-amber-600 font-black">(Você)</span>}
                        {p.isBot && <Bot className="w-3 h-3 text-cyan-600" />}
                        {isHost && p.id !== myId && players.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removePlayer(p.id)}
                            className="text-slate-400 hover:text-rose-600 ml-1 p-0.5"
                            title="Remover"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Start Button */}
                {isHost ? (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={startMatch}
                    className="w-full py-4 px-6 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-base tracking-wider uppercase flex items-center justify-center gap-2 border-[3px] border-slate-950 shadow-[4px_5px_0px_#090d16] transition-all cursor-pointer"
                  >
                    <Play className="w-5 h-5 fill-slate-950" />
                    <span>INICIAR PARTIDA (GO!)</span>
                  </motion.button>
                ) : (
                  <div className="w-full py-3.5 px-4 rounded-2xl bg-slate-900 border-2 border-slate-950 text-amber-300 font-bold text-xs flex items-center justify-center gap-2 animate-pulse shadow-[3px_3px_0px_#090d16]">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>Aguardando o líder (Host) iniciar a partida...</span>
                  </div>
                )}
              </motion.div>
            </div>
          )}

          {/* ACTIVE GAMEPLAY VIEW */}
          {phase === 'playing' && (
            <div className="flex-1 flex flex-col gap-3 max-w-5xl mx-auto w-full min-h-0 overflow-hidden">
              {/* Question Trivia Physical Card */}
              <TriviaTableCard
                card={activeCard}
                round={round}
                totalRounds={totalRounds}
                penaltyMode={penaltyMode}
                isSquashing={isSquashing}
              />

              {/* Arena Centerpiece: Table & Controls */}
              <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-3 overflow-hidden">
                {/* Left Column: Tactile Escalada de Chutes Feed */}
                <div
                  className="md:col-span-5 flex flex-col rounded-3xl p-3 sm:p-3.5 min-h-0 overflow-hidden border-[3px] border-slate-950 shadow-[4px_5px_0px_#090d16]"
                  style={{ background: 'rgba(9, 13, 22, 0.75)' }}
                >
                  <div className="flex items-center justify-between text-xs font-black text-amber-300 mb-2 flex-shrink-0">
                    <span className="flex items-center gap-1.5 uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      ESCALADA DE CHUTES:
                    </span>
                    <span className="font-mono text-slate-300 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700">
                      {bids.length} na mesa
                    </span>
                  </div>

                  <div
                    ref={bidsContainerRef}
                    className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0 scroll-smooth"
                  >
                    {bids.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-teal-200/60 font-medium italic p-3 text-center">
                        Nenhum chute ainda. O primeiro pato da rodada pode chutar qualquer número inteiro positivo!
                      </div>
                    ) : (
                      bids.map((bid, idx) => {
                        const isLatest = idx === bids.length - 1
                        return (
                          <motion.div
                            key={bid.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`flex items-center justify-between p-2.5 rounded-2xl border-2 border-slate-950 text-xs transition-transform ${
                              bid.isDouble
                                ? 'bg-gradient-to-r from-orange-600 to-rose-600 text-white shadow-[3px_3px_0px_#090d16]'
                                : isLatest
                                ? 'bg-amber-400 text-slate-950 shadow-[3px_3px_0px_#090d16] font-bold'
                                : 'bg-slate-800/90 text-slate-200 shadow-[2px_2px_0px_#090d16]'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="p-1 rounded-lg bg-slate-950/20 border border-slate-950/30 flex-shrink-0">
                                <DuckAvatarIcon avatar={bid.playerAvatar} className="w-4 h-4" />
                              </span>
                              <span className="font-black truncate">{bid.playerName}</span>
                              {bid.isDouble && (
                                <span className="px-1.5 py-0.2 rounded-md text-[9px] font-black uppercase bg-yellow-300 text-slate-950 border border-slate-950 flex items-center gap-0.5">
                                  <Flame className="w-2.5 h-2.5 text-red-600" /> 2X
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 font-mono flex-shrink-0">
                              <span className="text-[10px] opacity-75">
                                (+{bid.delta.toLocaleString('pt-BR')})
                              </span>
                              <strong className="text-sm font-black">
                                {bid.value.toLocaleString('pt-BR')}
                              </strong>
                              <span className="text-[10px] opacity-80 uppercase">{activeCard.unit}</span>
                            </div>
                          </motion.div>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Right Column: Active Pile, Turn HUD & Player's Hand */}
                <div className="md:col-span-7 flex flex-col justify-between gap-2.5 min-h-0 overflow-y-auto pr-0.5">
                  {/* Turn Status Badge */}
                  <TactileTurnBadge
                    currentPlayer={currentPlayer}
                    isMyTurn={isMyTurn}
                    botThinking={botThinking}
                    timeLeft={timeLeft}
                    turnDuration={turnDuration}
                    currentBidValue={currentBidValue}
                    unit={activeCard.unit}
                  />

                  {/* Central Table Bid Pile */}
                  <TableBidPile
                    bids={bids}
                    activeCardUnit={activeCard.unit}
                    isSquashing={isSquashing}
                  />

                  {/* Player's Hand / Action Controls */}
                  <div
                    className="rounded-3xl p-3 sm:p-4 border-[3px] border-slate-950 flex flex-col gap-2 shadow-[4px_5px_0px_#090d16]"
                    style={{ background: 'rgba(9, 13, 22, 0.85)' }}
                  >
                    {isMyTurn ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs font-black text-amber-300">
                          <span className="uppercase tracking-wider">
                            Escolha uma carta ou digite um número maior:
                          </span>
                        </div>

                        {/* Hand Fan Layout (Mão em Leque) */}
                        <HandFan cards={playerHandCards} disabledAll={!isMyTurn} />

                        {/* Custom Number Input Chit */}
                        <form
                          onSubmit={handleManualBidSubmit}
                          className="flex items-center gap-2 pt-1"
                        >
                          <input
                            ref={inputRef}
                            type="number"
                            inputMode="numeric"
                            min={currentBidValue + 1}
                            placeholder={
                              currentBidValue > 0
                                ? `Outro valor (maior que ${currentBidValue})...`
                                : 'Digite qualquer chute...'
                            }
                            value={bidInput}
                            onChange={(e) => setBidInput(e.target.value)}
                            className="flex-1 px-3.5 py-2.5 rounded-2xl bg-slate-950 border-2 border-slate-700 text-white font-mono font-bold text-sm focus:outline-none focus:border-amber-400 transition-colors shadow-inner"
                          />

                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.96 }}
                            type="submit"
                            className="px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 border-2 border-slate-950 shadow-[2.5px_2.5px_0px_#090d16] cursor-pointer"
                          >
                            <span>Chutar</span>
                            <ArrowRight className="w-3.5 h-3.5 stroke-[3]" />
                          </motion.button>
                        </form>
                      </div>
                    ) : (
                      <div className="py-6 text-center text-xs text-teal-200/70 font-semibold flex items-center justify-center gap-2">
                        <DuckAvatarIcon avatar={currentPlayer.avatar} className="w-5 h-5 animate-bounce" />
                        <span>
                          Aguardando a jogada de <strong className="text-white">{currentPlayer.name}</strong>...
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Toast Notification */}
          <AnimatePresence>
            {toastMessage && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.9 }}
                className="absolute bottom-5 left-1/2 -translate-x-1/2 px-4 py-2 rounded-2xl bg-amber-400 border-2 border-slate-950 text-slate-950 text-xs font-black shadow-[4px_4px_0px_#090d16] z-50 flex items-center gap-2"
              >
                <RubberDuckToken className="w-4 h-4" />
                <span>{toastMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Right Sidebar: Table Roster & Physical Match Log */}
        <aside
          className="w-full lg:w-80 border-t-[3px] lg:border-t-0 lg:border-l-[3px] border-slate-950 p-3.5 sm:p-4 flex flex-col gap-3.5 overflow-y-auto"
          style={{ background: 'rgba(8, 29, 32, 0.9)' }}
        >
          {/* Players Roster */}
          <div
            className="rounded-3xl p-3.5 border-2 border-slate-950 shadow-[3px_4px_0px_#090d16]"
            style={{ background: 'rgba(9, 13, 22, 0.7)' }}
          >
            <div className="flex items-center justify-between mb-2.5 text-xs font-black text-amber-300">
              <span className="flex items-center gap-1.5 uppercase tracking-wider">
                <Users className="w-4 h-4 text-amber-400" /> Patos na Mesa ({players.length}):
              </span>
              <span className="text-[10px] text-teal-200/70 uppercase">Penalidade</span>
            </div>

            <div className="space-y-1.5">
              {players.map((p) => {
                const isTurn = phase === 'playing' && p.id === currentPlayer.id
                return (
                  <PlayerTokenCard
                    key={p.id}
                    player={p}
                    isCurrentTurn={isTurn}
                    isMe={p.id === myId}
                  />
                )
              })}
            </div>
          </div>

          {/* History Feed */}
          <div
            className="flex-1 rounded-3xl p-3.5 border-2 border-slate-950 shadow-[3px_4px_0px_#090d16] flex flex-col min-h-[160px]"
            style={{ background: 'rgba(9, 13, 22, 0.7)' }}
          >
            <span className="text-xs font-black text-amber-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Registro da Mesa
            </span>
            <div className="flex-1 overflow-y-auto space-y-1.5 text-xs text-slate-300 pr-1">
              {history.length === 0 ? (
                <span className="text-teal-200/50 italic text-[11px] font-medium">
                  As jogadas, blefes e desafios aparecerão aqui...
                </span>
              ) : (
                history.map((h) => (
                  <div
                    key={h.id}
                    className={`p-2 rounded-xl border-2 border-slate-950 text-[11px] font-bold leading-relaxed shadow-[1.5px_1.5px_0px_#090d16] ${
                      h.type === 'challenge'
                        ? 'bg-rose-600 text-white'
                        : h.type === 'double'
                        ? 'bg-orange-500 text-slate-950'
                        : 'bg-slate-800 text-slate-200'
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

      {/* REVEAL MODAL (SHOWDOWN) */}
      <AnimatePresence>
        {phase === 'revealing' && revealInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 30 }}
              transition={{ ease: [0.34, 1.56, 0.64, 1], duration: 0.4 }}
              className="max-w-lg w-full rounded-3xl p-6 text-center border-[3.5px] border-slate-950 shadow-[8px_10px_0px_#090d16] relative overflow-hidden"
              style={{ background: LINEN_TEXTURE }}
            >
              <div className="inline-block px-3 py-1 rounded-xl bg-rose-500 text-white font-black text-xs tracking-wider uppercase mb-2 border-2 border-slate-950 shadow-[2px_2px_0px_#090d16]">
                HORA DA VERDADE!
              </div>

              <h2 className="text-lg sm:text-xl font-black text-slate-950 mb-3">
                "{revealInfo.card.question}"
              </h2>

              {/* Side-by-Side Comparison */}
              <div className="grid grid-cols-2 gap-3 my-3">
                <div className="p-3 rounded-2xl bg-amber-100 border-2 border-slate-950 text-slate-950 shadow-[2px_2px_0px_#090d16]">
                  <span className="text-[10px] text-amber-900 uppercase font-black block mb-0.5">
                    ÚLTIMO CHUTE ({revealInfo.bidder.name})
                  </span>
                  <div className="text-2xl font-black font-mono">
                    {revealInfo.bidValue.toLocaleString('pt-BR')}
                  </div>
                  <span className="text-[10px] text-amber-800 uppercase font-bold">
                    {revealInfo.card.unit}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-rose-100 border-2 border-slate-950 text-slate-950 shadow-[2px_2px_0px_#090d16]">
                  <span className="text-[10px] text-rose-900 uppercase font-black block mb-0.5">
                    DESAFIADOR
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-rose-600">
                    NEM A PATO!
                  </div>
                  <span className="text-[10px] text-rose-800 uppercase font-bold truncate block">
                    {revealInfo.challenger.name}
                  </span>
                </div>
              </div>

              {/* Real Answer Reveal Banner */}
              <div className="my-4 p-4 rounded-2xl bg-sky-100 border-2 border-slate-950 text-slate-950 shadow-[3px_3px_0px_#090d16]">
                <span className="text-xs font-black tracking-wider text-sky-900 uppercase block mb-0.5">
                  A RESPOSTA REAL É:
                </span>
                <div className="text-4xl font-black text-sky-700 font-mono my-1 leading-none">
                  {revealInfo.realAnswer.toLocaleString('pt-BR')}{' '}
                  <span className="text-base text-slate-700 font-sans">{revealInfo.card.unit}</span>
                </div>
                <p className="text-xs text-slate-700 mt-2 font-medium italic leading-relaxed px-1">
                  "{revealInfo.card.fact}"
                </p>
              </div>

              {/* Verdict Ribbon */}
              <div
                className={`p-3.5 rounded-2xl border-2 border-slate-950 mb-5 text-xs sm:text-sm font-bold shadow-[3px_3px_0px_#090d16] ${
                  revealInfo.exceeded
                    ? 'bg-rose-500 text-white'
                    : 'bg-emerald-500 text-slate-950'
                }`}
              >
                {revealInfo.exceeded ? (
                  <div>
                    <strong className="block text-sm sm:text-base font-black mb-0.5 uppercase tracking-wide">
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
                    <strong className="block text-sm sm:text-base font-black mb-0.5 uppercase tracking-wide">
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

              {/* Next Round CTA */}
              {isHost ? (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    sound.click()
                    nextRound()
                  }}
                  className="w-full py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 border-[3px] border-slate-950 shadow-[4px_4px_0px_#090d16] cursor-pointer"
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
                <div className="w-full py-3 px-4 rounded-2xl bg-slate-900 border-2 border-slate-950 text-amber-300 font-bold text-xs flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400 animate-spin" />
                  <span>Aguardando o líder iniciar a próxima rodada...</span>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* GAME OVER MODAL (PODIUM) */}
      <AnimatePresence>
        {phase === 'gameover' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              className="max-w-md w-full rounded-3xl p-6 text-center border-[3.5px] border-slate-950 shadow-[8px_10px_0px_#090d16] relative overflow-hidden"
              style={{ background: LINEN_TEXTURE }}
            >
              <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-400 border-[3px] border-slate-950 flex items-center justify-center text-slate-950 mb-3 shadow-[3px_3px_0px_#090d16]">
                <Trophy className="w-9 h-9 stroke-[2.5]" />
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight leading-none mb-1">
                FIM DA PARTIDA!
              </h2>

              <p className="text-xs text-slate-700 font-semibold mb-4">
                Em <em>Nem a Pato!</em>, quem acumula <strong>menos patos</strong> é o grande campeão!
              </p>

              {/* The Big Duck / Biggest Loser Banner */}
              <div className="p-3.5 rounded-2xl bg-rose-500 border-2 border-slate-950 text-white mb-4 shadow-[3px_3px_0px_#090d16]">
                <span className="text-xs font-black uppercase tracking-wider mb-1 flex items-center justify-center gap-1.5">
                  <Crown className="w-4 h-4 text-yellow-300 inline" /> O GRANDE PATO DA VEZ (PAGOU O PATO!):
                </span>
                <div className="text-lg font-black flex items-center justify-center gap-2 mt-1">
                  <DuckAvatarIcon avatar={theBigDuck.avatar} className="w-6 h-6" />
                  <span>{theBigDuck.name}</span>
                </div>
                <div className="text-xs font-mono text-rose-100 mt-1 font-bold">
                  Acumulou {theBigDuck.ducksCount} patos e {theBigDuck.cardsCount} cartas de penalidade!
                </div>
              </div>

              {/* Leaderboard Table */}
              <div className="space-y-1.5 mb-5">
                {rankedPlayers.map((p, rank) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border-2 border-slate-950 text-xs shadow-[2px_2px_0px_#090d16] ${
                      rank === 0
                        ? 'bg-amber-300 text-slate-950 font-black'
                        : 'bg-white text-slate-900 font-bold'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm font-mono w-5 flex items-center justify-center">
                        {rank === 0 ? (
                          <Medal className="w-4 h-4 text-amber-700" />
                        ) : rank === 1 ? (
                          <Medal className="w-4 h-4 text-slate-500" />
                        ) : rank === 2 ? (
                          <Medal className="w-4 h-4 text-amber-800" />
                        ) : (
                          `#${rank + 1}`
                        )}
                      </span>
                      <DuckAvatarIcon avatar={p.avatar} className="w-5 h-5" />
                      <span className="truncate">{p.name}</span>
                    </div>

                    <div className="flex items-center gap-1 font-mono font-black text-slate-950">
                      <span>{p.ducksCount}</span>
                      <RubberDuckToken className="w-4 h-4" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Play Again CTA */}
              {isHost ? (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    sound.click()
                    setPhase('lobby')
                    syncToClients({ phase: 'lobby' })
                  }}
                  className="w-full py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 border-[3px] border-slate-950 shadow-[4px_4px_0px_#090d16] cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Jogar Novamente</span>
                </motion.button>
              ) : (
                <div className="text-xs text-slate-600 font-bold italic">
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
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm select-none">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-sm h-full border-l-[3.5px] border-slate-950 p-5 flex flex-col justify-between shadow-2xl overflow-y-auto"
              style={{ background: LINEN_TEXTURE }}
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b-2 border-slate-950 mb-4">
                  <h3 className="font-black text-slate-950 text-base flex items-center gap-2 uppercase tracking-wide">
                    <SlidersHorizontal className="w-4 h-4 text-amber-700" /> Configurações &amp; Sala
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      sound.click()
                      setDrawerOpen(false)
                    }}
                    className="p-1.5 rounded-xl text-slate-950 hover:bg-slate-200 border border-slate-950"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  {/* Status da Conexão P2P */}
                  <div className="p-3 rounded-2xl bg-white border-2 border-slate-950 flex items-center justify-between shadow-[2px_2px_0px_#090d16]">
                    <div className="flex items-center gap-2">
                      {connectionStatus.connected ? (
                        <Wifi className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <WifiOff className="w-4 h-4 text-amber-600 animate-pulse" />
                      )}
                      <div>
                        <div className="font-black text-slate-950">
                          {connectionStatus.connected ? 'Conexão P2P Ativa' : 'Conectando ao Lago...'}
                        </div>
                        <div className="text-[10px] text-slate-600 font-bold">
                          {isHost ? 'Você é o Host (Mesa)' : 'Você é Convidado'} · Sala: {roomCode}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Perfil: Nome & Avatar */}
                  <div className="p-3.5 rounded-2xl bg-white border-2 border-slate-950 shadow-[2px_2px_0px_#090d16]">
                    <label className="text-slate-950 font-black block mb-1.5 flex items-center gap-1.5 uppercase">
                      <UserCheck className="w-3.5 h-3.5 text-amber-700" /> Seu Nome no Lago:
                    </label>
                    <input
                      type="text"
                      maxLength={18}
                      value={myName}
                      onChange={(e) => setMyName(e.target.value)}
                      onBlur={() => handleSaveProfile(myName, myAvatar)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border-2 border-slate-950 text-slate-950 font-bold mb-3 shadow-inner"
                    />

                    <label className="text-slate-950 font-black block mb-1.5 uppercase">
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
                          className={`p-2 rounded-xl border-2 border-slate-950 flex items-center justify-center transition-transform ${
                            myAvatar === av
                              ? 'bg-amber-400 text-slate-950 shadow-[2px_2px_0px_#090d16] scale-105'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <DuckAvatarIcon avatar={av} className="w-6 h-6" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Entrar em Outra Sala */}
                  <form
                    onSubmit={handleManualJoinSubmit}
                    className="p-3.5 rounded-2xl bg-white border-2 border-slate-950 shadow-[2px_2px_0px_#090d16]"
                  >
                    <label className="text-slate-950 font-black block mb-1.5 flex items-center gap-1.5 uppercase">
                      <LogIn className="w-3.5 h-3.5 text-amber-700" /> Conectar a Outra Sala:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ex: PATO-1234"
                        value={joinInputCode}
                        onChange={(e) => setJoinInputCode(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border-2 border-slate-950 text-slate-950 font-mono font-bold uppercase shadow-inner"
                      />
                      <button
                        type="submit"
                        className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black border-2 border-slate-950 shadow-[2px_2px_0px_#090d16]"
                      >
                        Entrar
                      </button>
                    </div>
                  </form>

                  {/* Regras e Configurações da Partida (Host) */}
                  {isHost && (
                    <div className="p-3.5 rounded-2xl bg-white border-2 border-slate-950 space-y-3 shadow-[2px_2px_0px_#090d16]">
                      <span className="text-slate-950 font-black block uppercase">
                        Regras da Partida (Host):
                      </span>

                      <div>
                        <label className="text-slate-700 font-bold block mb-1">
                          Total de Rodadas:
                        </label>
                        <select
                          value={totalRounds}
                          onChange={(e) => {
                            sound.click()
                            const val = Number(e.target.value)
                            setTotalRounds(val)
                            syncToClients({ totalRounds: val })
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border-2 border-slate-950 text-slate-950 font-bold"
                        >
                          <option value={5}>5 Rodadas (Rápida)</option>
                          <option value={7}>7 Rodadas (Média)</option>
                          <option value={10}>10 Rodadas (Oficial)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-slate-700 font-bold block mb-1">
                          Tempo por Turno:
                        </label>
                        <select
                          value={turnDuration}
                          onChange={(e) => {
                            sound.click()
                            const val = Number(e.target.value)
                            setTurnDuration(val)
                            syncToClients({ turnDuration: val })
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border-2 border-slate-950 text-slate-950 font-bold"
                        >
                          <option value={15}>15 segundos (Pânico!)</option>
                          <option value={25}>25 segundos (Padrão)</option>
                          <option value={40}>40 segundos (Relax)</option>
                          <option value={0}>Sem tempo limite</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-slate-700 font-bold block mb-1">
                          Sistema de Penalidade:
                        </label>
                        <select
                          value={penaltyMode}
                          onChange={(e) => {
                            sound.click()
                            const val = e.target.value as 'ducks' | 'cards'
                            setPenaltyMode(val)
                            syncToClients({ penaltyMode: val })
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border-2 border-slate-950 text-slate-950 font-bold"
                        >
                          <option value="ducks">Patos das Cartas (1 a 3 patos)</option>
                          <option value="cards">1 Carta = 1 Ponto</option>
                        </select>
                      </div>

                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={addBot}
                          className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-black flex items-center justify-center gap-2 border-2 border-slate-950 shadow-[2px_2px_0px_#090d16]"
                        >
                          <Bot className="w-4 h-4 text-cyan-400" />
                          <span>Adicionar Mais um Bot</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t-2 border-slate-950 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    sound.click()
                    setPhase('lobby')
                    setDrawerOpen(false)
                    if (isHost) syncToClients({ phase: 'lobby' })
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-black uppercase tracking-wider border-2 border-slate-950 shadow-[3px_3px_0px_#090d16]"
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
