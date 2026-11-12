;(() => {
  'use strict'

  // ==================== GLOBAL VARIABLES & CONSTANTS ====================
  let pokemonData = []
  let soundEnabled = true
  let audioCtx = null

  const state = {
    mode: 'solo', // 'solo' | 'versus' | 'royale'
    visualMode: 'silhouette', // 'silhouette' | 'colored'
    inputMode: 'choices', // 'choices' | 'text'
    tier: 'all', // 'all' | '1' | '2'
    seed: '',
    score: 0,
    streak: 0,
    bestStreak: 0,
    totalHits: 0,
    totalRounds: 0,
    round: 1,
    currentPokemon: null,
    choices: [],
    soloLocked: false,
    pool: [],
  }

  // DOM Elements
  const btnToggleVisual = document.getElementById('btn-toggle-visual')
  const visIcon = document.getElementById('vis-icon')
  const visLabel = document.getElementById('vis-label')
  const hudScore = document.getElementById('hud-score')
  const hudStreak = document.getElementById('hud-streak')
  const soloHudPills = document.getElementById('solo-hud-pills')
  const btnSound = document.getElementById('btn-sound')
  const soundIcon = document.getElementById('sound-icon')
  const btnToggleDrawer = document.getElementById('btn-toggle-drawer')
  const configDrawer = document.getElementById('config-drawer')
  const tierSelect = document.getElementById('tier-select')
  const optInputChoices = document.getElementById('opt-input-choices')
  const optInputText = document.getElementById('opt-input-text')
  const optVisSilhouette = document.getElementById('opt-vis-silhouette')
  const optVisColored = document.getElementById('opt-vis-colored')
  const seedInput = document.getElementById('seed-input')
  const btnApplySeed = document.getElementById('btn-apply-seed')
  const toastContainer = document.getElementById('toast-container')
  const confettiCanvas = document.getElementById('confetti-canvas')
  const modalSummary = document.getElementById('modal-summary')

  // LEDs & Sensor
  const ledRed = document.getElementById('led-red')
  const ledYellow = document.getElementById('led-yellow')
  const ledGreen = document.getElementById('led-green')

  // Solo View Elements
  const viewSolo = document.getElementById('view-solo')
  const soloDexChip = document.getElementById('solo-dex-chip')
  const soloRegionChip = document.getElementById('solo-region-chip')
  const soloTypeChip = document.getElementById('solo-type-chip')
  const soloRoundCounter = document.getElementById('solo-round-counter')
  const soloMonitor = document.getElementById('solo-monitor')
  const soloPokemonImg = document.getElementById('solo-pokemon-img')
  const soloRevealBanner = document.getElementById('solo-reveal-banner')
  const soloRevealName = document.getElementById('solo-reveal-name')
  const soloRevealTypes = document.getElementById('solo-reveal-types')
  const soloChoicesGrid = document.getElementById('solo-choices-grid')
  const soloTextMode = document.getElementById('solo-text-mode')
  const soloGuessForm = document.getElementById('solo-guess-form')
  const soloGuessInput = document.getElementById('solo-guess-input')
  const soloSuggestions = document.getElementById('solo-suggestions')

  // Multiplayer View Elements
  const viewMultiplayer = document.getElementById('view-multiplayer')
  const multiModeBadge = document.getElementById('multi-mode-badge')
  const multiModeIcon = document.getElementById('multi-mode-icon')
  const multiModeName = document.getElementById('multi-mode-name')
  const multiRoomCode = document.getElementById('multi-room-code')
  const btnCopyRoom = document.getElementById('btn-copy-room')
  const multiP2pStatus = document.getElementById('multi-p2p-status')
  const multiStatusText = document.getElementById('multi-status-text')
  const playerNameInput = document.getElementById('player-name-input')
  const roomCodeInput = document.getElementById('room-code-input')
  const multiGenSelect = document.getElementById('multi-gen-select')
  const btnMultiJoin = document.getElementById('btn-multi-join')
  const btnMultiHost = document.getElementById('btn-multi-host')
  const btnAddBot = document.getElementById('btn-add-bot')
  const btnRemBot = document.getElementById('btn-rem-bot')
  const btnStartMulti = document.getElementById('btn-start-multi')
  const arenaTimerVal = document.getElementById('arena-timer-val')
  const arenaTimerBar = document.getElementById('arena-timer-bar')
  const arenaRoundBadge = document.getElementById('arena-round-badge')
  const arenaAliveBadge = document.getElementById('arena-alive-badge')
  const multiDexChip = document.getElementById('multi-dex-chip')
  const multiRegionChip = document.getElementById('multi-region-chip')
  const multiTypeChip = document.getElementById('multi-type-chip')
  const multiPokemonImg = document.getElementById('multi-pokemon-img')
  const multiRevealBanner = document.getElementById('multi-reveal-banner')
  const multiRevealName = document.getElementById('multi-reveal-name')
  const multiRevealTypes = document.getElementById('multi-reveal-types')
  const multiChoicesGrid = document.getElementById('multi-choices-grid')
  const multiPlayersList = document.getElementById('multi-players-list')
  const multiFeed = document.getElementById('multi-feed')

  // Modal Elements
  const modalBadge = document.getElementById('modal-badge')
  const modalTitle = document.getElementById('modal-title')
  const modalDesc = document.getElementById('modal-desc')
  const modalScore = document.getElementById('modal-score')
  const modalStreak = document.getElementById('modal-streak')
  const modalAcc = document.getElementById('modal-acc')
  const btnModalRestart = document.getElementById('btn-modal-restart')
  const btnModalClose = document.getElementById('btn-modal-close')

  // ==================== PROCEDURAL SOUND FX (WEB AUDIO API) ====================
  const SoundFX = {
    getCtx() {
      if (!audioCtx && typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || window.webkitAudioContext
        if (AudioCtx) audioCtx = new AudioCtx()
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {})
      }
      return audioCtx
    },

    playSelect() {
      if (!soundEnabled) return
      const ctx = this.getCtx()
      if (!ctx) return
      const t = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(420, t)
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.04)
      gain.gain.setValueAtTime(0.18, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.04)
    },

    playWhoosh() {
      if (!soundEnabled) return
      const ctx = this.getCtx()
      if (!ctx) return
      const t = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(180, t)
      osc.frequency.exponentialRampToValueAtTime(650, t + 0.12)
      gain.gain.setValueAtTime(0.15, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.13)
    },

    playCorrect() {
      if (!soundEnabled) return
      const ctx = this.getCtx()
      if (!ctx) return
      const t = ctx.currentTime
      // Upbeat nostalgic 3-note arpeggio (C5 -> E5 -> G5)
      const freqs = [523.25, 659.25, 783.99]
      freqs.forEach((freq, idx) => {
        const st = t + idx * 0.07
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, st)
        gain.gain.setValueAtTime(0.2, st)
        gain.gain.exponentialRampToValueAtTime(0.001, st + 0.22)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(st)
        osc.stop(st + 0.22)
      })
    },

    playWrong() {
      if (!soundEnabled) return
      const ctx = this.getCtx()
      if (!ctx) return
      const t = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(160, t)
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.22)
      gain.gain.setValueAtTime(0.25, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.25)
    },

    playTick() {
      if (!soundEnabled) return
      const ctx = this.getCtx()
      if (!ctx) return
      const t = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, t)
      gain.gain.setValueAtTime(0.08, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.03)
    },

    playFanfare() {
      if (!soundEnabled) return
      const ctx = this.getCtx()
      if (!ctx) return
      const t = ctx.currentTime
      const notes = [440, 554.37, 659.25, 880]
      notes.forEach((freq, i) => {
        const st = t + i * 0.1
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, st)
        gain.gain.setValueAtTime(0.25, st)
        gain.gain.exponentialRampToValueAtTime(0.001, st + 0.35)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(st)
        osc.stop(st + 0.35)
      })
    },
  }

  // ==================== HELPER UTILITIES ====================
  function normalizePt(str) {
    if (!str) return ''
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim()
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div')
    toast.className = `toast ${type}`
    toast.textContent = message
    toastContainer.appendChild(toast)
    setTimeout(() => {
      toast.style.opacity = '0'
      toast.style.transform = 'translateY(-6px)'
      setTimeout(() => toast.remove(), 250)
    }, 2800)
  }

  function pulseLeds(type) {
    if (type === 'hit') {
      ledGreen.style.boxShadow = '0 0 14px #22c55e'
      setTimeout(() => (ledGreen.style.boxShadow = ''), 400)
    } else if (type === 'miss') {
      ledRed.style.boxShadow = '0 0 14px #ef4444'
      setTimeout(() => (ledRed.style.boxShadow = ''), 400)
    } else {
      ledYellow.style.boxShadow = '0 0 14px #facc15'
      setTimeout(() => (ledYellow.style.boxShadow = ''), 400)
    }
  }

  function triggerScreenShake(el) {
    const target = el || document.querySelector('.arena-card')
    if (target) {
      target.classList.remove('trigger-shake')
      void target.offsetWidth // force reflow
      target.classList.add('trigger-shake')
    }
  }

  // Deterministic seeded random
  function pseudoRandom(seedStr) {
    let hash = 0
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash << 5) - hash + seedStr.charCodeAt(i)
      hash |= 0
    }
    return () => {
      hash = (hash + 0x6d2b79f5) | 0
      let t = Math.imul(hash ^ (hash >>> 15), 1 | hash)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  function shuffle(array, randFn = Math.random) {
    const copy = [...array]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(randFn() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
  }

  // ==================== CONFETTI PARTICLES ====================
  function launchConfetti() {
    const ctx = confettiCanvas.getContext('2d')
    const width = (confettiCanvas.width = window.innerWidth)
    const height = (confettiCanvas.height = window.innerHeight)
    const colors = ['#ef4444', '#facc15', '#38bdf8', '#22c55e', '#a855f7', '#ffffff']
    const particles = []

    for (let i = 0; i < 70; i++) {
      particles.push({
        x: width / 2,
        y: height / 2 + 50,
        vx: (Math.random() - 0.5) * 16,
        vy: -Math.random() * 14 - 4,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vr: (Math.random() - 0.5) * 12,
        alpha: 1,
      })
    }

    let frame = 0
    function loop() {
      ctx.clearRect(0, 0, width, height)
      let alive = false
      particles.forEach((p) => {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.35 // gravity
        p.rotation += p.vr
        p.alpha -= 0.012

        if (p.alpha > 0) {
          alive = true
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate((p.rotation * Math.PI) / 180)
          ctx.globalAlpha = Math.max(0, p.alpha)
          ctx.fillStyle = p.color
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
          ctx.restore()
        }
      })

      frame++
      if (alive && frame < 120) {
        requestAnimationFrame(loop)
      } else {
        ctx.clearRect(0, 0, width, height)
      }
    }
    requestAnimationFrame(loop)
  }

  // ==================== DATA POOL FILTERING ====================
  function getFilteredPool(filterVal) {
    if (!pokemonData.length) return []
    if (!filterVal || filterVal === 'all') return [...pokemonData]
    if (filterVal === 'retro') return pokemonData.filter((p) => p.gen <= 3)
    const gNum = Number.parseInt(filterVal, 10)
    if (gNum >= 1 && gNum <= 9) {
      return pokemonData.filter((p) => p.gen === gNum)
    }
    return [...pokemonData]
  }

  // ==================== SOLO QUIZ LOGIC ====================
  function startSoloQuiz() {
    state.score = 0
    state.streak = 0
    state.totalHits = 0
    state.totalRounds = 0
    state.round = 1
    state.soloLocked = false
    updateSoloHud()

    const pool = getFilteredPool(state.tier)
    const rand = state.seed ? pseudoRandom(state.seed) : Math.random
    state.pool = shuffle(pool, rand)
    nextSoloQuestion()
  }

  function nextSoloQuestion() {
    state.soloLocked = false
    if (!state.pool.length) {
      state.pool = shuffle(getFilteredPool(state.tier))
    }

    // Pick target Pokémon
    const target = state.pool.pop()
    state.currentPokemon = target

    // Build 3 plausible distractors (prioritize same gen/pool for harder choices)
    const poolCandidates = getFilteredPool(state.tier).filter((p) => p.id !== target.id)
    const distractors = shuffle(poolCandidates.length >= 3 ? poolCandidates : pokemonData.filter((p) => p.id !== target.id)).slice(0, 3)
    state.choices = shuffle([target, ...distractors])

    // Update Display
    soloRoundCounter.textContent = `Rodada ${state.round}`
    soloDexChip.textContent = `POKÉDEX #${target.dex}`
    soloRegionChip.textContent = `${target.region} · Gen ${target.gen}`
    soloTypeChip.textContent = target.types.join(' / ')

    // Image & Silhouette
    soloPokemonImg.src = target.svg
    soloPokemonImg.classList.remove('revealed', 'colored', 'reveal-bounce')

    if (state.visualMode === 'silhouette') {
      soloPokemonImg.classList.add('silhouette')
      soloDexChip.textContent = 'POKÉDEX #???'
      soloTypeChip.textContent = '???'
    } else {
      soloPokemonImg.classList.add('colored')
    }

    soloRevealBanner.hidden = true
    SoundFX.playWhoosh()

    // Render Choice Buttons
    renderSoloChoices()

    // Clear Text Input if in typing mode
    soloGuessInput.value = ''
    soloSuggestions.hidden = true
  }

  function renderSoloChoices() {
    const buttons = soloChoicesGrid.querySelectorAll('.btn-choice')
    buttons.forEach((btn, idx) => {
      const p = state.choices[idx]
      btn.dataset.pokemonId = p.id
      btn.className = 'btn-choice'
      btn.disabled = false
      const nameEl = btn.querySelector('.choice-name')
      if (nameEl) nameEl.textContent = p.name
    })
  }

  function handleSoloAnswer(guessPokemonId) {
    if (state.soloLocked || !state.currentPokemon) return
    state.soloLocked = true
    state.totalRounds++

    const isCorrect = Number(guessPokemonId) === state.currentPokemon.id
    const target = state.currentPokemon

    // Reveal image with bounce and color
    soloPokemonImg.classList.remove('silhouette')
    soloPokemonImg.classList.add('revealed', 'reveal-bounce')
    soloDexChip.textContent = `POKÉDEX #${target.dex}`
    soloRegionChip.textContent = `${target.region} · Gen ${target.gen}`
    soloTypeChip.textContent = target.types.join(' / ')

    // Show name banner stamp
    soloRevealName.textContent = target.name.toUpperCase()
    soloRevealTypes.textContent = `${target.region} · Gen ${target.gen} · ${target.types.join(' / ')} · #${target.dex}`
    soloRevealBanner.hidden = false

    // Update Choice Button Highlights
    const buttons = soloChoicesGrid.querySelectorAll('.btn-choice')
    buttons.forEach((btn) => {
      btn.disabled = true
      const id = Number(btn.dataset.pokemonId)
      if (id === target.id) {
        btn.classList.add('correct')
      } else if (id === Number(guessPokemonId) && !isCorrect) {
        btn.classList.add('wrong')
      }
    })

    if (isCorrect) {
      state.totalHits++
      state.streak++
      if (state.streak > state.bestStreak) state.bestStreak = state.streak

      const streakBonus = Math.min(state.streak * 10, 100)
      const silhouetteBonus = state.visualMode === 'silhouette' ? 50 : 0
      state.score += 100 + streakBonus + silhouetteBonus

      SoundFX.playCorrect()
      pulseLeds('hit')
      showToast(`Acertou! É o ${target.name}! (+${100 + streakBonus + silhouetteBonus} pts)`, 'success')
      if (state.streak % 5 === 0) launchConfetti()
    } else {
      state.streak = 0
      SoundFX.playWrong()
      pulseLeds('miss')
      triggerScreenShake(soloMonitor)
      showToast(`Errou! Era o ${target.name}!`, 'error')
    }

    updateSoloHud()

    // Advance to next after 1.8 seconds
    setTimeout(() => {
      state.round++
      nextSoloQuestion()
    }, 1800)
  }

  function updateSoloHud() {
    hudScore.textContent = state.score
    hudStreak.textContent = state.streak
  }

  // ==================== AUTOCOMPLETE SUGGESTIONS ====================
  function updateSuggestions(query) {
    const q = normalizePt(query)
    if (!q || q.length < 2) {
      soloSuggestions.hidden = true
      return
    }

    const matches = pokemonData.filter((p) => {
      return (
        normalizePt(p.name).includes(q) ||
        normalizePt(p.englishName).includes(q) ||
        p.acceptedNames.some((alt) => alt.includes(q))
      )
    }).slice(0, 5)

    if (!matches.length) {
      soloSuggestions.hidden = true
      return
    }

    soloSuggestions.innerHTML = ''
    matches.forEach((p) => {
      const item = document.createElement('div')
      item.className = 'suggestion-item'
      item.textContent = p.name
      item.addEventListener('click', () => {
        soloGuessInput.value = p.name
        soloSuggestions.hidden = true
        handleSoloAnswer(p.id)
      })
      soloSuggestions.appendChild(item)
    })
    soloSuggestions.hidden = false
  }

  // ==================== MULTIPLAYER LOGIC (NBPRoom P2P) ====================
  let multiRoom = null
  let multiTimerInterval = null
  let botSimulationInterval = null

  const vsState = {
    roomCode: '',
    arenaType: 'versus', // 'versus' | 'royale'
    maxPlayers: 2,
    status: 'lobby', // 'lobby' | 'playing' | 'gameover'
    generation: 'all',
    roundIndex: 0,
    roundTimeLeft: 10,
    currentPokemon: null,
    choices: [],
    roundAnswered: false,
    players: [],
    history: [],
  }

  const BOT_NAMES = ['Gary Carvalho', 'Ash Ketchum', 'Misty Cerulean', 'Brock Pewter', 'Jessie Rocket', 'James Rocket']

  function initMultiplayerRoom() {
    if (multiRoom) return

    multiRoom = new window.NBPRoom({
      gameId: 'pokemon-nbp',
      defaultPrefix: 'POK',
      onStateSync: (remoteState) => {
        // Sync full game state from Host
        Object.assign(vsState, remoteState)
        renderMultiplayerUI()
      },
      onAction: (actionData, profile) => {
        if (multiRoom.isHost) {
          handleHostAction(actionData, profile)
        } else if (actionData?.type === 'HOST_LEFT') {
          multiRoom.promoteToHost(vsState.players)
          showToast('O Host saiu! Você agora é o novo Host da partida.', 'info')
        }
      },
      onStatus: (status) => {
        updateMultiStatusUI(status)
        if (status.connected && !multiRoom.isHost) {
          multiRoom.sendToHost({ type: 'JOIN_REQUEST', profile: multiRoom.profile })
        }
      },
      onError: (err) => {
        console.error('Erro de rede P2P:', err)
        showToast('Erro de conexão P2P.', 'error')
      },
    })
  }

  function updateMultiStatusUI(status) {
    const dot = multiP2pStatus.querySelector('.status-dot')
    if (status.connected) {
      dot.classList.add('connected')
      multiStatusText.textContent = 'Conectado P2P'
    } else {
      dot.classList.remove('connected')
      multiStatusText.textContent = 'Aguardando P2P...'
    }
  }

  function initHostMultiRoom(customCode = '') {
    initMultiplayerRoom()
    const code = (customCode || `POK-${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase()
    multiRoom.hostRoom(code)

    vsState.roomCode = code
    vsState.arenaType = state.mode === 'royale' ? 'royale' : 'versus'
    vsState.maxPlayers = vsState.arenaType === 'royale' ? 6 : 2
    vsState.generation = multiGenSelect ? multiGenSelect.value : 'all'
    vsState.status = 'lobby'
    vsState.roundIndex = 0
    vsState.players = [
      {
        id: multiRoom.profile.id,
        name: multiRoom.profile.name || 'Treinador Red',
        isHost: true,
        isBot: false,
        score: 0,
        hearts: 3,
        eliminated: false,
        answered: false,
        hit: false,
      },
    ]

    syncMultiState()
    renderMultiplayerUI()
    showToast(`Sala ${code} criada com sucesso!`, 'success')
  }

  function joinMultiRoom(code) {
    if (!code) return
    initMultiplayerRoom()
    const cleanCode = code.trim().toUpperCase()
    multiRoom.joinRoom(cleanCode)
    vsState.roomCode = cleanCode
    multiRoom.sendToHost({ type: 'JOIN_REQUEST', profile: multiRoom.profile })
    renderMultiplayerUI()
  }

  function handleHostAction(action, profile) {
    if (!action) return

    if (action.type === 'JOIN_REQUEST') {
      const existing = vsState.players.find((p) => p.id === profile.id)
      if (!existing && vsState.players.length < vsState.maxPlayers) {
        vsState.players.push({
          id: profile.id,
          name: profile.name || `Treinador #${vsState.players.length + 1}`,
          isHost: false,
          isBot: false,
          score: 0,
          hearts: 3,
          eliminated: false,
          answered: false,
          hit: false,
        })
        appendFeed(`${profile.name || 'Um novo treinador'} entrou na sala!`)
        syncMultiState()
      }
    } else if (action.type === 'SUBMIT_ANSWER') {
      const player = vsState.players.find((p) => p.id === action.playerId)
      if (player && !player.eliminated && !player.answered && vsState.status === 'playing') {
        player.answered = true
        const isCorrect = Number(action.pokemonId) === vsState.currentPokemon.id
        player.hit = isCorrect

        if (isCorrect) {
          player.score += 100
          appendFeed(`⚡ ${player.name} acertou (+100 pts)!`, 'hit')
        } else {
          appendFeed(`❌ ${player.name} errou!`, 'miss')
          if (vsState.arenaType === 'royale') {
            player.hearts = Math.max(0, player.hearts - 1)
            if (player.hearts === 0) {
              player.eliminated = true
              appendFeed(`💀 ${player.name} foi ELIMINADO!`, 'miss')
            }
          }
        }

        checkRoundEndCondition()
        syncMultiState()
      }
    }
  }

  function checkRoundEndCondition() {
    const activePlayers = vsState.players.filter((p) => !p.eliminated)
    const allAnswered = activePlayers.every((p) => p.answered)

    if (allAnswered) {
      endMultiRound()
    }
  }

  function startMultiMatch() {
    if (!multiRoom.isHost) return
    vsState.status = 'playing'
    vsState.roundIndex = 0

    // Reset scores & hearts
    vsState.players.forEach((p) => {
      p.score = 0
      p.hearts = 3
      p.eliminated = false
      p.answered = false
      p.hit = false
    })

    appendFeed('🎮 A partida começou! Quem é esse Pokémon?!', 'system')
    nextMultiRound()
  }

  function nextMultiRound() {
    if (!multiRoom.isHost) return
    vsState.roundIndex++
    vsState.roundTimeLeft = 9

    // Check Royale win condition
    if (vsState.arenaType === 'royale') {
      const alive = vsState.players.filter((p) => !p.eliminated)
      if (alive.length <= 1) {
        endMultiMatch(alive[0])
        return
      }
    } else if (vsState.roundIndex > 10) {
      // 1v1 ends at 10 rounds
      const sorted = [...vsState.players].sort((a, b) => b.score - a.score)
      endMultiMatch(sorted[0])
      return
    }

    // Pick a random Pokémon for this round based on match generation
    const pool = getFilteredPool(vsState.generation || 'all')
    const target = pool[Math.floor(Math.random() * pool.length)]
    const distractors = shuffle(pool.filter((p) => p.id !== target.id)).slice(0, 3)

    vsState.currentPokemon = target
    vsState.choices = shuffle([target, ...distractors])

    // Reset round states
    vsState.players.forEach((p) => {
      p.answered = false
      p.hit = false
    })

    syncMultiState()
    startRoundTimer()
    simulateBots()
  }

  function startRoundTimer() {
    clearInterval(multiTimerInterval)
    multiTimerInterval = setInterval(() => {
      if (vsState.roundTimeLeft > 0) {
        vsState.roundTimeLeft--
        if (vsState.roundTimeLeft <= 3) SoundFX.playTick()
        renderMultiTimer()
        if (multiRoom.isHost && vsState.roundTimeLeft === 0) {
          // Timeout: penalize anyone who hasn't answered
          vsState.players.forEach((p) => {
            if (!p.eliminated && !p.answered) {
              p.answered = true
              p.hit = false
              if (vsState.arenaType === 'royale') {
                p.hearts = Math.max(0, p.hearts - 1)
                if (p.hearts === 0) {
                  p.eliminated = true
                  appendFeed(`⏳ ${p.name} estourou o tempo e foi ELIMINADO!`, 'miss')
                }
              }
            }
          })
          endMultiRound()
        }
      }
    }, 1000)
  }

  function endMultiRound() {
    clearInterval(multiTimerInterval)
    clearInterval(botSimulationInterval)

    // Reveal target
    if (multiRoom.isHost) {
      syncMultiState()
      setTimeout(() => {
        nextMultiRound()
      }, 2400)
    }
  }

  function endMultiMatch(winner) {
    clearInterval(multiTimerInterval)
    clearInterval(botSimulationInterval)
    vsState.status = 'gameover'
    syncMultiState()

    const winnerName = winner ? winner.name : 'Ninguém'
    appendFeed(`🏆 ${winnerName} é o Grande Vencedor!`, 'hit')
    SoundFX.playFanfare()
    launchConfetti()
    showSummaryModal(winner)
  }

  function simulateBots() {
    clearInterval(botSimulationInterval)
    if (!multiRoom.isHost) return

    const bots = vsState.players.filter((p) => p.isBot && !p.eliminated)
    bots.forEach((bot) => {
      // Simulate answer latency between 2.5s and 6.5s
      const delayMs = Math.floor(2500 + Math.random() * 4000)
      setTimeout(() => {
        if (vsState.status !== 'playing' || bot.answered || !vsState.currentPokemon) return
        // 75% accuracy for bots
        const willHit = Math.random() < 0.75
        let chosenId = vsState.currentPokemon.id
        if (!willHit) {
          const wrongChoices = vsState.choices.filter((c) => c.id !== vsState.currentPokemon.id)
          chosenId = wrongChoices[Math.floor(Math.random() * wrongChoices.length)].id
        }
        handleHostAction({ type: 'SUBMIT_ANSWER', playerId: bot.id, pokemonId: chosenId }, bot)
      }, delayMs)
    })
  }

  function syncMultiState() {
    renderMultiplayerUI()
    if (multiRoom && multiRoom.isHost) {
      multiRoom.broadcastState(vsState)
    }
  }

  function sendMultiAnswer(pokemonId) {
    if (vsState.status !== 'playing') return
    const me = vsState.players.find((p) => p.id === (multiRoom?.profile?.id || 'me'))
    if (!me || me.answered || me.eliminated) return

    const action = {
      type: 'SUBMIT_ANSWER',
      playerId: me.id,
      pokemonId: Number(pokemonId),
    }

    if (multiRoom.isHost) {
      handleHostAction(action, multiRoom.profile)
    } else {
      multiRoom.sendToHost(action)
    }
  }

  // ==================== MULTIPLAYER UI RENDERING ====================
  function renderMultiplayerUI() {
    multiRoomCode.textContent = vsState.roomCode || '---'
    multiModeName.textContent = vsState.arenaType === 'royale' ? 'Battle Royale (6P)' : 'Duelo 1v1'
    multiModeIcon.textContent = vsState.arenaType === 'royale' ? '👑' : '⚔️'

    // Lobby vs Match controls
    const isLobby = vsState.status === 'lobby'
    document.getElementById('multi-setup-box').hidden = !isLobby
    document.getElementById('multi-arena-view').hidden = isLobby

    // Host controls for bots
    btnAddBot.disabled = !multiRoom?.isHost || vsState.players.length >= vsState.maxPlayers
    btnRemBot.disabled = !multiRoom?.isHost || !vsState.players.some((p) => p.isBot)
    btnStartMulti.disabled = !multiRoom?.isHost || vsState.players.length < 2

    // Alive badge for Royale
    if (vsState.arenaType === 'royale') {
      arenaAliveBadge.hidden = false
      const aliveCount = vsState.players.filter((p) => !p.eliminated).length
      arenaAliveBadge.textContent = `Vivos: ${aliveCount}/${vsState.players.length}`
    } else {
      arenaAliveBadge.hidden = true
    }

    arenaRoundBadge.textContent = `Rodada ${vsState.roundIndex}`
    renderMultiTimer()

    // Render Question if playing
    if (vsState.status === 'playing' && vsState.currentPokemon) {
      const target = vsState.currentPokemon
      multiDexChip.textContent = state.visualMode === 'silhouette' ? 'POKÉDEX #???' : `POKÉDEX #${target.dex}`
      multiRegionChip.textContent = `${target.region} · Gen ${target.gen}`
      multiTypeChip.textContent = state.visualMode === 'silhouette' ? '???' : target.types.join(' / ')
      multiPokemonImg.src = target.svg

      const me = vsState.players.find((p) => p.id === (multiRoom?.profile?.id || 'me'))
      const answered = me?.answered || false

      if (answered || state.visualMode === 'colored') {
        multiPokemonImg.classList.remove('silhouette')
        multiPokemonImg.classList.add('revealed')
        multiRevealName.textContent = target.name.toUpperCase()
        multiRevealTypes.textContent = `${target.region} · Gen ${target.gen} · ${target.types.join(' / ')} · #${target.dex}`
        multiRevealBanner.hidden = false
      } else {
        multiPokemonImg.classList.add('silhouette')
        multiPokemonImg.classList.remove('revealed')
        multiRevealBanner.hidden = true
      }

      // Render 4 choices
      const btns = multiChoicesGrid.querySelectorAll('.multi-btn-choice')
      btns.forEach((btn, idx) => {
        const choice = vsState.choices[idx]
        if (!choice) return
        btn.dataset.pokemonId = choice.id
        btn.className = 'btn-choice multi-btn-choice'
        btn.disabled = answered || me?.eliminated
        const nameEl = btn.querySelector('.choice-name')
        if (nameEl) nameEl.textContent = choice.name

        if (answered) {
          if (choice.id === target.id) btn.classList.add('correct')
        }
      })
    }

    // Render Players List
    renderPlayersList()
  }

  function renderMultiTimer() {
    arenaTimerVal.textContent = `${vsState.roundTimeLeft}s`
    const pct = Math.max(0, (vsState.roundTimeLeft / 9) * 100)
    arenaTimerBar.style.width = `${pct}%`
  }

  function renderPlayersList() {
    multiPlayersList.innerHTML = ''
    const myId = multiRoom?.profile?.id

    vsState.players.forEach((p) => {
      const item = document.createElement('div')
      item.className = `player-item${p.id === myId ? ' is-me' : ''}${p.eliminated ? ' eliminated' : ''}`

      const info = document.createElement('div')
      info.className = 'player-item-info'

      const avatar = document.createElement('div')
      avatar.className = 'player-avatar'
      avatar.textContent = p.isBot ? '🤖' : '🧢'

      const name = document.createElement('span')
      name.className = 'player-name'
      name.textContent = p.name
      if (p.id === myId) {
        const tag = document.createElement('span')
        tag.className = 'player-name-tag'
        tag.textContent = '(Você)'
        name.appendChild(tag)
      }

      info.appendChild(avatar)
      info.appendChild(name)

      const stats = document.createElement('div')
      stats.className = 'player-stats'

      if (vsState.arenaType === 'royale') {
        const hearts = document.createElement('div')
        hearts.className = 'player-hearts'
        for (let i = 0; i < 3; i++) {
          hearts.textContent += i < p.hearts ? '❤️' : '🖤'
        }
        stats.appendChild(hearts)
      }

      const score = document.createElement('span')
      score.className = 'player-score'
      score.textContent = `${p.score} pts`
      stats.appendChild(score)

      item.appendChild(info)
      item.appendChild(stats)
      multiPlayersList.appendChild(item)
    })
  }

  function appendFeed(text, type = 'system') {
    const p = document.createElement('p')
    p.className = `feed-entry ${type}`
    p.textContent = text
    multiFeed.appendChild(p)
    multiFeed.scrollTop = multiFeed.scrollHeight
  }

  function showSummaryModal(winner) {
    if (winner) {
      modalBadge.textContent = '🏆 CAMPEÃO DA ARENA!'
      modalTitle.textContent = `${winner.name} Venceu!`
      modalDesc.textContent = `Partida finalizada com glória no ${vsState.arenaType === 'royale' ? 'Battle Royale' : 'Duelo 1v1'}!`
      modalScore.textContent = `${winner.score} pts`
      modalStreak.textContent = `${winner.hearts} vidas`
      modalAcc.textContent = '1º Lugar'
    } else {
      modalBadge.textContent = 'FIM DE JOGO'
      modalTitle.textContent = 'Partida Concluída'
      modalDesc.textContent = 'Treine mais para se tornar um Mestre Pokémon!'
      modalScore.textContent = `${state.score} pts`
      modalStreak.textContent = `🔥 ${state.bestStreak}`
      const acc = state.totalRounds > 0 ? Math.round((state.totalHits / state.totalRounds) * 100) : 0
      modalAcc.textContent = `${acc}%`
    }
    modalSummary.showModal()
  }

  // ==================== EVENT LISTENERS & INITIALIZATION ====================
  function setupEventListeners() {
    // Mode Switcher Tabs
    document.querySelectorAll('.mode-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        SoundFX.playSelect()
        document.querySelectorAll('.mode-tab').forEach((t) => {
          t.classList.remove('active')
          t.setAttribute('aria-selected', 'false')
        })
        tab.classList.add('active')
        tab.setAttribute('aria-selected', 'true')

        const selectedMode = tab.dataset.mode
        state.mode = selectedMode

        if (selectedMode === 'solo') {
          viewSolo.hidden = false
          viewMultiplayer.hidden = true
          soloHudPills.hidden = false
        } else {
          viewSolo.hidden = true
          viewMultiplayer.hidden = false
          soloHudPills.hidden = true
          vsState.arenaType = selectedMode === 'royale' ? 'royale' : 'versus'
          vsState.maxPlayers = selectedMode === 'royale' ? 6 : 2
          initHostMultiRoom()
        }
      })
    })

    // Visual Mode Toggle: Silhouette vs Colored
    btnToggleVisual.addEventListener('click', () => {
      toggleVisualMode()
    })

    // Drawer options
    optVisSilhouette.addEventListener('click', () => setVisualMode('silhouette'))
    optVisColored.addEventListener('click', () => setVisualMode('colored'))

    // Audio Toggle
    btnSound.addEventListener('click', () => {
      soundEnabled = !soundEnabled
      soundIcon.textContent = soundEnabled ? '🔊' : '🔇'
      SoundFX.playSelect()
    })

    // Config Drawer Toggle
    btnToggleDrawer.addEventListener('click', () => {
      SoundFX.playSelect()
      const isOpen = !configDrawer.hidden
      configDrawer.hidden = isOpen
      btnToggleDrawer.setAttribute('aria-expanded', String(!isOpen))
    })

    // Tier / Generation Selector
    tierSelect.addEventListener('change', (e) => {
      state.tier = e.target.value
      startSoloQuiz()
    })

    if (multiGenSelect) {
      multiGenSelect.addEventListener('change', (e) => {
        vsState.generation = e.target.value
        syncMultiState()
      })
    }

    // Input Mode Segmented Control
    optInputChoices.addEventListener('click', () => setInputMode('choices'))
    optInputText.addEventListener('click', () => setInputMode('text'))

    // Seed Input
    btnApplySeed.addEventListener('click', () => {
      state.seed = seedInput.value.trim().toUpperCase()
      showToast(`Partida gerada com Seed: ${state.seed || 'Aleatória'}`)
      startSoloQuiz()
    })

    // Solo Choice Buttons
    soloChoicesGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-choice')
      if (btn && btn.dataset.pokemonId) {
        SoundFX.playSelect()
        handleSoloAnswer(btn.dataset.pokemonId)
      }
    })

    // Multi Choice Buttons
    multiChoicesGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.multi-btn-choice')
      if (btn && btn.dataset.pokemonId) {
        SoundFX.playSelect()
        sendMultiAnswer(btn.dataset.pokemonId)
      }
    })

    // Text Input Autocomplete & Form
    soloGuessInput.addEventListener('input', (e) => {
      updateSuggestions(e.target.value)
    })

    soloGuessForm.addEventListener('submit', (e) => {
      e.preventDefault()
      const val = normalizePt(soloGuessInput.value)
      if (!val) return

      const matched = pokemonData.find((p) => {
        return (
          normalizePt(p.name) === val ||
          normalizePt(p.englishName) === val ||
          p.acceptedNames.some((alt) => alt === val)
        )
      })

      if (matched) {
        handleSoloAnswer(matched.id)
      } else {
        showToast('Pokémon não reconhecido!', 'error')
      }
    })

    // Multiplayer Buttons
    btnMultiHost.addEventListener('click', () => {
      const name = playerNameInput.value.trim()
      if (name && multiRoom) multiRoom.setPlayerName(name)
      initHostMultiRoom()
    })

    btnMultiJoin.addEventListener('click', () => {
      const code = roomCodeInput.value.trim().toUpperCase()
      const name = playerNameInput.value.trim()
      if (name && multiRoom) multiRoom.setPlayerName(name)
      joinMultiRoom(code)
    })

    btnCopyRoom.addEventListener('click', () => {
      const url = `${window.location.origin}${window.location.pathname}?room=${vsState.roomCode}`
      navigator.clipboard.writeText(url).then(() => {
        showToast('Link da sala copiado!', 'success')
      })
    })

    btnAddBot.addEventListener('click', () => {
      if (!multiRoom?.isHost || vsState.players.length >= vsState.maxPlayers) return
      const botName = BOT_NAMES[vsState.players.length % BOT_NAMES.length]
      vsState.players.push({
        id: `bot-${Date.now()}-${Math.random()}`,
        name: botName,
        isHost: false,
        isBot: true,
        score: 0,
        hearts: 3,
        eliminated: false,
        answered: false,
        hit: false,
      })
      appendFeed(`🤖 ${botName} entrou na arena!`)
      syncMultiState()
    })

    btnRemBot.addEventListener('click', () => {
      if (!multiRoom?.isHost) return
      const botIdx = vsState.players.findLastIndex((p) => p.isBot)
      if (botIdx !== -1) {
        const removed = vsState.players.splice(botIdx, 1)[0]
        appendFeed(`🤖 ${removed.name} saiu da arena.`)
        syncMultiState()
      }
    })

    btnStartMulti.addEventListener('click', () => {
      startMultiMatch()
    })

    // Modal Buttons
    btnModalRestart.addEventListener('click', () => {
      modalSummary.close()
      if (state.mode === 'solo') {
        startSoloQuiz()
      } else {
        startMultiMatch()
      }
    })

    btnModalClose.addEventListener('click', () => {
      modalSummary.close()
    })

    // Keyboard Shortcuts: 1, 2, 3, 4
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
      const key = e.key
      if (['1', '2', '3', '4'].includes(key)) {
        const idx = Number(key) - 1
        if (state.mode === 'solo') {
          const btns = soloChoicesGrid.querySelectorAll('.btn-choice')
          if (btns[idx] && !btns[idx].disabled) btns[idx].click()
        } else {
          const btns = multiChoicesGrid.querySelectorAll('.multi-btn-choice')
          if (btns[idx] && !btns[idx].disabled) btns[idx].click()
        }
      }
    })
  }

  function setVisualMode(mode) {
    state.visualMode = mode
    const isSilhouette = mode === 'silhouette'
    visIcon.textContent = isSilhouette ? '🌑' : '🎨'
    visLabel.textContent = isSilhouette ? 'Silhueta' : 'Colorido'
    btnToggleVisual.classList.toggle('colored', !isSilhouette)
    optVisSilhouette.classList.toggle('active', isSilhouette)
    optVisColored.classList.toggle('active', !isSilhouette)

    if (state.mode === 'solo' && state.currentPokemon && !state.soloLocked) {
      if (isSilhouette) {
        soloPokemonImg.classList.add('silhouette')
        soloPokemonImg.classList.remove('colored')
        soloDexChip.textContent = 'POKÉDEX #???'
        soloTypeChip.textContent = '???'
      } else {
        soloPokemonImg.classList.remove('silhouette')
        soloPokemonImg.classList.add('colored')
        soloDexChip.textContent = `POKÉDEX #${state.currentPokemon.dex}`
        soloTypeChip.textContent = state.currentPokemon.types.join(' / ')
      }
    }
    SoundFX.playSelect()
  }

  function toggleVisualMode() {
    setVisualMode(state.visualMode === 'silhouette' ? 'colored' : 'silhouette')
  }

  function setInputMode(mode) {
    state.inputMode = mode
    const isChoices = mode === 'choices'
    optInputChoices.classList.toggle('active', isChoices)
    optInputText.classList.toggle('active', !isChoices)
    soloChoicesGrid.hidden = !isChoices
    soloTextMode.hidden = isChoices
    if (!isChoices) soloGuessInput.focus()
  }

  // ==================== APP BOOTSTRAP ====================
  async function init() {
    try {
      const res = await fetch('data/pokemon.json')
      if (!res.ok) throw new Error('Não foi possível carregar o banco de Pokémon.')
      pokemonData = await res.json()
      console.log(`Carregados ${pokemonData.length} Pokémon com sucesso.`)

      setupEventListeners()

      // Check URL parameters for invites
      const params = new URLSearchParams(window.location.search)
      const roomParam = params.get('room') || params.get('sala')
      const nickParam = params.get('nick') || params.get('nome')

      if (nickParam) {
        playerNameInput.value = nickParam
      }

      if (roomParam) {
        // Automatically switch to multiplayer
        const tabVersus = document.querySelector('.mode-tab[data-mode="versus"]')
        if (tabVersus) tabVersus.click()
        roomCodeInput.value = roomParam.trim().toUpperCase()
        joinMultiRoom(roomParam.trim().toUpperCase())
      } else {
        startSoloQuiz()
      }
    } catch (err) {
      console.error('Falha na inicialização do jogo:', err)
      showToast('Erro ao carregar dados do jogo.', 'error')
    }
  }

  window.addEventListener('DOMContentLoaded', init)
})()
