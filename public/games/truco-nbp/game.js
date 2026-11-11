/**
 * Truco Goiano · NBP Games
 * Suporte a 1v1 (Mano a Mano) e 2v2 (Duplas)
 * Motor de Baralho Real (NBPDeck), Manilhas Dinâmicas, Gritos de Truco e Bots de IA
 */

;(() => {
  // Ordem de valores do truco limpo
  const TRUCO_CARD_VALUES = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3']
  const SUIT_ORDER = ['diamonds', 'spades', 'hearts', 'clubs'] // Ouros (pica-fumo), Espadas (espadilha), Copas (copeta), Paus (zap)

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
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(140, t)
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.14)
      gain.gain.setValueAtTime(0.35, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16)
      osc.connect(gain)
      gain.connect(this.ctx.destination)
      osc.start(t)
      osc.stop(t + 0.16)
    }

    playTrucoShout() {
      if (!this.enabled) return
      this._init()
      if (!this.ctx) return
      const t = this.ctx.currentTime
      ;[349.23, 440, 523.25, 698.46].forEach((f, idx) => {
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(f, t + idx * 0.08)
        gain.gain.setValueAtTime(0.18, t + idx * 0.08)
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.25)
        osc.connect(gain)
        gain.connect(this.ctx.destination)
        osc.start(t + idx * 0.08)
        osc.stop(t + idx * 0.08 + 0.25)
      })
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
        osc.frequency.setValueAtTime(f, t + idx * 0.1)
        gain.gain.setValueAtTime(0.2, t + idx * 0.1)
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.1 + 0.3)
        osc.connect(gain)
        gain.connect(this.ctx.destination)
        osc.start(t + idx * 0.1)
        osc.stop(t + idx * 0.1 + 0.3)
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
        deck.push({ id: `${val}_${suit}`, value: val, suit })
      })
    })
    return shuffle(deck)
  }

  // Descobre a Manilha com base no Vira
  function getManilhaValue(viraVal) {
    const idx = TRUCO_CARD_VALUES.indexOf(String(viraVal).toUpperCase())
    if (idx < 0) return '4'
    return TRUCO_CARD_VALUES[(idx + 1) % TRUCO_CARD_VALUES.length]
  }

  // Força de uma carta no Truco Goiano
  function getCardPower(card, manilhaVal) {
    if (!card || card.covered) return 0 // Coberta perde sempre

    const isManilha = card.value === manilhaVal
    if (isManilha) {
      // 100 + ordem de naipe: Paus(3) > Copas(2) > Espadas(1) > Ouros(0)
      const suitPower = SUIT_ORDER.indexOf(card.suit)
      return 100 + suitPower
    }

    // Cartas normais (1 a 10): 3(10) > 2(9) > A(8) > K(7) > J(6) > Q(5) > 7(4) > 6(3) > 5(2) > 4(1)
    return TRUCO_CARD_VALUES.indexOf(card.value) + 1
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

    // Distribui 3 cartas para cada jogador
    state.players.forEach((p) => {
      p.hand = [state.deck.pop(), state.deck.pop(), state.deck.pop()]
    })

    // Vira
    state.vira = state.deck.pop()
    state.manilha = getManilhaValue(state.vira.value)

    state.phase = 'playing'
    state.dealerIdx = (state.dealerIdx + 1) % state.players.length
    state.roundStarterIdx = (state.dealerIdx + 1) % state.players.length
    state.turn = state.roundStarterIdx

    syncState()
    sound.playSlam()
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
      if (state.pendingBet) return // Não pode jogar se há aposta pendente
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
        resolveTrick()
      } else {
        state.turn = (state.turn + 1) % state.players.length
      }
      syncState()
      return
    }

    // 2. Pedir Truco / Aumentar
    if (action.type === 'SHOUT_TRUCO') {
      if (state.pendingBet) return
      const myTeam = player.team
      if (state.lastRaiseTeam === myTeam) return // Não pode aumentar sobre si mesmo

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
      const pointsWon = state.stake // Ganha os pontos do nível anterior
      awardHandToTeam(winningTeam, pointsWon)
      return
    }

    // 5. Responder Aposta: Aumentar (Truco -> Seis -> Nove -> Doze)
    if (action.type === 'RAISE_BET') {
      if (!state.pendingBet || state.pendingBet.challengerTeam === player.team) return
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

  function getNextBetLevel(current) {
    if (current === 1) return 3
    if (current === 3) return 6
    if (current === 6) return 9
    if (current === 9) return 12
    return null
  }

  // --- RESOLUÇÃO DE VAZA (QUEDA) ---
  function resolveTrick() {
    const trickCards = [...state.playedCardsInTrick]
    state.playedCardsInTrick = []

    let highestPower = -1
    let winnerCard = null
    let isTied = false

    trickCards.forEach((item) => {
      const power = getCardPower(item.card, state.manilha)
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

    // Quem ganhou joga primeiro na próxima vaza
    if (!isTied) {
      const winnerIdx = state.players.findIndex((p) => p.id === winnerCard.playerId)
      if (winnerIdx >= 0) state.turn = winnerIdx
    }

    state.currentTrick++

    // Checa se a mão foi decidida
    const handWinner = evaluateHandWinner(state.tricksHistory)
    if (handWinner) {
      setTimeout(() => {
        if (handWinner === 'tied_hand') {
          // Empatou tudo: ninguém pontua
          startNewHand()
        } else {
          awardHandToTeam(handWinner, state.stake)
        }
      }, 1200)
    }
  }

  // Avaliação clássica do Truco (Melhor de 3 com empates)
  function evaluateHandWinner(tricks) {
    const [t1, t2, t3] = tricks
    if (!t1) return null

    // Caso 1: Alguém fez 2 vazas
    const usWins = tricks.filter((t) => t === 'us').length
    const themWins = tricks.filter((t) => t === 'them').length
    if (usWins >= 2) return 'us'
    if (themWins >= 2) return 'them'

    // Caso 2: Empate na 1ª vaza -> Quem fizer a 2ª ganha
    if (t1 === 'tied' && t2) {
      if (t2 !== 'tied') return t2
      // Empate na 1ª e na 2ª -> Quem fizer a 3ª ganha
      if (t3 && t3 !== 'tied') return t3
      if (t3 === 'tied') return 'tied_hand'
    }

    // Caso 3: Empate na 2ª vaza -> Quem fez a 1ª ganha
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

    // Checa vitória da partida (12 pontos)
    if (state.scoreTeamUs >= 12 || state.scoreTeamThem >= 12) {
      state.phase = 'finished'
      state.winner = state.scoreTeamUs >= 12 ? 'us' : 'them'
      sound.playWin()
      syncState()
    } else {
      syncState()
      setTimeout(() => {
        startNewHand()
      }, 1500)
    }
  }

  // --- INTELIGÊNCIA ARTIFICIAL DOS BOTS TRUQUEIROS ---
  function scheduleBots() {
    clearTimeout(botActionTimer)
    if (!room.isHost || state.phase !== 'playing') return

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
    // Avalia força da mão do bot
    const handPowers = bot.hand.map((c) => getCardPower(c, state.manilha))
    const maxPower = Math.max(...handPowers, 0)
    const hasZap = bot.hand.some((c) => c.value === state.manilha && c.suit === 'clubs')

    if (hasZap || maxPower >= 100) {
      // Tem manilha forte: aceita ou aumenta
      if (Math.random() < 0.35 && state.pendingBet.level < 12) {
        handleHostAction({ type: 'RAISE_BET' }, { id: bot.id })
      } else {
        handleHostAction({ type: 'ACCEPT_BET' }, { id: bot.id })
      }
    } else if (maxPower >= 7) {
      // Tem 3 ou 2 ou Ás: 70% de aceitar
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
    // Pode pedir Truco antes de jogar?
    if (state.stake === 1 && state.lastRaiseTeam !== bot.team && Math.random() < 0.25) {
      const hasManilha = bot.hand.some((c) => c.value === state.manilha)
      if (hasManilha || Math.random() < 0.2) {
        handleHostAction({ type: 'SHOUT_TRUCO' }, { id: bot.id })
        return
      }
    }

    // Escolhe a melhor carta
    const sorted = [...bot.hand].sort((a, b) => getCardPower(a, state.manilha) - getCardPower(b, state.manilha))
    // 1ª rodada: joga a intermediária ou mais alta; 3ª rodada: a maior
    const cardToPlay = state.currentTrick === 0 && sorted.length === 3 ? sorted[1] : sorted[sorted.length - 1]

    handleHostAction({ type: 'PLAY_CARD', cardId: cardToPlay.id, covered: false }, { id: bot.id })
  }

  // --- RENDERIZAÇÃO DA INTERFACE ---
  function render() {
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

  function renderTable() {
    if (state.phase === 'lobby') return

    // Placar
    const usElem = document.getElementById('score-us')
    const themElem = document.getElementById('score-them')
    const stakeElem = document.getElementById('stake-badge')
    if (usElem) usElem.textContent = state.scoreTeamUs
    if (themElem) themElem.textContent = state.scoreTeamThem
    if (stakeElem) stakeElem.textContent = `VALE ${state.stake} ${state.stake === 1 ? 'TENTO' : 'TENTOS'}`

    // Vira e Manilha
    const viraSlot = document.getElementById('vira-card-slot')
    const manilhaHint = document.getElementById('manilha-hint')
    if (viraSlot && state.vira && window.NBPDeck) {
      viraSlot.innerHTML = window.NBPDeck.renderCard(state.vira.value, state.vira.suit)
    }
    if (manilhaHint && state.manilha) {
      manilhaHint.textContent = `MANILHA: ${state.manilha}`
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

    // Arena de Cartas Jogadas na Vaza
    const arena = document.getElementById('trick-cards-arena')
    if (arena) {
      if (state.playedCardsInTrick.length === 0) {
        arena.innerHTML = `<span style="font-size:0.8rem; color:#6ee7b7; opacity:0.7;">Aguardando jogadas...</span>`
      } else {
        arena.innerHTML = state.playedCardsInTrick
          .map((item) => {
            const isManilha = item.card.value === state.manilha
            const manilhaName = isManilha ? getManilhaName(item.card.suit) : ''
            const cardHtml = item.covered
              ? window.NBPDeck.renderCardBack()
              : window.NBPDeck.renderCard(item.card.value, item.card.suit, {
                  isManilha,
                  manilhaLabel: manilhaName,
                })

            return `
              <div class="played-trick-card" style="--rot:${item.rot}deg; text-align:center;">
                <div style="font-size:0.7rem; font-weight:800; color:#fde68a; margin-bottom:4px;">${item.playerName}</div>
                ${cardHtml}
              </div>
            `
          })
          .join('')
      }
    }

    // Banner de Desafio de Truco
    renderChallengeBanner()

    // Mão do Jogador Local
    renderLocalHand()
  }

  function renderChallengeBanner() {
    const banner = document.getElementById('truco-challenge-banner')
    const title = document.getElementById('challenge-banner-title')
    const actions = document.getElementById('challenge-banner-actions')
    if (!banner) return

    if (state.pendingBet) {
      banner.hidden = false
      const challenger = state.players.find((p) => p.id === state.pendingBet.challengerPlayerId)
      const myTeam = state.players.find((p) => p.id === room.profile.id)?.team
      const isMyTeamChallenged = state.pendingBet.challengerTeam !== myTeam

      const labels = { 3: 'TRUCO!', 6: 'SEIS!', 9: 'NOVE!', 12: 'DOZE!' }
      if (title) title.textContent = `🚨 ${challenger?.name || 'Alguém'} gritou ${labels[state.pendingBet.level]}!`

      if (isMyTeamChallenged && actions) {
        const nextLevel = getNextBetLevel(state.pendingBet.level)
        actions.innerHTML = `
          <button type="button" class="btn-accept" id="btn-accept-bet">Aceitar</button>
          ${nextLevel ? `<button type="button" class="btn-raise" id="btn-raise-bet">Pedir ${nextLevel}!</button>` : ''}
          <button type="button" class="btn-fold" id="btn-fold-bet">Correr</button>
        `

        document.getElementById('btn-accept-bet').onclick = () => sendAction({ type: 'ACCEPT_BET' })
        if (nextLevel) {
          document.getElementById('btn-raise-bet').onclick = () => sendAction({ type: 'RAISE_BET' })
        }
        document.getElementById('btn-fold-bet').onclick = () => sendAction({ type: 'FOLD_BET' })
      } else {
        if (actions) actions.innerHTML = `<span style="font-size:0.85rem; color:#fff;">Aguardando adversários responderem...</span>`
      }
    } else {
      banner.hidden = true
    }
  }

  function renderLocalHand() {
    const me = state.players.find((p) => p.id === room.profile.id)
    const cardsRow = document.getElementById('local-hand-cards')
    const turnInd = document.getElementById('turn-indicator')
    const trucoBtn = document.getElementById('btn-shout-truco')
    const coveredBtn = document.getElementById('btn-toggle-covered')

    if (!me) return
    const isMyTurn = state.players[state.turn]?.id === me.id

    if (turnInd) {
      turnInd.textContent = isMyTurn ? '👉 SUA VEZ! Clique em uma carta para jogar' : `Aguardando ${state.players[state.turn]?.name}...`
      turnInd.style.color = isMyTurn ? '#fde68a' : '#94a3b8'
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

      cardsRow.querySelectorAll('[data-card-id]').forEach((slot) => {
        slot.onclick = () => {
          if (!isMyTurn || state.pendingBet) return
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
      const nextLevel = getNextBetLevel(state.stake)
      trucoBtn.disabled = !nextLevel || state.lastRaiseTeam === me.team || state.pendingBet !== null
      trucoBtn.innerHTML = `<i data-lucide="flame"></i> ${nextLevel ? (nextLevel === 3 ? 'TRUCO!' : `PEDIR ${nextLevel}!`) : 'DOZE MÁXIMO'}`
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
})()
