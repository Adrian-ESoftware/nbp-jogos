/**
 * Golpe de Estado · Jogo de Blefe, Dedução e Eliminação (Estilo Coup)
 * NBP Games · Multiplayer P2P (PeerJS / NBPRoom) & Bots de IA
 */

;(() => {
  // --- CONSTANTES & DEFINIÇÕES DA CORTE ---
  const CHARACTERS = {
    duke: {
      id: 'duke',
      name: 'Duque',
      action: 'tax',
      actionName: 'Taxar (+3 moedas)',
      canBlock: ['foreign_aid'],
      blockName: 'Bloquear Ajuda Externa',
      icon: 'crown',
      hint: 'Coleta 3 moedas do Tesouro. Bloqueia Ajuda Externa.',
      color: '#dfa938',
    },
    assassin: {
      id: 'assassin',
      name: 'Assassino',
      action: 'assassinate',
      actionName: 'Assassinar (-3 moedas)',
      canBlock: [],
      icon: 'skull',
      hint: 'Paga 3 moedas para eliminar 1 influência de um alvo.',
      color: '#ef4444',
    },
    captain: {
      id: 'captain',
      name: 'Capitão',
      action: 'steal',
      actionName: 'Extorquir (Rouba 2)',
      canBlock: ['steal'],
      blockName: 'Bloquear Extorsão',
      icon: 'anchor',
      hint: 'Rouba até 2 moedas de outro jogador. Bloqueia extorsões.',
      color: '#38bdf8',
    },
    ambassador: {
      id: 'ambassador',
      name: 'Embaixador',
      action: 'exchange',
      actionName: 'Trocar (2 Cartas)',
      canBlock: ['steal'],
      blockName: 'Bloquear Extorsão',
      icon: 'scale',
      hint: 'Compra 2 cartas da Corte, escolhe quais manter. Bloqueia extorsões.',
      color: '#10b981',
    },
    contessa: {
      id: 'contessa',
      name: 'Condessa',
      action: null,
      actionName: null,
      canBlock: ['assassinate'],
      blockName: 'Bloquear Assassinato',
      icon: 'shield',
      hint: 'Não possui ação ativa. Bloqueia tentativas de assassinato.',
      color: '#a855f7',
    },
  }

  const ACTIONS = {
    income: {
      id: 'income',
      name: 'Renda',
      character: null,
      cost: 0,
      requiresTarget: false,
      blockableBy: [],
      challengeable: false,
      description: 'Pega 1 moeda do Tesouro.',
    },
    foreign_aid: {
      id: 'foreign_aid',
      name: 'Ajuda Externa',
      character: null,
      cost: 0,
      requiresTarget: false,
      blockableBy: ['duke'],
      challengeable: false,
      description: 'Pega 2 moedas do Tesouro (bloqueável por Duque).',
    },
    coup: {
      id: 'coup',
      name: 'Golpe de Estado',
      character: null,
      cost: 7,
      requiresTarget: true,
      blockableBy: [],
      challengeable: false,
      description: 'Paga 7 moedas. O alvo perde 1 influência imediatamente.',
    },
    tax: {
      id: 'tax',
      name: 'Taxar (Duque)',
      character: 'duke',
      cost: 0,
      requiresTarget: false,
      blockableBy: [],
      challengeable: true,
      description: 'Pega 3 moedas do Tesouro.',
    },
    assassinate: {
      id: 'assassinate',
      name: 'Assassinar',
      character: 'assassin',
      cost: 3,
      requiresTarget: true,
      blockableBy: ['contessa'],
      challengeable: true,
      description: 'Paga 3 moedas para eliminar 1 influência do alvo.',
    },
    steal: {
      id: 'steal',
      name: 'Extorquir (Capitão)',
      character: 'captain',
      cost: 0,
      requiresTarget: true,
      blockableBy: ['captain', 'ambassador'],
      challengeable: true,
      description: 'Rouba até 2 moedas de um jogador alvo.',
    },
    exchange: {
      id: 'exchange',
      name: 'Trocar (Embaixador)',
      character: 'ambassador',
      cost: 0,
      requiresTarget: false,
      blockableBy: [],
      challengeable: true,
      description: 'Compra 2 cartas da Corte, junta com a mão e devolve 2.',
    },
  }

  // --- ÁUDIO SINTETIZADO (Web Audio API) ---
  class SoundManager {
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

    // 1. Tilintar metálico agudo de moedas batendo (frequências inarmônicas de ouro)
    playCoin() {
      if (!this.enabled) return
      this._init()
      if (!this.ctx) return
      try {
        const t = this.ctx.currentTime
        const partials = [2420, 3840, 5260, 7550]
        partials.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator()
          const gain = this.ctx.createGain()
          osc.type = idx % 2 === 0 ? 'sine' : 'triangle'
          const jitter = (Math.random() - 0.5) * 60
          osc.frequency.setValueAtTime(freq + jitter, t)
          osc.frequency.exponentialRampToValueAtTime(freq * 0.92, t + 0.12)

          const vol = 0.08 / (idx + 1)
          gain.gain.setValueAtTime(vol, t)
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14 + idx * 0.03)

          osc.connect(gain)
          gain.connect(this.ctx.destination)
          osc.start(t)
          osc.stop(t + 0.22)
        })
      } catch (_) {}
    }

    playCoinCascade(count = 3) {
      if (!this.enabled) return
      for (let i = 0; i < Math.min(count, 5); i++) {
        setTimeout(() => this.playCoin(), i * 65)
      }
    }

    // 2. Deslize pesado de carta na madeira ao revelar/comprar influência
    playCard() {
      if (!this.enabled) return
      this._init()
      if (!this.ctx) return
      try {
        const t = this.ctx.currentTime
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.14)
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4))
        }
        const noise = this.ctx.createBufferSource()
        noise.buffer = buffer

        const filter = this.ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.setValueAtTime(920, t)
        filter.frequency.exponentialRampToValueAtTime(320, t + 0.13)
        filter.Q.value = 1.4

        const gain = this.ctx.createGain()
        gain.gain.setValueAtTime(0.12, t)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14)

        noise.connect(filter)
        filter.connect(gain)
        gain.connect(this.ctx.destination)
        noise.start(t)

        // Impacto sutil na madeira
        const thud = this.ctx.createOscillator()
        const tGain = this.ctx.createGain()
        thud.type = 'triangle'
        thud.frequency.setValueAtTime(140, t)
        thud.frequency.exponentialRampToValueAtTime(45, t + 0.04)
        tGain.gain.setValueAtTime(0.08, t)
        tGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04)
        thud.connect(tGain)
        tGain.connect(this.ctx.destination)
        thud.start(t)
        thud.stop(t + 0.045)
      } catch (_) {}
    }

    // 3. Batida grave de martelo/tambor de tensão (Golpe de Estado ou Contestação)
    playWarDrum() {
      if (!this.enabled) return
      this._init()
      if (!this.ctx) return
      try {
        const t = this.ctx.currentTime
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(120, t)
        osc.frequency.exponentialRampToValueAtTime(32, t + 0.38)

        gain.gain.setValueAtTime(0.38, t)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42)

        osc.connect(gain)
        gain.connect(this.ctx.destination)
        osc.start(t)
        osc.stop(t + 0.42)

        // Impacto percussivo metálico/madeira do martelo
        const smack = this.ctx.createOscillator()
        const sGain = this.ctx.createGain()
        smack.type = 'triangle'
        smack.frequency.setValueAtTime(260, t)
        smack.frequency.exponentialRampToValueAtTime(50, t + 0.06)
        sGain.gain.setValueAtTime(0.22, t)
        sGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07)
        smack.connect(sGain)
        sGain.connect(this.ctx.destination)
        smack.start(t)
        smack.stop(t + 0.07)
      } catch (_) {}
    }

    playChallenge() {
      this.playWarDrum()
      if (!this.enabled) return
      this._init()
      if (!this.ctx) return
      try {
        const t = this.ctx.currentTime
        ;[185.0, 220.0, 277.18].forEach((f, idx) => {
          const osc = this.ctx.createOscillator()
          const gain = this.ctx.createGain()
          osc.type = 'sawtooth'
          osc.frequency.setValueAtTime(f, t + 0.04)
          osc.frequency.exponentialRampToValueAtTime(f * 0.95, t + 0.4)
          gain.gain.setValueAtTime(0.08, t + 0.04)
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45)
          osc.connect(gain)
          gain.connect(this.ctx.destination)
          osc.start(t + 0.04)
          osc.stop(t + 0.45)
        })
      } catch (_) {}
    }

    playSuccess() {
      if (!this.enabled) return
      this._init()
      if (!this.ctx) return
      const t = this.ctx.currentTime
      ;[523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc.frequency.setValueAtTime(freq, t + idx * 0.08)
        gain.gain.setValueAtTime(0.15, t + idx * 0.08)
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.25)
        osc.connect(gain)
        gain.connect(this.ctx.destination)
        osc.start(t + idx * 0.08)
        osc.stop(t + idx * 0.08 + 0.25)
      })
    }

    playElimination() {
      if (!this.enabled) return
      this._init()
      if (!this.ctx) return
      const t = this.ctx.currentTime
      ;[392.0, 329.63, 261.63, 196.0].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(freq, t + idx * 0.12)
        gain.gain.setValueAtTime(0.15, t + idx * 0.12)
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.12 + 0.3)
        osc.connect(gain)
        gain.connect(this.ctx.destination)
        osc.start(t + idx * 0.12)
        osc.stop(t + idx * 0.12 + 0.3)
      })
    }
  }

  const sound = new SoundManager()

  // --- AUXILIARES E EMBARALHAMENTO ---
  function shuffle(arr) {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  function createCourtDeck() {
    const deck = []
    const characters = ['duke', 'assassin', 'captain', 'ambassador', 'contessa']
    characters.forEach((char) => {
      for (let i = 0; i < 3; i++) {
        deck.push({
          id: `${char}_${i + 1}`,
          character: char,
        })
      }
    })
    return shuffle(deck)
  }

  // --- ESTADO DO JOGO ---
  let state = {
    phase: 'lobby', // 'lobby' | 'playing' | 'finished'
    turn: 0,
    treasury: 50,
    deck: [],
    players: [],
    pendingAction: null,
    // pendingAction: {
    //   type: 'action' | 'block',
    //   actionId: string,
    //   actorId: string,
    //   targetId: string | null,
    //   claimedCharacter: string | null,
    //   cost: number,
    //   blockerId: string | null,
    //   step: 'CHALLENGE_ACTION' | 'BLOCK_ACTION' | 'CHALLENGE_BLOCK',
    //   passedPlayerIds: [],
    //   deadline: number,
    // }
    loseInfluenceRequest: null,
    // { playerId: string, reason: string, resumeCallback: string }
    exchangeRequest: null,
    // { playerId: string, drawnCards: [], keepCount: number }
    winner: null,
    logs: [],
  }

  let reactionTimer = null
  let botDecisionTimer = null
  let scheduledBotTurn = null

  // --- MULTIPLAYER P2P (NBPRoom) ---
  const room = new window.NBPRoom({
    gameId: 'golpe-nbp',
    defaultPrefix: 'GOL',
    onStateSync: (remoteState) => {
      state = remoteState
      render()
    },
    onStatus: (status) => {
      const connElem = document.getElementById('connection-status')
      if (connElem) {
        if (status.error) {
          connElem.textContent = 'Erro de conexão ou sala não encontrada.'
          connElem.style.color = 'var(--crimson-400)'
        } else if (status.connected) {
          connElem.textContent = `Conectado à sala ${status.roomCode}`
          connElem.style.color = 'var(--emerald-400)'
        } else {
          connElem.textContent = `Conectando à sala ${status.roomCode}...`
          connElem.style.color = 'var(--gold-400)'
        }
      }
      if (status.connected && !room.isHost) {
        room.sendToHost({ type: 'JOIN_REQUEST', profile: room.profile })
      }
    },
    onError: (err) => {
      addLog(`Erro de rede: ${err.message}`)
    },
    onAction: (actionData, profile) => {
      if (room.isHost) {
        handleHostAction(actionData, profile)
      } else if (actionData?.type === 'HOST_LEFT') {
        migrateHost(actionData.hostId)
      }
    },
  })

  function syncState() {
    render()
    room.broadcastState(state)
    scheduleBots()
  }

  function addLog(message, type = 'normal') {
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text: message,
      type,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }
    state.logs.unshift(entry)
    if (state.logs.length > 50) state.logs.pop()
  }

  // --- MIGRAÇÃO DE HOST ---
  function migrateHost(oldHostId) {
    if (!state) return
    const remaining = state.players
      .filter((p) => !p.isBot && !p.disconnected && p.id !== oldHostId)
      .sort((a, b) => a.id.localeCompare(b.id))

    if (remaining[0]?.id === room.profile.id) {
      room.promoteToHost(remaining)
      addLog('O anfitrião saiu. A mesa foi transferida para você.', 'normal')
      syncState()
    }
  }

  // --- INICIALIZAÇÃO DE PARTIDA (HOST) ---
  function startGame() {
    if (!room.isHost) return
    if (state.players.length < 2 || state.players.length > 6) {
      showToast('O jogo precisa de 2 a 6 nobres na corte.')
      return
    }

    state.deck = createCourtDeck()
    state.turn = 0
    state.pendingAction = null
    state.loseInfluenceRequest = null
    state.exchangeRequest = null
    state.winner = null
    state.phase = 'playing'
    state.logs = []

    const isTwoPlayers = state.players.length === 2

    // Setup de moedas e 2 cartas por jogador
    state.players.forEach((player, idx) => {
      player.cards = [
        { ...state.deck.pop(), revealed: false },
        { ...state.deck.pop(), revealed: false },
      ]
      player.eliminated = false

      // Variante oficial de 2 jogadores:
      // O primeiro jogador começa com 1 moeda e o segundo com 2 moedas
      if (isTwoPlayers) {
        player.coins = idx === 0 ? 1 : 2
      } else {
        player.coins = 2
      }
    })

    const totalCoinsInHands = state.players.reduce((sum, p) => sum + p.coins, 0)
    state.treasury = 50 - totalCoinsInHands

    addLog('A assembleia da Corte Imperial foi declarada aberta!', 'action')
    if (isTwoPlayers) {
      addLog('Modo 1v1 oficial: Jogador 1 inicia com 1 moeda, Jogador 2 com 2 moedas.')
    }

    syncState()
    sound.playCard()
  }

  // --- MÁQUINA DE ESTADOS & RESOLUÇÃO DE AÇÕES (HOST) ---
  function handleHostAction(action, profile) {
    if (!state || !action) return
    const actorId = profile?.id || action.playerId
    const player = state.players.find((p) => p.id === actorId)

    // Gestão do Lobby
    if (action.type === 'JOIN_REQUEST' && profile) {
      if (state.phase === 'lobby' && state.players.length < 6) {
        if (!state.players.some((p) => p.id === profile.id)) {
          state.players.push({
            id: profile.id,
            name: profile.name || `Nobre ${state.players.length + 1}`,
            isBot: false,
            coins: 2,
            cards: [],
            eliminated: false,
          })
          addLog(`${profile.name} uniu-se à corte.`)
          syncState()
        }
      } else {
        // Reconexão de jogador existente
        const existing = state.players.find((p) => p.id === profile.id)
        if (existing && existing.disconnected) {
          existing.disconnected = false
          existing.isBot = false
          existing.name = profile.name
          addLog(`${existing.name} retornou à corte.`)
          syncState()
        }
      }
      return
    }

    if (action.type === 'PLAYER_LEFT') {
      const left = state.players.find((p) => p.id === action.playerId)
      if (left) {
        if (state.phase === 'playing' && !left.eliminated) {
          left.disconnected = true
          left.isBot = true
          left.name += ' (Bot)'
          addLog(`${left.name} desconectou; um conselheiro bot assume.`)
        } else {
          state.players = state.players.filter((p) => p.id !== action.playerId)
        }
        syncState()
      }
      return
    }

    if (action.type === 'ADD_BOT' && room.isHost && state.phase === 'lobby') {
      if (state.players.length < 6) {
        let n = 1
        while (state.players.some((p) => p.name === `Conselheiro ${n}`)) n++
        state.players.push({
          id: `bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: `Conselheiro ${n}`,
          isBot: true,
          difficulty: action.difficulty || 'normal',
          coins: 2,
          cards: [],
          eliminated: false,
        })
        syncState()
      }
      return
    }

    if (action.type === 'REMOVE_BOT' && room.isHost && state.phase === 'lobby') {
      const botIdx = state.players.findLastIndex((p) => p.isBot)
      if (botIdx >= 0) {
        state.players.splice(botIdx, 1)
        syncState()
      }
      return
    }

    if (action.type === 'START_GAME' && room.isHost && state.phase === 'lobby') {
      startGame()
      return
    }

    // Ações durante o jogo
    if (state.phase !== 'playing') return

    // 1. Declaração de Ação do Turno
    if (action.type === 'DECLARE_ACTION') {
      const activePlayer = getActivePlayer()
      if (!activePlayer || activePlayer.id !== actorId) return
      if (state.pendingAction || state.loseInfluenceRequest || state.exchangeRequest) return

      const actionDef = ACTIONS[action.actionId]
      if (!actionDef) return

      // Validação de moedas
      if (activePlayer.coins < actionDef.cost) {
        return
      }

      // Regra de ouro: Se tem 10+ moedas, DEVE dar golpe
      if (activePlayer.coins >= 10 && actionDef.id !== 'coup') {
        return
      }

      // Validação de alvo se necessário
      if (actionDef.requiresTarget) {
        const target = state.players.find((p) => p.id === action.targetId)
        if (!target || target.eliminated || target.id === activePlayer.id) return
      }

      // Processar pagamento do Assassino ou Golpe
      if (actionDef.id === 'coup') {
        activePlayer.coins -= 7
        state.treasury += 7
        sound.playWarDrum()
        table3D?.transferCoins(activePlayer.id === room.profile.id ? 'player' : 'opponent', 'treasury', 7)
        table3D?.triggerCameraShake(180)
        table3D?.flashLighting()
        addLog(`${activePlayer.name} desferiu um Golpe de Estado contra ${getPlayerName(action.targetId)}!`, 'action')
        promptLoseInfluence(action.targetId, 'Golpe de Estado', () => {
          advanceTurn()
        })
        syncState()
        return
      }

      if (actionDef.id === 'income') {
        activePlayer.coins += 1
        state.treasury = Math.max(0, state.treasury - 1)
        sound.playCoin()
        table3D?.transferCoins('treasury', activePlayer.id === room.profile.id ? 'player' : 'opponent', 1)
        addLog(`${activePlayer.name} pegou Renda (+1 moeda).`)
        advanceTurn()
        syncState()
        return
      }

      // Ações com possibilidade de desafio ou bloqueio
      state.pendingAction = {
        type: 'action',
        actionId: actionDef.id,
        actorId: activePlayer.id,
        targetId: action.targetId || null,
        claimedCharacter: actionDef.character,
        cost: actionDef.cost,
        blockerId: null,
        blockedWithCharacter: null,
        step: actionDef.challengeable ? 'CHALLENGE_ACTION' : 'BLOCK_ACTION',
        passedPlayerIds: [activePlayer.id],
        deadline: Date.now() + 9000,
      }

      if (actionDef.id === 'assassinate') {
        // Desconta as 3 moedas de imediato conforme a regra padrão
        activePlayer.coins -= 3
        state.treasury += 3
        sound.playWarDrum()
        table3D?.transferCoins(activePlayer.id === room.profile.id ? 'player' : 'opponent', 'treasury', 3)
        table3D?.triggerCameraShake(150)
        table3D?.flashLighting()
      }

      const targetStr = action.targetId ? ` contra ${getPlayerName(action.targetId)}` : ''
      addLog(`${activePlayer.name} declarou ${actionDef.name}${targetStr}!`, 'action')
      syncState()
      return
    }

    // 2. Reação: Passar
    if (action.type === 'PASS_REACTION') {
      if (!state.pendingAction) return
      if (!state.pendingAction.passedPlayerIds.includes(actorId)) {
        state.pendingAction.passedPlayerIds.push(actorId)
      }
      checkReactionResolved()
      return
    }

    // 3. Reação: Desafiar Ação
    if (action.type === 'CHALLENGE_ACTION') {
      if (!state.pendingAction || state.pendingAction.step !== 'CHALLENGE_ACTION') return
      resolveActionChallenge(actorId)
      return
    }

    // 4. Reação: Bloquear Ação
    if (action.type === 'BLOCK_ACTION') {
      if (!state.pendingAction || state.pendingAction.step !== 'BLOCK_ACTION') return
      const actionDef = ACTIONS[state.pendingAction.actionId]

      // Checa se quem está bloqueando tem permissão para isso
      if (state.pendingAction.actionId === 'foreign_aid') {
        // Qualquer um pode bloquear com Duque
        if (action.character !== 'duke') return
      } else if (state.pendingAction.actionId === 'assassinate') {
        // Apenas o alvo pode bloquear com Condessa
        if (actorId !== state.pendingAction.targetId || action.character !== 'contessa') return
      } else if (state.pendingAction.actionId === 'steal') {
        // Apenas o alvo pode bloquear com Capitão ou Embaixador
        if (
          actorId !== state.pendingAction.targetId ||
          (action.character !== 'captain' && action.character !== 'ambassador')
        ) {
          return
        }
      } else {
        return
      }

      state.pendingAction.step = 'CHALLENGE_BLOCK'
      state.pendingAction.blockerId = actorId
      state.pendingAction.blockedWithCharacter = action.character
      state.pendingAction.passedPlayerIds = [actorId]
      state.pendingAction.deadline = Date.now() + 9000

      sound.playChallenge()
      const charName = CHARACTERS[action.character].name
      addLog(`${getPlayerName(actorId)} declarou ter o ${charName} e bloqueou a ação!`, 'action')
      syncState()
      return
    }

    // 5. Reação: Desafiar Bloqueio
    if (action.type === 'CHALLENGE_BLOCK') {
      if (!state.pendingAction || state.pendingAction.step !== 'CHALLENGE_BLOCK') return
      resolveBlockChallenge(actorId)
      return
    }

    // 6. Resposta à perda de influência
    if (action.type === 'CHOOSE_LOSE_INFLUENCE') {
      if (!state.loseInfluenceRequest || state.loseInfluenceRequest.playerId !== actorId) return
      applyInfluenceLoss(actorId, action.cardId)
      return
    }

    // 7. Resposta à troca do Embaixador
    if (action.type === 'SUBMIT_EXCHANGE') {
      if (!state.exchangeRequest || state.exchangeRequest.playerId !== actorId) return
      applyExchange(actorId, action.keptCardIds)
      return
    }

    // 8. Reiniciar / Jogar Novamente
    if (action.type === 'PLAY_AGAIN' && room.isHost) {
      startGame()
      return
    }
  }

  // --- VERIFICAÇÃO AUTOMÁTICA DE RESOLUÇÃO DE REAÇÃO (TIMEOUT OU TODOS PASSARAM) ---
  function checkReactionResolved() {
    if (!state.pendingAction) return

    const alivePlayers = getAlivePlayers()
    const allPassed = alivePlayers.every((p) => state.pendingAction.passedPlayerIds.includes(p.id))

    if (allPassed || Date.now() >= state.pendingAction.deadline) {
      if (state.pendingAction.step === 'CHALLENGE_ACTION') {
        const actionDef = ACTIONS[state.pendingAction.actionId]
        if (actionDef.blockableBy.length > 0) {
          // Passa para a janela de bloqueio
          state.pendingAction.step = 'BLOCK_ACTION'
          state.pendingAction.passedPlayerIds = [state.pendingAction.actorId]
          state.pendingAction.deadline = Date.now() + 9000
          syncState()
        } else {
          // Sem bloqueios possíveis, executa a ação
          executeResolvedAction()
        }
      } else if (state.pendingAction.step === 'BLOCK_ACTION') {
        // Ninguém bloqueou, executa a ação original
        executeResolvedAction()
      } else if (state.pendingAction.step === 'CHALLENGE_BLOCK') {
        // Ninguém desafiou o bloqueio: Bloqueio bem-sucedido!
        addLog(
          `O bloqueio de ${getPlayerName(state.pendingAction.blockerId)} teve êxito. A ação de ${getPlayerName(state.pendingAction.actorId)} falhou.`,
          'normal'
        )
        state.pendingAction = null
        advanceTurn()
        syncState()
      }
    }
  }

  // --- RESOLUÇÃO DE DESAFIO À AÇÃO ---
  function resolveActionChallenge(challengerId) {
    const actionState = state.pendingAction
    const actor = state.players.find((p) => p.id === actionState.actorId)
    const challenger = state.players.find((p) => p.id === challengerId)
    const claimedChar = actionState.claimedCharacter

    sound.playChallenge()
    table3D?.triggerCameraShake(160)
    table3D?.flashLighting()
    addLog(`${challenger.name} desafiou a alegação de ${actor.name} de possuir o ${CHARACTERS[claimedChar].name}!`, 'challenge')

    // Checa se o ator tem a carta alegada viva
    const matchedCard = actor.cards.find((c) => !c.revealed && c.character === claimedChar)

    if (matchedCard) {
      // ATOR TINHA A CARTA: Desafiante perde 1 influência!
      addLog(`Verdadeiro! ${actor.name} revelou o ${CHARACTERS[claimedChar].name} e provou sua legitimidade!`, 'action')
      // Troca a carta do ator no baralho
      state.deck.push({ id: matchedCard.id, character: matchedCard.character })
      state.deck = shuffle(state.deck)
      const newCard = state.deck.pop()
      matchedCard.id = newCard.id
      matchedCard.character = newCard.character

      promptLoseInfluence(challengerId, 'Desafio Falho à Ação', () => {
        // Se a ação for bloqueável, vai para a janela de bloqueio; senão executa!
        const actionDef = ACTIONS[actionState.actionId]
        if (actionDef.blockableBy.length > 0) {
          actionState.step = 'BLOCK_ACTION'
          actionState.passedPlayerIds = [actor.id]
          actionState.deadline = Date.now() + 9000
          syncState()
        } else {
          executeResolvedAction()
        }
      })
    } else {
      // ATOR ESTAVA BLEFANDO: Ator perde 1 influência, ação é cancelada!
      addLog(`Blefe desmascarado! ${actor.name} não possuía o ${CHARACTERS[claimedChar].name}!`, 'challenge')
      state.pendingAction = null
      promptLoseInfluence(actor.id, 'Blefe de Ação Desmascarado', () => {
        advanceTurn()
      })
    }
    syncState()
  }

  // --- RESOLUÇÃO DE DESAFIO AO BLOQUEIO ---
  function resolveBlockChallenge(challengerId) {
    const actionState = state.pendingAction
    const blocker = state.players.find((p) => p.id === actionState.blockerId)
    const challenger = state.players.find((p) => p.id === challengerId)
    const claimedChar = actionState.blockedWithCharacter

    sound.playChallenge()
    table3D?.triggerCameraShake(160)
    table3D?.flashLighting()
    addLog(`${challenger.name} desafiou o bloqueio de ${blocker.name} com ${CHARACTERS[claimedChar].name}!`, 'challenge')

    const matchedCard = blocker.cards.find((c) => !c.revealed && c.character === claimedChar)

    if (matchedCard) {
      // BLOQUEADOR TINHA A CARTA: Desafiante perde 1 influência, bloqueio funciona!
      addLog(`Verdadeiro! ${blocker.name} revelou o ${CHARACTERS[claimedChar].name}. O bloqueio foi mantido!`, 'action')
      state.deck.push({ id: matchedCard.id, character: matchedCard.character })
      state.deck = shuffle(state.deck)
      const newCard = state.deck.pop()
      matchedCard.id = newCard.id
      matchedCard.character = newCard.character

      promptLoseInfluence(challengerId, 'Desafio Falho ao Bloqueio', () => {
        addLog(`A ação original de ${getPlayerName(actionState.actorId)} foi bloqueada com sucesso.`)
        state.pendingAction = null
        advanceTurn()
      })
    } else {
      // BLOQUEADOR ESTAVA BLEFANDO: Bloqueador perde 1 influência, ação original passa!
      addLog(`Blefe no bloqueio! ${blocker.name} não possuía o ${CHARACTERS[claimedChar].name}!`, 'challenge')
      promptLoseInfluence(blocker.id, 'Blefe de Bloqueio Desmascarado', () => {
        // Bloqueio falhou: ação original é executada!
        executeResolvedAction()
      })
    }
    syncState()
  }

  // --- EXECUÇÃO DA AÇÃO RESOLVIDA ---
  function executeResolvedAction() {
    if (!state.pendingAction) return
    const { actionId, actorId, targetId } = state.pendingAction
    const actor = state.players.find((p) => p.id === actorId)
    state.pendingAction = null

    if (actionId === 'income') {
      actor.coins += 1
      state.treasury = Math.max(0, state.treasury - 1)
      sound.playCoin()
      table3D?.transferCoins('treasury', actor.id === room.profile.id ? 'player' : 'opponent', 1)
      advanceTurn()
      syncState()
    } else if (actionId === 'foreign_aid') {
      actor.coins += 2
      state.treasury = Math.max(0, state.treasury - 2)
      sound.playCoinCascade(2)
      table3D?.transferCoins('treasury', actor.id === room.profile.id ? 'player' : 'opponent', 2)
      addLog(`${actor.name} recebeu Ajuda Externa (+2 moedas).`)
      advanceTurn()
      syncState()
    } else if (actionId === 'tax') {
      actor.coins += 3
      state.treasury = Math.max(0, state.treasury - 3)
      sound.playCoinCascade(3)
      table3D?.transferCoins('treasury', actor.id === room.profile.id ? 'player' : 'opponent', 3)
      addLog(`${actor.name} cobrou Taxa da Corte com o Duque (+3 moedas).`)
      advanceTurn()
      syncState()
    } else if (actionId === 'steal') {
      const target = state.players.find((p) => p.id === targetId)
      const stolen = Math.min(2, target.coins)
      target.coins -= stolen
      actor.coins += stolen
      sound.playCoinCascade(stolen)
      table3D?.transferCoins(target.id === room.profile.id ? 'player' : 'opponent', actor.id === room.profile.id ? 'player' : 'opponent', stolen)
      addLog(`${actor.name} extorquiu ${stolen} moedas de ${target.name} com o Capitão.`)
      advanceTurn()
      syncState()
    } else if (actionId === 'assassinate') {
      const target = state.players.find((p) => p.id === targetId)
      sound.playWarDrum()
      table3D?.triggerCameraShake(150)
      table3D?.flashLighting()
      addLog(`O assassinato de ${target.name} teve êxito!`, 'challenge')
      promptLoseInfluence(targetId, 'Assassinato Executado', () => {
        advanceTurn()
      })
      syncState()
    } else if (actionId === 'exchange') {
      sound.playCard()
      // Compra 2 cartas da Corte
      const drawnCards = [state.deck.pop(), state.deck.pop()].filter(Boolean)
      const activeCardsCount = actor.cards.filter((c) => !c.revealed).length

      if (actor.isBot) {
        // Bot escolhe automaticamente as melhores cartas
        const pool = [...actor.cards.filter((c) => !c.revealed), ...drawnCards]
        pool.sort((a, b) => {
          // Prioridade do bot: Duke / Captain > Contessa > Assassin > Ambassador
          const weight = { duke: 5, captain: 4, contessa: 3, assassin: 2, ambassador: 1 }
          return (weight[b.character] || 0) - (weight[a.character] || 0)
        })
        const kept = pool.slice(0, activeCardsCount)
        const returned = pool.slice(activeCardsCount)

        let kIdx = 0
        actor.cards.forEach((c) => {
          if (!c.revealed) {
            c.id = kept[kIdx].id
            c.character = kept[kIdx].character
            kIdx++
          }
        })
        returned.forEach((c) => state.deck.push(c))
        state.deck = shuffle(state.deck)

        addLog(`${actor.name} completou a troca de cartas com o Embaixador.`)
        advanceTurn()
        syncState()
      } else {
        // Humano: abre modal de troca
        state.exchangeRequest = {
          playerId: actor.id,
          drawnCards,
          keepCount: activeCardsCount,
        }
        syncState()
      }
    }
  }

  // --- PERDA DE INFLUÊNCIA ---
  function promptLoseInfluence(playerId, reason, callback) {
    const player = state.players.find((p) => p.id === playerId)
    if (!player || player.eliminated) {
      if (callback) callback()
      return
    }

    const aliveCards = player.cards.filter((c) => !c.revealed)
    if (aliveCards.length === 0) {
      if (callback) callback()
      return
    }

    if (aliveCards.length === 1) {
      // Perda direta e automática
      applyInfluenceLoss(playerId, aliveCards[0].id, callback)
    } else {
      // Tem 2 cartas: precisa escolher
      if (player.isBot) {
        // Bot escolhe uma carta menos valiosa para descartar
        const cardToLose = aliveCards[Math.floor(Math.random() * aliveCards.length)]
        applyInfluenceLoss(playerId, cardToLose.id, callback)
      } else {
        // Jogador humano
        state.loseInfluenceRequest = {
          playerId,
          reason,
          _callback: callback,
        }
        syncState()
      }
    }
  }

  function applyInfluenceLoss(playerId, cardId, directCallback = null) {
    const player = state.players.find((p) => p.id === playerId)
    if (!player) return

    const card = player.cards.find((c) => c.id === cardId)
    if (card && !card.revealed) {
      card.revealed = true
      sound.playElimination()
      const charName = CHARACTERS[card.character].name
      addLog(`${player.name} perdeu 1 influência e revelou seu ${charName}!`, 'challenge')
    }

    const remainingAlive = player.cards.filter((c) => !c.revealed).length
    if (remainingAlive === 0) {
      player.eliminated = true
      state.treasury += player.coins
      player.coins = 0
      addLog(`💀 ${player.name} perdeu todas as influências e foi EXILADO da corte!`, 'elimination')
    }

    const cb = directCallback || state.loseInfluenceRequest?._callback
    state.loseInfluenceRequest = null

    // Checa vitória
    if (checkVictory()) {
      syncState()
      return
    }

    if (cb) cb()
    syncState()
  }

  function applyExchange(playerId, keptCardIds) {
    const player = state.players.find((p) => p.id === playerId)
    if (!player || !state.exchangeRequest) return

    const pool = [...player.cards.filter((c) => !c.revealed), ...state.exchangeRequest.drawnCards]
    const keptCards = []
    const returnedCards = []

    pool.forEach((card) => {
      if (keptCardIds.includes(card.id) && keptCards.length < state.exchangeRequest.keepCount) {
        keptCards.push(card)
      } else {
        returnedCards.push(card)
      }
    })

    let kIdx = 0
    player.cards.forEach((c) => {
      if (!c.revealed) {
        c.id = keptCards[kIdx].id
        c.character = keptCards[kIdx].character
        kIdx++
      }
    })

    returnedCards.forEach((c) => state.deck.push(c))
    state.deck = shuffle(state.deck)

    addLog(`${player.name} completou a troca de cartas com o Embaixador.`)
    state.exchangeRequest = null
    advanceTurn()
    syncState()
  }

  // --- AVANÇO DE TURNO & VITÓRIA ---
  function advanceTurn() {
    if (checkVictory()) return
    const alivePlayers = getAlivePlayers()
    if (alivePlayers.length <= 1) return

    let nextTurn = (state.turn + 1) % state.players.length
    while (state.players[nextTurn].eliminated) {
      nextTurn = (nextTurn + 1) % state.players.length
    }
    state.turn = nextTurn
    addLog(`É a vez de ${state.players[state.turn].name}.`)
  }

  function checkVictory() {
    const alive = getAlivePlayers()
    if (alive.length === 1 && state.phase === 'playing') {
      state.phase = 'finished'
      state.winner = alive[0]
      addLog(`🏆 ${alive[0].name} eliminou todas as intrigas e assumiu o Trono Imperial!`, 'action')
      sound.playSuccess()
      return true
    }
    return false
  }

  function getActivePlayer() {
    return state.players[state.turn]
  }

  function getAlivePlayers() {
    return state.players.filter((p) => !p.eliminated)
  }

  function getPlayerName(id) {
    return state.players.find((p) => p.id === id)?.name || 'Desconhecido'
  }

  // --- INTELIGÊNCIA ARTIFICIAL DOS BOTS ---
  function scheduleBots() {
    if (!room.isHost || state.phase !== 'playing') {
      clearTimeout(botDecisionTimer)
      botDecisionTimer = null
      scheduledBotTurn = null
      return
    }

    // 1. Bot precisa escolher carta para perder influência
    if (state.loseInfluenceRequest) {
      const p = state.players.find((x) => x.id === state.loseInfluenceRequest.playerId)
      if (p && p.isBot) {
        botDecisionTimer = setTimeout(() => {
          const alive = p.cards.filter((c) => !c.revealed)
          if (alive.length > 0) {
            applyInfluenceLoss(p.id, alive[0].id)
          }
        }, 1200)
        return
      }
    }

    // 2. Bots reagindo à janela de desafio ou bloqueio
    if (state.pendingAction) {
      const botsToReact = getAlivePlayers().filter(
        (p) => p.isBot && !state.pendingAction.passedPlayerIds.includes(p.id)
      )

      if (botsToReact.length > 0) {
        botDecisionTimer = setTimeout(() => {
          botsToReact.forEach((bot) => decideBotReaction(bot))
          checkReactionResolved()
          syncState()
        }, 1400)
        return
      }
    }

    // 3. Bot executando sua ação de turno
    const active = getActivePlayer()
    if (active && active.isBot && !state.pendingAction && !state.loseInfluenceRequest && !state.exchangeRequest) {
      const key = `${active.id}_${active.coins}_${active.cards.map((c) => c.character).join(',')}`
      if (scheduledBotTurn === key) return
      scheduledBotTurn = key

      clearTimeout(botDecisionTimer)
      botDecisionTimer = setTimeout(() => {
        scheduledBotTurn = null
        decideBotTurnAction(active)
      }, 1600)
    }
  }

  function decideBotTurnAction(bot) {
    if (!room.isHost || state.phase !== 'playing' || getActivePlayer()?.id !== bot.id) return

    const opponents = getAlivePlayers().filter((p) => p.id !== bot.id)
    if (opponents.length === 0) return

    // Alvo mais perigoso (mais moedas)
    const sortedTargets = [...opponents].sort((a, b) => b.coins - a.coins)
    const target = sortedTargets[0]

    // Regra dos 10+: obrigatório golpe
    if (bot.coins >= 10) {
      handleHostAction({ type: 'DECLARE_ACTION', actionId: 'coup', targetId: target.id }, { id: bot.id })
      return
    }

    // Se tem 7 a 9 moedas: 70% de chance de golpe
    if (bot.coins >= 7 && Math.random() < 0.7) {
      handleHostAction({ type: 'DECLARE_ACTION', actionId: 'coup', targetId: target.id }, { id: bot.id })
      return
    }

    // Analisa cartas na mão
    const aliveCards = bot.cards.filter((c) => !c.revealed).map((c) => c.character)
    const hasAssassin = aliveCards.includes('assassin')
    const hasCaptain = aliveCards.includes('captain')
    const hasDuke = aliveCards.includes('duke')
    const hasAmbassador = aliveCards.includes('ambassador')

    // Se tem moedas para assassinar e tem o assassino
    if (bot.coins >= 3 && hasAssassin && Math.random() < 0.8) {
      handleHostAction({ type: 'DECLARE_ACTION', actionId: 'assassinate', targetId: target.id }, { id: bot.id })
      return
    }

    // Se tem o capitão e o alvo tem moedas
    if (hasCaptain && target.coins >= 1 && Math.random() < 0.85) {
      handleHostAction({ type: 'DECLARE_ACTION', actionId: 'steal', targetId: target.id }, { id: bot.id })
      return
    }

    // Se tem o Duque: cobra taxa
    if (hasDuke && Math.random() < 0.9) {
      handleHostAction({ type: 'DECLARE_ACTION', actionId: 'tax' }, { id: bot.id })
      return
    }

    // Blefe ocasional (25% chance de blefar Duque ou Capitão se não tiver)
    const bluffRoll = Math.random()
    if (bluffRoll < 0.2) {
      handleHostAction({ type: 'DECLARE_ACTION', actionId: 'tax' }, { id: bot.id })
      return
    }
    if (bluffRoll < 0.35 && target.coins >= 2) {
      handleHostAction({ type: 'DECLARE_ACTION', actionId: 'steal', targetId: target.id }, { id: bot.id })
      return
    }

    // Se tem Embaixador: troca cartas
    if (hasAmbassador && Math.random() < 0.6) {
      handleHostAction({ type: 'DECLARE_ACTION', actionId: 'exchange' }, { id: bot.id })
      return
    }

    // Opção padrão segura: Ajuda Externa ou Renda
    if (Math.random() < 0.6) {
      handleHostAction({ type: 'DECLARE_ACTION', actionId: 'foreign_aid' }, { id: bot.id })
    } else {
      handleHostAction({ type: 'DECLARE_ACTION', actionId: 'income' }, { id: bot.id })
    }
  }

  function decideBotReaction(bot) {
    const act = state.pendingAction
    if (!act) return

    const aliveCards = bot.cards.filter((c) => !c.revealed).map((c) => c.character)
    const actionDef = ACTIONS[act.actionId]

    // 1. Janela de Desafio à Ação
    if (act.step === 'CHALLENGE_ACTION') {
      // Contagem de cartas: se todas as 3 cópias do personagem já foram reveladas ou estão na mão do bot -> 100% de certeza de blefe!
      const revealedCount = state.players
        .flatMap((p) => p.cards)
        .filter((c) => c.revealed && c.character === act.claimedCharacter).length
      const inHandCount = aliveCards.filter((c) => c === act.claimedCharacter).length

      if (revealedCount + inHandCount >= 3) {
        handleHostAction({ type: 'CHALLENGE_ACTION' }, { id: bot.id })
        return
      }

      // Desconfiança moderada se o bot for Difícil ou se tiver cartas daquele personagem
      const challengeChance = inHandCount >= 2 ? 0.6 : 0.12
      if (Math.random() < challengeChance) {
        handleHostAction({ type: 'CHALLENGE_ACTION' }, { id: bot.id })
        return
      }

      // Senão passa
      handleHostAction({ type: 'PASS_REACTION' }, { id: bot.id })
      return
    }

    // 2. Janela de Bloqueio
    if (act.step === 'BLOCK_ACTION') {
      if (act.actionId === 'foreign_aid') {
        // Duque pode bloquear
        if (aliveCards.includes('duke') || Math.random() < 0.25) {
          handleHostAction({ type: 'BLOCK_ACTION', character: 'duke' }, { id: bot.id })
          return
        }
      } else if (act.actionId === 'assassinate' && act.targetId === bot.id) {
        // Alvo bloqueia com Condessa
        if (aliveCards.includes('contessa') || Math.random() < 0.45) {
          handleHostAction({ type: 'BLOCK_ACTION', character: 'contessa' }, { id: bot.id })
          return
        }
      } else if (act.actionId === 'steal' && act.targetId === bot.id) {
        // Alvo bloqueia com Capitão ou Embaixador
        if (aliveCards.includes('captain')) {
          handleHostAction({ type: 'BLOCK_ACTION', character: 'captain' }, { id: bot.id })
          return
        }
        if (aliveCards.includes('ambassador')) {
          handleHostAction({ type: 'BLOCK_ACTION', character: 'ambassador' }, { id: bot.id })
          return
        }
        if (Math.random() < 0.3) {
          handleHostAction({ type: 'BLOCK_ACTION', character: 'captain' }, { id: bot.id })
          return
        }
      }

      handleHostAction({ type: 'PASS_REACTION' }, { id: bot.id })
      return
    }

    // 3. Janela de Desafio ao Bloqueio
    if (act.step === 'CHALLENGE_BLOCK') {
      // O atacante original tem interesse forte em desafiar se o bloqueio parecer blefe
      if (act.actorId === bot.id) {
        const revealedCount = state.players
          .flatMap((p) => p.cards)
          .filter((c) => c.revealed && c.character === act.blockedWithCharacter).length
        const inHandCount = aliveCards.filter((c) => c === act.blockedWithCharacter).length

        if (revealedCount + inHandCount >= 3) {
          handleHostAction({ type: 'CHALLENGE_BLOCK' }, { id: bot.id })
          return
        }

        if (Math.random() < 0.25) {
          handleHostAction({ type: 'CHALLENGE_BLOCK' }, { id: bot.id })
          return
        }
      }

      handleHostAction({ type: 'PASS_REACTION' }, { id: bot.id })
    }
  }

  // --- INTERFACE DO USUÁRIO & RENDERIZAÇÃO ---
  function render() {
    renderTopbar()
    renderLobby()
    renderGameTable()
    renderModals()

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons()
    }
  }

  function renderTopbar() {
    const codeElem = document.getElementById('room-code-display')
    if (codeElem) {
      codeElem.textContent = room.roomCode || 'SALA-0000'
    }
  }

  function renderLobby() {
    const lobbyPanel = document.getElementById('lobby-panel')
    const gameTable = document.getElementById('game-table')
    const startBtn = document.getElementById('btn-start-game')

    if (state.phase === 'lobby') {
      if (lobbyPanel) lobbyPanel.hidden = false
      if (gameTable) gameTable.hidden = true

      const listElem = document.getElementById('lobby-player-list')
      if (listElem) {
        listElem.innerHTML = state.players
          .map((p, idx) => {
            const isLocal = p.id === room.profile.id
            const isHost = idx === 0
            return `
              <div class="lobby-player-item">
                <div class="lobby-player-info">
                  <span>${p.name}</span>
                  ${isLocal ? '<span style="font-size:0.7rem; color:var(--gold-400);">(Você)</span>' : ''}
                  ${isHost ? '<span class="host-badge">Anfitrião</span>' : ''}
                  ${p.isBot ? '<span class="bot-badge">Conselheiro IA</span>' : ''}
                </div>
                <div>
                  <span style="font-size:0.8rem; color:var(--text-muted)">Pronto</span>
                </div>
              </div>
            `
          })
          .join('')
      }

      if (startBtn) {
        startBtn.style.display = room.isHost ? 'inline-flex' : 'none'
        startBtn.disabled = state.players.length < 2 || state.players.length > 6
      }
    } else {
      if (lobbyPanel) lobbyPanel.hidden = true
      if (gameTable) gameTable.hidden = false
    }
  }

  function renderGameTable() {
    if (state.phase === 'lobby') return

    // 1. Oponentes na Borda da Mesa Imperial
    const opponentsRow = document.getElementById('opponents-row')
    if (opponentsRow) {
      const opponents = state.players.filter((p) => p.id !== room.profile.id)
      opponentsRow.innerHTML = opponents
        .map((p) => {
          const isActive = state.players[state.turn]?.id === p.id
          const isEliminated = p.eliminated
          return `
            <div class="opponent-seat ${isActive ? 'active-turn' : ''} ${isEliminated ? 'eliminated' : ''}">
              <div class="opponent-seat-header">
                <span class="opponent-seat-name" title="${p.name}">
                  ${p.isBot ? '<i data-lucide="bot" style="width:14px;height:14px;"></i>' : '<i data-lucide="user" style="width:14px;height:14px;"></i>'}
                  ${p.name}
                </span>
                <span class="opponent-seat-coins">
                  <i data-lucide="coins" style="width:13px;height:13px;"></i>
                  ${p.coins}
                </span>
              </div>
              <div class="opponent-cards-fan">
                ${p.cards
                  .map((card, cIdx) => {
                    if (card.revealed) {
                      const char = CHARACTERS[card.character]
                      return `
                        <div class="mini-court-card revealed" title="Eliminada: ${char.name}">
                          <i data-lucide="${char.icon}" style="width:16px;height:16px;"></i>
                        </div>
                      `
                    }
                    const fanDeg = cIdx === 0 ? '-6deg' : '6deg'
                    return `
                      <div class="mini-court-card back" style="transform: rotate(${fanDeg});" title="Influência Oculta da Corte">
                        <i data-lucide="shield" style="width:16px;height:16px;"></i>
                      </div>
                    `
                  })
                  .join('')}
              </div>
            </div>
          `
        })
        .join('')
      setupCard3DHover()
    }

    // 2. Stats Centrais & Log da Corte
    const treasuryElem = document.getElementById('treasury-count')
    const deckElem = document.getElementById('deck-count')
    if (treasuryElem) treasuryElem.textContent = state.treasury
    if (deckElem) deckElem.textContent = `${state.deck.length} Cartas`

    if (table3D) {
      table3D.updateTreasury(state.treasury)
      table3D.updateDeck(state.deck.length)
    }

    const feedElem = document.getElementById('court-log-feed')
    if (feedElem) {
      feedElem.innerHTML = state.logs
        .map((log) => `<div class="log-entry log-${log.type}"><span>[${log.time}]</span> <strong>${log.text}</strong></div>`)
        .join('')
    }

    // 3. Banner de Reação
    renderReactionBar()

    // 4. Jogador Local
    renderLocalPlayer()
    initTableCanvas()
  }

  function renderReactionBar() {
    const reactionBar = document.getElementById('reaction-bar')
    const reactionMsg = document.getElementById('reaction-message')
    const countdownElem = document.getElementById('reaction-countdown')
    const actionsElem = document.getElementById('reaction-actions')
    const tableWrap = document.querySelector('.poker-table-wrap')

    if (!reactionBar || !state.pendingAction) {
      if (reactionBar) reactionBar.hidden = true
      if (tableWrap) tableWrap.classList.remove('high-tension-arena')
      clearInterval(reactionTimer)
      return
    }

    reactionBar.hidden = false
    if (tableWrap) tableWrap.classList.add('high-tension-arena')
    const act = state.pendingAction
    const actorName = getPlayerName(act.actorId)
    const myId = room.profile.id
    const me = state.players.find((p) => p.id === myId)
    const isMeActor = act.actorId === myId
    const hasPassed = act.passedPlayerIds.includes(myId)
    const isAlive = me && !me.eliminated

    // Contagem regressiva
    const remainingSec = Math.max(0, Math.ceil((act.deadline - Date.now()) / 1000))
    if (countdownElem) countdownElem.textContent = remainingSec

    if (!reactionTimer) {
      reactionTimer = setInterval(() => {
        if (!state.pendingAction) {
          clearInterval(reactionTimer)
          reactionTimer = null
          return
        }
        const rem = Math.max(0, Math.ceil((state.pendingAction.deadline - Date.now()) / 1000))
        const cElem = document.getElementById('reaction-countdown')
        if (cElem) cElem.textContent = rem
        if (rem <= 0 && room.isHost) {
          checkReactionResolved()
        }
      }, 500)
    }

    let buttonsHtml = ''

    if (act.step === 'CHALLENGE_ACTION') {
      const charName = CHARACTERS[act.claimedCharacter]?.name || 'Personagem'
      if (reactionMsg) {
        reactionMsg.innerHTML = `<strong>${actorName}</strong> declarou ter o <strong>${charName}</strong>. Alguém duvida?`
      }

      if (isAlive && !isMeActor && !hasPassed) {
        buttonsHtml = `
          <button type="button" class="btn-challenge" id="btn-react-challenge">
            <i data-lucide="alert-octagon"></i> Duvido! (Desafiar)
          </button>
          <button type="button" class="btn-pass" id="btn-react-pass">
            Passar
          </button>
        `
      } else if (hasPassed) {
        buttonsHtml = `<span style="font-size:0.8rem; color:var(--text-muted)">Você passou. Aguardando a mesa...</span>`
      }
    } else if (act.step === 'BLOCK_ACTION') {
      const actionName = ACTIONS[act.actionId].name
      if (reactionMsg) {
        reactionMsg.innerHTML = `Ação <strong>${actionName}</strong> de <strong>${actorName}</strong>. Deseja bloquear?`
      }

      if (isAlive && !isMeActor && !hasPassed) {
        let canBlockButtons = ''
        if (act.actionId === 'foreign_aid') {
          canBlockButtons = `
            <button type="button" class="btn-block" data-block-char="duke">
              <i data-lucide="crown"></i> Bloquear com Duque
            </button>
          `
        } else if (act.actionId === 'assassinate' && act.targetId === myId) {
          canBlockButtons = `
            <button type="button" class="btn-block" data-block-char="contessa">
              <i data-lucide="shield"></i> Bloquear com Condessa
            </button>
          `
        } else if (act.actionId === 'steal' && act.targetId === myId) {
          canBlockButtons = `
            <button type="button" class="btn-block" data-block-char="captain">
              <i data-lucide="anchor"></i> Bloquear com Capitão
            </button>
            <button type="button" class="btn-block" data-block-char="ambassador">
              <i data-lucide="scale"></i> Bloquear com Embaixador
            </button>
          `
        }

        buttonsHtml = `
          ${canBlockButtons}
          <button type="button" class="btn-pass" id="btn-react-pass">
            Passar
          </button>
        `
      } else if (hasPassed) {
        buttonsHtml = `<span style="font-size:0.8rem; color:var(--text-muted)">Você passou. Aguardando a mesa...</span>`
      }
    } else if (act.step === 'CHALLENGE_BLOCK') {
      const blockerName = getPlayerName(act.blockerId)
      const charName = CHARACTERS[act.blockedWithCharacter]?.name || 'Personagem'
      if (reactionMsg) {
        reactionMsg.innerHTML = `<strong>${blockerName}</strong> bloqueou alegando <strong>${charName}</strong>! Alguém duvida?`
      }

      if (isAlive && act.blockerId !== myId && !hasPassed) {
        buttonsHtml = `
          <button type="button" class="btn-challenge" id="btn-react-challenge-block">
            <i data-lucide="alert-octagon"></i> Duvidar do Bloqueio!
          </button>
          <button type="button" class="btn-pass" id="btn-react-pass">
            Aceitar Bloqueio
          </button>
        `
      } else if (hasPassed) {
        buttonsHtml = `<span style="font-size:0.8rem; color:var(--text-muted)">Você passou. Aguardando a mesa...</span>`
      }
    }

    if (actionsElem) {
      actionsElem.innerHTML = buttonsHtml

      // Listeners dos botões de reação
      const challengeBtn = document.getElementById('btn-react-challenge')
      const challengeBlockBtn = document.getElementById('btn-react-challenge-block')
      const passBtn = document.getElementById('btn-react-pass')

      if (challengeBtn) {
        challengeBtn.onclick = () => sendAction({ type: 'CHALLENGE_ACTION' })
      }
      if (challengeBlockBtn) {
        challengeBlockBtn.onclick = () => sendAction({ type: 'CHALLENGE_BLOCK' })
      }
      if (passBtn) {
        passBtn.onclick = () => sendAction({ type: 'PASS_REACTION' })
      }

      actionsElem.querySelectorAll('[data-block-char]').forEach((btn) => {
        btn.onclick = () => {
          const char = btn.getAttribute('data-block-char')
          sendAction({ type: 'BLOCK_ACTION', character: char })
        }
      })
    }
  }

  function renderLocalPlayer() {
    const myId = room.profile.id
    const me = state.players.find((p) => p.id === myId)
    if (!me) return

    const nameElem = document.getElementById('local-player-name')
    const coinsElem = document.getElementById('local-coins-count')
    const avatarElem = document.getElementById('local-avatar')
    const turnBadge = document.getElementById('turn-status-badge')

    if (nameElem) nameElem.textContent = me.name
    if (coinsElem) coinsElem.textContent = me.coins
    if (avatarElem) avatarElem.textContent = me.name.charAt(0).toUpperCase()

    const isMyTurn = state.players[state.turn]?.id === myId && !me.eliminated
    if (turnBadge) {
      if (me.eliminated) {
        turnBadge.className = 'turn-pill waiting'
        turnBadge.textContent = 'Você foi eliminado'
        turnBadge.style.color = '#ef4444'
      } else if (isMyTurn) {
        turnBadge.className = 'turn-pill your-turn'
        turnBadge.textContent = 'SEU TURNO! Escolha sua ação'
        turnBadge.style.color = 'var(--gold-300)'
      } else {
        turnBadge.className = 'turn-pill waiting'
        turnBadge.textContent = `Aguardando ${state.players[state.turn]?.name || 'oponente'}`
        turnBadge.style.color = '#94a3b8'
      }
    }

    // Cartas de Baralho de Luxo do Jogador
    const cardsRow = document.getElementById('player-cards-row')
    if (cardsRow) {
      cardsRow.innerHTML = me.cards
        .map((card, idx) => {
          const char = CHARACTERS[card.character]
          const fanAngle = idx === 0 ? '-5deg' : '5deg'
          if (card.revealed) {
            return `
              <div class="luxury-card card-${char.id} dead" style="--fan: ${fanAngle};">
                <div class="card-corner-index top-left">
                  <span>${char.name.charAt(0)}</span>
                  <i data-lucide="${char.icon}" style="width:12px;height:12px;margin-top:2px;"></i>
                </div>
                <div class="card-emblem-wrap">
                  <i data-lucide="${char.icon}" style="width:36px;height:36px;"></i>
                </div>
                <div>
                  <div class="card-title-banner">${char.name}</div>
                  <div class="card-power-text">${char.hint}</div>
                </div>
                <div class="card-corner-index bottom-right">
                  <span>${char.name.charAt(0)}</span>
                  <i data-lucide="${char.icon}" style="width:12px;height:12px;margin-top:2px;"></i>
                </div>
              </div>
            `
          }
          return `
            <div class="luxury-card card-${char.id}" style="--fan: ${fanAngle};">
              <div class="card-corner-index top-left">
                <span>${char.name.charAt(0)}</span>
                <i data-lucide="${char.icon}" style="width:12px;height:12px;margin-top:2px;"></i>
              </div>
              <div class="card-emblem-wrap">
                <i data-lucide="${char.icon}" style="width:36px;height:36px;"></i>
              </div>
              <div>
                <div class="card-title-banner">${char.name}</div>
                <div class="card-power-text">${char.hint}</div>
              </div>
              <div class="card-corner-index bottom-right">
                <span>${char.name.charAt(0)}</span>
                <i data-lucide="${char.icon}" style="width:12px;height:12px;margin-top:2px;"></i>
              </div>
            </div>
          `
        })
        .join('')
      setupCard3DHover()
    }

    // Botões de Ação do Turno
    const coupMust = isMyTurn && me.coins >= 10
    const actionButtons = document.querySelectorAll('.action-btn')

    actionButtons.forEach((btn) => {
      const actId = btn.getAttribute('data-action')
      const actDef = ACTIONS[actId]
      if (!actDef) return

      let disabled = !isMyTurn || state.pendingAction !== null || me.coins < actDef.cost

      if (coupMust && actId !== 'coup') {
        disabled = true
      }

      btn.disabled = disabled
      if (actId === 'coup') {
        if (coupMust) {
          btn.classList.add('forced-coup')
        } else {
          btn.classList.remove('forced-coup')
        }
      }
    })
  }

  function renderModals() {
    renderLoseInfluenceModal()
    renderExchangeModal()
    renderGameOverModal()
  }

  function renderLoseInfluenceModal() {
    const modal = document.getElementById('modal-lose-card')
    if (!modal) return

    const myId = room.profile.id
    if (state.loseInfluenceRequest && state.loseInfluenceRequest.playerId === myId) {
      modal.hidden = false
      const grid = document.getElementById('lose-cards-grid')
      const me = state.players.find((p) => p.id === myId)
      if (grid && me) {
        const aliveCards = me.cards.filter((c) => !c.revealed)
        grid.innerHTML = aliveCards
          .map((card) => {
            const char = CHARACTERS[card.character]
            return `
              <div class="luxury-card card-${char.id} selectable" data-lose-card-id="${card.id}" style="margin: 0 auto;">
                <div class="card-corner-index top-left">
                  <span>${char.name.charAt(0)}</span>
                  <i data-lucide="${char.icon}" style="width:12px;height:12px;margin-top:2px;"></i>
                </div>
                <div class="card-emblem-wrap">
                  <i data-lucide="${char.icon}" style="width:36px;height:36px;"></i>
                </div>
                <div>
                  <div class="card-title-banner">${char.name}</div>
                  <div class="card-power-text">${char.hint}</div>
                </div>
                <button type="button" class="btn-challenge" style="margin-top:8px; width:100%; font-size:0.75rem;">
                  Eliminar Carta
                </button>
              </div>
            `
          })
          .join('')

        grid.querySelectorAll('[data-lose-card-id]').forEach((elem) => {
          elem.onclick = () => {
            const cId = elem.getAttribute('data-lose-card-id')
            modal.hidden = true
            sendAction({ type: 'CHOOSE_LOSE_INFLUENCE', cardId: cId })
          }
        })
        setupCard3DHover()
      }
    } else {
      modal.hidden = true
    }
  }

  let selectedKeptCards = []

  function renderExchangeModal() {
    const modal = document.getElementById('modal-exchange')
    if (!modal) return

    const myId = room.profile.id
    if (state.exchangeRequest && state.exchangeRequest.playerId === myId) {
      modal.hidden = false
      const me = state.players.find((p) => p.id === myId)
      const req = state.exchangeRequest
      const desc = document.getElementById('exchange-modal-desc')
      const grid = document.getElementById('exchange-cards-grid')
      const confirmBtn = document.getElementById('btn-confirm-exchange')

      if (desc) {
        desc.textContent = `Selecione exatamente ${req.keepCount} carta(s) para manter em sua mão secreta:`
      }

      const pool = [...me.cards.filter((c) => !c.revealed), ...req.drawnCards]

      if (grid) {
        grid.innerHTML = pool
          .map((card) => {
            const char = CHARACTERS[card.character]
            const isSelected = selectedKeptCards.includes(card.id)
            return `
              <div class="exchange-card ${isSelected ? 'selected' : ''}" data-exchange-card-id="${card.id}">
                <i data-lucide="${char.icon}" style="width:24px;height:24px;color:${char.color};"></i>
                <strong style="font-size:0.85rem;">${char.name}</strong>
              </div>
            `
          })
          .join('')

        grid.querySelectorAll('[data-exchange-card-id]').forEach((elem) => {
          elem.onclick = () => {
            const id = elem.getAttribute('data-exchange-card-id')
            if (selectedKeptCards.includes(id)) {
              selectedKeptCards = selectedKeptCards.filter((x) => x !== id)
            } else {
              if (selectedKeptCards.length < req.keepCount) {
                selectedKeptCards.push(id)
              }
            }
            renderExchangeModal()
          }
        })
      }

      if (confirmBtn) {
        confirmBtn.disabled = selectedKeptCards.length !== req.keepCount
        confirmBtn.onclick = () => {
          modal.hidden = true
          sendAction({ type: 'SUBMIT_EXCHANGE', keptCardIds: selectedKeptCards })
          selectedKeptCards = []
        }
      }
    } else {
      modal.hidden = true
      selectedKeptCards = []
    }
  }

  function renderGameOverModal() {
    const modal = document.getElementById('modal-game-over')
    if (!modal) return

    if (state.phase === 'finished' && state.winner) {
      modal.hidden = false
      const titleElem = document.getElementById('winner-title')
      const descElem = document.getElementById('winner-desc')
      const isWinner = state.winner.id === room.profile.id

      if (titleElem) {
        titleElem.textContent = isWinner ? 'Glória Absoluta! Você Venceu!' : `${state.winner.name} Venceu a Partida!`
      }
      if (descElem) {
        descElem.textContent = isWinner
          ? 'Você manobrou todas as intrigas da Corte e coroou seu império!'
          : 'Todos os seus opositores foram derrotados e o novo líder assumiu o poder supremo.'
      }

      const againBtn = document.getElementById('btn-play-again')
      if (againBtn) {
        againBtn.style.display = room.isHost ? 'inline-flex' : 'none'
        againBtn.onclick = () => {
          modal.hidden = true
          if (room.isHost) {
            startGame()
          } else {
            sendAction({ type: 'PLAY_AGAIN' })
          }
        }
      }
    } else {
      modal.hidden = true
    }
  }

  function openTargetModal(actionId) {
    const modal = document.getElementById('modal-target')
    const listElem = document.getElementById('target-list')
    const titleElem = document.getElementById('target-modal-title')
    if (!modal || !listElem) return

    modal.hidden = false
    const actDef = ACTIONS[actionId]
    if (titleElem) {
      titleElem.innerHTML = `<i data-lucide="crosshair"></i> Alvo para ${actDef.name}`
    }

    const targets = getAlivePlayers().filter((p) => p.id !== room.profile.id)
    listElem.innerHTML = targets
      .map((t) => {
        return `
          <button type="button" class="target-btn" data-target-id="${t.id}">
            <span>${t.name}</span>
            <span style="color:var(--gold-400)">${t.coins} moedas</span>
          </button>
        `
      })
      .join('')

    listElem.querySelectorAll('[data-target-id]').forEach((btn) => {
      btn.onclick = () => {
        const targetId = btn.getAttribute('data-target-id')
        modal.hidden = true
        sendAction({ type: 'DECLARE_ACTION', actionId, targetId })
      }
    })
  }

  function showToast(msg) {
    const old = document.querySelector('.toast-msg')
    if (old) old.remove()
    const toast = document.createElement('div')
    toast.className = 'toast-msg'
    toast.textContent = msg
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 3200)
  }

  function sendAction(actionData) {
    if (room.isHost) {
      handleHostAction(actionData, room.profile)
    } else {
      room.sendToHost(actionData)
    }
  }

  // --- GERENCIAMENTO DE SALA HOST & CLIENTE ---
  function initHostRoom(customCode = '') {
    const code = (customCode || `GOL-${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase()
    room.hostRoom(code)
    state.players = [
      {
        id: room.profile.id,
        name: room.profile.name || 'Você',
        isBot: false,
        coins: 2,
        cards: [],
        eliminated: false,
      },
      {
        id: 'bot_1',
        name: 'Conselheiro 1',
        isBot: true,
        difficulty: 'normal',
        coins: 2,
        cards: [],
        eliminated: false,
      },
      {
        id: 'bot_2',
        name: 'Conselheiro 2',
        isBot: true,
        difficulty: 'normal',
        coins: 2,
        cards: [],
        eliminated: false,
      },
    ]
    state.phase = 'lobby'
    state.winner = null
    state.pendingAction = null
    state.loseInfluenceRequest = null
    state.exchangeRequest = null
    state.deck = []
    syncState()
    return code
  }

  function joinExistingRoom(code) {
    if (!code) return
    room.joinRoom(code)
    room.sendToHost({ type: 'JOIN_REQUEST', profile: room.profile })
  }

  // --- COPIAR LINK DA SALA ---
  function copyRoomShareLink() {
    const code = room.roomCode || 'SALA-0000'
    let baseUrl = window.location.origin + window.location.pathname
    try {
      if (window.parent && window.parent.location && window.parent.location.origin) {
        baseUrl = `${window.parent.location.origin}/jogos/golpe-nbp`
      }
    } catch {}

    const cleanUrl = `${baseUrl}?room=${encodeURIComponent(code)}`
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(cleanUrl)
        .then(() => showToast('Link da sala copiado! Envie aos amigos.'))
        .catch(() => showToast(`Código da sala: ${code}`))
    } else {
      showToast(`Código da sala: ${code}`)
    }
  }

  // --- 3D HOVER TÁTIL PARA CARTAS DO JOGADOR ---
  function setupCard3DHover() {
    const cards = document.querySelectorAll('.luxury-card:not(.dead)')
    cards.forEach((card) => {
      if (card.dataset.hoverAttached) return
      card.dataset.hoverAttached = 'true'

      let specular = card.querySelector('.card-specular')
      if (!specular) {
        specular = document.createElement('div')
        specular.className = 'card-specular'
        specular.setAttribute('aria-hidden', 'true')
        card.appendChild(specular)
      }

      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const centerX = rect.width / 2
        const centerY = rect.height / 2

        const rotateX = ((centerY - y) / centerY) * 12
        const rotateY = ((x - centerX) / centerX) * 12

        card.style.transform = `perspective(800px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-22px) scale(1.08)`
        card.style.zIndex = '20'

        specular.style.opacity = '1'
        specular.style.background = `radial-gradient(circle 130px at ${x}px ${y}px, rgba(255, 255, 255, 0.32) 0%, transparent 80%)`
      })

      card.addEventListener('mouseleave', () => {
        card.style.transform = ''
        card.style.zIndex = ''
        specular.style.opacity = '0'
      })
    })
  }

  // --- CENA 3D DA MESA DE CONSELHO SECRETO (THREE.JS PBR & JUICE) ---
  let table3D = null

  class Table3D {
    constructor(canvas, THREE) {
      this.canvas = canvas
      this.THREE = THREE
      this.renderer = null
      this.scene = null
      this.camera = null
      this.spotLight = null
      this.candleL = null
      this.candleR = null
      this.treasuryGroup = null
      this.deckGroup = null
      this.flyingCoins = []
      this.shakeIntensity = 0
      this.shakeDecay = 0
      this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0 }
      this.baseCamY = 8.2
      this.baseCamZ = 9.4
      this.lastTreasuryCount = -1
      this.lastDeckCount = -1
    }

    init() {
      const THREE = this.THREE
      const rect = this.canvas.getBoundingClientRect()
      const width = rect.width || 840
      const height = rect.height || 540

      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      })
      this.renderer.setSize(width, height, false)
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping
      this.renderer.toneMappingExposure = 1.18
      this.renderer.shadowMap.enabled = true
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

      this.scene = new THREE.Scene()
      this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100)
      this.camera.position.set(0, this.baseCamY, this.baseCamZ)
      this.camera.lookAt(0, -0.4, 0)

      // Environment Map via PMREMGenerator
      try {
        const pmrem = new THREE.PMREMGenerator(this.renderer)
        pmrem.compileEquirectangularShader()
        const eCanvas = document.createElement('canvas')
        eCanvas.width = 512
        eCanvas.height = 256
        const eCtx = eCanvas.getContext('2d')
        const bgGrad = eCtx.createLinearGradient(0, 0, 0, 256)
        bgGrad.addColorStop(0, '#1c050d')
        bgGrad.addColorStop(0.5, '#0b0205')
        bgGrad.addColorStop(1, '#040102')
        eCtx.fillStyle = bgGrad
        eCtx.fillRect(0, 0, 512, 256)

        const drawBloom = (x, y, r, color) => {
          const g = eCtx.createRadialGradient(x, y, 0, x, y, r)
          g.addColorStop(0, color)
          g.addColorStop(1, 'transparent')
          eCtx.fillStyle = g
          eCtx.beginPath()
          eCtx.arc(x, y, r, 0, Math.PI * 2)
          eCtx.fill()
        }
        drawBloom(256, 50, 120, '#fef08a')
        drawBloom(110, 110, 80, '#f59e0b')
        drawBloom(400, 110, 80, '#f59e0b')
        drawBloom(256, 190, 90, '#991b1b')

        const tex = new THREE.CanvasTexture(eCanvas)
        tex.mapping = THREE.EquirectangularReflectionMapping
        this.scene.environment = pmrem.fromEquirectangular(tex).texture
        pmrem.dispose()
        tex.dispose()
      } catch (_) {}

      // Iluminação Realista PBR
      const ambient = new THREE.AmbientLight(0x280e14, 1.4)
      this.scene.add(ambient)

      this.spotLight = new THREE.SpotLight(0xffedd5, 5.0, 30, Math.PI / 3.6, 0.65, 1.2)
      this.spotLight.position.set(0, 9.8, 1.0)
      this.spotLight.target.position.set(0, 0, 0)
      this.spotLight.castShadow = true
      this.spotLight.shadow.mapSize.set(1024, 1024)
      this.spotLight.shadow.bias = -0.0001
      this.spotLight.shadow.radius = 2.4
      this.scene.add(this.spotLight)
      this.scene.add(this.spotLight.target)

      this.candleL = new THREE.PointLight(0xd97706, 1.6, 15, 1.8)
      this.candleL.position.set(-5.6, 2.8, 1.2)
      this.scene.add(this.candleL)

      this.candleR = new THREE.PointLight(0xd97706, 1.6, 15, 1.8)
      this.candleR.position.set(5.6, 2.8, 1.2)
      this.scene.add(this.candleR)

      // Mesa Real (Madeira nobre entalhada + Veludo Carmesim + Ouro velho)
      this.buildTable()

      // Tesouro e Baralho 3D
      this.buildTreasuryAndDeck()

      window.addEventListener('resize', () => this.resize())
      window.addEventListener('mousemove', (e) => {
        this.mouse.targetX = (e.clientX / window.innerWidth - 0.5) * 0.9
        this.mouse.targetY = (e.clientY / window.innerHeight - 0.5) * 0.6
      })

      this.animate()
    }

    buildTable() {
      const THREE = this.THREE
      const tableGroup = new THREE.Group()

      // Moldura de madeira nobre entalhada
      const woodMat = new THREE.MeshStandardMaterial({
        color: 0x1b050c,
        roughness: 0.42,
        metalness: 0.14,
        envMapIntensity: 0.9,
      })
      const outerRim = new THREE.Mesh(
        new THREE.CylinderGeometry(6.6, 7.0, 0.55, 48),
        woodMat
      )
      outerRim.position.y = -0.3
      outerRim.receiveShadow = true
      tableGroup.add(outerRim)

      // Friso de ouro velho
      const goldTrimMat = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        metalness: 0.88,
        roughness: 0.22,
        envMapIntensity: 1.4,
      })
      const goldRing = new THREE.Mesh(
        new THREE.TorusGeometry(6.18, 0.05, 12, 64),
        goldTrimMat
      )
      goldRing.rotation.x = Math.PI / 2
      goldRing.position.y = -0.01
      tableGroup.add(goldRing)

      // Tampo interno de veludo carmesim fosco aveludado
      const feltMat = new THREE.MeshStandardMaterial({
        color: 0x140207,
        roughness: 0.78,
        metalness: 0.05,
        envMapIntensity: 0.4,
      })
      const innerFelt = new THREE.Mesh(
        new THREE.CylinderGeometry(6.15, 6.15, 0.52, 48),
        feltMat
      )
      innerFelt.position.y = -0.28
      innerFelt.receiveShadow = true
      tableGroup.add(innerFelt)

      this.scene.add(tableGroup)
    }

    buildTreasuryAndDeck() {
      const THREE = this.THREE
      this.coinMat = new THREE.MeshStandardMaterial({
        color: 0xf5b722,
        metalness: 0.88,
        roughness: 0.22,
        envMapIntensity: 1.5,
      })
      this.coinGeom = new THREE.CylinderGeometry(0.38, 0.38, 0.055, 24)

      this.treasuryGroup = new THREE.Group()
      this.treasuryGroup.position.set(1.7, 0, -0.15)
      this.scene.add(this.treasuryGroup)

      this.deckGroup = new THREE.Group()
      this.deckGroup.position.set(-1.7, 0, -0.15)
      this.deckGroup.rotation.y = -0.08
      this.scene.add(this.deckGroup)
    }

    updateTreasury(count) {
      if (this.lastTreasuryCount === count) return
      this.lastTreasuryCount = count
      const THREE = this.THREE
      while (this.treasuryGroup.children.length > 0) {
        const c = this.treasuryGroup.children.pop()
        c.geometry?.dispose()
      }

      const visualCoins = Math.min(count, 36)
      const piles = [
        { x: 0, z: 0, count: Math.ceil(visualCoins * 0.45) },
        { x: 0.45, z: 0.35, count: Math.floor(visualCoins * 0.3) },
        { x: -0.4, z: 0.3, count: Math.floor(visualCoins * 0.25) },
      ]

      piles.forEach((pile) => {
        for (let i = 0; i < pile.count; i++) {
          const coin = new THREE.Mesh(this.coinGeom, this.coinMat)
          const angleJitter = (Math.random() - 0.5) * 0.12
          coin.position.set(
            pile.x + (Math.random() - 0.5) * 0.04,
            i * 0.058,
            pile.z + (Math.random() - 0.5) * 0.04
          )
          coin.rotation.y = angleJitter + i * 0.2
          coin.castShadow = true
          coin.receiveShadow = true
          this.treasuryGroup.add(coin)
        }
      })
    }

    updateDeck(deckCount) {
      if (this.lastDeckCount === deckCount) return
      this.lastDeckCount = deckCount
      const THREE = this.THREE
      while (this.deckGroup.children.length > 0) {
        const c = this.deckGroup.children.pop()
        c.geometry?.dispose()
      }

      const visualCards = Math.max(1, Math.min(deckCount, 15))
      const deckHeight = visualCards * 0.025
      const deckGeom = new THREE.BoxGeometry(1.48, deckHeight, 2.16)
      const deckMat = new THREE.MeshStandardMaterial({
        color: 0x220510,
        roughness: 0.45,
        metalness: 0.12,
        envMapIntensity: 0.8,
      })
      const deckMesh = new THREE.Mesh(deckGeom, deckMat)
      deckMesh.position.y = deckHeight / 2
      deckMesh.castShadow = true
      deckMesh.receiveShadow = true
      this.deckGroup.add(deckMesh)

      const topMat = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        metalness: 0.85,
        roughness: 0.25,
      })
      const topFrame = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 2.08),
        topMat
      )
      topFrame.rotation.x = -Math.PI / 2
      topFrame.position.y = deckHeight + 0.002
      this.deckGroup.add(topFrame)
    }

    transferCoins(fromPos, toPos, count = 1, onComplete) {
      const THREE = this.THREE
      const resolvePos = (pos) => {
        if (pos instanceof THREE.Vector3) return pos
        if (pos === 'treasury') return new THREE.Vector3(1.7, 0.2, -0.15)
        if (pos === 'player') return new THREE.Vector3(0, 0.1, 3.6)
        return new THREE.Vector3(-1.8, 0.1, -2.6)
      }

      const start = resolvePos(fromPos)
      const end = resolvePos(toPos)
      const coinCount = Math.max(1, Math.min(count, 8))

      for (let i = 0; i < coinCount; i++) {
        const coin = new THREE.Mesh(this.coinGeom, this.coinMat)
        coin.castShadow = true
        coin.position.copy(start)
        this.scene.add(coin)

        this.flyingCoins.push({
          mesh: coin,
          start: start.clone(),
          end: end.clone(),
          progress: 0,
          delay: i * 0.05,
          speed: 1.45,
          peakY: 1.6 + Math.random() * 0.4,
          rotSpeedX: 8.0 + Math.random() * 4.0,
          rotSpeedZ: 5.0 + Math.random() * 3.0,
          bouncing: false,
          bounceTime: 0,
          isLast: i === coinCount - 1,
          onComplete,
        })
      }
    }

    triggerCameraShake(durationMs = 150) {
      this.shakeIntensity = 0.24
      this.shakeDecay = this.shakeIntensity / (durationMs / 1000)
    }

    flashLighting() {
      if (this.spotLight) {
        this.spotLight.intensity = 9.5
        const timer = setInterval(() => {
          this.spotLight.intensity = Math.max(5.0, this.spotLight.intensity - 0.45)
          if (this.spotLight.intensity <= 5.0) clearInterval(timer)
        }, 20)
      }
      const flashEl = document.getElementById('arena-flash-overlay')
      if (flashEl) {
        flashEl.classList.remove('active')
        void flashEl.offsetWidth
        flashEl.classList.add('active')
        setTimeout(() => flashEl.classList.remove('active'), 200)
      }
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      this.camera.aspect = rect.width / rect.height
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(rect.width, rect.height, false)
    }

    animate() {
      requestAnimationFrame(() => this.animate())

      const dt = 0.016
      // Atualizar moedas voadoras
      for (let i = this.flyingCoins.length - 1; i >= 0; i--) {
        const fc = this.flyingCoins[i]
        if (fc.delay > 0) {
          fc.delay -= dt
          continue
        }
        if (!fc.bouncing) {
          fc.progress += dt * fc.speed
          const t = Math.min(1, fc.progress)
          fc.mesh.position.x = fc.start.x + (fc.end.x - fc.start.x) * t
          fc.mesh.position.z = fc.start.z + (fc.end.z - fc.start.z) * t
          fc.mesh.position.y =
            fc.start.y + (fc.end.y - fc.start.y) * t + Math.sin(t * Math.PI) * fc.peakY
          fc.mesh.rotation.x += fc.rotSpeedX * dt
          fc.mesh.rotation.z += fc.rotSpeedZ * dt

          if (t >= 1) {
            fc.bouncing = true
            sound.playCoin()
          }
        } else {
          fc.bounceTime += dt * 5.0
          const b = Math.abs(Math.sin(fc.bounceTime * Math.PI)) * 0.22 * Math.max(0, 1 - fc.bounceTime * 0.6)
          fc.mesh.position.y = fc.end.y + b
          if (fc.bounceTime >= 1.2) {
            this.scene.remove(fc.mesh)
            fc.mesh.geometry?.dispose()
            if (fc.isLast && fc.onComplete) fc.onComplete()
            this.flyingCoins.splice(i, 1)
          }
        }
      }

      // Interpolação suave do mouse com paralaxe e respiração
      this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.05
      this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.05

      const nowSec = performance.now() * 0.001
      const breathX = Math.sin(nowSec * 0.4) * 0.08
      const breathY = Math.cos(nowSec * 0.3) * 0.06

      let shakeX = 0
      let shakeY = 0
      if (this.shakeIntensity > 0) {
        shakeX = (Math.random() - 0.5) * this.shakeIntensity
        shakeY = (Math.random() - 0.5) * this.shakeIntensity
        this.shakeIntensity = Math.max(0, this.shakeIntensity - this.shakeDecay * dt)
      }

      this.camera.position.x = this.mouse.x * 0.45 + breathX + shakeX
      this.camera.position.y = this.baseCamY + this.mouse.y * 0.35 + breathY + shakeY
      this.camera.position.z = this.baseCamZ
      this.camera.lookAt(0, -0.35, 0)

      // Bruxuleio suave de velas
      if (this.candleL && this.candleR) {
        const flick = Math.sin(nowSec * 7) * 0.12 + (Math.random() - 0.5) * 0.06
        this.candleL.intensity = 1.6 + flick
        this.candleR.intensity = 1.6 - flick
      }

      this.renderer.render(this.scene, this.camera)
    }
  }

  async function initTableCanvas() {
    const canvas = document.getElementById('table-felt-canvas')
    if (!canvas || table3D) return
    try {
      const THREE = await import('../../vendor/three.module.js')
      table3D = new Table3D(canvas, THREE)
      table3D.init()
      if (state) {
        table3D.updateTreasury(state.treasury)
        table3D.updateDeck(state.deck.length)
      }
    } catch (err) {
      console.warn('Erro ao carregar Three.js para mesa 3D:', err)
    }
  }

  // --- CONFIGURAÇÃO DE EVENTOS DE DOM ---
  function setupDomEvents() {
    // Topbar
    const copyBtn = document.getElementById('btn-copy-room')
    if (copyBtn) copyBtn.onclick = copyRoomShareLink

    const drawerToggle = document.getElementById('btn-toggle-drawer')
    const drawer = document.getElementById('room-drawer')
    if (drawerToggle && drawer) {
      drawerToggle.onclick = () => {
        drawer.hidden = !drawer.hidden
      }
    }

    const soundBtn = document.getElementById('btn-sound')
    if (soundBtn) {
      soundBtn.onclick = () => {
        sound.enabled = !sound.enabled
        soundBtn.setAttribute('aria-pressed', sound.enabled ? 'true' : 'false')
        soundBtn.innerHTML = sound.enabled
          ? '<i data-lucide="volume-2"></i>'
          : '<i data-lucide="volume-x"></i>'
        if (window.lucide) window.lucide.createIcons()
        showToast(sound.enabled ? 'Som ativado' : 'Som desativado')
      }
    }

    const rulesBtn = document.getElementById('btn-rules')
    const rulesModal = document.getElementById('modal-rules')
    const closeRulesBtn = document.getElementById('btn-close-rules')
    if (rulesBtn && rulesModal) {
      rulesBtn.onclick = () => {
        rulesModal.hidden = false
      }
    }
    if (closeRulesBtn && rulesModal) {
      closeRulesBtn.onclick = () => {
        rulesModal.hidden = true
      }
    }

    const closeTargetBtn = document.getElementById('btn-close-target')
    const targetModal = document.getElementById('modal-target')
    if (closeTargetBtn && targetModal) {
      closeTargetBtn.onclick = () => {
        targetModal.hidden = true
      }
    }

    // Drawer inputs & buttons
    const nicknameInput = document.getElementById('input-nickname')
    if (nicknameInput) {
      nicknameInput.value = room.profile.name || 'Você'
      nicknameInput.onchange = () => {
        const cleanName = nicknameInput.value.trim() || 'Nobre'
        room.setPlayerName(cleanName)
        if (!room.isHost) {
          room.sendToHost({ type: 'JOIN_REQUEST', profile: room.profile })
        } else {
          const me = state.players.find((p) => p.id === room.profile.id)
          if (me) me.name = cleanName
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
          joinExistingRoom(code)
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

    // Lobby buttons
    const addBotBtn = document.getElementById('btn-add-bot')
    if (addBotBtn) {
      addBotBtn.onclick = () => sendAction({ type: 'ADD_BOT', difficulty: 'normal' })
    }

    const removeBotBtn = document.getElementById('btn-remove-bot')
    if (removeBotBtn) {
      removeBotBtn.onclick = () => sendAction({ type: 'REMOVE_BOT' })
    }

    const startBtn = document.getElementById('btn-start-game')
    if (startBtn) {
      startBtn.onclick = () => sendAction({ type: 'START_GAME' })
    }

    // Botões de ação do turno
    document.querySelectorAll('.action-btn').forEach((btn) => {
      btn.onclick = () => {
        const actId = btn.getAttribute('data-action')
        const actDef = ACTIONS[actId]
        if (!actDef) return

        if (actDef.requiresTarget) {
          openTargetModal(actId)
        } else {
          sendAction({ type: 'DECLARE_ACTION', actionId: actId })
        }
      }
    })
  }

  // --- AUTO-INICIALIZAÇÃO ---
  window.addEventListener('DOMContentLoaded', () => {
    setupDomEvents()

    // Lê parâmetros da URL para entrar em sala automaticamente se houver ?room=
    const params = new URLSearchParams(window.location.search)
    const roomParam = params.get('room') || params.get('sala')
    const nicknameParam = params.get('nick') || params.get('nome')

    if (nicknameParam) {
      room.setPlayerName(nicknameParam)
    }

    if (roomParam) {
      joinExistingRoom(roomParam.trim().toUpperCase())
    } else {
      initHostRoom()
    }

    render()
  })
})()
