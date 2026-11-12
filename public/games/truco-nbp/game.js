/**
 * Truco Goiano · NBP Games
 * Suporte a 1v1 (Mano a Mano) e 2v2 (Duplas)
 * Mesa com aspectos em 3D (Three.js), Baralho Real e Regras de Truco Goiano:
 * Ordem: 5 < 6 < 7 < 8 < 9 < 10 < Q < J < K < A < 2 < 3
 * Sem 7 de copas nem 7 de ouros
 */

import { createTrucoTable } from './table3d.js'

// Ordem de valores do Truco Goiano: APENAS do 5 ao 10, com Manilhas Fixas nos 10
// Cartas normais: 5 < 6 < 7 (sem 7♥ e sem 7♦) < 8 < 9
// Manilhas Fixas: 10♦ (Ouros) < 10♠ (Espadas) < 10♥ (Copas) < 10♣ (Paus / Zap)
const TRUCO_CARD_VALUES = ['5', '6', '7', '8', '9', '10']
const FIXED_MANILHA = '10'
const SUIT_ORDER = ['diamonds', 'spades', 'hearts', 'clubs'] // Ouros (pica-fumo), Espadas (espadilha), Copas (copeta), Paus (zap)

let table3d = null

  // Sons sintetizados na Web Audio API
  class TrucoSound {
    constructor() {
      this.enabled = true
      this.ctx = null
    }

    _init() {
      if (!this.ctx && typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || window.webkitAudioContext
        if (AudioCtx) this.ctx = new AudioCtx()
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume()
      }
    }

    playSlam() {
      if (!this.enabled) return
      this._init()
      if (!this.ctx) return
      const t = this.ctx.currentTime

      // 1. Transiente inicial de estalo seco (card slap snap)
      const slapOsc = this.ctx.createOscillator()
      const slapGain = this.ctx.createGain()
      slapOsc.type = 'triangle'
      slapOsc.frequency.setValueAtTime(380, t)
      slapOsc.frequency.exponentialRampToValueAtTime(75, t + 0.045)
      slapGain.gain.setValueAtTime(0.42, t)
      slapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
      slapOsc.connect(slapGain)
      slapGain.connect(this.ctx.destination)
      slapOsc.start(t)
      slapOsc.stop(t + 0.05)

      // 2. Ruído filtrado do arremesso/estalo
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.04)
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25))
      }
      const noise = this.ctx.createBufferSource()
      noise.buffer = buffer
      const filter = this.ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(1400, t)
      filter.Q.setValueAtTime(1.5, t)
      const noiseGain = this.ctx.createGain()
      noiseGain.gain.setValueAtTime(0.28, t)
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04)
      noise.connect(filter)
      filter.connect(noiseGain)
      noiseGain.connect(this.ctx.destination)
      noise.start(t)

      // 3. Batida oca e grave da madeira/feltro
      const thudOsc = this.ctx.createOscillator()
      const thudGain = this.ctx.createGain()
      thudOsc.type = 'sine'
      thudOsc.frequency.setValueAtTime(125, t)
      thudOsc.frequency.exponentialRampToValueAtTime(32, t + 0.14)
      thudGain.gain.setValueAtTime(0.45, t)
      thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16)
      thudOsc.connect(thudGain)
      thudGain.connect(this.ctx.destination)
      thudOsc.start(t)
      thudOsc.stop(t + 0.16)
    }

    playShuffleDeal() {
      if (!this.enabled) return
      this._init()
      if (!this.ctx) return
      const t = this.ctx.currentTime

      const burstCount = 5
      for (let b = 0; b < burstCount; b++) {
        const startTime = t + b * 0.045
        const dur = 0.038
        const bufferSize = Math.floor(this.ctx.sampleRate * dur)
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1
        }
        const noise = this.ctx.createBufferSource()
        noise.buffer = buffer
        const filter = this.ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.setValueAtTime(1800 - b * 140, startTime)
        filter.Q.setValueAtTime(2.2, startTime)
        const gain = this.ctx.createGain()
        gain.gain.setValueAtTime(0.18, startTime)
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur)
        noise.connect(filter)
        filter.connect(gain)
        gain.connect(this.ctx.destination)
        noise.start(startTime)
      }
    }

    playTrickSweep() {
      if (!this.enabled) return
      this._init()
      if (!this.ctx) return
      const t = this.ctx.currentTime

      const dur = 0.32
      const bufferSize = Math.floor(this.ctx.sampleRate * dur)
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1
      }
      const noise = this.ctx.createBufferSource()
      noise.buffer = buffer
      const filter = this.ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(1100, t)
      filter.frequency.exponentialRampToValueAtTime(280, t + dur)
      filter.Q.setValueAtTime(1.8, t)
      const gain = this.ctx.createGain()
      gain.gain.setValueAtTime(0.01, t)
      gain.gain.linearRampToValueAtTime(0.24, t + 0.08)
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
      noise.connect(filter)
      filter.connect(gain)
      gain.connect(this.ctx.destination)
      noise.start(t)
    }

    playTrucoShout() {
      if (!this.enabled) return
      this._init()
      if (!this.ctx) return
      const t = this.ctx.currentTime

      // 1. Sub-bass boom
      const boomOsc = this.ctx.createOscillator()
      const boomGain = this.ctx.createGain()
      boomOsc.type = 'sine'
      boomOsc.frequency.setValueAtTime(120, t)
      boomOsc.frequency.exponentialRampToValueAtTime(32, t + 0.45)
      boomGain.gain.setValueAtTime(0.5, t)
      boomGain.gain.exponentialRampToValueAtTime(0.001, t + 0.48)
      boomOsc.connect(boomGain)
      boomGain.connect(this.ctx.destination)
      boomOsc.start(t)
      boomOsc.stop(t + 0.48)

      // 2. Acorde dramático tenso em staccato (A3, C4, Eb4, F#4)
      const freqs = [220, 261.63, 311.13, 369.99, 440]
      freqs.forEach((f, idx) => {
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(f, t + idx * 0.02)
        gain.gain.setValueAtTime(0.12, t + idx * 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.02 + 0.38)
        osc.connect(gain)
        gain.connect(this.ctx.destination)
        osc.start(t + idx * 0.02)
        osc.stop(t + idx * 0.02 + 0.38)
      })
    }

    playButton() {
      if (!this.enabled) return
      this._init()
      if (!this.ctx) return
      const t = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(620, t)
      osc.frequency.exponentialRampToValueAtTime(280, t + 0.04)
      gain.gain.setValueAtTime(0.15, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04)
      osc.connect(gain)
      gain.connect(this.ctx.destination)
      osc.start(t)
      osc.stop(t + 0.04)
    }

    playWin() {
      if (!this.enabled) return
      this._init()
      if (!this.ctx) return
      const t = this.ctx.currentTime
      ;[523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(f, t + idx * 0.09)
        gain.gain.setValueAtTime(0.24, t + idx * 0.09)
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.09 + 0.32)
        osc.connect(gain)
        gain.connect(this.ctx.destination)
        osc.start(t + idx * 0.09)
        osc.stop(t + idx * 0.09 + 0.32)
      })
    }
  }

  const sound = new TrucoSound()

  function shuffle(arr) {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

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
    return shuffle(deck)
  }

  // No Truco Goiano as manilhas são FIXAS: é SEMPRE os 10!
  function getManilhaValue() {
    return FIXED_MANILHA
  }

  // Força de uma carta no Truco Goiano (5 a 9 normais, e os 10 são as Manilhas Fixas)
  function getCardPower(card) {
    if (!card || card.covered) return 0 // Coberta perde sempre

    const isManilha = card.value === FIXED_MANILHA
    if (isManilha) {
      // Manilhas Fixas nos 10: Paus(3) > Copas(2) > Espadas(1) > Ouros(0)
      const suitPower = SUIT_ORDER.indexOf(card.suit)
      return 100 + suitPower
    }

    // Cartas normais (5 a 9): 5(1) < 6(2) < 7(3 - apenas ♠ e ♣) < 8(4) < 9(5)
    const normalIndex = ['5', '6', '7', '8', '9'].indexOf(card.value)
    return normalIndex >= 0 ? normalIndex + 1 : 0
  }

  function getManilhaName(suit) {
    if (suit === 'clubs') return 'ZAP (Paus)'
    if (suit === 'hearts') return 'COPETA (Copas)'
    if (suit === 'spades') return 'ESPADILHA (Espadas)'
    if (suit === 'diamonds') return 'PICA-FUMO (Ouros)'
    return 'MANILHA'
  }

  // --- ESTADO DO JOGO ---
  let state = {
    phase: 'lobby', // 'lobby' | 'playing' | 'finished'
    mode: '1v1', // '1v1' | '2v2'
    scoreTeamUs: 0, // Pontos Nós (Jogador 0 e 2)
    scoreTeamThem: 0, // Pontos Eles (Jogador 1 e 3)
    stake: 1, // 1 | 3 | 6 | 9 | 12
    lastRaiseTeam: null, // 'us' | 'them'
    pendingBet: null, // { level: 3|6|9|12, challengerTeam: 'us'|'them', challengerPlayerId: string }
    vira: null,
    manilha: null,
    deck: [],
    players: [],
    turn: 0,
    dealerIdx: 0,
    roundStarterIdx: 0,
    currentTrick: 0, // 0, 1, 2
    tricksHistory: [], // ['us', 'them', 'tied']
    playedCardsInTrick: [], // [{ playerId, card, covered, rot }]
    isResolvingTrick: false,
    handWinner: null,
    winner: null,
  }

  let botActionTimer = null
  let isCoveredMode = false

  // --- MULTIPLAYER P2P (NBPRoom) ---
  const room = new window.NBPRoom({
    gameId: 'truco-nbp',
    defaultPrefix: 'TRU',
    onStateSync: (remoteState) => {
      state = remoteState
      render()
    },
    onStatus: (status) => {
      const connElem = document.getElementById('connection-status')
      if (connElem) {
        if (status.error) {
          connElem.textContent = 'Erro de conexão ou sala não encontrada.'
          connElem.style.color = '#ef4444'
        } else if (status.connected) {
          connElem.textContent = `Conectado à sala ${status.roomCode}`
          connElem.style.color = '#34d399'
        } else {
          connElem.textContent = `Conectando à sala ${status.roomCode}...`
          connElem.style.color = '#f59e0b'
        }
      }
      if (status.connected && !room.isHost) {
        room.sendToHost({ type: 'JOIN_REQUEST', profile: room.profile })
      }
    },
    onAction: (action, profile) => {
      if (room.isHost) {
        handleHostAction(action, profile)
      } else if (action?.type === 'HOST_LEFT') {
        migrateHost(action.hostId)
      }
    },
  })

  function syncState() {
    render()
    if (room.isHost) {
      room.broadcastState(state)
      scheduleBots()
    }
  }

  function migrateHost(oldHostId) {
    if (!state) return
    const remaining = state.players
      .filter((p) => !p.isBot && !p.disconnected && p.id !== oldHostId)
      .sort((a, b) => a.id.localeCompare(b.id))

    if (remaining[0]?.id === room.profile.id) {
      room.promoteToHost(remaining)
      syncState()
    }
  }

  function initHostRoom(customCode = '') {
    const code = (customCode || `TRU-${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase()
    room.hostRoom(code)
    setupLobbyPlayers(state.mode)
    syncState()
    return code
  }

  function setupLobbyPlayers(mode) {
    state.mode = mode
    state.phase = 'lobby'
    state.scoreTeamUs = 0
    state.scoreTeamThem = 0
    state.stake = 1
    state.pendingBet = null

    if (mode === '1v1') {
      state.players = [
        { id: room.profile.id, name: room.profile.name || 'Você', team: 'us', isBot: false, hand: [] },
        { id: 'bot_rival', name: 'Zezão do Truco', team: 'them', isBot: true, hand: [] },
      ]
    } else {
      // 2v2: Sul(Você), Oeste(Rival 1), Norte(Parceiro), Leste(Rival 2)
      state.players = [
        { id: room.profile.id, name: room.profile.name || 'Você', team: 'us', isBot: false, hand: [] },
        { id: 'bot_rival1', name: 'Tião Carreiro', team: 'them', isBot: true, hand: [] },
        { id: 'bot_parceiro', name: 'Chico Mineiro', team: 'us', isBot: true, hand: [] },
        { id: 'bot_rival2', name: 'Tonico', team: 'them', isBot: true, hand: [] },
      ]
    }
  }

  // --- CONTROLE DE MÃO & EMBARALHAMENTO ---
  function startNewHand() {
    if (!room.isHost) return
    state.deck = createTrucoDeck()
    state.stake = 1
    state.lastRaiseTeam = null
    state.pendingBet = null
    state.currentTrick = 0
    state.tricksHistory = []
    state.playedCardsInTrick = []
    state.isResolvingTrick = false
    state.handWinner = null

    // Distribui 3 cartas para cada jogador
    state.players.forEach((p) => {
      p.hand = [state.deck.pop(), state.deck.pop(), state.deck.pop()]
    })

    // No Truco Goiano as manilhas são FIXAS: é SEMPRE os 10!
    state.manilha = FIXED_MANILHA
    state.vira = { id: '10_clubs', value: '10', suit: 'clubs' }

    state.phase = 'playing'
    state.dealerIdx = (state.dealerIdx + 1) % state.players.length
    state.roundStarterIdx = (state.dealerIdx + 1) % state.players.length
    state.turn = state.roundStarterIdx

    syncState()
    sound.playShuffleDeal()
  }

  // --- MÁQUINA DE ESTADOS & AÇÕES (HOST) ---
  function handleHostAction(action, profile) {
    if (!state || !action) return
    const actorId = profile?.id || action.playerId
    const player = state.players.find((p) => p.id === actorId)

    if (action.type === 'JOIN_REQUEST' && profile) {
      if (state.phase === 'lobby') {
        const slot = state.players.find((p) => p.isBot)
        if (slot) {
          slot.id = profile.id
          slot.name = profile.name
          slot.isBot = false
          syncState()
        }
      }
      return
    }

    if (action.type === 'SET_MODE' && room.isHost && state.phase === 'lobby') {
      setupLobbyPlayers(action.mode)
      syncState()
      return
    }

    if (action.type === 'START_GAME' && room.isHost && state.phase === 'lobby') {
      startNewHand()
      return
    }

    if (state.phase !== 'playing') return

    // 1. Jogar Carta na Vaza
    if (action.type === 'PLAY_CARD') {
      if (state.pendingBet || state.isResolvingTrick || state.handWinner) return // Não pode jogar se há aposta pendente ou mão/vaza decidida
      const active = state.players[state.turn]
      if (!active || active.id !== actorId) return

      const cardIdx = active.hand.findIndex((c) => c.id === action.cardId)
      if (cardIdx < 0) return

      const [card] = active.hand.splice(cardIdx, 1)
      const isCovered = !!action.covered && state.currentTrick > 0 // Cega permitida na 2ª e 3ª

      state.playedCardsInTrick.push({
        playerId: active.id,
        playerName: active.name,
        team: active.team,
        card,
        covered: isCovered,
        rot: Math.floor((Math.random() - 0.5) * 24),
      })

      sound.playSlam()

      // Checa se todos jogaram na vaza
      if (state.playedCardsInTrick.length === state.players.length) {
        state.isResolvingTrick = true
        clearTimeout(botActionTimer)
        syncState() // Sincroniza com as cartas repousadas na mesa para todos verem!

        // Pausa de 2.6 segundos para contemplar a vaza batida (não começa instantâneo)
        setTimeout(() => {
          resolveTrick()
        }, 2600)
      } else {
        state.turn = (state.turn + 1) % state.players.length
        syncState()
      }
      return
    }

    // 2. Pedir Truco / Aumentar
    if (action.type === 'SHOUT_TRUCO') {
      if (state.pendingBet || state.isResolvingTrick || state.handWinner) return
      const myTeam = player.team
      if (state.lastRaiseTeam === myTeam) return // Não pode aumentar sobre si mesmo

      // REGRA DE 11 PONTOS: Quem tem 11 pontos NÃO pode trucar! Se trucar perde a partida!
      const myTeamScore = myTeam === 'us' ? state.scoreTeamUs : state.scoreTeamThem
      if (myTeamScore >= 11) {
        const opponentTeam = myTeam === 'us' ? 'them' : 'us'
        sound.playWin()
        awardHandToTeam(opponentTeam, 12)
        return
      }

      const nextLevel = getNextBetLevel(state.stake)
      if (!nextLevel) return

      state.pendingBet = {
        level: nextLevel,
        challengerTeam: myTeam,
        challengerPlayerId: actorId,
      }
      sound.playTrucoShout()
      syncState()
      return
    }

    // 3. Responder Aposta: Aceitar
    if (action.type === 'ACCEPT_BET') {
      if (!state.pendingBet || state.pendingBet.challengerTeam === player.team) return
      state.stake = state.pendingBet.level
      state.lastRaiseTeam = state.pendingBet.challengerTeam
      state.pendingBet = null
      sound.playSlam()
      syncState()
      return
    }

    // 4. Responder Aposta: Correr / Fugir
    if (action.type === 'FOLD_BET') {
      if (!state.pendingBet || state.pendingBet.challengerTeam === player.team) return
      const winningTeam = state.pendingBet.challengerTeam
      const pointsWon = getFoldPoints(state.pendingBet.level)
      state.pendingBet = null
      state.handWinner = winningTeam
      state.isResolvingTrick = true
      clearTimeout(botActionTimer)
      awardHandToTeam(winningTeam, pointsWon)
      return
    }

    // 5. Responder Aposta: Aumentar (Truco -> Seis -> Nove -> Doze)
    if (action.type === 'RAISE_BET') {
      if (!state.pendingBet || state.pendingBet.challengerTeam === player.team) return

      // Quem tem 11 pontos NÃO pode aumentar nem trucar!
      const myTeamScore = player.team === 'us' ? state.scoreTeamUs : state.scoreTeamThem
      if (myTeamScore >= 11) {
        const opponentTeam = player.team === 'us' ? 'them' : 'us'
        sound.playWin()
        awardHandToTeam(opponentTeam, 12)
        return
      }

      const nextLevel = getNextBetLevel(state.pendingBet.level)
      if (!nextLevel) return

      state.stake = state.pendingBet.level
      state.pendingBet = {
        level: nextLevel,
        challengerTeam: player.team,
        challengerPlayerId: actorId,
      }
      sound.playTrucoShout()
      syncState()
      return
    }

    if (action.type === 'PLAY_AGAIN' && room.isHost) {
      state.scoreTeamUs = 0
      state.scoreTeamThem = 0
      state.phase = 'lobby'
      syncState()
    }
  }

  function getFoldPoints(pendingLevel) {
    // No Truco Goiano, quando correm do Truco dá apenas 1 tento (e não 2)
    if (pendingLevel === 3) return 1
    if (pendingLevel === 6) return 3
    if (pendingLevel === 9) return 6
    if (pendingLevel === 12) return 9
    return 1
  }

  function getNextBetLevel(current) {
    if (current === 1) return 3
    if (current === 3) return 6
    if (current === 6) return 9
    if (current === 9) return 12
    return null
  }

  // --- RESOLUÇÃO DE VAZA (QUEDA) ---
  function resolveTrick() {
    if (!room.isHost) return
    const trickCards = [...state.playedCardsInTrick]

    let highestPower = -1
    let winnerCard = null
    let isTied = false

    trickCards.forEach((item) => {
      const power = getCardPower(item.card)
      if (power > highestPower) {
        highestPower = power
        winnerCard = item
        isTied = false
      } else if (power === highestPower && highestPower > 0) {
        isTied = true
      }
    })

    const result = isTied ? 'tied' : winnerCard.team
    state.tricksHistory.push(result)

    // Checa se a mão já foi decidida (ex: ganhou 1ª e 2ª vazas, ou canga)
    const handWinner = evaluateHandWinner(state.tricksHistory)
    if (handWinner) {
      // Mão encerrada: NÃO avança nem joga a 3ª rodada!
      state.handWinner = handWinner
      state.isResolvingTrick = true
      clearTimeout(botActionTimer)
      syncState()

      // Pausa confortável para contemplar a vitória da mão antes de pontuar e embaralhar a próxima
      setTimeout(() => {
        if (table3d?.sweepCards) {
          table3d.sweepCards(result, () => {
            state.playedCardsInTrick = []
            if (handWinner === 'tied_hand') {
              state.isResolvingTrick = false
              state.handWinner = null
              startNewHand()
            } else {
              awardHandToTeam(handWinner, state.stake)
            }
          })
        } else {
          state.playedCardsInTrick = []
          if (handWinner === 'tied_hand') {
            state.isResolvingTrick = false
            state.handWinner = null
            startNewHand()
          } else {
            awardHandToTeam(handWinner, state.stake)
          }
        }
      }, 2400)
    } else {
      // Mão ainda em disputa: quem ganhou a vaza começa jogando a próxima
      if (!isTied) {
        const winnerIdx = state.players.findIndex((p) => p.id === winnerCard.playerId)
        if (winnerIdx >= 0) state.turn = winnerIdx
      }
      state.currentTrick++
      if (table3d?.sweepCards) {
        table3d.sweepCards(result, () => {
          state.playedCardsInTrick = []
          state.isResolvingTrick = false
          syncState()
        })
      } else {
        state.playedCardsInTrick = []
        state.isResolvingTrick = false
        syncState()
      }
    }
  }

  // Avaliação clássica do Truco (Melhor de 3 com empates)
  function evaluateHandWinner(tricks) {
    const [t1, t2, t3] = tricks
    if (!t1) return null

    // Caso 1: Alguém fez 2 vazas (se ganhou 1ª e 2ª, fecha a mão imediatamente sem jogar a 3ª)
    const usWins = tricks.filter((t) => t === 'us').length
    const themWins = tricks.filter((t) => t === 'them').length
    if (usWins >= 2) return 'us'
    if (themWins >= 2) return 'them'

    // Caso 2: Empate na 1ª vaza -> Quem fizer a 2ª ganha a mão imediatamente
    if (t1 === 'tied' && t2) {
      if (t2 !== 'tied') return t2
      // Empate na 1ª e na 2ª -> Quem fizer a 3ª ganha
      if (t3 && t3 !== 'tied') return t3
      if (t3 === 'tied') return 'tied_hand'
    }

    // Caso 3: Empate na 2ª vaza -> Quem fez a 1ª ganha a mão imediatamente
    if (t2 === 'tied') {
      return t1
    }

    // Caso 4: Empate na 3ª vaza -> Quem fez a 1ª ganha
    if (t3 === 'tied') {
      return t1
    }

    // Caso 5: Se chegou na 3ª e alguém venceu
    if (t3 && t3 !== 'tied') {
      return t3
    }

    return null
  }

  function awardHandToTeam(winningTeam, points) {
    if (winningTeam === 'us') {
      state.scoreTeamUs += points
    } else {
      state.scoreTeamThem += points
    }

    state.isResolvingTrick = true
    clearTimeout(botActionTimer)

    // Checa vitória da partida (12 pontos)
    if (state.scoreTeamUs >= 12 || state.scoreTeamThem >= 12) {
      state.phase = 'finished'
      state.winner = state.scoreTeamUs >= 12 ? 'us' : 'them'
      state.handWinner = null
      state.isResolvingTrick = false
      sound.playWin()
      syncState()
    } else {
      syncState()
      // Pausa de 2.4s para celebrar os tentos antes de embaralhar a próxima mão
      setTimeout(() => {
        state.isResolvingTrick = false
        state.handWinner = null
        startNewHand()
      }, 2400)
    }
  }

  // --- INTELIGÊNCIA ARTIFICIAL DOS BOTS TRUQUEIROS ---
  function scheduleBots() {
    clearTimeout(botActionTimer)
    if (!room.isHost || state.phase !== 'playing' || state.isResolvingTrick || state.handWinner) return

    // 1. Bot respondendo a Truco
    if (state.pendingBet) {
      const targetTeam = state.pendingBet.challengerTeam === 'us' ? 'them' : 'us'
      const botToRespond = state.players.find((p) => p.isBot && p.team === targetTeam)
      if (botToRespond) {
        botActionTimer = setTimeout(() => {
          decideBotBetResponse(botToRespond)
        }, 1400)
        return
      }
    }

    // 2. Bot jogando sua vez de carta
    const active = state.players[state.turn]
    if (active && active.isBot && active.hand.length > 0) {
      botActionTimer = setTimeout(() => {
        decideBotCardPlay(active)
      }, 1300)
    }
  }

  function decideBotBetResponse(bot) {
    const botTeamScore = bot.team === 'us' ? state.scoreTeamUs : state.scoreTeamThem
    const canRaise = botTeamScore < 11 && state.pendingBet.level < 12

    // Avalia força da mão do bot
    const handPowers = bot.hand.map((c) => getCardPower(c))
    const maxPower = Math.max(...handPowers, 0)
    const hasZap = bot.hand.some((c) => c.value === '10' && c.suit === 'clubs')

    if (hasZap || maxPower >= 100) {
      // Tem manilha forte (algum 10): aceita ou aumenta (se não estiver com 11)
      if (canRaise && Math.random() < 0.35) {
        handleHostAction({ type: 'RAISE_BET' }, { id: bot.id })
      } else {
        handleHostAction({ type: 'ACCEPT_BET' }, { id: bot.id })
      }
    } else if (maxPower >= 4) {
      // Tem 8 ou 9: 70% de aceitar
      if (Math.random() < 0.7) {
        handleHostAction({ type: 'ACCEPT_BET' }, { id: bot.id })
      } else {
        handleHostAction({ type: 'FOLD_BET' }, { id: bot.id })
      }
    } else {
      // Mão fraca: 65% de correr, 35% de blefar aceitando
      if (Math.random() < 0.65) {
        handleHostAction({ type: 'FOLD_BET' }, { id: bot.id })
      } else {
        handleHostAction({ type: 'ACCEPT_BET' }, { id: bot.id })
      }
    }
  }

  function decideBotCardPlay(bot) {
    const botTeamScore = bot.team === 'us' ? state.scoreTeamUs : state.scoreTeamThem
    // Na mão de 11 o bot JAMAIS pode pedir truco!
    if (botTeamScore < 11 && state.stake === 1 && state.lastRaiseTeam !== bot.team && Math.random() < 0.25) {
      const hasManilha = bot.hand.some((c) => c.value === '10')
      if (hasManilha || Math.random() < 0.2) {
        handleHostAction({ type: 'SHOUT_TRUCO' }, { id: bot.id })
        return
      }
    }

    // Escolhe a melhor carta
    const sorted = [...bot.hand].sort((a, b) => getCardPower(a) - getCardPower(b))
    // 1ª rodada: joga a intermediária ou mais alta; 3ª rodada: a maior
    const cardToPlay = state.currentTrick === 0 && sorted.length === 3 ? sorted[1] : sorted[sorted.length - 1]

    handleHostAction({ type: 'PLAY_CARD', cardId: cardToPlay.id, covered: false }, { id: bot.id })
  }

  function initTable3D() {
    if (table3d) return
    const canvas = document.getElementById('truco-canvas-3d')
    if (canvas) {
      table3d = createTrucoTable(canvas, {
        onSlam: () => sound.playSlam(),
        onSweep: () => sound.playTrickSweep(),
      })
    }
  }

  // --- RENDERIZAÇÃO DA INTERFACE ---
  function render() {
    initTable3D()
    if (table3d && state.phase !== 'lobby') {
      table3d.update(state, room.profile.id)
    }

    renderTopbar()
    renderLobby()
    renderTable()
    renderModals()

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons()
    }
  }

  function renderTopbar() {
    const codeElem = document.getElementById('room-code-display')
    if (codeElem) codeElem.textContent = room.roomCode || 'TRU-0000'
  }

  function renderLobby() {
    const lobby = document.getElementById('lobby-panel')
    const table = document.getElementById('game-table')
    const listElem = document.getElementById('lobby-player-list')

    if (state.phase === 'lobby') {
      if (lobby) lobby.hidden = false
      if (table) table.hidden = true

      if (listElem) {
        listElem.innerHTML = state.players
          .map((p) => {
            const teamLabel = p.team === 'us' ? 'Equipe Nós' : 'Equipe Eles'
            return `
              <div class="lobby-player-item">
                <div>
                  <strong>${p.name}</strong> ${p.id === room.profile.id ? '<span style="color:#fde68a;">(Você)</span>' : ''}
                  <span style="font-size:0.75rem; color:#6ee7b7; margin-left:6px;">[${teamLabel}]</span>
                </div>
                <div>${p.isBot ? '<span style="font-size:0.75rem; color:#cbd5e1;">Bot Truqueiro</span>' : 'Jogador Conectado'}</div>
              </div>
            `
          })
          .join('')
      }
    } else {
      if (lobby) lobby.hidden = true
      if (table) table.hidden = false
    }
  }

  let prevScoreUs = 0
  let prevScoreThem = 0

  function renderTable() {
    if (state.phase === 'lobby') return

    // Placar Físico de Tentos (Nós vs Eles)
    const usElem = document.getElementById('score-us')
    const themElem = document.getElementById('score-them')
    const stakeElem = document.getElementById('stake-badge')
    const scoreboard = document.querySelector('.truco-scoreboard')

    if (usElem) {
      if (state.scoreTeamUs !== prevScoreUs) {
        usElem.textContent = state.scoreTeamUs
        usElem.classList.remove('score-pulse')
        void usElem.offsetWidth
        usElem.classList.add('score-pulse')
        prevScoreUs = state.scoreTeamUs
      }
    }
    if (themElem) {
      if (state.scoreTeamThem !== prevScoreThem) {
        themElem.textContent = state.scoreTeamThem
        themElem.classList.remove('score-pulse')
        void themElem.offsetWidth
        themElem.classList.add('score-pulse')
        prevScoreThem = state.scoreTeamThem
      }
    }
    if (stakeElem) stakeElem.textContent = `VALE ${state.stake} ${state.stake === 1 ? 'TENTO' : 'TENTOS'}`

    // Regra de Mão de 11: Se Nós ou Eles tem 11 pontos, destaca o placar com moldura especial e alerta
    if (scoreboard) {
      const isHandOf11 = state.scoreTeamUs === 11 || state.scoreTeamThem === 11
      scoreboard.classList.toggle('is-hand-of-11', isHandOf11)
      let badge11 = scoreboard.querySelector('.hand-11-badge')
      if (isHandOf11) {
        if (!badge11) {
          badge11 = document.createElement('div')
          badge11.className = 'hand-11-badge'
          scoreboard.appendChild(badge11)
        }
        badge11.textContent = '⚠️ MÃO DE 11: TRUCO PROIBIDO'
      } else if (badge11) {
        badge11.remove()
      }
    }

    // Vazas (Melhor de 3)
    ;[1, 2, 3].forEach((idx) => {
      const dot = document.getElementById(`trick-dot-${idx}`)
      if (dot) {
        dot.className = 'trick-dot'
        const res = state.tricksHistory[idx - 1]
        if (res === 'us') dot.classList.add('team-us')
        else if (res === 'them') dot.classList.add('team-them')
        else if (res === 'tied') dot.classList.add('tied')
      }
    })

    // Oponentes na Mesa
    const ring = document.getElementById('opponents-ring')
    if (ring) {
      const opponents = state.players.filter((p) => p.id !== room.profile.id)
      ring.innerHTML = opponents
        .map((p) => {
          const isActive = state.players[state.turn]?.id === p.id
          const teamLabel = p.team === 'us' ? 'Parceiro' : 'Rival'
          return `
            <div class="player-spot ${isActive ? 'active-turn' : ''}">
              <div class="player-spot-name">
                <i data-lucide="${p.isBot ? 'bot' : 'user'}" style="width:14px;height:14px;"></i>
                <span>${p.name}</span>
                <span style="font-size:0.65rem; color:#6ee7b7;">(${teamLabel})</span>
              </div>
              <div class="player-spot-cards">
                ${p.hand.map(() => `<div class="spot-mini-card"></div>`).join('')}
              </div>
            </div>
          `
        })
        .join('')
    }

    // Banner de Desafio de Truco
    renderChallengeBanner()

    // Mão do Jogador Local
    renderLocalHand()
  }

  let lastChallengeBetLevel = null
  function renderChallengeBanner() {
    const banner = document.getElementById('truco-challenge-banner')
    const title = document.getElementById('challenge-banner-title')
    const actions = document.getElementById('challenge-banner-actions')
    const tableWrap = document.querySelector('.truco-table-wrap')
    if (!banner) return

    if (state.pendingBet) {
      banner.hidden = false
      const challenger = state.players.find((p) => p.id === state.pendingBet.challengerPlayerId)
      const myTeam = state.players.find((p) => p.id === room.profile.id)?.team
      const isMyTeamChallenged = state.pendingBet.challengerTeam !== myTeam

      const labels = { 3: 'TRUCO!', 6: 'SEIS!', 9: 'NOVE!', 12: 'DOZE!' }
      if (title) {
        title.innerHTML = `🚨 <strong>${challenger?.name || 'Alguém'}</strong> gritou <span class="shout-word">${labels[state.pendingBet.level]}</span>`
      }

      // Se for um novo grito/aumento, aplica carimbo com impacto cinemático e tremor na mesa
      if (lastChallengeBetLevel !== state.pendingBet.level) {
        lastChallengeBetLevel = state.pendingBet.level
        banner.classList.remove('impact-stamp')
        void banner.offsetWidth
        banner.classList.add('impact-stamp')

        if (tableWrap) {
          tableWrap.classList.add('arena-truco-shake', 'truco-tension-pulse')
          setTimeout(() => {
            tableWrap.classList.remove('arena-truco-shake')
          }, 200)
        }
        if (table3d?.triggerCameraShake) {
          table3d.triggerCameraShake(160, 0.08)
        }
      }

      if (isMyTeamChallenged && actions) {
        const myTeamScore = myTeam === 'us' ? state.scoreTeamUs : state.scoreTeamThem
        const nextLevel = getNextBetLevel(state.pendingBet.level)
        const canRaise = myTeamScore < 11 && nextLevel
        const foldPts = getFoldPoints(state.pendingBet.level)
        actions.innerHTML = `
          <button type="button" class="btn-accept" id="btn-accept-bet">Aceitar (${state.pendingBet.level} Tentos)</button>
          ${canRaise ? `<button type="button" class="btn-raise" id="btn-raise-bet">Pedir ${nextLevel}!</button>` : ''}
          <button type="button" class="btn-fold" id="btn-fold-bet">Correr (Dá ${foldPts} ${foldPts === 1 ? 'Tento' : 'Tentos'})</button>
        `

        document.getElementById('btn-accept-bet').onclick = () => {
          sound.playButton()
          sendAction({ type: 'ACCEPT_BET' })
        }
        if (canRaise) {
          document.getElementById('btn-raise-bet').onclick = () => {
            sound.playButton()
            sendAction({ type: 'RAISE_BET' })
          }
        }
        document.getElementById('btn-fold-bet').onclick = () => {
          sound.playButton()
          sendAction({ type: 'FOLD_BET' })
        }
      } else {
        if (actions) actions.innerHTML = `<span style="font-size:0.85rem; color:#fff;">Aguardando adversários responderem...</span>`
      }
    } else {
      banner.hidden = true
      lastChallengeBetLevel = null
      if (tableWrap) tableWrap.classList.remove('truco-tension-pulse')
    }
  }

  function setupHand3DHover(cardsRow) {
    if (!cardsRow) return
    const slots = cardsRow.querySelectorAll('.card-pick-slot')
    slots.forEach((slot) => {
      const cardEl = slot.querySelector('.real-card')
      if (!cardEl) return

      let sheen = cardEl.querySelector('.card-specular-sheen')
      if (!sheen) {
        sheen = document.createElement('div')
        sheen.className = 'card-specular-sheen'
        cardEl.appendChild(sheen)
      }

      slot.onpointermove = (e) => {
        const rect = slot.getBoundingClientRect()
        if (!rect.width || !rect.height) return
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const px = (x / rect.width) * 100
        const py = (y / rect.height) * 100
        const rotY = ((x - rect.width / 2) / (rect.width / 2)) * 14
        const rotX = -((y - rect.height / 2) / (rect.height / 2)) * 14

        cardEl.style.transform = `perspective(800px) rotateX(${rotX.toFixed(1)}deg) rotateY(${rotY.toFixed(1)}deg) translateY(-26px) scale(1.1)`
        sheen.style.opacity = '1'
        sheen.style.background = `radial-gradient(circle at ${px.toFixed(0)}% ${py.toFixed(0)}%, rgba(255, 255, 255, 0.42) 0%, rgba(255, 255, 255, 0) 65%)`
      }

      slot.onpointerleave = () => {
        cardEl.style.transform = ''
        sheen.style.opacity = '0'
      }
    })
  }

  function renderLocalHand() {
    const me = state.players.find((p) => p.id === room.profile.id)
    const cardsRow = document.getElementById('local-hand-cards')
    const turnInd = document.getElementById('turn-indicator')
    const trucoBtn = document.getElementById('btn-shout-truco')
    const coveredBtn = document.getElementById('btn-toggle-covered')

    if (!me) return
    const isMyTurn =
      state.phase === 'playing' &&
      state.players[state.turn]?.id === me.id &&
      !state.pendingBet &&
      !state.isResolvingTrick &&
      !state.handWinner

    if (turnInd) {
      if (state.handWinner) {
        const winnerName = state.handWinner === 'us' ? 'NÓS' : state.handWinner === 'them' ? 'ELES' : 'EMPATE'
        turnInd.textContent =
          state.handWinner === 'tied_hand'
            ? '🤝 Mão empatada! Embaralhando nova mão...'
            : `🎉 Equipe ${winnerName} venceu a mão (+${state.stake} tentos)!`
        turnInd.style.color = '#34d399'
      } else if (state.isResolvingTrick) {
        turnInd.textContent = '🃏 Conferindo vaza...'
        turnInd.style.color = '#60a5fa'
      } else {
        turnInd.textContent = isMyTurn ? '👉 SUA VEZ! Clique em uma carta para jogar' : `Aguardando ${state.players[state.turn]?.name}...`
        turnInd.style.color = isMyTurn ? '#fde68a' : '#94a3b8'
      }
    }

    if (cardsRow && window.NBPDeck) {
      cardsRow.innerHTML = me.hand
        .map((card, idx) => {
          const isManilha = card.value === state.manilha
          const mLabel = isManilha ? getManilhaName(card.suit) : ''
          const cardHtml = window.NBPDeck.renderCard(card.value, card.suit, {
            isManilha,
            manilhaLabel: mLabel,
            className: 'hand-card-interactive',
            style: `--fan: ${(idx - 1) * 7}deg;`,
          })

          return `<div data-card-id="${card.id}" class="card-pick-slot">${cardHtml}</div>`
        })
        .join('')

      setupHand3DHover(cardsRow)

      cardsRow.querySelectorAll('[data-card-id]').forEach((slot) => {
        slot.onclick = () => {
          if (!isMyTurn || state.pendingBet || state.isResolvingTrick || state.handWinner) return
          const cardId = slot.getAttribute('data-card-id')
          sendAction({
            type: 'PLAY_CARD',
            cardId,
            covered: isCoveredMode && state.currentTrick > 0,
          })
          isCoveredMode = false
          if (coveredBtn) coveredBtn.classList.remove('active')
        }
      })
    }

    if (trucoBtn) {
      const myTeamScore = me.team === 'us' ? state.scoreTeamUs : state.scoreTeamThem
      if (myTeamScore >= 11) {
        trucoBtn.disabled = true
        trucoBtn.title = 'Sua equipe está com 11 pontos e não pode trucar! Se trucar, perde o jogo.'
        trucoBtn.innerHTML = `<i data-lucide="shield-alert"></i> MÃO DE 11: NÃO PODE TRUCAR`
      } else {
        const nextLevel = getNextBetLevel(state.stake)
        trucoBtn.disabled =
          !nextLevel ||
          state.lastRaiseTeam === me.team ||
          state.pendingBet !== null ||
          state.isResolvingTrick ||
          !!state.handWinner
        trucoBtn.title = 'Pedir Truco / Aumentar aposta'
        trucoBtn.innerHTML = `<i data-lucide="flame"></i> ${nextLevel ? (nextLevel === 3 ? 'TRUCO!' : `PEDIR ${nextLevel}!`) : 'DOZE MÁXIMO'}`
      }
    }

    if (coveredBtn) {
      coveredBtn.style.display = state.currentTrick > 0 ? 'inline-flex' : 'none'
    }
  }

  function renderModals() {
    const overModal = document.getElementById('modal-game-over')
    if (overModal) {
      if (state.phase === 'finished' && state.winner) {
        overModal.hidden = false
        const title = document.getElementById('winner-title')
        const desc = document.getElementById('winner-desc')
        const myTeam = state.players.find((p) => p.id === room.profile.id)?.team
        const won = state.winner === myTeam
        if (title) title.textContent = won ? 'Vitória! Vocês venceram o Truco!' : 'Derrota! O adversário levou o jogo!'
        if (desc) desc.textContent = `Placar final: Nós ${state.scoreTeamUs} × ${state.scoreTeamThem} Eles`

        const againBtn = document.getElementById('btn-play-again')
        if (againBtn) {
          againBtn.style.display = room.isHost ? 'inline-flex' : 'none'
          againBtn.onclick = () => {
            overModal.hidden = true
            sendAction({ type: 'PLAY_AGAIN' })
          }
        }
      } else {
        overModal.hidden = true
      }
    }
  }

  function sendAction(actionData) {
    if (room.isHost) {
      handleHostAction(actionData, room.profile)
    } else {
      room.sendToHost(actionData)
    }
  }

  function copyRoomShareLink() {
    const code = room.roomCode || 'TRU-0000'
    let baseUrl = window.location.origin + window.location.pathname
    try {
      if (window.parent && window.parent.location && window.parent.location.origin) {
        baseUrl = `${window.parent.location.origin}/jogos/truco-nbp`
      }
    } catch {}

    const cleanUrl = `${baseUrl}?room=${encodeURIComponent(code)}`
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(cleanUrl)
    }
  }

  function setupDomEvents() {
    const copyBtn = document.getElementById('btn-copy-room')
    if (copyBtn) copyBtn.onclick = copyRoomShareLink

    const drawerToggle = document.getElementById('btn-toggle-drawer')
    const drawer = document.getElementById('room-drawer')
    if (drawerToggle && drawer) {
      drawerToggle.onclick = () => (drawer.hidden = !drawer.hidden)
    }

    const soundBtn = document.getElementById('btn-sound')
    if (soundBtn) {
      soundBtn.onclick = () => {
        sound.enabled = !sound.enabled
        soundBtn.setAttribute('aria-pressed', String(sound.enabled))
      }
    }

    const rulesBtn = document.getElementById('btn-rules')
    const rulesModal = document.getElementById('modal-rules')
    const closeRulesBtn = document.getElementById('btn-close-rules')
    if (rulesBtn && rulesModal) rulesBtn.onclick = () => (rulesModal.hidden = false)
    if (closeRulesBtn && rulesModal) closeRulesBtn.onclick = () => (rulesModal.hidden = true)

    // Seletor de Modo 1v1 vs 2v2
    document.querySelectorAll('.btn-mode').forEach((btn) => {
      btn.onclick = () => {
        document.querySelectorAll('.btn-mode').forEach((b) => b.classList.remove('active'))
        btn.classList.add('active')
        const mode = btn.getAttribute('data-mode')
        sendAction({ type: 'SET_MODE', mode })
      }
    })

    const startBtn = document.getElementById('btn-start-game')
    if (startBtn) {
      startBtn.onclick = () => sendAction({ type: 'START_GAME' })
    }

    const trucoBtn = document.getElementById('btn-shout-truco')
    if (trucoBtn) {
      trucoBtn.onclick = () => sendAction({ type: 'SHOUT_TRUCO' })
    }

    const coveredBtn = document.getElementById('btn-toggle-covered')
    if (coveredBtn) {
      coveredBtn.onclick = () => {
        isCoveredMode = !isCoveredMode
        coveredBtn.classList.toggle('active', isCoveredMode)
      }
    }

    const nicknameInput = document.getElementById('input-nickname')
    if (nicknameInput) {
      nicknameInput.value = room.profile.name || 'Você'
      nicknameInput.onchange = () => {
        const clean = nicknameInput.value.trim() || 'Truqueiro'
        room.setPlayerName(clean)
        if (!room.isHost) {
          room.sendToHost({ type: 'JOIN_REQUEST', profile: room.profile })
        } else {
          const me = state.players.find((p) => p.id === room.profile.id)
          if (me) me.name = clean
          syncState()
        }
      }
    }

    const joinBtn = document.getElementById('btn-join-room')
    const roomCodeInput = document.getElementById('input-room-code')
    if (joinBtn && roomCodeInput) {
      joinBtn.onclick = () => {
        const code = roomCodeInput.value.trim().toUpperCase()
        if (code) {
          room.joinRoom(code)
          room.sendToHost({ type: 'JOIN_REQUEST', profile: room.profile })
          if (drawer) drawer.hidden = true
        }
      }
    }

    const createBtn = document.getElementById('btn-create-room')
    if (createBtn) {
      createBtn.onclick = () => {
        initHostRoom()
        if (drawer) drawer.hidden = true
      }
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    setupDomEvents()
    const params = new URLSearchParams(window.location.search)
    const roomParam = params.get('room') || params.get('sala')
    const nicknameParam = params.get('nick') || params.get('nome')

    if (nicknameParam) room.setPlayerName(nicknameParam)

    if (roomParam) {
      room.joinRoom(roomParam.trim().toUpperCase())
      room.sendToHost({ type: 'JOIN_REQUEST', profile: room.profile })
    } else {
      initHostRoom()
    }

    render()
  })

