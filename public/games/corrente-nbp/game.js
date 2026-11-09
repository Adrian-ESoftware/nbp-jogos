;(() => {
  const BOT_NAMES = [
    { name: 'Bot Clarice 🤖', color: '#a855f7' },
    { name: 'Bot Machado 🤖', color: '#f59e0b' },
    { name: 'Bot Drummond 🤖', color: '#10b981' },
    { name: 'Bot Cecília 🤖', color: '#ec4899' },
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
  const btnJoinRoom = document.getElementById('btn-join-room')
  const btnHostRoom = document.getElementById('btn-host-room')
  const btnCopyRoom = document.getElementById('btn-copy-room')
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

  function playTone(freq, duration = 0.08, type = 'sine', gainVal = 0.08) {
    if (!soundEnabled) return
    try {
      if (!audioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext
        audioCtx = new AudioCtx()
      }
      if (audioCtx.state === 'suspended') audioCtx.resume()
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime)
      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration)
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.start()
      osc.stop(audioCtx.currentTime + duration)
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

      const hearts = p.eliminated ? '💀 Eliminado' : '❤️'.repeat(p.lives) + '🖤'.repeat(Math.max(0, 3 - p.lives))
      const youTag = p.id === room?.profile.id ? ' (Você)' : ''

      card.innerHTML = `
        <div class="player-left">
          <div class="avatar-dot" style="background:${p.color}">${p.name.charAt(0).toUpperCase()}</div>
          <div class="player-meta">
            <strong>${p.name}${youTag}</strong>
            <small>${isTurn ? '💣 Na vez agora!' : p.eliminated ? 'Fora da rodada' : 'Aguardando vez'}</small>
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
      possibleWordsCount.textContent = `📚 ${gameState.possibleCount.toLocaleString('pt-BR')} palavras possíveis`
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
    btnStartMatch.hidden = !isHost || gameState.status === 'playing'
    btnStartMatch.disabled = !dictReady
    btnAddBot.disabled = !isHost || gameState.status === 'playing'
    btnRemoveBot.disabled = !isHost || gameState.status === 'playing'
    ruleModeSelect.disabled = !isHost || gameState.status === 'playing'

    // Chain trail
    chainCount.textContent = String(gameState.chain.length)
    if (gameState.chain.length === 0) {
      chainTrail.innerHTML = '<span class="chain-empty">Nenhuma palavra usada ainda nesta partida.</span>'
    } else {
      chainTrail.innerHTML = ''
      const recent = gameState.chain.slice(-18)
      for (const item of recent) {
        const pill = document.createElement('span')
        pill.className = 'chain-pill'
        const pLen = item.nextPrefix ? item.nextPrefix.length : 1
        const head = item.word.slice(0, item.word.length - pLen).toUpperCase()
        const tail = item.word.slice(-pLen).toUpperCase()
        pill.innerHTML = `${head}<span class="link-highlight">${tail}</span> <small>(${item.playerName})</small>`
        chainTrail.appendChild(pill)
      }
      chainTrail.scrollTop = chainTrail.scrollHeight
    }
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

    for (const p of gameState.players) {
      p.lives = 3
      p.score = 0
      p.eliminated = false
    }

    gameState.turnIndex = 0
    modalWinner.hidden = true
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

  function updateTimerVisuals() {
    const pct = Math.max(0, (gameState.turnRemainingMs / gameState.turnDurationMs) * 100)
    timerBarFill.style.width = `${pct}%`
    timerSeconds.textContent = `${(gameState.turnRemainingMs / 1000).toFixed(1)}s`
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
    playTone(155, 0.16, 'sawtooth', 0.1)
    prefixInputWrapper.classList.remove('shake')
    void prefixInputWrapper.offsetWidth
    prefixInputWrapper.classList.add('shake')
    showToast(reason, 2000)
  }

  function triggerExplosionEffect(playerId, playerName, eliminated) {
    const card = document.getElementById(`pcard-${playerId}`)
    if (card) {
      card.classList.remove('exploded')
      void card.offsetWidth
      card.classList.add('exploded')
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
    document.getElementById('winner-title').textContent = `🏆 ${winner.name} Venceu!`
    document.getElementById('winner-subtitle').textContent =
      `Sobreviveu a uma corrente de ${gameState.chain.length} palavras sem repetir!`
    document.getElementById('winner-stats').textContent =
      `Pontuação: ${winner.score} pts · Nível máximo: Fase ${gameState.chainLevel}`
    modalWinner.hidden = false
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
          p2pStatus.textContent = st.isHost
            ? `🟡 Abrindo Sala ${st.roomCode}...`
            : `🟡 Conectando a ${st.roomCode}...`
        } else if (st.isHost && st.connected) {
          p2pStatus.textContent = `🟢 Host Online · ${st.roomCode}`
        } else if (!st.isHost && st.connected) {
          p2pStatus.textContent = `🟢 Conectado · ${st.roomCode}`
        } else {
          p2pStatus.textContent = `🔴 Offline · ${st.roomCode || ''}`
        }
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
    const params = new URLSearchParams(window.location.search)
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
      await navigator.clipboard.writeText(gameState.roomCode)
      showToast(`Código ${gameState.roomCode} copiado! Envie para seus amigos 📋`)
    } catch {
      showToast(`Código da sala: ${gameState.roomCode}`)
    }
  })

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
    btnSound.textContent = soundEnabled ? '🔊' : '🔇'
  })

  wordInput.addEventListener('input', () => {
    const clean = normalizePt(wordInput.value)
    room.sendToHost({ type: 'LIVE_TYPING', text: clean, selectedStarter: gameState.selectedStarter })
  })

  wordForm.addEventListener('submit', (e) => {
    e.preventDefault()
    const typed = normalizePt(wordInput.value)
    wordInput.value = ''
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
})()
