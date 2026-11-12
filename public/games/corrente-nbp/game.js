;(() => {
  const BOT_NAMES = [
    { name: 'Bot Clarice', color: '#a855f7' },
    { name: 'Bot Machado', color: '#f59e0b' },
    { name: 'Bot Drummond', color: '#10b981' },
    { name: 'Bot Cecília', color: '#ec4899' },
  ]

  const STARTER_POOL = 'abcdefghijlmnoprstuvz'.split('')

  let allValidSet = new Set()
  let prefixCountMap = new Map() // prefix (1, 2 or 3 chars) -> count of words
  let botWordsByPrefix = new Map() // prefix -> array of common words for bots
  let dictReady = false
  let soundEnabled = true
  let audioCtx = null

  // Room & Game State (Host is authoritative and syncs to P2P clients)
  let room = null
  let timerInterval = null
  let botThinkTimeout = null

  const gameState = {
    roomCode: '',
    status: 'lobby', // 'lobby' | 'playing' | 'gameover'
    ruleMode: 'progressive', // 'progressive' | 'last1' | 'last2'
    players: [], // [{ id, name, color, isBot, lives, score, eliminated }]
    turnIndex: 0,
    starterLetters: ['c', 'm', 'p', 't'], // 4 random letters when chain is empty
    selectedStarter: '',
    requiredPrefix: '', // '' when choosing from 4 starter letters, or 'a', 'to', 'car', etc.
    possibleCount: 0,
    chainLevel: 1, // 1 (1 letra), 2 (2 últimas letras), 3 (2/3 últimas letras + rápido)
    chain: [], // [{ word, playerName, prefixUsed, nextPrefix }]
    usedWords: [], // array of normalized words used in this match
    liveTyping: '',
    turnDurationMs: 12000,
    turnRemainingMs: 12000,
    winner: null,
  }

  // DOM Elements
  const playerNameInput = document.getElementById('player-name-input')
  const roomCodeInput = document.getElementById('room-code-input')
  const roomCodeDisplay = document.getElementById('room-code-display')
  const btnJoinRoom = document.getElementById('btn-join-room')
  const btnHostRoom = document.getElementById('btn-host-room')
  const btnCopyRoom = document.getElementById('btn-copy-room')
  const btnToggleDrawer = document.getElementById('btn-toggle-drawer')
  const roomDrawer = document.getElementById('room-drawer')
  const p2pStatus = document.getElementById('p2p-status')
  const ruleModeSelect = document.getElementById('rule-mode-select')
  const btnAddBot = document.getElementById('btn-add-bot')
  const btnRemoveBot = document.getElementById('btn-remove-bot')
  const btnSound = document.getElementById('btn-sound')
  const toastContainer = document.getElementById('toast-container')

  const chainLevelBadge = document.getElementById('chain-level-badge')
  const playersRing = document.getElementById('players-ring')
  const timerBarFill = document.getElementById('timer-bar-fill')
  const turnStatusText = document.getElementById('turn-status-text')
  const timerSeconds = document.getElementById('timer-seconds')

  const starterLettersBox = document.getElementById('starter-letters-box')
  const starterLettersGrid = document.getElementById('starter-letters-grid')
  const prefixChallengeBox = document.getElementById('prefix-challenge-box')
  const prevWordFormatted = document.getElementById('prev-word-formatted')
  const requiredPrefixPill = document.getElementById('required-prefix-pill')
  const possibleWordsCount = document.getElementById('possible-words-count')

  const liveTypingPreview = document.getElementById('live-typing-preview')
  const liveTypingPlayer = document.getElementById('live-typing-player')
  const liveTypingLetters = document.getElementById('live-typing-letters')

  const wordForm = document.getElementById('word-form')
  const prefixInputWrapper = document.querySelector('.prefix-input-wrapper')
  const lockedPrefixTag = document.getElementById('locked-prefix-tag')
  const wordInput = document.getElementById('word-input')
  const btnSubmitWord = document.getElementById('btn-submit-word')
  const btnStartMatch = document.getElementById('btn-start-match')

  const chainCount = document.getElementById('chain-count')
  const escalationHint = document.getElementById('escalation-hint')
  const chainTrail = document.getElementById('chain-trail')
  const modalWinner = document.getElementById('modal-winner')
  const confettiCanvas = document.getElementById('confetti-canvas')

  function normalizePt(str) {
    return String(str || '')
      .toLocaleLowerCase('pt-BR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z]/g, '')
  }

  function renderHearts(lives, eliminated) {
    if (eliminated) {
      return `<span class="eliminated-badge"><i data-lucide="skull" class="inline-icon"></i> Eliminado</span>`
    }
    let html = '<div class="hearts-row">'
    for (let i = 0; i < 3; i++) {
      if (i < lives) {
        html += `<span class="heart-icon active" title="Vida ativa"><i data-lucide="heart" class="inline-icon"></i></span>`
      } else {
        html += `<span class="heart-icon lost" title="Vida perdida"><i data-lucide="heart-crack" class="inline-icon"></i></span>`
      }
    }
    html += '</div>'
    return html
  }

  function refreshLucideIcons() {
    if (typeof window.lucide !== 'undefined' && typeof window.lucide.createIcons === 'function') {
      try {
        window.lucide.createIcons()
      } catch {
        // ignore
      }
    }
  }

  // ==================== PROCEDURAL SOUND FX (WEB AUDIO API) ====================
  const SoundFX = {
    ctx: null,
    getCtx() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext
        if (AudioCtx) this.ctx = new AudioCtx()
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {})
      }
      return this.ctx
    },
    // 1. Mechanical keyboard key tap when typing
    keyTap() {
      if (!soundEnabled) return
      const ctx = this.getCtx()
      if (!ctx) return
      try {
        const now = ctx.currentTime
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(750 + Math.random() * 220, now)
        osc.frequency.exponentialRampToValueAtTime(260, now + 0.024)
        gain.gain.setValueAtTime(0.045, now)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.024)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.024)
      } catch (_) {}
    },
    // 2. Ascending mechanical latch / ratchet sound when validating word and baton pass
    latchPass() {
      if (!soundEnabled) return
      const ctx = this.getCtx()
      if (!ctx) return
      try {
        const now = ctx.currentTime
        // Micro ratchet click 1
        const c1 = ctx.createOscillator()
        const g1 = ctx.createGain()
        c1.type = 'square'
        c1.frequency.setValueAtTime(680, now)
        g1.gain.setValueAtTime(0.05, now)
        g1.gain.exponentialRampToValueAtTime(0.001, now + 0.018)
        c1.connect(g1)
        g1.connect(ctx.destination)
        c1.start(now)
        c1.stop(now + 0.018)

        // Micro ratchet click 2
        const c2 = ctx.createOscillator()
        const g2 = ctx.createGain()
        c2.type = 'square'
        c2.frequency.setValueAtTime(940, now + 0.035)
        g2.gain.setValueAtTime(0.07, now + 0.035)
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.058)
        c2.connect(g2)
        g2.connect(ctx.destination)
        c2.start(now + 0.035)
        c2.stop(now + 0.058)

        // Resonant lock engate (chime)
        const chime = ctx.createOscillator()
        const gChime = ctx.createGain()
        chime.type = 'sine'
        chime.frequency.setValueAtTime(523.25, now + 0.065) // C5
        chime.frequency.exponentialRampToValueAtTime(880, now + 0.18) // A5
        gChime.gain.setValueAtTime(0.11, now + 0.065)
        gChime.gain.exponentialRampToValueAtTime(0.0001, now + 0.45)
        chime.connect(gChime)
        gChime.connect(ctx.destination)
        chime.start(now + 0.065)
        chime.stop(now + 0.45)
      } catch (_) {}
    },
    // 3. Short low buzz for invalid or repeated word
    errorBuzz() {
      if (!soundEnabled) return
      const ctx = this.getCtx()
      if (!ctx) return
      try {
        const now = ctx.currentTime
        const osc = ctx.createOscillator()
        const filter = ctx.createBiquadFilter()
        const gain = ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(115, now)
        osc.frequency.setValueAtTime(90, now + 0.05)
        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(420, now)
        gain.gain.setValueAtTime(0.12, now)
        gain.gain.linearRampToValueAtTime(0.09, now + 0.05)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
        osc.connect(filter)
        filter.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.12)
      } catch (_) {}
    },
    // 4. Accelerating tick-tock as time expires (< 4.5s)
    fuseTick(pitchHigh = false) {
      if (!soundEnabled) return
      const ctx = this.getCtx()
      if (!ctx) return
      try {
        const now = ctx.currentTime
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(pitchHigh ? 920 : 740, now)
        gain.gain.setValueAtTime(0.075, now)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.026)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.026)
      } catch (_) {}
    },
    // 5. Heavy impact thump on timeout / lost heart
    explosionThump() {
      if (!soundEnabled) return
      const ctx = this.getCtx()
      if (!ctx) return
      try {
        const now = ctx.currentTime
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(145, now)
        osc.frequency.exponentialRampToValueAtTime(32, now + 0.3)
        gain.gain.setValueAtTime(0.24, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.34)
      } catch (_) {}
    },
  }

  function playTone(freq, duration = 0.08, type = 'sine', gainVal = 0.08) {
    if (!soundEnabled) return
    try {
      const ctx = SoundFX.getCtx()
      if (!ctx) return
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      gain.gain.setValueAtTime(gainVal, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + duration)
    } catch {}
  }

  function playChord(notes, stepMs = 70) {
    notes.forEach((n, idx) => setTimeout(() => playTone(n, 0.15, 'triangle', 0.1), idx * stepMs))
  }

  function showToast(msg, duration = 2300) {
    const el = document.createElement('div')
    el.className = 'toast'
    el.textContent = msg
    toastContainer.appendChild(el)
    setTimeout(() => {
      el.style.opacity = '0'
      el.style.transition = 'opacity 0.2s ease'
      setTimeout(() => el.remove(), 220)
    }, duration)
  }

  // ==================== GAME JUICE & BATON PASS ANIMATIONS ====================
  let lastObservedChainLen = 0

  function spawnShockwave(x, y) {
    const wave = document.createElement('div')
    wave.className = 'shockwave-pulse'
    wave.style.left = `${x}px`
    wave.style.top = `${y}px`
    document.body.appendChild(wave)
    setTimeout(() => wave.remove(), 650)
  }

  function spawnDebris(rect) {
    const count = 18
    const colors = ['#f43f5e', '#fbbf24', '#ffffff', '#ef4444', '#fda4af', '#fb7185']
    const startX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
    const startY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2

    for (let i = 0; i < count; i++) {
      const shard = document.createElement('div')
      shard.className = 'particle-shard'
      const color = colors[i % colors.length]
      const size = 6 + Math.random() * 8
      shard.style.width = `${size}px`
      shard.style.height = `${size}px`
      shard.style.background = color
      shard.style.left = `${startX}px`
      shard.style.top = `${startY}px`
      document.body.appendChild(shard)

      const angle = Math.random() * Math.PI * 2
      const speed = 70 + Math.random() * 140
      const vx = Math.cos(angle) * speed
      const vy = Math.sin(angle) * speed - 50
      const rot = (Math.random() - 0.5) * 480

      if (typeof shard.animate === 'function') {
        shard.animate(
          [
            { transform: 'translate(-50%, -50%) scale(1.1) rotate(0deg)', opacity: 1 },
            {
              transform: `translate(calc(-50% + ${vx}px), calc(-50% + ${vy + 140}px)) scale(0.2) rotate(${rot}deg)`,
              opacity: 0,
            },
          ],
          {
            duration: 600 + Math.random() * 300,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'forwards',
          }
        ).onfinish = () => shard.remove()
      } else {
        setTimeout(() => shard.remove(), 600)
      }
    }
  }

  function triggerBatonPassAnimation(word, nextPrefix) {
    if (!nextPrefix) return
    const targetMedallion = document.getElementById('required-prefix-pill')
    const sourceCard = document.getElementById('word-form') || document.getElementById('live-word-card')
    if (!targetMedallion || !sourceCard) return

    const tRect = targetMedallion.getBoundingClientRect()
    const sRect = sourceCard.getBoundingClientRect()

    const flyer = document.createElement('div')
    flyer.className = 'baton-flyer'
    flyer.textContent = nextPrefix.toUpperCase()
    document.body.appendChild(flyer)

    const startX = sRect.left + sRect.width * 0.45
    const startY = sRect.top + sRect.height * 0.35
    const endX = tRect.left + tRect.width * 0.5
    const endY = tRect.top + tRect.height * 0.5

    const duration = 540
    const startTime = performance.now()

    function easeBackOut(t) {
      const s = 1.70158
      t = t - 1
      return t * t * ((s + 1) * t + s) + 1
    }

    function frame(now) {
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / duration)

      // Parabolic vertical arc (letter lifts high above table then drops)
      const arcRise = -85 * Math.sin(progress * Math.PI)
      const currentX = startX + (endX - startX) * progress
      const currentY = startY + (endY - startY) * progress + arcRise

      // Scale up to 1.35x at peak then lands
      const scale = 1.0 + 0.35 * Math.sin(progress * Math.PI)
      const rot = -10 + 20 * progress

      flyer.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%) scale(${scale}) rotate(${rot}deg)`

      if (progress < 1) {
        requestAnimationFrame(frame)
      } else {
        flyer.remove()

        // 1. Elastic bounce on central medallion
        targetMedallion.classList.remove('medallion-impact')
        void targetMedallion.offsetWidth
        targetMedallion.classList.add('medallion-impact')

        // 2. Shockwave pulse
        spawnShockwave(endX, endY)

        // 3. Audio: ascending mechanical latch
        SoundFX.latchPass()
      }
    }

    requestAnimationFrame(frame)
  }

  function randomRoomCode() {
    return `ELO-${Math.floor(1000 + Math.random() * 9000)}`
  }

  function pickFourStarterLetters() {
    const copy = [...STARTER_POOL]
    const picked = []
    for (let i = 0; i < 4; i++) {
      const idx = Math.floor(Math.random() * copy.length)
      picked.push(copy.splice(idx, 1)[0])
    }
    return picked
  }

  function getActivePrefixForTyping() {
    if (gameState.requiredPrefix) return gameState.requiredPrefix
    return gameState.selectedStarter || ''
  }

  // Computes the next required prefix (1, 2 or 3 last letters) with anti-deadlock check
  function computeNextPrefix(wordNorm, nextChainLen, ruleMode) {
    let targetLevel = 1
    if (ruleMode === 'last2') {
      targetLevel = 2
    } else if (ruleMode === 'progressive') {
      if (nextChainLen >= 14) targetLevel = 3
      else if (nextChainLen >= 6) targetLevel = 2
      else targetLevel = 1
    }

    const candidates = []
    if (targetLevel >= 3 && wordNorm.length >= 4) {
      candidates.push({ prefix: wordNorm.slice(-3), level: 3, minWords: 20 })
    }
    if (targetLevel >= 2 && wordNorm.length >= 3) {
      candidates.push({ prefix: wordNorm.slice(-2), level: 2, minWords: 15 })
      // If plural ending in 's' has no words (like 'ns'), also try the 2 letters before 's'
      if (wordNorm.endsWith('s') && wordNorm.length >= 4) {
        candidates.push({ prefix: wordNorm.slice(-3, -1), level: 2, minWords: 15 })
      }
    }
    candidates.push({ prefix: wordNorm.slice(-1), level: 1, minWords: 5 })
    if (wordNorm.length >= 2) {
      candidates.push({ prefix: wordNorm.slice(-2, -1), level: 1, minWords: 1 })
    }

    for (const c of candidates) {
      const count = prefixCountMap.get(c.prefix) || 0
      if (count >= c.minWords) {
        return { prefix: c.prefix, level: c.level, possibleCount: count }
      }
    }

    const fallback = wordNorm.slice(-1)
    return {
      prefix: fallback,
      level: 1,
      possibleCount: prefixCountMap.get(fallback) || 100,
    }
  }

  // ==================== UI RENDERING ====================
  function renderUI() {
    const isMyTurn =
      gameState.status === 'playing' &&
      gameState.players[gameState.turnIndex]?.id === room?.profile.id

    // Level badge
    if (gameState.chainLevel === 1) {
      chainLevelBadge.className = 'level-badge level-1'
      chainLevelBadge.textContent = 'FASE 1 · ÚLTIMA LETRA (1)'
    } else if (gameState.chainLevel === 2) {
      chainLevelBadge.className = 'level-badge level-2'
      chainLevelBadge.textContent = '🔥 FASE 2 · 2 ÚLTIMAS LETRAS!'
    } else {
      chainLevelBadge.className = 'level-badge level-3'
      chainLevelBadge.textContent = '⚡ FASE 3 · SOBREVIVÊNCIA (2/3 LETRAS)!'
    }

    // Escalation hint
    if (gameState.ruleMode === 'last1') {
      escalationHint.textContent = 'Modo Casual: Sempre 1 última letra'
    } else if (gameState.ruleMode === 'last2') {
      escalationHint.textContent = 'Modo Hardcore: Sempre as 2 últimas letras!'
    } else if (gameState.chain.length < 6) {
      escalationHint.textContent = `Faltam ${6 - gameState.chain.length} palavra(s) para mudar para as 2 últimas letras!`
    } else if (gameState.chain.length < 14) {
      escalationHint.textContent = `🔥 Modo 2 últimas letras ativo! (${14 - gameState.chain.length} para Fase 3)`
    } else {
      escalationHint.textContent = '⚡ Fase 3 ativa: 2/3 últimas letras e tempo reduzido!'
    }

    // Players ring
    playersRing.innerHTML = ''
    gameState.players.forEach((p, idx) => {
      const card = document.createElement('div')
      const isTurn = gameState.status === 'playing' && idx === gameState.turnIndex
      card.className = `player-card${isTurn ? ' active-turn' : ''}${p.eliminated ? ' eliminated' : ''}`
      card.id = `pcard-${p.id}`

      const hearts = renderHearts(p.lives, p.eliminated)
      const youTag = p.id === room?.profile.id ? ' (Você)' : ''
      const turnSubtitle = isTurn
        ? '<span class="status-turn"><i data-lucide="bomb" class="inline-icon"></i> Na vez agora!</span>'
        : p.eliminated
          ? 'Fora da rodada'
          : 'Aguardando vez'

      card.innerHTML = `
        <div class="player-left">
          <div class="avatar-dot" style="background:${p.color}">${p.name.charAt(0).toUpperCase()}</div>
          <div class="player-meta">
            <strong>${p.name}${youTag}</strong>
            <small>${turnSubtitle}</small>
          </div>
        </div>
        <div class="player-right">
          <div class="player-hearts">${hearts}</div>
          <span class="player-pts">${p.score} pts</span>
        </div>
      `
      playersRing.appendChild(card)
    })

    // Turn status banner
    const activePlayer = gameState.players[gameState.turnIndex]
    if (gameState.status === 'lobby') {
      turnStatusText.textContent = dictReady
        ? 'Sala pronta! Adicione amigos/Bots e clique em Iniciar Partida.'
        : 'Carregando banco de 626.333 palavras...'
      timerSeconds.textContent = '--'
      timerBarFill.style.width = '100%'
    } else if (gameState.status === 'playing' && activePlayer) {
      turnStatusText.textContent = isMyTurn
        ? '⚡ SUA VEZ! Digite uma palavra antes do tempo acabar!'
        : `⏳ Vez de ${activePlayer.name}...`
    }

    // 4 Starter letters vs Required prefix
    if (gameState.status === 'playing' && !gameState.requiredPrefix) {
      starterLettersBox.hidden = false
      prefixChallengeBox.hidden = true
      starterLettersGrid.innerHTML = ''

      for (const ch of gameState.starterLetters) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = `starter-letter-btn${gameState.selectedStarter === ch ? ' selected' : ''}`
        btn.textContent = ch.toUpperCase()
        btn.disabled = !isMyTurn
        btn.addEventListener('click', () => {
          if (!isMyTurn) return
          gameState.selectedStarter = ch
          playTone(480, 0.05)
          renderUI()
          room.sendToHost({ type: 'LIVE_TYPING', text: normalizePt(wordInput.value), selectedStarter: ch })
          wordInput.focus()
        })
        starterLettersGrid.appendChild(btn)
      }
    } else if (gameState.status === 'playing' && gameState.requiredPrefix) {
      starterLettersBox.hidden = true
      prefixChallengeBox.hidden = false

      const lastItem = gameState.chain[gameState.chain.length - 1]
      const prevW = lastItem ? lastItem.word : ''
      const prefLen = gameState.requiredPrefix.length
      if (prevW.length >= prefLen) {
        const head = prevW.slice(0, prevW.length - prefLen).toUpperCase()
        const tail = prevW.slice(-prefLen).toUpperCase()
        prevWordFormatted.innerHTML = `${head}<em>${tail}</em>`
      } else {
        prevWordFormatted.textContent = prevW.toUpperCase()
      }

      requiredPrefixPill.textContent = gameState.requiredPrefix.toUpperCase()
      possibleWordsCount.innerHTML = `<i data-lucide="book-open" class="inline-icon"></i> ${gameState.possibleCount.toLocaleString('pt-BR')} palavras possíveis`
    } else {
      starterLettersBox.hidden = true
      prefixChallengeBox.hidden = true
    }

    // Locked prefix tag inside input
    const activePref = getActivePrefixForTyping()
    if (gameState.status === 'playing' && activePref) {
      lockedPrefixTag.hidden = false
      lockedPrefixTag.textContent = activePref.toUpperCase()
    } else {
      lockedPrefixTag.hidden = true
    }

    // Live typing preview for other players
    if (gameState.status === 'playing' && !isMyTurn && activePlayer) {
      liveTypingPreview.hidden = false
      liveTypingPlayer.textContent = `${activePlayer.name} está digitando:`
      liveTypingLetters.textContent = (activePref + (gameState.liveTyping || '')).toUpperCase() || '...'
    } else {
      liveTypingPreview.hidden = true
    }

    // Input enable/disable
    wordInput.disabled = !isMyTurn
    btnSubmitWord.disabled = !isMyTurn
    if (isMyTurn) {
      wordInput.placeholder = activePref
        ? `Complete a palavra após "${activePref.toUpperCase()}"...`
        : `Digite começando com ${gameState.starterLetters.map((l) => l.toUpperCase()).join(', ')}...`
    } else {
      wordInput.placeholder =
        gameState.status === 'playing' ? `Aguardando ${activePlayer?.name || 'jogador'}...` : 'Aguardando início...'
    }

    // Host controls
    const isHost = room ? room.isHost : true
    if (roomCodeDisplay) {
      roomCodeDisplay.textContent = gameState.roomCode || 'ELO'
    }
    btnStartMatch.hidden = !isHost || gameState.status === 'playing'
    btnStartMatch.disabled = !dictReady
    btnAddBot.disabled = !isHost || gameState.status === 'playing'
    btnRemoveBot.disabled = !isHost || gameState.status === 'playing'
    ruleModeSelect.disabled = !isHost || gameState.status === 'playing'

    // Chain trail
    chainCount.textContent = String(gameState.chain.length)
    if (gameState.chain.length === 0) {
      chainTrail.innerHTML = '<span class="chain-empty">Nenhuma palavra usada ainda nesta partida. Inicie a partida para girar as letras!</span>'
    } else {
      chainTrail.innerHTML = ''
      const recent = gameState.chain.slice(-16)
      recent.forEach((item, idx) => {
        const chit = document.createElement('div')
        chit.className = 'chain-chit'
        const pLen = item.nextPrefix ? item.nextPrefix.length : 1
        const head = item.word.slice(0, item.word.length - pLen).toUpperCase()
        const tail = item.word.slice(-pLen).toUpperCase()
        chit.innerHTML = `
          <span class="chit-head">${head}</span><span class="chit-tail">${tail}</span>
          <span class="chit-author">${item.playerName}</span>
        `
        chainTrail.appendChild(chit)

        if (idx < recent.length - 1) {
          const arrow = document.createElement('span')
          arrow.className = 'chain-arrow'
          arrow.setAttribute('aria-hidden', 'true')
          arrow.innerHTML = '➔'
          chainTrail.appendChild(arrow)
        }
      })
      chainTrail.scrollTop = chainTrail.scrollHeight
    }

    if (gameState.chain.length > lastObservedChainLen) {
      if (lastObservedChainLen > 0) {
        const latest = gameState.chain[gameState.chain.length - 1]
        if (latest) {
          triggerBatonPassAnimation(latest.word, latest.nextPrefix)
        }
      }
      lastObservedChainLen = gameState.chain.length
    }

    refreshLucideIcons()
  }

  // ==================== HOST GAME LOOP ====================
  function syncToClients() {
    if (room && room.isHost) {
      room.broadcastState(gameState)
    }
    renderUI()
  }

  function startMatchOnHost() {
    if (!dictReady || !room.isHost) return
    if (gameState.players.length < 2) {
      // Automatically add 1 bot if playing alone so the game starts right away
      addBotOnHost()
    }

    gameState.status = 'playing'
    gameState.ruleMode = ruleModeSelect.value
    gameState.chain = []
    gameState.usedWords = []
    gameState.chainLevel = gameState.ruleMode === 'last2' ? 2 : 1
    gameState.requiredPrefix = ''
    gameState.starterLetters = pickFourStarterLetters()
    gameState.selectedStarter = gameState.starterLetters[0]
    gameState.liveTyping = ''
    gameState.winner = null
    lastObservedChainLen = 0

    for (const p of gameState.players) {
      p.lives = 3
      p.score = 0
      p.eliminated = false
    }

    gameState.turnIndex = 0
    modalWinner.hidden = true
    if (roomDrawer) {
      roomDrawer.hidden = true
      btnToggleDrawer?.setAttribute('aria-expanded', 'false')
    }
    playChord([440, 554.37, 659.25], 65)
    startTurnOnHost(true)
  }

  function startTurnOnHost(resetStarters = false) {
    clearInterval(timerInterval)
    clearTimeout(botThinkTimeout)

    if (resetStarters) {
      gameState.requiredPrefix = ''
      gameState.starterLetters = pickFourStarterLetters()
      gameState.selectedStarter = gameState.starterLetters[0]
    }

    gameState.liveTyping = ''
    // Speed up turn duration as chain grows
    const baseSec = gameState.chainLevel === 1 ? 12 : gameState.chainLevel === 2 ? 10 : 8.5
    gameState.turnDurationMs = baseSec * 1000
    gameState.turnRemainingMs = gameState.turnDurationMs

    wordInput.value = ''
    syncToClients()

    const currentPlayer = gameState.players[gameState.turnIndex]
    if (currentPlayer && currentPlayer.id === room.profile.id) {
      setTimeout(() => wordInput.focus(), 50)
    }

    if (currentPlayer && currentPlayer.isBot) {
      scheduleBotMove(currentPlayer)
    }

    const lastTick = Date.now()
    timerInterval = setInterval(() => {
      const elapsed = Date.now() - lastTick
      gameState.turnRemainingMs = Math.max(0, gameState.turnDurationMs - elapsed)
      updateTimerVisuals()

      if (gameState.turnRemainingMs <= 0) {
        clearInterval(timerInterval)
        handleTimeOutOnHost()
      }
    }, 80)
  }

  let lastTickTime = 0
  let altTick = false

  function updateTimerVisuals() {
    const pct = Math.max(0, (gameState.turnRemainingMs / gameState.turnDurationMs) * 100)
    timerBarFill.style.width = `${pct}%`
    const sec = Math.max(0, gameState.turnRemainingMs / 1000)
    timerSeconds.textContent = `${sec.toFixed(1)}s`

    let fuseColor = '#10b981'
    if (pct <= 25) {
      fuseColor = '#ef4444'
    } else if (pct <= 50) {
      fuseColor = '#f59e0b'
    }

    const turnBanner = document.getElementById('turn-banner')
    if (turnBanner) {
      turnBanner.style.setProperty('--fuse-color', fuseColor)
    }
    timerBarFill.style.backgroundColor = fuseColor

    const angle = `${(pct / 100) * 360}deg`
    const prefixBox = document.getElementById('prefix-challenge-box')
    if (prefixBox) {
      prefixBox.style.setProperty('--fuse-angle', angle)
      prefixBox.style.setProperty('--fuse-color', fuseColor)
    }

    // Accelerating procedural tick and heartbeat warning when time is critical (<= 4.5s)
    if (gameState.status === 'playing' && gameState.turnRemainingMs > 0 && gameState.turnRemainingMs <= 4500) {
      turnBanner?.classList.add('fuse-panic')
      prefixBox?.classList.add('fuse-panic')

      const now = Date.now()
      const tickInterval =
        gameState.turnRemainingMs > 2500 ? 700 : gameState.turnRemainingMs > 1200 ? 380 : 200
      if (now - lastTickTime >= tickInterval) {
        SoundFX.fuseTick(altTick)
        altTick = !altTick
        lastTickTime = now
      }
    } else {
      turnBanner?.classList.remove('fuse-panic')
      prefixBox?.classList.remove('fuse-panic')
    }
  }

  function advanceTurnIndex() {
    const total = gameState.players.length
    for (let step = 1; step <= total; step++) {
      const cand = (gameState.turnIndex + step) % total
      if (!gameState.players[cand].eliminated) {
        gameState.turnIndex = cand
        return
      }
    }
  }

  function handleTimeOutOnHost() {
    const victim = gameState.players[gameState.turnIndex]
    if (!victim) return

    victim.lives = Math.max(0, victim.lives - 1)
    if (victim.lives === 0) {
      victim.eliminated = true
    }

    playTone(130, 0.35, 'sawtooth', 0.14)
    room.broadcastEvent({
      type: 'EXPLOSION',
      playerId: victim.id,
      playerName: victim.name,
      eliminated: victim.eliminated,
    })
    triggerExplosionEffect(victim.id, victim.name, victim.eliminated)

    // Check alive players
    const alive = gameState.players.filter((p) => !p.eliminated)
    if (alive.length <= 1) {
      gameState.status = 'gameover'
      gameState.winner = alive[0] || victim
      syncToClients()
      room.broadcastEvent({ type: 'MATCH_OVER', winner: gameState.winner })
      showWinnerModal(gameState.winner)
      return
    }

    // Next alive player gets 4 fresh starter letters!
    advanceTurnIndex()
    startTurnOnHost(true)
  }

  function validateAndAcceptWordOnHost(rawInput, playerProfile, chosenStarter) {
    if (gameState.status !== 'playing') return
    const currentPlayer = gameState.players[gameState.turnIndex]
    if (!currentPlayer || currentPlayer.id !== playerProfile.id) return

    if (!gameState.requiredPrefix && chosenStarter && gameState.starterLetters.includes(chosenStarter)) {
      gameState.selectedStarter = chosenStarter
    }

    const activePref = getActivePrefixForTyping()
    const rawNorm = normalizePt(rawInput)
    let fullCandidate = activePref ? activePref + rawNorm : rawNorm

    // If user also typed the prefix itself (e.g. typed "casa" when "C" was already selected)
    if (
      activePref &&
      rawNorm.startsWith(activePref) &&
      (!allValidSet.has(fullCandidate) || gameState.usedWords.includes(fullCandidate)) &&
      allValidSet.has(rawNorm)
    ) {
      fullCandidate = rawNorm
    }

    // If choosing from 4 starter letters and user typed a full word starting with one of the 4
    if (!gameState.requiredPrefix) {
      const firstChar = fullCandidate.charAt(0)
      if (!gameState.starterLetters.includes(firstChar)) {
        sendReject(
          playerProfile.id,
          `A palavra deve começar com uma das 4 letras: ${gameState.starterLetters.map((l) => l.toUpperCase()).join(', ')}`
        )
        return
      }
    } else if (!fullCandidate.startsWith(gameState.requiredPrefix)) {
      sendReject(
        playerProfile.id,
        `A palavra precisa começar com "${gameState.requiredPrefix.toUpperCase()}"!`
      )
      return
    }

    if (fullCandidate.length < 3) {
      sendReject(playerProfile.id, 'Digite uma palavra com pelo menos 3 letras!')
      return
    }

    if (!allValidSet.has(fullCandidate)) {
      sendReject(playerProfile.id, `"${fullCandidate.toUpperCase()}" não existe no dicionário português!`)
      return
    }

    if (gameState.usedWords.includes(fullCandidate)) {
      sendReject(playerProfile.id, `"${fullCandidate.toUpperCase()}" já foi usada nesta partida!`)
      return
    }

    // Valid word!
    clearInterval(timerInterval)
    clearTimeout(botThinkTimeout)

    const prevLevel = gameState.chainLevel
    const nextChainLen = gameState.chain.length + 1
    const nextInfo = computeNextPrefix(fullCandidate, nextChainLen, gameState.ruleMode)

    gameState.usedWords.push(fullCandidate)
    gameState.chain.push({
      word: fullCandidate,
      playerName: currentPlayer.name,
      prefixUsed: activePref || fullCandidate.charAt(0),
      nextPrefix: nextInfo.prefix,
    })

    currentPlayer.score += fullCandidate.length * 10 * gameState.chainLevel
    gameState.requiredPrefix = nextInfo.prefix
    gameState.selectedStarter = ''
    gameState.chainLevel = nextInfo.level
    gameState.possibleCount = nextInfo.possibleCount

    playChord([523.25, 659.25, 783.99], 55)

    if (nextInfo.level > prevLevel) {
      const msg =
        nextInfo.level === 2
          ? '🔥 A CORRENTE EVOLUIU: Agora valem as 2 ÚLTIMAS LETRAS!'
          : '⚡ FASE 3 EXTREMA: 2/3 Últimas Letras!'
      showToast(msg, 3200)
      room.broadcastEvent({ type: 'TOAST', message: msg })
    }

    advanceTurnIndex()
    startTurnOnHost(false)
  }

  function sendReject(playerId, reason) {
    if (playerId === room.profile.id) {
      shakeInput(reason)
    } else {
      room.broadcastEvent({ type: 'REJECT', playerId, reason })
    }
  }

  function shakeInput(reason) {
    SoundFX.errorBuzz()
    prefixInputWrapper.classList.remove('visor-shake', 'visor-error-flash')
    void prefixInputWrapper.offsetWidth
    prefixInputWrapper.classList.add('visor-shake', 'visor-error-flash')
    setTimeout(() => {
      prefixInputWrapper.classList.remove('visor-shake')
      setTimeout(() => prefixInputWrapper.classList.remove('visor-error-flash'), 240)
    }, 120)
    showToast(reason, 2000)
  }

  function triggerExplosionEffect(playerId, playerName, eliminated) {
    // 1. Camera shake on the arena for 150ms
    const arena = document.querySelector('.game-arena')
    if (arena) {
      arena.classList.remove('arena-shake')
      void arena.offsetWidth
      arena.classList.add('arena-shake')
      setTimeout(() => arena.classList.remove('arena-shake'), 160)
    }

    // 2. Heavy impact thump sound
    SoundFX.explosionThump()

    // 3. Shake player card and animate lost heart cracking/falling
    const card = document.getElementById(`pcard-${playerId}`)
    if (card) {
      card.classList.remove('exploded')
      void card.offsetWidth
      card.classList.add('exploded')

      const hearts = card.querySelectorAll('.heart-icon')
      if (hearts && hearts.length > 0) {
        const targetHeart =
          Array.from(hearts).reverse().find((h) => h.classList.contains('lost')) ||
          hearts[hearts.length - 1]
        if (targetHeart) {
          targetHeart.classList.remove('heart-lost-crack')
          void targetHeart.offsetWidth
          targetHeart.classList.add('heart-lost-crack')
        }
      }

      const rect = card.getBoundingClientRect()
      spawnDebris(rect)
    } else {
      spawnDebris(null)
    }

    showToast(
      eliminated
        ? `💥 Tempo esgotado! ${playerName} foi eliminado(a)!`
        : `💥 Tempo esgotado! ${playerName} perdeu 1 ❤️!`,
      2400
    )
  }

  function scheduleBotMove(botPlayer) {
    const pref = gameState.requiredPrefix || gameState.starterLetters[Math.floor(Math.random() * 4)]
    const candidates = (botWordsByPrefix.get(pref) || []).filter(
      (w) => !gameState.usedWords.includes(w) && w.length >= pref.length + 2
    )

    if (candidates.length === 0) return // Bot will time out if trapped!

    const chosen = candidates[Math.floor(Math.random() * Math.min(candidates.length, 25))]
    const suffix = chosen.slice(pref.length)
    let typedIndex = 0

    // Simulate realistic typing letter by letter
    function typeStep() {
      if (gameState.status !== 'playing' || gameState.players[gameState.turnIndex]?.id !== botPlayer.id) return
      if (typedIndex < suffix.length) {
        typedIndex++
        gameState.liveTyping = suffix.slice(0, typedIndex)
        syncToClients()
        botThinkTimeout = setTimeout(typeStep, 190 + Math.random() * 140)
      } else {
        botThinkTimeout = setTimeout(() => {
          validateAndAcceptWordOnHost(chosen, botPlayer)
        }, 250)
      }
    }

    botThinkTimeout = setTimeout(typeStep, 900 + Math.random() * 900)
  }

  function addBotOnHost() {
    if (!room.isHost) return
    const existingBots = gameState.players.filter((p) => p.isBot).length
    if (existingBots >= BOT_NAMES.length) {
      showToast('Limite máximo de Bots atingido!')
      return
    }
    const meta = BOT_NAMES[existingBots]
    gameState.players.push({
      id: `bot_${Date.now()}_${existingBots}`,
      name: meta.name,
      color: meta.color,
      isBot: true,
      lives: 3,
      score: 0,
      eliminated: false,
    })
    syncToClients()
  }

  function removeBotOnHost() {
    if (!room.isHost) return
    const idx = gameState.players.map((p) => p.isBot).lastIndexOf(true)
    if (idx === -1) return
    gameState.players.splice(idx, 1)
    syncToClients()
  }

  function showWinnerModal(winner) {
    launchConfetti()
    playChord([523.25, 659.25, 783.99, 1046.5], 80)
    document.getElementById('winner-title').innerHTML = `<i data-lucide="trophy" class="inline-icon"></i> ${winner.name} Venceu!`
    document.getElementById('winner-subtitle').textContent =
      `Sobreviveu a uma corrente de ${gameState.chain.length} palavras sem repetir!`
    document.getElementById('winner-stats').textContent =
      `Pontuação: ${winner.score} pts · Nível máximo: Fase ${gameState.chainLevel}`
    modalWinner.hidden = false
    refreshLucideIcons()
  }

  function launchConfetti() {
    const ctx = confettiCanvas.getContext('2d')
    confettiCanvas.width = window.innerWidth
    confettiCanvas.height = window.innerHeight
    const colors = ['#f43f5e', '#fbbf24', '#10b981', '#38bdf8', '#a855f7']
    const pieces = Array.from({ length: 85 }, () => ({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 200,
      y: window.innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 12 - 4,
      size: Math.random() * 7 + 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.22,
    }))
    let frame = 0
    function tick() {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height)
      for (const p of pieces) {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.35
        p.rot += p.vrot
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65)
        ctx.restore()
      }
      frame++
      if (frame < 105) requestAnimationFrame(tick)
      else ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height)
    }
    requestAnimationFrame(tick)
  }

  // ==================== P2P ROOM SETUP ====================
  function ensureBotIfAloneInLobby() {
    if (gameState.status === 'lobby' && gameState.players.length === 1) {
      gameState.players.push({
        id: 'bot_initial',
        name: BOT_NAMES[0].name,
        color: BOT_NAMES[0].color,
        isBot: true,
        lives: 3,
        score: 0,
        eliminated: false,
      })
    }
  }

  function handlePlayerLeftOnHost(leavingPlayerId) {
    if (!room.isHost || !leavingPlayerId || leavingPlayerId === room.profile.id) return
    const idx = gameState.players.findIndex((p) => p.id === leavingPlayerId && !p.isBot)
    if (idx === -1) return

    const leavingPlayer = gameState.players[idx]
    const wasTheirTurn = gameState.status === 'playing' && gameState.turnIndex === idx

    gameState.players.splice(idx, 1)
    if (idx < gameState.turnIndex) {
      gameState.turnIndex = Math.max(0, gameState.turnIndex - 1)
    }
    if (gameState.turnIndex >= gameState.players.length) {
      gameState.turnIndex = 0
    }

    const leaveMsg = `🚪 ${leavingPlayer.name} saiu da sala.`
    showToast(leaveMsg, 2800)
    room.broadcastEvent({ type: 'TOAST', message: leaveMsg })

    if (gameState.status === 'lobby') {
      ensureBotIfAloneInLobby()
      syncToClients()
      return
    }

    if (gameState.status === 'playing') {
      const alive = gameState.players.filter((p) => !p.eliminated)
      if (alive.length <= 1) {
        clearInterval(timerInterval)
        clearTimeout(botThinkTimeout)
        gameState.status = 'gameover'
        gameState.winner = alive[0] || gameState.players[0]
        ensureBotIfAloneInLobby()
        syncToClients()
        if (gameState.winner) {
          room.broadcastEvent({ type: 'MATCH_OVER', winner: gameState.winner })
          showWinnerModal(gameState.winner)
        }
        return
      }

      if (wasTheirTurn) {
        if (gameState.players[gameState.turnIndex]?.eliminated) {
          advanceTurnIndex()
        }
        startTurnOnHost(false)
      } else {
        syncToClients()
      }
    }
  }

  function handleHostLeftOnClient(leavingHostId) {
    if (room.isHost) return
    const hostIdx = leavingHostId
      ? gameState.players.findIndex((p) => p.id === leavingHostId)
      : 0

    let hostName = 'O Host'
    if (hostIdx !== -1) {
      hostName = gameState.players[hostIdx].name
      gameState.players.splice(hostIdx, 1)
      if (hostIdx < gameState.turnIndex) {
        gameState.turnIndex = Math.max(0, gameState.turnIndex - 1)
      }
      if (gameState.turnIndex >= gameState.players.length) {
        gameState.turnIndex = 0
      }
    }

    const nextHost = gameState.players.find((p) => !p.isBot)
    if (!nextHost || nextHost.id === room.profile.id) {
      clearInterval(timerInterval)
      clearTimeout(botThinkTimeout)
      room.promoteToHost(gameState.players)

      const migMsg = `👑 ${hostName} saiu! ${room.profile.name} assumiu como Host da sala ${gameState.roomCode}.`
      showToast(migMsg, 3500)
      room.broadcastEvent({ type: 'TOAST', message: migMsg })

      if (gameState.status === 'lobby') {
        ensureBotIfAloneInLobby()
        syncToClients()
      } else if (gameState.status === 'playing') {
        const alive = gameState.players.filter((p) => !p.eliminated)
        if (alive.length <= 1) {
          gameState.status = 'gameover'
          gameState.winner = alive[0] || gameState.players[0]
          syncToClients()
          if (gameState.winner) {
            room.broadcastEvent({ type: 'MATCH_OVER', winner: gameState.winner })
            showWinnerModal(gameState.winner)
          }
        } else {
          if (gameState.players[gameState.turnIndex]?.eliminated) {
            advanceTurnIndex()
          }
          startTurnOnHost(false)
        }
      } else {
        syncToClients()
      }
    } else {
      showToast(`🚪 ${hostName} saiu. Aguardando novo Host (${nextHost.name})...`, 3000)
      renderUI()
    }
  }

  function setupRoomAsHost(code) {
    room.hostRoom(code)
    const normalized = room.roomCode || code
    gameState.roomCode = normalized
    gameState.status = 'lobby'
    gameState.players = [
      {
        id: room.profile.id,
        name: room.profile.name,
        color: room.profile.color,
        isBot: false,
        lives: 3,
        score: 0,
        eliminated: false,
      },
      {
        id: 'bot_initial',
        name: BOT_NAMES[0].name,
        color: BOT_NAMES[0].color,
        isBot: true,
        lives: 3,
        score: 0,
        eliminated: false,
      },
    ]
    roomCodeInput.value = normalized
    renderUI()
  }

  function initP2P() {
    room = new window.NBPRoom({
      gameId: 'corrente-nbp',
      defaultPrefix: 'ELO',
      onStatus(st) {
        if (st.connecting) {
          p2pStatus.innerHTML = `<i data-lucide="loader" class="inline-icon spin"></i> ${st.isHost ? `Abrindo ${st.roomCode}...` : `Conectando a ${st.roomCode}...`}`
        } else if (st.isHost && st.connected) {
          p2pStatus.innerHTML = `<i data-lucide="wifi" class="inline-icon text-green"></i> Host Online · ${st.roomCode}`
        } else if (!st.isHost && st.connected) {
          p2pStatus.innerHTML = `<i data-lucide="wifi" class="inline-icon text-green"></i> Conectado · ${st.roomCode}`
        } else {
          p2pStatus.innerHTML = `<i data-lucide="wifi-off" class="inline-icon text-red"></i> Offline · ${st.roomCode || ''}`
        }
        if (st.connected && st.roomCode) {
          try {
            if (window.parent && window.parent !== window) {
              const pUrl = new URL(window.parent.location.href)
              pUrl.searchParams.set('sala', st.roomCode)
              pUrl.searchParams.set('room', st.roomCode)
              window.parent.history.replaceState({}, '', pUrl.toString())
            }
          } catch (_) {}
        }
        refreshLucideIcons()
      },
      onError(err) {
        if (err && err.message) {
          showToast(`⚠️ ${err.message}`, 3600)
        }
      },
      onStateSync(remoteState) {
        const wasLobby = gameState.status === 'lobby' && gameState.roomCode !== remoteState.roomCode
        const prevTurnId = gameState.players[gameState.turnIndex]?.id
        const prevChainLen = gameState.chain.length
        Object.assign(gameState, remoteState)
        roomCodeInput.value = gameState.roomCode
        if (wasLobby) {
          showToast(`✅ Conectado à sala ${gameState.roomCode}!`, 2500)
        }

        const newTurnId = gameState.players[gameState.turnIndex]?.id
        if (
          gameState.status === 'playing' &&
          newTurnId === room.profile.id &&
          (prevTurnId !== newTurnId || gameState.chain.length !== prevChainLen)
        ) {
          wordInput.value = ''
          setTimeout(() => wordInput.focus(), 40)
        }

        clearInterval(timerInterval)
        if (!room.isHost && gameState.status === 'playing') {
          const syncStart = Date.now()
          const initialRem = gameState.turnRemainingMs
          timerInterval = setInterval(() => {
            const elapsed = Date.now() - syncStart
            gameState.turnRemainingMs = Math.max(0, initialRem - elapsed)
            updateTimerVisuals()
          }, 80)
        }

        updateTimerVisuals()
        renderUI()
      },
      onAction(action, senderProfile) {
        if (!action) return
        if (room.isHost) {
          if (action.type === 'PEER_CONNECTED') {
            syncToClients()
          } else if (
            (action.type === 'JOIN_REQUEST' || action.type === 'HEARTBEAT') &&
            action.profile
          ) {
            const exists = gameState.players.find((p) => p.id === action.profile.id)
            if (!exists) {
              // Remove automatic placeholder bot when a real friend joins in lobby
              if (gameState.status === 'lobby') {
                const botIdx = gameState.players.findIndex((p) => p.id === 'bot_initial')
                if (botIdx !== -1) gameState.players.splice(botIdx, 1)
              }
              gameState.players.push({
                id: action.profile.id,
                name: action.profile.name,
                color: action.profile.color || '#38bdf8',
                isBot: false,
                lives: 3,
                score: 0,
                eliminated: false,
              })
              const joinMsg = `👋 ${action.profile.name} entrou na sala!`
              showToast(joinMsg)
              room.broadcastEvent({ type: 'TOAST', message: joinMsg })
              syncToClients()
            } else if (action.type === 'JOIN_REQUEST') {
              exists.name = action.profile.name
              syncToClients()
            }
          } else if (action.type === 'PLAYER_LEFT') {
            handlePlayerLeftOnHost(action.playerId || senderProfile?.id)
          } else if (action.type === 'LIVE_TYPING') {
            const currentPlayer = gameState.players[gameState.turnIndex]
            if (currentPlayer && senderProfile && currentPlayer.id === senderProfile.id) {
              gameState.liveTyping = action.text
              if (action.selectedStarter && gameState.starterLetters.includes(action.selectedStarter)) {
                gameState.selectedStarter = action.selectedStarter
              }
              syncToClients()
            }
          } else if (action.type === 'SUBMIT_WORD') {
            validateAndAcceptWordOnHost(action.word, senderProfile, action.selectedStarter)
          }
        } else {
          // Client events
          if (action.type === 'HOST_LEFT') {
            handleHostLeftOnClient(action.hostId || senderProfile?.id)
          } else if (action.type === 'REJECT' && action.playerId === room.profile.id) {
            shakeInput(action.reason)
          } else if (action.type === 'EXPLOSION') {
            playTone(130, 0.35, 'sawtooth', 0.14)
            triggerExplosionEffect(action.playerId, action.playerName, action.eliminated)
          } else if (action.type === 'TOAST') {
            showToast(action.message, 3000)
          } else if (action.type === 'MATCH_OVER' && action.winner) {
            showWinnerModal(action.winner)
          }
        }
      },
    })

    playerNameInput.value = room.profile.name
    let searchStr = window.location.search
    try {
      if (!searchStr && window.parent && window.parent !== window && window.parent.location.search) {
        searchStr = window.parent.location.search
      }
    } catch (_) {}
    const params = new URLSearchParams(searchStr)
    const joinParam = params.get('sala') || params.get('room')
    if (joinParam) {
      roomCodeInput.value = joinParam.toUpperCase()
      room.joinRoom(joinParam)
    } else {
      setupRoomAsHost(randomRoomCode())
    }
  }

  // ==================== EVENT LISTENERS ====================
  playerNameInput.addEventListener('change', () => {
    room.setPlayerName(playerNameInput.value)
    const me = gameState.players.find((p) => p.id === room.profile.id)
    if (me) me.name = room.profile.name
    if (room.isHost) syncToClients()
    else room.sendToHost({ type: 'JOIN_REQUEST', profile: room.profile })
    showToast(`Nome atualizado para ${room.profile.name}`)
  })

  btnHostRoom.addEventListener('click', () => {
    const typed = roomCodeInput.value.trim().toUpperCase()
    const code = typed || randomRoomCode()
    if (room.isHost && code === gameState.roomCode && room.peer && room.peer.open) {
      navigator.clipboard?.writeText(code).catch(() => {})
      showToast(`Sala ${code} já está ativa! Código copiado 📋`)
      return
    }
    setupRoomAsHost(code)
    showToast(`Sala ${room.roomCode} criada! Compartilhe o código com seus amigos.`)
  })

  btnJoinRoom.addEventListener('click', () => {
    const code = roomCodeInput.value.trim().toUpperCase()
    if (!code) {
      showToast('Digite o código da sala do seu amigo!')
      return
    }
    clearInterval(timerInterval)
    clearTimeout(botThinkTimeout)
    room.joinRoom(code)
    roomCodeInput.value = room.roomCode
    showToast(`Conectando à sala ${room.roomCode}...`)
  })

  roomCodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      btnJoinRoom.click()
    }
  })

    btnCopyRoom.addEventListener('click', async () => {
    try {
      let baseOrigin = window.location.origin
      let basePath = '/jogos/corrente-nbp'
      try {
        if (window.parent && window.parent !== window) {
          baseOrigin = window.parent.location.origin
          if (window.parent.location.pathname.startsWith('/jogos/')) {
            basePath = window.parent.location.pathname
          }
        }
      } catch (_) {}
      const shareUrl = `${baseOrigin}${basePath}?room=${gameState.roomCode}`
      await navigator.clipboard.writeText(shareUrl)
      showToast(`Link da sala ${gameState.roomCode} copiado! 📋`)
    } catch {
      showToast(`Código da sala: ${gameState.roomCode}`)
    }
  })

  if (btnToggleDrawer && roomDrawer) {
    btnToggleDrawer.addEventListener('click', () => {
      const nextOpen = roomDrawer.hidden
      roomDrawer.hidden = !nextOpen
      btnToggleDrawer.setAttribute('aria-expanded', String(nextOpen))
    })
  }

  btnAddBot.addEventListener('click', addBotOnHost)
  btnRemoveBot.addEventListener('click', removeBotOnHost)

  ruleModeSelect.addEventListener('change', () => {
    gameState.ruleMode = ruleModeSelect.value
    syncToClients()
  })

  btnStartMatch.addEventListener('click', () => {
    startMatchOnHost()
  })

  document.getElementById('btn-rematch').addEventListener('click', () => {
    modalWinner.hidden = true
    if (room.isHost) startMatchOnHost()
  })

  document.getElementById('btn-close-winner').addEventListener('click', () => {
    modalWinner.hidden = true
  })

  btnSound.addEventListener('click', () => {
    soundEnabled = !soundEnabled
    btnSound.setAttribute('aria-pressed', String(soundEnabled))
    btnSound.innerHTML = soundEnabled
      ? '<i data-lucide="volume-2" class="inline-icon"></i>'
      : '<i data-lucide="volume-x" class="inline-icon"></i>'
    refreshLucideIcons()
  })

  wordInput.addEventListener('keydown', (e) => {
    if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      SoundFX.keyTap()
      prefixInputWrapper.classList.remove('input-micro-tap')
      void prefixInputWrapper.offsetWidth
      prefixInputWrapper.classList.add('input-micro-tap')
    }
  })

  wordInput.addEventListener('input', () => {
    const clean = normalizePt(wordInput.value)
    room.sendToHost({ type: 'LIVE_TYPING', text: clean, selectedStarter: gameState.selectedStarter })

    const activePref = getActivePrefixForTyping()
    if (clean.length > 0) {
      if (activePref) {
        // Locked prefix mode: matches prefix continuation
        prefixInputWrapper.classList.add('prefix-matched')
        prefixInputWrapper.classList.remove('prefix-mismatch')
      } else {
        // 4 starters mode: check if first char matches one of the 4 starters
        const first = clean.charAt(0)
        if (gameState.starterLetters.includes(first)) {
          gameState.selectedStarter = first
          prefixInputWrapper.classList.add('prefix-matched')
          prefixInputWrapper.classList.remove('prefix-mismatch')
          renderUI()
        } else {
          prefixInputWrapper.classList.remove('prefix-matched')
          prefixInputWrapper.classList.add('prefix-mismatch')
        }
      }
    } else {
      prefixInputWrapper.classList.remove('prefix-matched', 'prefix-mismatch')
    }
  })

  wordForm.addEventListener('submit', (e) => {
    e.preventDefault()
    const typed = normalizePt(wordInput.value)
    wordInput.value = ''
    prefixInputWrapper.classList.remove('prefix-matched', 'prefix-mismatch')
    room.sendToHost({
      type: 'SUBMIT_WORD',
      word: typed,
      selectedStarter: gameState.selectedStarter,
    })
  })

  // ==================== LOAD 626K PORTUGUESE DICTIONARY ====================
  async function loadDictionary() {
    try {
      const [valRes, tierRes] = await Promise.all([
        fetch('../../data/pt-br/dicionario-validacao.json'),
        fetch('../../data/pt-br/palavras-por-tamanho.json'),
      ])
      const valJson = await valRes.json()
      const tierJson = await tierRes.json()

      // 1. Index all 626,333 valid words and their 1, 2, 3-letter prefixes
      for (const lenKey of Object.keys(valJson.wordsByLength)) {
        const list = valJson.wordsByLength[lenKey]
        for (let i = 0; i < list.length; i++) {
          const w = list[i]
          allValidSet.add(w)
          const p1 = w.slice(0, 1)
          const p2 = w.slice(0, 2)
          prefixCountMap.set(p1, (prefixCountMap.get(p1) || 0) + 1)
          prefixCountMap.set(p2, (prefixCountMap.get(p2) || 0) + 1)
          if (w.length >= 4) {
            const p3 = w.slice(0, 3)
            prefixCountMap.set(p3, (prefixCountMap.get(p3) || 0) + 1)
          }
        }
      }

      // 2. Index common words (facil + medio) for Bots so Bots play natural words
      for (const lenKey of Object.keys(tierJson.lengths)) {
        const group = tierJson.lengths[lenKey]
        for (const rawW of [...group.facil, ...group.medio]) {
          const w = normalizePt(rawW)
          if (w.length < 4) continue
          for (const size of [1, 2, 3]) {
            const pref = w.slice(0, size)
            let arr = botWordsByPrefix.get(pref)
            if (!arr) {
              arr = []
              botWordsByPrefix.set(pref, arr)
            }
            if (arr.length < 60) arr.push(w)
          }
        }
      }

      dictReady = true
      renderUI()
      showToast(`📚 Dicionário carregado: ${allValidSet.size.toLocaleString('pt-BR')} palavras aceitas!`)
    } catch (err) {
      console.error(err)
      turnStatusText.textContent = 'Erro ao carregar o dicionário PT-BR.'
    }
  }

  initP2P()
  loadDictionary()
  refreshLucideIcons()
})()
