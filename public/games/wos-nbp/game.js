;(() => {
  const BOT_PROFILES = [
    { id: 'bot_lara', name: 'Bot Lara 🤖', color: '#f59e0b' },
    { id: 'bot_caio', name: 'Bot Caio 🤖', color: '#10b981' },
    { id: 'bot_nina', name: 'Bot Nina 🤖', color: '#ec4899' },
    { id: 'bot_teo', name: 'Bot Téo 🤖', color: '#38bdf8' },
  ]

  let dictReady = false
  let allValidSet = new Set() // All valid 4..10 letter words for bonus word detection
  let displayMap = new Map() // norm -> accented word
  let commonByLen = new Map() // len -> array of { norm, display, tier, counts }
  let rootPoolByLen = new Map() // len (6, 7, 8) -> array of root words with rich sub-anagrams

  let soundEnabled = true
  let audioCtx = null
  let room = null
  let timerInterval = null
  let botInterval = null
  let cooldownTimer = null
  let myCooldownUntil = 0

  const state = {
    roomCode: '',
    status: 'lobby', // 'lobby' | 'playing' | 'levelclear' | 'gameover'
    level: 1,
    cooldownEnabled: false,
    durationSec: 75,
    remainingSec: 75,
    quota: 5,
    bonusFoundCount: 0,
    bonusWordsUsed: [],
    // Tiles: [{ id, char, isFake, isHidden, revealedFake }]
    tiles: [],
    // Board words: [{ norm, display, len, solved, finderName, finderColor, hintIndices: [] }]
    words: [],
    // Players: [{ id, name, color, isBot, score, wordsFound }]
    players: [],
    // Recent guesses feed: [{ word, playerName, type: 'hit'|'bonus' }]
    feed: [],
  }

  // DOM Elements
  const p2pStatus = document.getElementById('p2p-status')
  const roomCodeDisplay = document.getElementById('room-code-display')
  const levelBadge = document.getElementById('level-badge')
  const btnCopyRoom = document.getElementById('btn-copy-room')
  const btnStartMatch = document.getElementById('btn-start-match')
  const btnToggleDrawer = document.getElementById('btn-toggle-drawer')
  const roomDrawer = document.getElementById('room-drawer')
  const btnSound = document.getElementById('btn-sound')

  const playerNameInput = document.getElementById('player-name-input')
  const roomCodeInput = document.getElementById('room-code-input')
  const btnJoinRoom = document.getElementById('btn-join-room')
  const btnHostRoom = document.getElementById('btn-host-room')
  const btnToggleCooldown = document.getElementById('btn-toggle-cooldown')
  const btnAddBot = document.getElementById('btn-add-bot')
  const btnRemoveBot = document.getElementById('btn-remove-bot')

  const toastContainer = document.getElementById('toast-container')
  const goalStatusText = document.getElementById('goal-status-text')
  const modifiersRow = document.getElementById('modifiers-row')
  const timerSeconds = document.getElementById('timer-seconds')
  const timerPill = timerSeconds.parentElement
  const wordsProgressFill = document.getElementById('words-progress-fill')
  const timerBarLine = document.getElementById('timer-bar-line')
  const lockMarker = document.getElementById('lock-marker')
  const lockIcon = document.getElementById('lock-icon')
  const lockQuotaText = document.getElementById('lock-quota-text')

  const lettersPool = document.getElementById('letters-pool')
  const btnShuffle = document.getElementById('btn-shuffle')
  const wordsGrid = document.getElementById('words-grid')

  const playersCountBadge = document.getElementById('players-count-badge')
  const leaderboardList = document.getElementById('leaderboard-list')
  const bonusCountBadge = document.getElementById('bonus-count-badge')
  const liveFeed = document.getElementById('live-feed')

  const guessForm = document.getElementById('guess-form')
  const inputWrapper = document.getElementById('input-wrapper')
  const cooldownBadge = document.getElementById('cooldown-badge')
  const guessInput = document.getElementById('guess-input')
  const modalSummary = document.getElementById('modal-summary')
  const confettiCanvas = document.getElementById('confetti-canvas')

  function normalizePt(str) {
    return String(str || '')
      .toLocaleLowerCase('pt-BR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z]/g, '')
  }

  function countLetters(wordNorm) {
    const counts = {}
    for (let i = 0; i < wordNorm.length; i++) {
      const ch = wordNorm[i]
      counts[ch] = (counts[ch] || 0) + 1
    }
    return counts
  }

  function canFormFromCounts(wordCounts, poolCounts) {
    for (const ch of Object.keys(wordCounts)) {
      if ((poolCounts[ch] || 0) < wordCounts[ch]) return false
    }
    return true
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

  function playChord(notes, stepMs = 65) {
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
    return `WOS-${Math.floor(1000 + Math.random() * 9000)}`
  }

  function shuffleArray(arr) {
    const copy = [...arr]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = copy[i]
      copy[i] = copy[j]
      copy[j] = tmp
    }
    return copy
  }

  // ==================== LEVEL PUZZLE GENERATOR (Words on Stream Mechanics) ====================
  function buildLevelPuzzle(levelNum) {
    // Root word length scales with level:
    // L1-2: 6 letters | L3-6: 7 letters | L7+: 8 letters
    const rootLen = levelNum <= 2 ? 6 : levelNum <= 6 ? 7 : 8
    const hasHidden = levelNum === 3 || levelNum >= 5
    const hasFake = levelNum >= 4
    const hiddenCount = levelNum >= 8 ? 2 : hasHidden ? 1 : 0

    const candidateRoots = rootPoolByLen.get(rootLen) || rootPoolByLen.get(7) || []
    let chosenSubWords = []
    let rootNorm = 'portas'

    // Pick a random root word that yields at least 10 sub-words
    const shuffledRoots = shuffleArray(candidateRoots.slice(0, 350))
    for (const rootCandidate of shuffledRoots) {
      const rCounts = rootCandidate.counts
      const matches = []

      for (let len = 4; len <= rootLen; len++) {
        const list = commonByLen.get(len) || []
        for (let i = 0; i < list.length; i++) {
          const item = list[i]
          if (canFormFromCounts(item.counts, rCounts)) {
            matches.push(item)
          }
        }
      }

      if (matches.length >= 10) {
        rootNorm = rootCandidate.norm
        // Prioritize facil first, then medio, cap board at 12..18 words
        const maxBoardWords = Math.min(18, 9 + Math.floor(levelNum * 0.9))
        matches.sort((a, b) => {
          if (a.tier !== b.tier) return a.tier === 'facil' ? -1 : 1
          return a.len - b.len || a.norm.localeCompare(b.norm)
        })
        chosenSubWords = matches.slice(0, maxBoardWords)
        // Re-sort by length then alphabetically like Words on Stream
        chosenSubWords.sort((a, b) => a.len - b.len || a.norm.localeCompare(b.norm))
        break
      }
    }

    // Build letter tiles from rootNorm
    const tiles = rootNorm.split('').map((ch, idx) => ({
      id: `t_${idx}_${ch}`,
      char: ch,
      isFake: false,
      isHidden: false,
      revealedFake: false,
    }))

    // Apply Hidden Letter ('?') modifier
    if (hiddenCount > 0) {
      const indices = shuffleArray(tiles.map((_, i) => i))
      for (let h = 0; h < Math.min(hiddenCount, indices.length); h++) {
        tiles[indices[h]].isHidden = true
      }
    }

    // Apply Fake Letter modifier (a decoy letter that does NOT belong to rootNorm)
    if (hasFake) {
      const alphabet = 'bcdfghjlmnprstvz'.split('')
      const rootSet = new Set(rootNorm.split(''))
      const decoys = alphabet.filter((c) => !rootSet.has(c))
      const fakeChar = decoys[Math.floor(Math.random() * decoys.length)] || 'z'
      tiles.push({
        id: `t_fake_${fakeChar}`,
        char: fakeChar,
        isFake: true,
        isHidden: false,
        revealedFake: false,
      })
    }

    const totalWords = chosenSubWords.length
    // Quota to unlock next level (~62% of board words)
    const quota = Math.max(4, Math.min(totalWords, Math.ceil(totalWords * 0.62)))
    const durationSec = Math.max(55, 80 - Math.min(20, (levelNum - 1) * 2))

    return {
      tiles: shuffleArray(tiles),
      words: chosenSubWords.map((w) => ({
        norm: w.norm,
        display: w.display,
        len: w.len,
        solved: false,
        finderName: '',
        finderColor: '',
        hintIndices: [],
      })),
      quota,
      durationSec,
    }
  }

  // ==================== UI RENDERING ====================
  function renderUI() {
    if (roomCodeDisplay) {
      roomCodeDisplay.textContent = state.roomCode || 'WOS'
    }
    levelBadge.textContent = `NÍVEL ${state.level}`

    // Cooldown toggle button
    btnToggleCooldown.classList.toggle('active', state.cooldownEnabled)
    btnToggleCooldown.setAttribute('aria-pressed', String(state.cooldownEnabled))
    btnToggleCooldown.innerHTML = `🔒 Cadeado 3s: <strong>${state.cooldownEnabled ? 'ON' : 'OFF'}</strong>`

    const isHost = room ? room.isHost : true
    btnToggleCooldown.disabled = !isHost
    btnAddBot.disabled = !isHost
    btnRemoveBot.disabled = !isHost

    if (state.status === 'lobby') {
      btnStartMatch.hidden = !isHost
      btnStartMatch.disabled = !dictReady
      btnStartMatch.textContent = `▶️ Iniciar Nível 1`
    } else if (state.status === 'levelclear' || state.status === 'gameover') {
      btnStartMatch.hidden = !isHost
      btnStartMatch.disabled = false
      btnStartMatch.textContent =
        state.status === 'levelclear'
          ? `▶️ Ir para Nível ${state.level + 1}`
          : `🔄 Reiniciar no Nível 1`
    } else {
      btnStartMatch.hidden = true
    }

    // Modifiers pills (Hidden ? & Fake Letter)
    const hiddenTilesCount = state.tiles.filter((t) => t.isHidden).length
    const hasFakeTile = state.tiles.some((t) => t.isFake)
    modifiersRow.innerHTML = ''
    if (hiddenTilesCount > 0) {
      const span = document.createElement('span')
      span.className = 'mod-pill hidden-mod'
      span.textContent = `❓ ${hiddenTilesCount} Letra(s) Oculta(s)`
      modifiersRow.appendChild(span)
    }
    if (hasFakeTile) {
      const span = document.createElement('span')
      span.className = 'mod-pill fake-mod'
      span.textContent = `🎭 1 Letra Falsa`
      modifiersRow.appendChild(span)
    }

    // Solved count & Lock Progress
    const solvedCount = state.words.filter((w) => w.solved).length
    const totalWords = Math.max(1, state.words.length)
    const unlocked = solvedCount >= state.quota

    if (state.status === 'lobby') {
      goalStatusText.textContent = dictReady
        ? 'Sala pronta! Convide amigos ou clique em Iniciar Nível 1.'
        : 'Preparando gerador de anagramas em português...'
    } else {
      goalStatusText.textContent = unlocked
        ? `🔓 Nível ${state.level} Garantido! (${solvedCount}/${totalWords} palavras)`
        : `🔒 Encontre ${state.quota - solvedCount} palavra(s) para abrir o cadeado! (${solvedCount}/${state.quota})`
    }

    const fillPct = Math.min(100, Math.round((solvedCount / totalWords) * 100))
    const lockPct = Math.min(92, Math.max(15, Math.round((state.quota / totalWords) * 100)))
    wordsProgressFill.style.width = `${fillPct}%`
    lockMarker.style.left = `${lockPct}%`
    lockMarker.classList.toggle('unlocked', unlocked)
    lockIcon.textContent = unlocked ? '🔓' : '🔒'
    lockQuotaText.textContent = `${solvedCount}/${state.quota}`

    // Render Scrambled Letter Tiles
    lettersPool.innerHTML = ''
    for (const tile of state.tiles) {
      const btn = document.createElement('button')
      btn.type = 'button'
      const showChar =
        state.status === 'gameover' || state.status === 'levelclear'
          ? tile.char.toUpperCase()
          : tile.isHidden
            ? '?'
            : tile.char.toUpperCase()

      btn.className = `letter-tile${tile.isHidden && state.status === 'playing' ? ' mystery' : ''}${tile.revealedFake || (tile.isFake && state.status !== 'playing') ? ' revealed-fake' : ''}`
      btn.textContent = showChar
      btn.title = tile.revealedFake
        ? 'Letra Falsa revelada!'
        : tile.isHidden
          ? 'Letra Oculta (?): descubra qual é pelas palavras!'
          : `Clique para inserir "${tile.char.toUpperCase()}"`

      btn.addEventListener('click', () => {
        if (state.status !== 'playing' || tile.isHidden || tile.revealedFake) return
        guessInput.value += tile.char.toUpperCase()
        playTone(460, 0.04)
        guessInput.focus()
      })
      lettersPool.appendChild(btn)
    }

    // Render Hidden & Solved Words Grid
    wordsGrid.innerHTML = ''
    const revealAll = state.status === 'gameover' || state.status === 'levelclear'
    for (const w of state.words) {
      const slot = document.createElement('div')
      slot.className = `word-slot${w.solved ? ' solved' : revealAll ? ' missed' : ''}`

      const boxes = document.createElement('div')
      boxes.className = 'slot-boxes'
      const chars = (w.solved || revealAll ? w.display : w.norm).split('')

      for (let i = 0; i < chars.length; i++) {
        const cBox = document.createElement('span')
        const isHinted = !w.solved && !revealAll && (w.hintIndices || []).includes(i)
        cBox.className = `slot-char${isHinted ? ' slot-Char-hint' : ''}`
        cBox.textContent = w.solved || revealAll || isHinted ? chars[i].toUpperCase() : ''
        boxes.appendChild(cBox)
      }
      slot.appendChild(boxes)

      if (w.solved && w.finderName) {
        const finder = document.createElement('span')
        finder.className = 'slot-finder'
        finder.textContent = w.finderName
        slot.appendChild(finder)
      }
      wordsGrid.appendChild(slot)
    }

    // Render Leaderboard
    playersCountBadge.textContent = `${state.players.length} jogador${state.players.length === 1 ? '' : 'es'}`
    leaderboardList.innerHTML = ''
    const sortedPlayers = [...state.players].sort((a, b) => b.score - a.score)
    for (const p of sortedPlayers) {
      const row = document.createElement('div')
      row.className = 'leader-row'
      const youSuffix = p.id === room?.profile.id ? ' (Você)' : ''
      row.innerHTML = `
        <div class="leader-left">
          <span class="leader-dot" style="background:${p.color || '#a855f7'}">${p.name.charAt(0).toUpperCase()}</span>
          <span class="leader-name">${p.name}${youSuffix}</span>
        </div>
        <div class="leader-stats">
          <span class="leader-words">${p.wordsFound || 0} pal.</span>
          <span class="leader-pts">${p.score || 0} pts</span>
        </div>
      `
      leaderboardList.appendChild(row)
    }

    // Render Live Feed & Bonus Counter
    bonusCountBadge.textContent = `⭐ ${state.bonusFoundCount} bônus`
    if (state.feed.length === 0) {
      liveFeed.innerHTML = '<span class="feed-empty">Digite palavras de 4+ letras abaixo!</span>'
    } else {
      liveFeed.innerHTML = ''
      for (const item of state.feed.slice(0, 14)) {
        const row = document.createElement('div')
        row.className = `feed-item ${item.type}`
        row.innerHTML = `
          <span><strong class="feed-word">${item.word}</strong> · ${item.playerName}</span>
          <span>${item.type === 'bonus' ? '⭐ +40' : '✅'}</span>
        `
        liveFeed.appendChild(row)
      }
    }
  }

  function updateTimerVisuals() {
    const sec = Math.max(0, Math.ceil(state.remainingSec))
    timerSeconds.textContent = `${sec}s`
    timerPill.classList.toggle('urgent', state.status === 'playing' && sec <= 12)
    const pct = Math.max(0, Math.min(100, (state.remainingSec / Math.max(1, state.durationSec)) * 100))
    timerBarLine.style.width = `${pct}%`
  }

  // ==================== HOST GAME LOOP & WORD VALIDATION ====================
  function syncToClients() {
    if (room && room.isHost) {
      room.broadcastState(state)
    }
    renderUI()
  }

  function startLevelOnHost(levelNum) {
    if (!dictReady || !room?.isHost) return
    clearInterval(timerInterval)
    clearInterval(botInterval)

    if (levelNum === 1) {
      for (const p of state.players) {
        p.score = 0
        p.wordsFound = 0
      }
      state.feed = []
    }

    const puzzle = buildLevelPuzzle(levelNum)
    state.level = levelNum
    state.status = 'playing'
    state.tiles = puzzle.tiles
    state.words = puzzle.words
    state.quota = puzzle.quota
    state.durationSec = puzzle.durationSec
    state.remainingSec = puzzle.durationSec
    state.bonusFoundCount = 0
    state.bonusWordsUsed = []

    modalSummary.hidden = true
    if (roomDrawer) {
      roomDrawer.hidden = true
      btnToggleDrawer?.setAttribute('aria-expanded', 'false')
    }

    playChord([440, 554.37, 659.25], 65)
    syncToClients()
    updateTimerVisuals()
    setTimeout(() => guessInput.focus(), 50)

    let hint25Given = false
    let hint12Given = false
    const startTs = Date.now()

    timerInterval = setInterval(() => {
      const elapsed = (Date.now() - startTs) / 1000
      state.remainingSec = Math.max(0, state.durationSec - elapsed)
      updateTimerVisuals()

      // Progressive letter hints & Fake letter cross-out like Words on Stream!
      if (!hint25Given && state.remainingSec <= 30) {
        hint25Given = true
        revealProgressiveHintsOnHost(1)
      }
      if (!hint12Given && state.remainingSec <= 15) {
        hint12Given = true
        revealProgressiveHintsOnHost(2)
      }

      if (state.remainingSec <= 0) {
        clearInterval(timerInterval)
        clearInterval(botInterval)
        finishLevelOnHost()
      }
    }, 200)

    startBotsLoopOnHost()
  }

  function revealProgressiveHintsOnHost(stage) {
    if (!room?.isHost || state.status !== 'playing') return
    // Cross out fake letter at stage 1 (30s left)
    for (const t of state.tiles) {
      if (t.isFake && !t.revealedFake) {
        t.revealedFake = true
        showToast(`🎭 Dica: A letra falsa "${t.char.toUpperCase()}" foi riscada!`, 2600)
      }
    }
    // Reveal 1st letter on unsolved words at stage 1, and last letter at stage 2
    for (const w of state.words) {
      if (w.solved) continue
      if (!w.hintIndices.includes(0)) {
        w.hintIndices.push(0)
      } else if (stage >= 2 && w.len >= 5 && !w.hintIndices.includes(w.len - 1)) {
        w.hintIndices.push(w.len - 1)
      }
    }
    syncToClients()
  }

  function startBotsLoopOnHost() {
    clearInterval(botInterval)
    if (!room?.isHost || state.status !== 'playing') return

    botInterval = setInterval(() => {
      if (state.status !== 'playing') {
        clearInterval(botInterval)
        return
      }
      const bots = state.players.filter((p) => p.isBot)
      if (!bots.length) return
      const unsolved = state.words.filter((w) => !w.solved)
      if (!unsolved.length) return

      const bot = bots[Math.floor(Math.random() * bots.length)]
      // Bots prefer shorter unsolved words
      const candidate = unsolved[Math.floor(Math.random() * Math.min(unsolved.length, 4))]
      if (candidate) {
        processGuessOnHost(candidate.norm, bot)
      }
    }, 5200)
  }

  function processGuessOnHost(rawWord, senderProfile) {
    if (!room?.isHost || state.status !== 'playing') return
    const norm = normalizePt(rawWord)
    if (norm.length < 4) return

    let player = state.players.find((p) => p.id === senderProfile?.id)
    if (!player && senderProfile) {
      player = {
        id: senderProfile.id,
        name: senderProfile.name || 'Jogador',
        color: senderProfile.color || '#38bdf8',
        isBot: false,
        score: 0,
        wordsFound: 0,
      }
      state.players.push(player)
    }
    if (!player) return

    // 1. Check if it matches an unsolved word on the board
    const boardWord = state.words.find((w) => w.norm === norm)
    if (boardWord) {
      if (boardWord.solved) {
        sendFeedbackToPlayer(player.id, 'already', `"${boardWord.display.toUpperCase()}" já foi encontrada!`)
        return
      }

      boardWord.solved = true
      boardWord.finderName = player.name
      boardWord.finderColor = player.color

      const pts = boardWord.len * 25 + state.level * 10
      player.score = (player.score || 0) + pts
      player.wordsFound = (player.wordsFound || 0) + 1

      state.feed.unshift({
        word: boardWord.display.toUpperCase(),
        playerName: player.name,
        type: 'hit',
      })
      if (state.feed.length > 20) state.feed.pop()

      playChord([523.25, 659.25, 783.99], 50)
      room.broadcastEvent({
        type: 'WORD_FOUND',
        playerId: player.id,
        word: boardWord.display.toUpperCase(),
        isBonus: false,
      })

      // Check if all board words are solved -> instant level clear!
      if (state.words.every((w) => w.solved)) {
        clearInterval(timerInterval)
        clearInterval(botInterval)
        finishLevelOnHost()
        return
      }

      syncToClients()
      return
    }

    // 2. Check if it's a valid Bonus Word formed by the real letters
    if (allValidSet.has(norm)) {
      const realChars = state.tiles.filter((t) => !t.isFake).map((t) => t.char).join('')
      const poolCounts = countLetters(realChars)
      const guessCounts = countLetters(norm)

      if (canFormFromCounts(guessCounts, poolCounts)) {
        if (state.bonusWordsUsed.includes(norm)) {
          sendFeedbackToPlayer(player.id, 'already', `Palavra bônus "${norm.toUpperCase()}" já usada!`)
          return
        }
        state.bonusWordsUsed.push(norm)
        state.bonusFoundCount++
        player.score = (player.score || 0) + 40

        const disp = (displayMap.get(norm) || norm).toUpperCase()
        state.feed.unshift({
          word: disp,
          playerName: player.name,
          type: 'bonus',
        })
        if (state.feed.length > 20) state.feed.pop()

        playTone(660, 0.12, 'triangle', 0.1)
        room.broadcastEvent({
          type: 'WORD_FOUND',
          playerId: player.id,
          word: disp,
          isBonus: true,
        })
        syncToClients()
        return
      }
    }

    sendFeedbackToPlayer(player.id, 'invalid', `"${norm.toUpperCase()}" não está no quadro!`)
  }

  function sendFeedbackToPlayer(playerId, kind, msg) {
    if (playerId === room.profile.id) {
      handleLocalReject(msg)
    } else {
      room.broadcastEvent({ type: 'REJECT', playerId, message: msg })
    }
  }

  function handleLocalReject(msg) {
    playTone(165, 0.15, 'sawtooth', 0.1)
    inputWrapper.classList.remove('shake')
    void inputWrapper.offsetWidth
    inputWrapper.classList.add('shake')
    showToast(msg, 1700)
  }

  function triggerLocalCooldown() {
    if (!state.cooldownEnabled) return
    myCooldownUntil = Date.now() + 3000
    clearInterval(cooldownTimer)
    cooldownBadge.hidden = false
    guessInput.disabled = true

    cooldownTimer = setInterval(() => {
      const rem = (myCooldownUntil - Date.now()) / 1000
      if (rem <= 0) {
        clearInterval(cooldownTimer)
        cooldownBadge.hidden = true
        guessInput.disabled = false
        guessInput.focus()
      } else {
        cooldownBadge.textContent = `🔒 ${rem.toFixed(1)}s`
      }
    }, 100)
  }

  function finishLevelOnHost() {
    const solvedCount = state.words.filter((w) => w.solved).length
    const passed = solvedCount >= state.quota
    state.status = passed ? 'levelclear' : 'gameover'
    syncToClients()
    room.broadcastEvent({
      type: 'LEVEL_END',
      passed,
      level: state.level,
      solvedCount,
      totalWords: state.words.length,
    })
    openSummaryModal(passed, solvedCount, state.words.length)
  }

  function openSummaryModal(passed, solvedCount, totalWords) {
    if (passed) {
      launchConfetti()
      playChord([523.25, 659.25, 783.99, 1046.5], 70)
    } else {
      playTone(150, 0.3, 'sawtooth', 0.12)
    }

    document.getElementById('modal-badge').textContent = passed
      ? `🔓 NÍVEL ${state.level} SUPERADO!`
      : `🔒 FIM DE JOGO NO NÍVEL ${state.level}`
    document.getElementById('modal-title').textContent = passed
      ? `Rumo ao Nível ${state.level + 1}! 🎉`
      : `O Cadeado Não Abriu!`
    document.getElementById('modal-subtitle').textContent = passed
      ? `A sala encontrou ${solvedCount} de ${totalWords} palavras (meta: ${state.quota})!`
      : `Vocês encontraram ${solvedCount} de ${state.quota} palavras necessárias.`

    const wordsList = document.getElementById('modal-words-list')
    const missedBox = document.getElementById('modal-Missed-box')
    missedBox.hidden = false
    wordsList.innerHTML = ''
    for (const w of state.words) {
      const pill = document.createElement('span')
      pill.className = `modal-word-pill ${w.solved ? 'found' : 'missed'}`
      pill.textContent = w.display.toUpperCase()
      wordsList.appendChild(pill)
    }

    const sorted = [...state.players].sort((a, b) => b.score - a.score)
    const mvp = sorted[0]
    document.getElementById('modal-mvp-box').textContent = mvp
      ? `👑 Destaque da Sala: ${mvp.name} (${mvp.score} pts · ${mvp.wordsFound} palavras)`
      : 'Parabéns à equipe!'

    const btnNext = document.getElementById('btn-next-action')
    const isHost = room ? room.isHost : true
    btnNext.hidden = !isHost
    btnNext.textContent = passed
      ? `▶️ Iniciar Nível ${state.level + 1}`
      : `🔄 Jogar Novamente (Nível 1)`

    modalSummary.hidden = false
  }

  function launchConfetti() {
    const ctx = confettiCanvas.getContext('2d')
    confettiCanvas.width = window.innerWidth
    confettiCanvas.height = window.innerHeight
    const colors = ['#a855f7', '#38bdf8', '#10b981', '#fbbf24', '#f43f5e']
    const pieces = Array.from({ length: 80 }, () => ({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 200,
      y: window.innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 13,
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
      if (frame < 100) requestAnimationFrame(tick)
      else ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height)
    }
    requestAnimationFrame(tick)
  }

  // ==================== P2P MULTIPLAYER ROOM ====================
  function setupRoomAsHost(code) {
    clearInterval(timerInterval)
    clearInterval(botInterval)
    room.hostRoom(code)
    const normalized = room.roomCode || code
    state.roomCode = normalized
    state.status = 'lobby'
    state.level = 1
    state.players = [
      {
        id: room.profile.id,
        name: room.profile.name,
        color: room.profile.color || '#a855f7',
        isBot: false,
        score: 0,
        wordsFound: 0,
      },
    ]
    roomCodeInput.value = normalized
    if (dictReady) {
      const preview = buildLevelPuzzle(1)
      state.tiles = preview.tiles
      state.words = preview.words
      state.quota = preview.quota
      state.durationSec = preview.durationSec
      state.remainingSec = preview.durationSec
    }
    renderUI()
  }

  function initP2P() {
    room = new window.NBPRoom({
      gameId: 'wos-nbp',
      defaultPrefix: 'WOS',
      onStatus(st) {
        if (st.connecting) {
          p2pStatus.textContent = st.isHost
            ? `🟡 Abrindo ${st.roomCode}...`
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
        if (err && err.message) showToast(`⚠️ ${err.message}`, 3200)
      },
      onStateSync(remoteState) {
        Object.assign(state, remoteState)
        roomCodeInput.value = state.roomCode
        clearInterval(timerInterval)
        if (!room.isHost && state.status === 'playing') {
          const syncTs = Date.now()
          const initRem = state.remainingSec
          timerInterval = setInterval(() => {
            const elapsed = (Date.now() - syncTs) / 1000
            state.remainingSec = Math.max(0, initRem - elapsed)
            updateTimerVisuals()
          }, 200)
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
            const p = action.profile
            const exists = state.players.find((pl) => pl.id === p.id)
            if (!exists) {
              state.players.push({
                id: p.id,
                name: p.name,
                color: p.color || '#38bdf8',
                isBot: false,
                score: 0,
                wordsFound: 0,
              })
              const joinMsg = `👋 ${p.name} entrou na sala!`
              showToast(joinMsg)
              room.broadcastEvent({ type: 'TOAST', message: joinMsg })
              syncToClients()
            } else if (action.type === 'JOIN_REQUEST') {
              exists.name = p.name
              syncToClients()
            }
          } else if (action.type === 'PLAYER_LEFT') {
            const leftId = action.playerId || senderProfile?.id
            const idx = state.players.findIndex((p) => p.id === leftId && !p.isBot)
            if (idx !== -1) {
              const leftName = state.players[idx].name
              state.players.splice(idx, 1)
              showToast(`🚪 ${leftName} saiu da sala.`)
              syncToClients()
            }
          } else if (action.type === 'SUBMIT_GUESS') {
            processGuessOnHost(action.word, senderProfile)
          }
        } else {
          if (action.type === 'HOST_LEFT') {
            const hostIdx = state.players.findIndex((p) => p.id === (action.hostId || senderProfile?.id))
            if (hostIdx !== -1) state.players.splice(hostIdx, 1)
            const nextHost = state.players.find((p) => !p.isBot)
            if (!nextHost || nextHost.id === room.profile.id) {
              room.promoteToHost(state.players)
              showToast(`👑 Você assumiu como Host da sala ${state.roomCode}!`)
              syncToClients()
            }
          } else if (action.type === 'WORD_FOUND') {
            if (action.playerId === room.profile.id) {
              playChord([523.25, 659.25, 783.99], 50)
              triggerLocalCooldown()
            } else {
              playTone(587.33, 0.08, 'triangle', 0.07)
            }
          } else if (action.type === 'REJECT' && action.playerId === room.profile.id) {
            handleLocalReject(action.message)
          } else if (action.type === 'TOAST' && action.message) {
            showToast(action.message)
          } else if (action.type === 'LEVEL_END') {
            openSummaryModal(action.passed, action.solvedCount, action.totalWords)
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
  btnToggleDrawer.addEventListener('click', () => {
    const nextOpen = roomDrawer.hidden
    roomDrawer.hidden = !nextOpen
    btnToggleDrawer.setAttribute('aria-expanded', String(nextOpen))
  })

  playerNameInput.addEventListener('change', () => {
    room.setPlayerName(playerNameInput.value)
    const me = state.players.find((p) => p.id === room.profile.id)
    if (me) me.name = room.profile.name
    if (room.isHost) syncToClients()
    else room.sendToHost({ type: 'JOIN_REQUEST', profile: room.profile })
    showToast(`Apelido atualizado para ${room.profile.name}`)
  })

  btnHostRoom.addEventListener('click', () => {
    const code = roomCodeInput.value.trim().toUpperCase() || randomRoomCode()
    setupRoomAsHost(code)
    showToast(`Sala ${room.roomCode} criada! Compartilhe com os amigos.`)
  })

  btnJoinRoom.addEventListener('click', () => {
    const code = roomCodeInput.value.trim().toUpperCase()
    if (!code) {
      showToast('Digite o código da sala!')
      return
    }
    clearInterval(timerInterval)
    clearInterval(botInterval)
    room.joinRoom(code)
    roomCodeInput.value = room.roomCode
    roomDrawer.hidden = true
    btnToggleDrawer.setAttribute('aria-expanded', 'false')
    showToast(`Conectando à sala ${room.roomCode}...`)
  })

  btnCopyRoom.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(state.roomCode)
      showToast(`Código ${state.roomCode} copiado! Envie para seus amigos 📋`)
    } catch {
      showToast(`Sala: ${state.roomCode}`)
    }
  })

  btnToggleCooldown.addEventListener('click', () => {
    if (!room?.isHost) return
    state.cooldownEnabled = !state.cooldownEnabled
    syncToClients()
  })

  btnAddBot.addEventListener('click', () => {
    if (!room?.isHost) return
    const botCount = state.players.filter((p) => p.isBot).length
    if (botCount >= BOT_PROFILES.length) {
      showToast('Limite máximo de Bots atingido!')
      return
    }
    const meta = BOT_PROFILES[botCount]
    state.players.push({
      id: `${meta.id}_${Date.now()}`,
      name: meta.name,
      color: meta.color,
      isBot: true,
      score: 0,
      wordsFound: 0,
    })
    syncToClients()
  })

  btnRemoveBot.addEventListener('click', () => {
    if (!room?.isHost) return
    const idx = state.players.map((p) => p.isBot).lastIndexOf(true)
    if (idx === -1) return
    state.players.splice(idx, 1)
    syncToClients()
  })

  btnStartMatch.addEventListener('click', () => {
    if (!room?.isHost) return
    const nextLvl = state.status === 'levelclear' ? state.level + 1 : 1
    startLevelOnHost(nextLvl)
  })

  document.getElementById('btn-next-action').addEventListener('click', () => {
    if (!room?.isHost) return
    const nextLvl = state.status === 'levelclear' ? state.level + 1 : 1
    startLevelOnHost(nextLvl)
  })

  document.getElementById('btn-close-modal').addEventListener('click', () => {
    modalSummary.hidden = true
  })

  document.getElementById('btn-share-wos').addEventListener('click', async () => {
    const sorted = [...state.players].sort((a, b) => b.score - a.score)
    const topStr = sorted
      .slice(0, 4)
      .map((p, i) => `${i + 1}º ${p.name}: ${p.score} pts (${p.wordsFound} pal.)`)
      .join('\n')
    const text = `🟣 NBP Palavras em Live (Words on Stream)\n🏆 Chegamos ao Nível ${state.level} na sala ${state.roomCode}!\n${topStr}`
    try {
      await navigator.clipboard.writeText(text)
      showToast('Placar copiado para compartilhar! 📋')
    } catch {
      showToast('Não foi possível copiar o placar.')
    }
  })

  btnShuffle.addEventListener('click', () => {
    state.tiles = shuffleArray(state.tiles)
    playTone(390, 0.05)
    renderUI()
  })

  btnSound.addEventListener('click', () => {
    soundEnabled = !soundEnabled
    btnSound.setAttribute('aria-pressed', String(soundEnabled))
    btnSound.textContent = soundEnabled ? '🔊' : '🔇'
  })

  guessForm.addEventListener('submit', (e) => {
    e.preventDefault()
    if (state.status !== 'playing') {
      if (room?.isHost && dictReady) {
        startLevelOnHost(1)
      }
      return
    }
    if (Date.now() < myCooldownUntil) return

    const typed = normalizePt(guessInput.value)
    if (typed.length < 4) {
      handleLocalReject('As palavras precisam ter pelo menos 4 letras!')
      return
    }
    guessInput.value = ''

    if (room.isHost) {
      const prevWords = state.players.find((p) => p.id === room.profile.id)?.wordsFound || 0
      processGuessOnHost(typed, room.profile)
      const nowWords = state.players.find((p) => p.id === room.profile.id)?.wordsFound || 0
      if (nowWords > prevWords) {
        triggerLocalCooldown()
      }
    } else {
      room.sendToHost({ type: 'SUBMIT_GUESS', word: typed })
    }
  })

  // ==================== LOAD PORTUGUESE WORD BANK ====================
  async function loadDictionary() {
    try {
      const res = await fetch('../../data/pt-br/palavras-por-tamanho.json')
      const data = await res.json()

      for (let len = 4; len <= 10; len++) {
        const group = data.lengths[String(len)]
        if (!group) continue
        const bucket = []
        const seenNorm = new Set()

        for (const tier of ['facil', 'medio']) {
          for (const rawW of group[tier] || []) {
            const norm = normalizePt(rawW)
            if (norm.length !== len || seenNorm.has(norm)) continue
            seenNorm.add(norm)
            allValidSet.add(norm)
            displayMap.set(norm, rawW)
            bucket.push({
              norm,
              display: rawW,
              len,
              tier,
              counts: countLetters(norm),
            })
          }
        }
        commonByLen.set(len, bucket)

        for (const rawHard of group.dificil || []) {
          const norm = normalizePt(rawHard)
          if (norm.length === len) {
            allValidSet.add(norm)
            if (!displayMap.has(norm)) displayMap.set(norm, rawHard)
          }
        }
      }

      // Index rich root words of lengths 6, 7 and 8
      for (const rLen of [6, 7, 8]) {
        const roots = (commonByLen.get(rLen) || []).filter((w) => w.tier === 'facil')
        rootPoolByLen.set(rLen, roots)
      }

      dictReady = true
      if (state.status === 'lobby' && state.words.length === 0) {
        const preview = buildLevelPuzzle(1)
        state.tiles = preview.tiles
        state.words = preview.words
        state.quota = preview.quota
        state.durationSec = preview.durationSec
        state.remainingSec = preview.durationSec
      }
      renderUI()
    } catch (err) {
      console.error(err)
      goalStatusText.textContent = 'Erro ao carregar banco de palavras PT-BR.'
    }
  }

  initP2P()
  loadDictionary()
})()
