import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Volume2,
  VolumeX,
  Trophy,
  Sparkles,
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
  ChevronRight,
  Info,
  Swords,
  Crown,
  Share2,
  SlidersHorizontal,
  X
} from 'lucide-react'
import type { TriviaCard, Player, Bid, RevealInfo, HistoryItem, DuckAvatar } from './types'
import { fetchCardsDatabase, FALLBACK_CARDS } from './cards'
import { decideBotTurn, BOT_NAMES } from './bot'
import { sound } from './sound'

const AVATARS: DuckAvatar[] = ['🦆', '🕶️', '🕵️', '🎩', '🤿', '👑', '🤖', '🤠']

function generateRoomCode(): string {
  const num = Math.floor(1000 + Math.random() * 9000)
  return `PATO-${num}`
}

export function NemAPatoGame() {
  // Game Configuration & State
  const [phase, setPhase] = useState<'lobby' | 'playing' | 'revealing' | 'gameover'>('lobby')
  const [cards, setCards] = useState<TriviaCard[]>(FALLBACK_CARDS)
  const [round, setRound] = useState(1)
  const [totalRounds, setTotalRounds] = useState(10)
  const [turnDuration, setTurnDuration] = useState(25)
  const [penaltyMode, setPenaltyMode] = useState<'ducks' | 'cards'>('ducks')
  const [soundEnabled, setSoundEnabled] = useState(true)

  // Room & Players
  const [roomCode, setRoomCode] = useState(generateRoomCode())
  const [players, setPlayers] = useState<Player[]>([
    { id: 'p1', name: 'Você (Pato Alpha)', avatar: '🦆', isBot: false, isHost: true, ducksCount: 0, cardsCount: 0 },
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

  const bidsContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load 400 questions on mount
  useEffect(() => {
    fetchCardsDatabase().then((db) => {
      if (db && db.length > 0) {
        setCards(db)
        setActiveCard(db[0])
      }
    })
  }, [])

  // Auto-scroll ONLY the internal bids container (without scrolling the page or question)
  useEffect(() => {
    if (bidsContainerRef.current) {
      bidsContainerRef.current.scrollTop = bidsContainerRef.current.scrollHeight
    }
  }, [bids])

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    const t = setTimeout(() => setToastMessage(null), 3200)
    return () => clearTimeout(t)
  }, [])

  // Turn Timer
  useEffect(() => {
    if (phase !== 'playing' || turnDuration <= 0) return

    if (timeLeft <= 0) {
      handleTimeout()
      return
    }

    if (timeLeft <= 5) {
      sound.tick()
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [phase, timeLeft, turnDuration])

  // Current active player
  const currentPlayer = players[currentTurnIndex] || players[0]
  const isMyTurn = !currentPlayer.isBot && phase === 'playing'
  const currentBidValue = bids.length > 0 ? bids[bids.length - 1].value : 0

  // Handle Timeout
  const handleTimeout = useCallback(() => {
    if (phase !== 'playing') return
    const timedOutPlayer = currentPlayer
    showToast(`⏱️ O tempo de ${timedOutPlayer.name} esgotou!`)

    if (bids.length > 0) {
      // Automatic Nem a Pato challenge
      handleChallenge(timedOutPlayer.id)
    } else {
      // Must bid at least 1
      executeBid(timedOutPlayer.id, 1, false)
    }
  }, [phase, currentPlayer, bids])

  // Bot Turn Handler
  useEffect(() => {
    if (phase !== 'playing' || !currentPlayer.isBot || botThinking) return

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
  }, [phase, currentTurnIndex, currentPlayer, activeCard, bids])

  // Start a new match
  function startMatch() {
    sound.quack()
    const shuffled = [...cards].sort(() => Math.random() - 0.5)
    setCards(shuffled)
    setActiveCard(shuffled[0])
    setRound(1)
    setBids([])
    setHistory([])
    setPlayers((prev) =>
      prev.map((p) => ({ ...p, ducksCount: 0, cardsCount: 0 }))
    )
    setCurrentTurnIndex(0)
    setTimeLeft(turnDuration)
    setPhase('playing')
    addHistoryItem('info', `🏁 Partida iniciada com ${players.length} patos no lago!`)
  }

  // Next Round
  function nextRound() {
    if (round >= totalRounds) {
      sound.fanfare()
      setPhase('gameover')
      return
    }

    const nextCardIndex = round % cards.length
    const nextCard = cards[nextCardIndex] || cards[0]
    setActiveCard(nextCard)
    setRound((prev) => prev + 1)
    setBids([])
    setRevealInfo(null)
    setPhase('playing')
    setTimeLeft(turnDuration)

    // Turn passes to the player after the previous bidder or challenger
    const nextPlayerIndex = (currentTurnIndex + 1) % players.length
    setCurrentTurnIndex(nextPlayerIndex)
    addHistoryItem('info', `🦆 Rodada ${round + 1} de ${totalRounds}: ${nextCard.category}`)
  }

  // Execute a Bid
  function executeBid(playerId: string, value: number, isDouble = false) {
    const player = players.find((p) => p.id === playerId)
    if (!player) return

    if (value <= currentBidValue && bids.length > 0) {
      showToast(`O palpite deve ser maior que ${currentBidValue}!`)
      return
    }

    const delta = bids.length > 0 ? value - currentBidValue : value

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

    setBids((prev) => [...prev, newBid])
    setBidInput('')

    const actionText = isDouble
      ? `🔥 ${player.name} DOBROU o palpite para ${value.toLocaleString('pt-BR')} ${activeCard.unit}!`
      : `📈 ${player.name} chutou ${value.toLocaleString('pt-BR')} ${activeCard.unit} (+${delta.toLocaleString('pt-BR')})`

    addHistoryItem(isDouble ? 'double' : 'bid', actionText)

    // Next player's turn
    const nextIdx = (currentTurnIndex + 1) % players.length
    setCurrentTurnIndex(nextIdx)
    setTimeLeft(turnDuration)
  }

  // Handle "NEM A PATO!" Challenge
  function handleChallenge(challengerId: string) {
    if (bids.length === 0) return

    sound.nemAPato()

    const challenger = players.find((p) => p.id === challengerId) || currentPlayer
    const lastBid = bids[bids.length - 1]
    const bidder = players.find((p) => p.id === lastBid.playerId) || players[0]
    const realAnswer = activeCard.answer
    const bidValue = lastBid.value

    const exceeded = bidValue > realAnswer
    const penaltyPlayer = exceeded ? bidder : challenger
    const penaltyDucks = penaltyMode === 'ducks' ? activeCard.ducks : 1

    // Apply penalties
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.id === penaltyPlayer.id) {
          return {
            ...p,
            ducksCount: p.ducksCount + penaltyDucks,
            cardsCount: p.cardsCount + 1
          }
        }
        return p
      })
    )

    setRevealInfo({
      bidder,
      challenger,
      bidValue,
      realAnswer,
      exceeded,
      penaltyPlayer,
      penaltyDucks,
      card: activeCard
    })

    const challengeLog = exceeded
      ? `🚨 NEM A PATO! ${bidder.name} EXAGEROU com ${bidValue.toLocaleString('pt-BR')} (Real: ${realAnswer.toLocaleString('pt-BR')})! Recebe +${penaltyDucks} patos!`
      : `🚨 NEM A PATO! ${challenger.name} DUVIDOU ERRADO! O chute ${bidValue.toLocaleString('pt-BR')} não passou de ${realAnswer.toLocaleString('pt-BR')}. Recebe +${penaltyDucks} patos!`

    addHistoryItem('challenge', challengeLog)
    setPhase('revealing')
  }

  function addHistoryItem(type: HistoryItem['type'], text: string) {
    setHistory((prev) => [
      { id: `${Date.now()}-${Math.random()}`, type, text, timestamp: Date.now() },
      ...prev.slice(0, 40)
    ])
  }

  function addBot() {
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
    setPlayers((prev) => [...prev, newBot])
    sound.quack()
    showToast(`🤖 ${pick.name} entrou no lago!`)
  }

  function removePlayer(id: string) {
    if (players.length <= 2) {
      showToast('Mínimo de 2 patos no jogo!')
      return
    }
    setPlayers((prev) => prev.filter((p) => p.id !== id))
  }

  function copyInviteLink() {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/jogos/nem-a-pato?room=${roomCode}` : ''
    navigator.clipboard?.writeText(url)
    setCopiedLink(true)
    showToast('Link de convite copiado!')
    setTimeout(() => setCopiedLink(false), 2000)
  }

  function handleManualBidSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isMyTurn) return
    const val = parseInt(bidInput, 10)
    if (isNaN(val) || val <= 0) {
      showToast('Digite um número válido maior que zero!')
      return
    }
    if (bids.length > 0 && val <= currentBidValue) {
      showToast(`Seu palpite deve ser maior que ${currentBidValue.toLocaleString('pt-BR')}!`)
      return
    }
    executeBid(currentPlayer.id, val, false)
  }

  function handleHelperAdd(add: number) {
    if (!isMyTurn) return
    const base = bids.length > 0 ? currentBidValue : 0
    executeBid(currentPlayer.id, base + add, false)
  }

  function handleDouble() {
    if (!isMyTurn || bids.length === 0) return
    executeBid(currentPlayer.id, currentBidValue * 2, true)
  }

  // Keyboard Shortcuts: Enter for bid, Space / N for "Nem a Pato!"
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (phase !== 'playing' || !isMyTurn) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if ((e.code === 'Space' || e.key.toLowerCase() === 'n') && bids.length > 0) {
        e.preventDefault()
        handleChallenge(currentPlayer.id)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [phase, isMyTurn, bids, currentPlayer])

  // Sorted players for game over podium (least ducks wins! highest ducks is O GRANDE PATO)
  const rankedPlayers = [...players].sort((a, b) => a.ducksCount - b.ducksCount)
  const theBigDuck = [...players].sort((a, b) => b.ducksCount - a.ducksCount)[0]

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
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-2xl shadow-lg shadow-amber-500/20 cursor-pointer"
            title="Quack!"
          >
            🦆
          </motion.div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5 font-mono">
                NEM A PATO!
              </h2>
              <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">
                Trivia &amp; Blefe
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
            title="Copiar link da sala"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
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
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl mb-4 shadow-inner">
                  🦆
                </div>
                <div className="inline-block px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 font-bold text-xs tracking-wider uppercase mb-2">
                  LAGO DOS PATOS
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
                  NEM A PATO!
                </h1>
                <p className="text-sm text-slate-300 mb-6 leading-relaxed">
                  Cada pato deve chutar um valor <strong>maior</strong> que o anterior sem estourar o número real. Acha que o amigo exagerou? Grite <strong>NEM A PATO!</strong>
                </p>

                {/* Roster Tags */}
                <div className="w-full bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 mb-6">
                  <div className="flex items-center justify-between mb-3 text-xs text-slate-400 font-medium">
                    <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Patos na partida ({players.length}):</span>
                    <button
                      type="button"
                      onClick={addBot}
                      className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar Bot
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {players.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700/70 text-xs text-slate-200"
                      >
                        <span className="text-base">{p.avatar}</span>
                        <span className="font-semibold">{p.name}</span>
                        {p.isBot && <Bot className="w-3 h-3 text-cyan-400" />}
                        {players.length > 2 && (
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

                {/* Start Match CTA Button */}
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={startMatch}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-extrabold text-base tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all"
                >
                  <Play className="w-5 h-5 fill-slate-950" />
                  INICIAR PARTIDA (GO!)
                </motion.button>
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
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-300">
                      <span className="text-[10px] text-amber-400 uppercase hidden sm:inline">Penalidade:</span>
                      <span>{'🦆'.repeat(penaltyMode === 'ducks' ? activeCard.ducks : 1)}</span>
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
                            <span className="text-base flex-shrink-0">{bid.playerAvatar}</span>
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
                        <span className="text-2xl">{currentPlayer.avatar}</span>
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
                            onClick={() => handleChallenge(currentPlayer.id)}
                            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 via-red-500 to-rose-600 hover:from-rose-500 hover:to-red-400 text-white font-extrabold text-sm sm:text-base tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 border border-rose-400/40"
                          >
                            <span className="text-xl">🦆🚨</span>
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
                <Users className="w-4 h-4 text-amber-400" /> Patos no Lago:
              </span>
              <span className="text-[10px] text-slate-500 uppercase">Penalidade</span>
            </div>

            <div className="space-y-2">
              {players.map((p, idx) => {
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
                      <span className="text-xl">{p.avatar}</span>
                      <div>
                        <div className="font-semibold flex items-center gap-1">
                          {p.name}
                          {p.isBot && <Bot className="w-3 h-3 text-cyan-400" />}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {p.cardsCount} carta(s)
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 font-mono font-bold text-amber-300">
                      <span>{p.ducksCount}</span>
                      <span>🦆</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Match Log */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2 text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-400" /> Acontecimentos:
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">AO VIVO</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 text-xs max-h-56 pr-1 font-sans">
              {history.length === 0 ? (
                <p className="text-slate-500 text-xs italic">Nenhum evento registrado ainda.</p>
              ) : (
                history.map((h) => (
                  <div key={h.id} className="text-slate-300 leading-relaxed border-b border-slate-800/50 pb-1.5 last:border-0">
                    {h.text}
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* DRAMATIC REVEAL MODAL */}
      <AnimatePresence>
        {phase === 'revealing' && revealInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="max-w-lg w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl text-center relative overflow-hidden"
            >
              {/* Header Stamp */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-500/20 text-rose-300 font-extrabold text-xs tracking-wider uppercase mb-4 border border-rose-500/40 animate-pulse">
                <ShieldAlert className="w-4 h-4" /> DESAFIO "NEM A PATO!" LANÇADO!
              </div>

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
                      <strong>{revealInfo.bidder.name}</strong> leva a penalidade (+{revealInfo.penaltyDucks} 🦆)!
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
                      <strong>{revealInfo.challenger.name}</strong> leva a penalidade (+{revealInfo.penaltyDucks} 🦆)!
                    </span>
                  </div>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={nextRound}
                className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
              >
                <span>{round >= totalRounds ? 'Ver Resultado Final 🏆' : 'Próxima Rodada ▶'}</span>
              </motion.button>
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
              <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl mb-3">
                🏆
              </div>
              <h2 className="text-2xl font-extrabold text-white mb-1">FIM DA PARTIDA!</h2>
              <p className="text-xs text-slate-400 mb-6">
                Em <em>Nem a Pato!</em>, quem acumula <strong>menos patos</strong> é o grande vencedor!
              </p>

              {/* The Big Duck (Biggest Loser / Grande Pato) */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-950/50 to-slate-950 border border-rose-500/30 mb-6">
                <span className="text-xs text-rose-300 font-extrabold uppercase tracking-wider block mb-1">
                  👑 O GRANDE PATO DA VEZ (PAGOU O PATO!):
                </span>
                <div className="text-xl font-extrabold text-white flex items-center justify-center gap-2">
                  <span>{theBigDuck.avatar}</span>
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
                      <span className="font-extrabold text-sm font-mono w-4">
                        {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `#${rank + 1}`}
                      </span>
                      <span className="text-base">{p.avatar}</span>
                      <span className="font-bold">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono font-bold">
                      <span>{p.ducksCount}</span>
                      <span>🦆</span>
                    </div>
                  </div>
                ))}
              </div>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setPhase('lobby')}
                className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
              >
                <RefreshCw className="w-4 h-4" /> Jogar Novamente
              </motion.button>
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
              className="w-full max-w-sm h-full bg-slate-900 border-l border-slate-800 p-5 flex flex-col justify-between shadow-2xl"
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-amber-400" /> Opções da Partida
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
                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">
                      Quantidade de Rodadas:
                    </label>
                    <select
                      value={totalRounds}
                      onChange={(e) => setTotalRounds(Number(e.target.value))}
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
                      onChange={(e) => setTurnDuration(Number(e.target.value))}
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
                      onChange={(e) => setPenaltyMode(e.target.value as 'ducks' | 'cards')}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-medium"
                    >
                      <option value="ducks">🦆 Patos das Cartas (1 a 3 patos)</option>
                      <option value="cards">🃏 1 Carta = 1 Ponto</option>
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
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setPhase('lobby')
                    setDrawerOpen(false)
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
