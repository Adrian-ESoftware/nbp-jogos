;(() => {
  const MODE_CONFIG = {
    termo: { label: 'Termo', boards: 1, maxAttempts: 6 },
    dueto: { label: 'Dueto', boards: 2, maxAttempts: 7 },
    quarteto: { label: 'Quarteto', boards: 4, maxAttempts: 9 },
  }

  const KB_ROWS = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'BACK'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', 'ENTER'],
  ]

  const STATS_KEY = 'nbp_termo_stats_v1'

  let dataset = null
  let validSet = new Set()
  let soundEnabled = true
  let audioCtx = null

  const state = {
    mode: 'termo',
    tier: 'medio',
    seed: '',
    targets: [], // [{ word: 'órgão', norm: 'orgao', solved: false, solvedAtRow: -1 }]
    maxAttempts: 6,
    currentRow: 0,
    currentInput: ['', '', '', '', ''],
    cursor: 0,
    history: [], // [{ guessNorm, displayWord, evalsByBoard: [ ['correct', ...], ... ] }]
    isRevealing: false,
    gameOver: false,
    won: false,
  }

  // DOM Elements
  const boardsContainer = document.getElementById('boards-container')
  const keyboardEl = document.getElementById('keyboard')
  const toastContainer = document.getElementById('toast-container')
  const tierSelect = document.getElementById('tier-select')
  const seedInput = document.getElementById('seed-input')
  const btnApplySeed = document.getElementById('btn-apply-seed')
  const btnRandomSeed = document.getElementById('btn-random-seed')
  const btnSound = document.getElementById('btn-sound')
  const btnHelp = document.getElementById('btn-help')
  const modalResult = document.getElementById('modal-result')
  const modalHelp = document.getElementById('modal-help')
  const confettiCanvas = document.getElementById('confetti-canvas')

  function normalizePt(str) {
    return str
      .toLocaleLowerCase('pt-BR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
  }

  // Simple Web Audio Synth for tactile feedback
  function playTone(freq, duration = 0.07, type = 'sine', gainVal = 0.08) {
    if (!soundEnabled) return
    try {
      if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext
        audioCtx = new AudioContextClass()
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
    } catch {
      // Ignore audio errors
    }
  }

  function playChord(notes, stepMs = 80) {
    notes.forEach((n, idx) => {
      setTimeout(() => playTone(n, 0.16, 'triangle', 0.1), idx * stepMs)
    })
  }

  function showToast(msg, duration = 2000) {
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

  // Deterministic PRNG (FNV-1a + Mulberry32)
  function createSeededRandom(seedStr) {
    let h = 2166136261 >>> 0
    for (let i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    let s = h >>> 0
    return function next() {
      s += 0x6d2b79f5
      let t = s
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  function getTodayCode() {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `DIA-${d}${m}`
  }

  function evaluateGuess(guessNorm, targetNorm) {
    const g = guessNorm.split('')
    const t = targetNorm.split('')
    const res = new Array(5).fill('absent')
    const counts = {}

    for (let i = 0; i < 5; i++) {
      if (g[i] === t[i]) {
        res[i] = 'correct'
      } else {
        counts[t[i]] = (counts[t[i]] || 0) + 1
      }
    }

    for (let i = 0; i < 5; i++) {
      if (res[i] === 'correct') continue
      const ch = g[i]
      if (counts[ch] > 0) {
        res[i] = 'present'
        counts[ch]--
      }
    }
    return res
  }

  function pickTargets(mode, tier, seedCode) {
    const cfg = MODE_CONFIG[mode]
    const pool = dataset.targets[tier] || dataset.targets.medio
    const fullSeed = `${mode}:${tier}:${seedCode.toUpperCase()}`
    const rng = createSeededRandom(fullSeed)
    const copy = [...pool]
    const chosen = []

    for (let i = 0; i < cfg.boards; i++) {
      const idx = Math.floor(rng() * (copy.length - i)) + i
      const tmp = copy[i]
      copy[i] = copy[idx]
      copy[idx] = tmp
      const word = copy[i]
      chosen.push({
        word,
        norm: normalizePt(word),
        solved: false,
        solvedAtRow: -1,
      })
    }
    return chosen
  }

  function buildBoardsDOM() {
    const cfg = MODE_CONFIG[state.mode]
    boardsContainer.className = `boards-container mode-${state.mode}`
    boardsContainer.innerHTML = ''

    for (let b = 0; b < cfg.boards; b++) {
      const card = document.createElement('div')
      card.className = 'board-card'
      card.id = `board-${b}`

      for (let r = 0; r < cfg.maxAttempts; r++) {
        const row = document.createElement('div')
        row.className = 'board-row'
        row.id = `board-${b}-row-${r}`

        for (let c = 0; c < 5; c++) {
          const tile = document.createElement('div')
          tile.className = 'tile'
          tile.id = `tile-${b}-${r}-${c}`
          tile.addEventListener('click', () => {
            if (state.gameOver || state.isRevealing) return
            if (r === state.currentRow && !state.targets[b].solved) {
              state.cursor = c
              playTone(360, 0.04)
              renderActiveRow()
            }
          })
          row.appendChild(tile)
        }
        card.appendChild(row)
      }
      boardsContainer.appendChild(card)
    }
  }

  function buildKeyboardDOM() {
    const cfg = MODE_CONFIG[state.mode]
    keyboardEl.innerHTML = ''

    for (const rowKeys of KB_ROWS) {
      const rowEl = document.createElement('div')
      rowEl.className = 'kb-row'

      for (const k of rowKeys) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'key'
        btn.dataset.key = k

        if (k === 'BACK' || k === 'ENTER') {
          btn.classList.add('wide')
          const span = document.createElement('span')
          span.className = 'key-label'
          span.textContent = k === 'BACK' ? '⌫' : 'ENTER'
          btn.appendChild(span)
        } else {
          const quads = document.createElement('div')
          quads.className = `key-quadrants q-${cfg.boards}`
          quads.id = `kb-quads-${k}`
          for (let b = 0; b < cfg.boards; b++) {
            const q = document.createElement('div')
            q.className = 'quad'
            q.id = `kb-q-${k}-${b}`
            quads.appendChild(q)
          }
          const span = document.createElement('span')
          span.className = 'key-label'
          span.textContent = k.toUpperCase()
          btn.appendChild(quads)
          btn.appendChild(span)
        }

        btn.addEventListener('click', () => handleKeyInput(k))
        rowEl.appendChild(btn)
      }
      keyboardEl.appendChild(rowEl)
    }
  }

  function renderActiveRow(popCol = -1) {
    const cfg = MODE_CONFIG[state.mode]
    for (let b = 0; b < cfg.boards; b++) {
      const target = state.targets[b]
      for (let r = 0; r < cfg.maxAttempts; r++) {
        const rowEl = document.getElementById(`board-${b}-row-${r}`)
        const isActive = !state.gameOver && !target.solved && r === state.currentRow
        rowEl.classList.toggle('active-row', isActive)

        if (isActive) {
          for (let c = 0; c < 5; c++) {
            const tile = document.getElementById(`tile-${b}-${r}-${c}`)
            const ch = state.currentInput[c] || ''
            tile.textContent = ch.toUpperCase()
            tile.classList.toggle('filled', Boolean(ch))
            tile.classList.toggle('cursor', c === state.cursor)
            if (c === popCol) {
              tile.classList.remove('pop')
              void tile.offsetWidth
              tile.classList.add('pop')
            }
          }
        }
      }
    }
  }

  function updateKeyboardColors() {
    const cfg = MODE_CONFIG[state.mode]
    const priority = { absent: 1, present: 2, correct: 3 }
    const boardKeyState = Array.from({ length: cfg.boards }, () => ({}))

    for (let r = 0; r < state.history.length; r++) {
      const h = state.history[r]
      const letters = h.guessNorm.split('')
      for (let b = 0; b < cfg.boards; b++) {
        const solvedAt = state.targets[b].solvedAtRow
        if (solvedAt !== -1 && r > solvedAt) continue
        const evals = h.evalsByBoard[b]
        for (let c = 0; c < 5; c++) {
          const ch = letters[c]
          const st = evals[c]
          const prev = boardKeyState[b][ch]
          if (!prev || priority[st] > priority[prev]) {
            boardKeyState[b][ch] = st
          }
        }
      }
    }

    for (let code = 97; code <= 122; code++) {
      const ch = String.fromCharCode(code)
      for (let b = 0; b < cfg.boards; b++) {
        const q = document.getElementById(`kb-q-${ch}-${b}`)
        if (!q) continue
        q.className = 'quad'
        const st = boardKeyState[b][ch]
        if (st) q.classList.add(st)
      }
    }
  }

  function shakeCurrentRow() {
    playTone(150, 0.14, 'sawtooth', 0.09)
    const cfg = MODE_CONFIG[state.mode]
    for (let b = 0; b < cfg.boards; b++) {
      if (state.targets[b].solved) continue
      const rowEl = document.getElementById(`board-${b}-row-${state.currentRow}`)
      if (!rowEl) continue
      rowEl.classList.remove('shake')
      void rowEl.offsetWidth
      rowEl.classList.add('shake')
    }
  }

  function handleKeyInput(key) {
    if (state.gameOver || state.isRevealing) return

    if (key === 'LEFT') {
      state.cursor = Math.max(0, state.cursor - 1)
      renderActiveRow()
      return
    }
    if (key === 'RIGHT') {
      state.cursor = Math.min(4, state.cursor + 1)
      renderActiveRow()
      return
    }
    if (key === 'BACK') {
      playTone(260, 0.04)
      if (state.currentInput[state.cursor]) {
        state.currentInput[state.cursor] = ''
      } else if (state.cursor > 0) {
        state.cursor--
        state.currentInput[state.cursor] = ''
      }
      renderActiveRow()
      return
    }
    if (key === 'ENTER') {
      submitCurrentGuess()
      return
    }

    if (/^[a-z]$/.test(key)) {
      playTone(440 + state.cursor * 35, 0.045)
      const popIndex = state.cursor
      state.currentInput[state.cursor] = key
      if (state.cursor < 4) {
        // Move to next empty slot or just increment
        const nextEmpty = state.currentInput.findIndex((v, idx) => idx > state.cursor && !v)
        if (nextEmpty !== -1) {
          state.cursor = nextEmpty
        } else {
          state.cursor = Math.min(4, state.cursor + 1)
        }
      }
      renderActiveRow(popIndex)
    }
  }

  function submitCurrentGuess() {
    const rawGuess = state.currentInput.join('')
    if (rawGuess.length < 5 || state.currentInput.some((c) => !c)) {
      shakeCurrentRow()
      showToast('Digite uma palavra de 5 letras!')
      return
    }

    const guessNorm = normalizePt(rawGuess)
    if (!validSet.has(guessNorm)) {
      shakeCurrentRow()
      showToast('Essa palavra não é aceita no dicionário!')
      return
    }

    const cfg = MODE_CONFIG[state.mode]
    const rowIdx = state.currentRow
    const displayWord = dataset.accentMap[guessNorm] || guessNorm
    const evalsByBoard = state.targets.map((t) => evaluateGuess(guessNorm, t.norm))

    state.isRevealing = true

    // Remove cursor highlight before flipping
    for (let b = 0; b < cfg.boards; b++) {
      const rowEl = document.getElementById(`board-${b}-row-${rowIdx}`)
      if (rowEl) rowEl.classList.remove('active-row')
      for (let c = 0; c < 5; c++) {
        const tile = document.getElementById(`tile-${b}-${rowIdx}-${c}`)
        if (tile) tile.classList.remove('cursor')
      }
    }

    // Staggered 3D Flip Animation across all unsolved boards
    const STAGGER_MS = 105
    for (let c = 0; c < 5; c++) {
      setTimeout(() => {
        playTone(320 + c * 55, 0.06, 'triangle', 0.07)
        for (let b = 0; b < cfg.boards; b++) {
          if (state.targets[b].solved) continue
          const tile = document.getElementById(`tile-${b}-${rowIdx}-${c}`)
          if (!tile) continue
          tile.classList.add('flip')

          // Change color and show accented letter at half-flip (230ms)
          setTimeout(() => {
            // If word is exact match, show target's accented char; otherwise show guess's accented char
            const isExactWord = guessNorm === state.targets[b].norm
            const wordToUse = isExactWord ? state.targets[b].word : displayWord
            tile.textContent = wordToUse[c].toUpperCase()
            tile.classList.remove('filled')
            tile.classList.add(evalsByBoard[b][c])
          }, 230)
        }
      }, c * STAGGER_MS)
    }

    setTimeout(() => {
      // Check newly solved boards
      let newlySolved = false
      for (let b = 0; b < cfg.boards; b++) {
        if (!state.targets[b].solved && guessNorm === state.targets[b].norm) {
          state.targets[b].solved = true
          state.targets[b].solvedAtRow = rowIdx
          newlySolved = true

          const card = document.getElementById(`board-${b}`)
          if (card) card.classList.add('solved')

          // Bounce wave on solved row
          for (let c = 0; c < 5; c++) {
            const tile = document.getElementById(`tile-${b}-${rowIdx}-${c}`)
            setTimeout(() => {
              if (tile) tile.classList.add('bounce')
            }, c * 65)
          }
        }
      }

      if (newlySolved) {
        playChord([523.25, 659.25, 783.99, 1046.5], 70)
      }

      state.history.push({ guessNorm, displayWord, evalsByBoard })
      updateKeyboardColors()

      const allSolved = state.targets.every((t) => t.solved)
      if (allSolved) {
        state.gameOver = true
        state.won = true
        state.isRevealing = false
        recordGameResult(true)
        launchConfetti()
        setTimeout(() => openResultModal(), 650)
        return
      }

      if (rowIdx + 1 >= cfg.maxAttempts) {
        state.gameOver = true
        state.won = false
        state.isRevealing = false
        recordGameResult(false)
        playChord([349.23, 311.13, 261.63], 120)
        setTimeout(() => openResultModal(), 550)
        return
      }

      state.currentRow++
      state.currentInput = ['', '', '', '', '']
      state.cursor = 0
      state.isRevealing = false
      renderActiveRow()
    }, 5 * STAGGER_MS + 300)
  }

  function loadStats() {
    try {
      const raw = localStorage.getItem(STATS_KEY)
      if (raw) return JSON.parse(raw)
    } catch {
      // ignore
    }
    return { played: 0, wins: 0, streak: 0 }
  }

  function recordGameResult(won) {
    const s = loadStats()
    s.played++
    if (won) {
      s.wins++
      s.streak++
    } else {
      s.streak = 0
    }
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(s))
    } catch {
      // ignore
    }
  }

  function openResultModal() {
    const cfg = MODE_CONFIG[state.mode]
    const stats = loadStats()
    document.getElementById('modal-badge').textContent = `${cfg.label.toUpperCase()} · NÍVEL ${state.tier.toUpperCase()} · SALA ${state.seed}`
    document.getElementById('modal-title').textContent = state.won ? 'Você Acertou! 🎉' : 'Fim das Tentativas!'
    document.getElementById('modal-subtitle').textContent = state.won
      ? `Resolvido em ${state.history.length} de ${cfg.maxAttempts} tentativas!`
      : 'Veja abaixo a(s) palavra(s) correta(s) desta rodada:'

    const wordsBox = document.getElementById('modal-words')
    wordsBox.innerHTML = ''
    for (const t of state.targets) {
      const pill = document.createElement('span')
      pill.className = 'word-pill'
      pill.textContent = t.word.toUpperCase()
      wordsBox.appendChild(pill)
    }

    document.getElementById('stat-played').textContent = String(stats.played)
    document.getElementById('stat-wins').textContent = String(stats.wins)
    document.getElementById('stat-streak').textContent = String(stats.streak)
    modalResult.hidden = false
  }

  function buildShareText() {
    const cfg = MODE_CONFIG[state.mode]
    const attemptsText = state.won ? `${state.history.length}/${cfg.maxAttempts}` : `X/${cfg.maxAttempts}`
    const lines = [
      `🟩 NBP ${cfg.label} (${state.tier.toUpperCase()}) · ${attemptsText}`,
      `🔑 Sala: ${state.seed}`,
      '',
    ]

    if (cfg.boards === 1) {
      for (const h of state.history) {
        const rowEmojis = h.evalsByBoard[0]
          .map((e) => (e === 'correct' ? '🟩' : e === 'present' ? '🟨' : '⬛'))
          .join('')
        lines.push(rowEmojis)
      }
    } else {
      const solvedCounts = state.targets.map((t) => (t.solved ? `${t.solvedAtRow + 1}️⃣` : '🟥')).join(' ')
      lines.push(`Placar: ${solvedCounts}`)
      for (const h of state.history) {
        const rowStr = h.evalsByBoard
          .map((ev) => ev.map((e) => (e === 'correct' ? '🟩' : e === 'present' ? '🟨' : '⬛')).join(''))
          .join(' ')
        lines.push(rowStr)
      }
    }
    return lines.join('\n')
  }

  // Confetti burst on canvas
  function launchConfetti() {
    const ctx = confettiCanvas.getContext('2d')
    confettiCanvas.width = window.innerWidth
    confettiCanvas.height = window.innerHeight
    const colors = ['#10b981', '#facc15', '#38bdf8', '#a855f7', '#f43f5e']
    const pieces = Array.from({ length: 90 }, () => ({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 180,
      y: window.innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 12 - 4,
      size: Math.random() * 7 + 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.25,
    }))

    let frame = 0
    function tick() {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height)
      for (const p of pieces) {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.36
        p.rot += p.vrot
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65)
        ctx.restore()
      }
      frame++
      if (frame < 110) requestAnimationFrame(tick)
      else ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height)
    }
    requestAnimationFrame(tick)
  }

  function startNewGame(customSeed) {
    if (!dataset) return
    const cfg = MODE_CONFIG[state.mode]
    state.maxAttempts = cfg.maxAttempts
    state.seed = (customSeed || seedInput.value.trim() || getTodayCode()).toUpperCase()
    seedInput.value = state.seed
    state.targets = pickTargets(state.mode, state.tier, state.seed)
    state.currentRow = 0
    state.currentInput = ['', '', '', '', '']
    state.cursor = 0
    state.history = []
    state.isRevealing = false
    state.gameOver = false
    state.won = false

    modalResult.hidden = true
    buildBoardsDOM()
    buildKeyboardDOM()
    renderActiveRow()
  }

  function randomRoomCode() {
    const num = Math.floor(1000 + Math.random() * 9000)
    return `NBP-${num}`
  }

  // Event Listeners
  document.querySelectorAll('.mode-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-tab').forEach((b) => {
        b.classList.remove('active')
        b.setAttribute('aria-selected', 'false')
      })
      btn.classList.add('active')
      btn.setAttribute('aria-selected', 'true')
      state.mode = btn.dataset.mode
      startNewGame(randomRoomCode())
    })
  })

  tierSelect.addEventListener('change', () => {
    state.tier = tierSelect.value
    startNewGame(randomRoomCode())
    showToast(`Nível alterado para ${tierSelect.options[tierSelect.selectedIndex].text}`)
  })

  btnApplySeed.addEventListener('click', () => {
    const val = seedInput.value.trim() || randomRoomCode()
    startNewGame(val)
    showToast(`Sala "${state.seed}" carregada!`)
  })

  const btnDailySeed = document.getElementById('btn-daily-seed')
  if (btnDailySeed) {
    btnDailySeed.addEventListener('click', () => {
      const code = getTodayCode()
      startNewGame(code)
      showToast(`Desafio do Dia (${code}) carregado!`)
    })
  }

  seedInput.addEventListener('keydown', (e) => {
    e.stopPropagation()
    if (e.key === 'Enter') {
      seedInput.blur()
      btnApplySeed.click()
    }
  })

  btnRandomSeed.addEventListener('click', () => {
    const code = randomRoomCode()
    startNewGame(code)
    showToast(`Nova partida gerada: Sala ${code}`)
  })

  btnSound.addEventListener('click', () => {
    soundEnabled = !soundEnabled
    btnSound.setAttribute('aria-pressed', String(soundEnabled))
    btnSound.textContent = soundEnabled ? '🔊' : '🔇'
  })

  btnHelp.addEventListener('click', () => {
    modalHelp.hidden = false
  })

  document.getElementById('btn-close-help').addEventListener('click', () => {
    modalHelp.hidden = true
  })

  document.getElementById('btn-close-modal').addEventListener('click', () => {
    modalResult.hidden = true
  })

  document.getElementById('btn-next-game').addEventListener('click', () => {
    startNewGame(randomRoomCode())
  })

  document.getElementById('btn-share').addEventListener('click', async () => {
    const text = buildShareText()
    try {
      await navigator.clipboard.writeText(text)
      showToast('Resultado copiado! Cole no chat dos amigos 📋')
    } catch {
      showToast('Não foi possível copiar automaticamente.')
    }
  })

  window.addEventListener('keydown', (e) => {
    if (document.activeElement === seedInput) return
    if (!modalHelp.hidden || !modalResult.hidden) {
      if (e.key === 'Escape') {
        modalHelp.hidden = true
        modalResult.hidden = true
      }
      return
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return

    if (e.key === 'Backspace') {
      e.preventDefault()
      handleKeyInput('BACK')
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleKeyInput('ENTER')
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      handleKeyInput('LEFT')
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      handleKeyInput('RIGHT')
    } else {
      const normKey = normalizePt(e.key)
      if (/^[a-z]$/.test(normKey)) {
        e.preventDefault()
        handleKeyInput(normKey)
      }
    }
  })

  // Load PT-BR Word Bank and initialize
  async function init() {
    try {
      const res = await fetch('../../data/pt-br/termo-5-letras.json')
      if (!res.ok) throw new Error('Falha ao carregar banco de palavras')
      dataset = await res.json()
      validSet = new Set(dataset.validGuesses)
      startNewGame(randomRoomCode())
    } catch (err) {
      showToast('Erro ao carregar o banco de palavras PT-BR.', 5000)
      console.error(err)
    }
  }

  init()
})()
