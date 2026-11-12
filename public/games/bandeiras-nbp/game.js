;(() => {
  let worldData = []
  let brStatesData = []
  let soundEnabled = true
  let audioCtx = null

  const state = {
    mode: 'quiz', // 'quiz' | 'flagle' | 'highlow'
    tier: '2', // '1' | '2' | '3' | '4' | 'br'
    seed: '',
    score: 0,
    streak: 0,
    bestStreak: 0,
    pool: [],
    // Quiz state
    quizQuestions: [],
    quizIndex: 0,
    quizHits: 0,
    quizLocked: false,
    showContinent: false, // Default: Continente OFF
    quizMultipleChoice: true, // Default: Múltipla Escolha ON
    // Flagle state
    flagleTarget: null,
    flagleGuesses: [],
    flagleRevealedOrder: [0, 4, 2, 3, 1, 5],
    flagleRevealedCount: 1,
    flagleOver: false,
    flagleWon: false,
    // HighLow state
    hlLeft: null,
    hlRight: null,
    hlDeck: [],
    hlIndex: 0,
    hlLocked: false,
  }

  // DOM Elements
  const hudScore = document.getElementById('hud-score')
  const hudStreak = document.getElementById('hud-streak')
  const soloHudPills = document.getElementById('solo-hud-pills')
  const soloSeedBox = document.getElementById('solo-seed-box')
  const btnToggleGeoDrawer = document.getElementById('btn-toggle-geo-drawer')
  const geoDrawer = document.getElementById('geo-drawer')
  const tierSelect = document.getElementById('tier-select')
  const seedInput = document.getElementById('seed-input')
  const btnApplySeed = document.getElementById('btn-apply-seed')
  const btnRandomSeed = document.getElementById('btn-random-seed')
  const btnSound = document.getElementById('btn-sound')
  const toastContainer = document.getElementById('toast-container')
  const confettiCanvas = document.getElementById('confetti-canvas')
  const modalSummary = document.getElementById('modal-summary')

  const viewQuiz = document.getElementById('view-quiz')
  const viewFlagle = document.getElementById('view-flagle')
  const viewHighlow = document.getElementById('view-highlow')
  const viewVersus = document.getElementById('view-versus')

  function normalizePt(str) {
    return str
      .toLocaleLowerCase('pt-BR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
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
    // 1. Som sutil de página/tecido virando na troca de bandeira
    pageTurn() {
      if (!soundEnabled) return
      const ctx = this.getCtx()
      if (!ctx) return
      try {
        const now = ctx.currentTime
        const bufferSize = Math.floor(ctx.sampleRate * 0.12)
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35))
        }
        const noise = ctx.createBufferSource()
        noise.buffer = buffer

        const filter = ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.setValueAtTime(1100, now)
        filter.frequency.exponentialRampToValueAtTime(420, now + 0.12)
        filter.Q.value = 1.2

        const gain = ctx.createGain()
        gain.gain.setValueAtTime(0.09, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)

        noise.connect(filter)
        filter.connect(gain)
        gain.connect(ctx.destination)
        noise.start(now)
      } catch (_) {}
    },
    // 2. Clique tátil nos botões
    btnClick() {
      if (!soundEnabled) return
      const ctx = this.getCtx()
      if (!ctx) return
      try {
        const now = ctx.currentTime
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(680 + Math.random() * 120, now)
        osc.frequency.exponentialRampToValueAtTime(240, now + 0.02)
        gain.gain.setValueAtTime(0.045, now)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.02)
      } catch (_) {}
    },
    // 3. Carimbo seco com acorde curto ascendente ao acertar
    stampCorrect() {
      if (!soundEnabled) return
      const ctx = this.getCtx()
      if (!ctx) return
      try {
        const now = ctx.currentTime
        // Impacto inicial de carimbo
        const stamp = ctx.createOscillator()
        const sGain = ctx.createGain()
        stamp.type = 'triangle'
        stamp.frequency.setValueAtTime(210, now)
        stamp.frequency.exponentialRampToValueAtTime(60, now + 0.035)
        sGain.gain.setValueAtTime(0.12, now)
        sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035)
        stamp.connect(sGain)
        sGain.connect(ctx.destination)
        stamp.start(now)
        stamp.stop(now + 0.035)

        // Tríade ascendente alegre
        const notes = [523.25, 659.25, 783.99]
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(freq, now + 0.035 + idx * 0.045)
          gain.gain.setValueAtTime(0.08, now + 0.035 + idx * 0.045)
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035 + idx * 0.045 + 0.28)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start(now + 0.035 + idx * 0.045)
          osc.stop(now + 0.035 + idx * 0.045 + 0.28)
        })
      } catch (_) {}
    },
    // 4. Som grave abafado ao errar
    errorDull() {
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
        osc.frequency.exponentialRampToValueAtTime(70, now + 0.17)
        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(260, now)
        gain.gain.setValueAtTime(0.13, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17)
        osc.connect(filter)
        filter.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.17)
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
    } catch {
      // Ignore audio errors
    }
  }

  function playChord(notes, stepMs = 75) {
    notes.forEach((n, idx) => setTimeout(() => playTone(n, 0.15, 'triangle', 0.1), idx * stepMs))
  }

  // ==================== 3D FLAG HOVER & FLOATING BADGES ====================
  function setupFlag3DHover() {
    const frames = document.querySelectorAll('.flag-frame')
    frames.forEach((frame) => {
      if (frame.dataset.hoverAttached) return
      frame.dataset.hoverAttached = 'true'

      const specular = frame.querySelector('.flag-specular')

      frame.addEventListener('mousemove', (e) => {
        const rect = frame.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const centerX = rect.width / 2
        const centerY = rect.height / 2

        const rotateX = ((centerY - y) / centerY) * 9
        const rotateY = ((x - centerX) / centerX) * 9

        frame.style.transform = `perspective(800px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale(1.025)`

        if (specular) {
          specular.style.opacity = '1'
          specular.style.background = `radial-gradient(circle 140px at ${x}px ${y}px, rgba(255, 255, 255, 0.28) 0%, transparent 80%)`
        }
      })

      frame.addEventListener('mouseleave', () => {
        frame.style.transform = ''
        if (specular) {
          specular.style.opacity = '0'
        }
      })
    })
  }

  function spawnFloatingBadge(text, type = 'score', targetEl) {
    const badge = document.createElement('div')
    badge.className = `floating-badge ${type}`
    badge.textContent = text

    let x = window.innerWidth / 2
    let y = window.innerHeight * 0.4
    if (targetEl) {
      const rect = targetEl.getBoundingClientRect()
      x = rect.left + rect.width / 2
      y = rect.top + rect.height * 0.25
    }

    badge.style.left = `${x}px`
    badge.style.top = `${y}px`
    document.body.appendChild(badge)

    setTimeout(() => badge.remove(), 950)
  }

  function showToast(msg, duration = 2200) {
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

  function shuffleWithSeed(items, seedStr) {
    const rng = createSeededRandom(seedStr)
    const arr = [...items]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      const tmp = arr[i]
      arr[i] = arr[j]
      arr[j] = tmp
    }
    return arr
  }

  function getTodaySeed() {
    const now = new Date()
    const d = String(now.getDate()).padStart(2, '0')
    const m = String(now.getMonth() + 1).padStart(2, '0')
    return `GEO-${d}${m}`
  }

  function randomSeed() {
    return `ATLAS-${Math.floor(1000 + Math.random() * 9000)}`
  }

  function calculateDistanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371
    const toRad = (deg) => (deg * Math.PI) / 180
    const dLat = toRad(lat2 - lat1)
    const dLng = toRad(lng2 - lng1)
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return Math.round(R * c)
  }

  function getCompassDirection(fromLat, fromLng, toLat, toLng) {
    const toRad = (deg) => (deg * Math.PI) / 180
    const toDeg = (rad) => (rad * 180) / Math.PI
    const dLng = toRad(toLng - fromLng)
    const lat1 = toRad(fromLat)
    const lat2 = toRad(toLat)
    const y = Math.sin(dLng) * Math.cos(lat2)
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
    const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360
    const dirs = [
      { cardinal: 'N', arrow: '⬆️' },
      { cardinal: 'NE', arrow: '↗️' },
      { cardinal: 'L', arrow: '➡️' },
      { cardinal: 'SE', arrow: '↘️' },
      { cardinal: 'S', arrow: '⬇️' },
      { cardinal: 'SO', arrow: '↙️' },
      { cardinal: 'O', arrow: '⬅️' },
      { cardinal: 'NO', arrow: '↖️' },
    ]
    return dirs[Math.round(bearing / 45) % 8]
  }

  function getFilteredPool() {
    if (state.tier === 'br') {
      return brStatesData.map((st) => ({
        code: st.uf,
        nome: st.nome,
        nomesAceitos: st.nomesAceitos,
        capital: st.capital,
        regiao: `Brasil · ${st.regiao}`,
        populacao: st.populacao,
        areaKm2: st.areaKm2,
        coordenadas: st.coordenadas,
        fronteiras: st.fronteiras,
        svg: `../..${st.bandeira.svg}`,
        parecidas: [],
        nivel: st.nivel,
      }))
    }

    const maxNivel = Number.parseInt(state.tier, 10) || 2
    return worldData
      .filter((c) => c.nivel <= maxNivel)
      .map((c) => ({
        code: c.cca2,
        nome: c.nome,
        nomesAceitos: c.nomesAceitos,
        capital: c.capital,
        regiao: c.continente,
        populacao: c.populacao,
        areaKm2: c.areaKm2,
        coordenadas: c.coordenadas,
        fronteiras: c.fronteiras,
        svg: `../..${c.bandeira.svg}`,
        parecidas: c.bandeira.parecidas || [],
        nivel: c.nivel,
      }))
  }

  function updateHud() {
    hudScore.textContent = String(state.score)
    hudStreak.textContent = String(state.streak)

    const streakPill = hudStreak ? hudStreak.closest('.hud-pill') : null
    if (streakPill) {
      streakPill.classList.remove('streak-warm', 'streak-hot', 'streak-mega')
      if (state.streak >= 8) {
        streakPill.classList.add('streak-mega')
      } else if (state.streak >= 4) {
        streakPill.classList.add('streak-hot')
      } else if (state.streak >= 2) {
        streakPill.classList.add('streak-warm')
      }
    }
  }

  // ==================== MODO 1: QUIZ DE BANDEIRAS ====================
  function startQuizMode() {
    const shuffled = shuffleWithSeed(state.pool, `quiz:${state.tier}:${state.seed}`)
    state.quizQuestions = shuffled.slice(0, 10)
    state.quizIndex = 0
    state.quizHits = 0
    state.score = 0
    state.streak = 0
    updateHud()
    renderQuizRound()
  }

  function pickQuizDistractors(target, index) {
    const rng = createSeededRandom(`opt:${state.seed}:${index}:${target.code}`)
    const candidates = state.pool.filter((item) => item.code !== target.code)

    // Prioritize visually similar flags or same region for smart alternatives
    const similar = candidates.filter((c) => target.parecidas.includes(c.code))
    const sameRegion = candidates.filter(
      (c) => c.regiao === target.regiao && !target.parecidas.includes(c.code)
    )
    const others = candidates.filter(
      (c) => c.regiao !== target.regiao && !target.parecidas.includes(c.code)
    )

    const picked = []
    for (const group of [similar, sameRegion, others]) {
      const groupShuffled = [...group].sort(() => rng() - 0.5)
      for (const item of groupShuffled) {
        if (picked.length < 3) picked.push(item)
      }
    }

    const options = [target, ...picked.slice(0, 3)]
    return options.sort(() => rng() - 0.5)
  }

  const btnToggleContinent = document.getElementById('btn-toggle-continent')
  const btnToggleInputMode = document.getElementById('btn-toggle-inputmode')
  const quizWriteBox = document.getElementById('quiz-write-box')
  const quizWriteInput = document.getElementById('quiz-write-input')
  const quizWriteSuggestions = document.getElementById('quiz-write-suggestions')
  const btnQuizWriteSubmit = document.getElementById('btn-quiz-write-submit')
  const btnQuizWriteSkip = document.getElementById('btn-quiz-write-skip')

  function updateQuizTogglesUI() {
    const regionBadge = document.getElementById('quiz-region-badge')
    regionBadge.hidden = !state.showContinent

    btnToggleContinent.classList.toggle('active', state.showContinent)
    btnToggleContinent.setAttribute('aria-pressed', String(state.showContinent))
    btnToggleContinent.innerHTML = `🌍 Continente: <strong>${state.showContinent ? 'ON' : 'OFF'}</strong>`

    btnToggleInputMode.classList.toggle('active', state.quizMultipleChoice)
    btnToggleInputMode.setAttribute('aria-pressed', String(state.quizMultipleChoice))
    btnToggleInputMode.innerHTML = state.quizMultipleChoice
      ? `🎯 Múltipla Escolha: <strong>ON</strong>`
      : `⌨️ Modo Escrever: <strong>ON</strong>`

    document.getElementById('quiz-options').hidden = !state.quizMultipleChoice
    quizWriteBox.hidden = state.quizMultipleChoice
  }

  function renderQuizRound() {
    state.quizLocked = false
    const total = state.quizQuestions.length
    const current = state.quizQuestions[state.quizIndex]

    document.getElementById('quiz-progress-text').textContent = `Rodada ${state.quizIndex + 1} de ${total}`
    document.getElementById('quiz-progress-fill').style.width = `${((state.quizIndex + 1) / total) * 100}%`

    const card = document.getElementById('quiz-flag-card')
    card.classList.remove('enter')
    void card.offsetWidth
    card.classList.add('enter')

    const flagFrame = card.querySelector('.flag-frame')
    if (flagFrame) {
      flagFrame.classList.remove('slide-exit')
      flagFrame.classList.remove('slide-enter')
      void flagFrame.offsetWidth
      flagFrame.classList.add('slide-enter')
    }
    setupFlag3DHover()

    const regionBadge = document.getElementById('quiz-region-badge')
    regionBadge.textContent = current.regiao
    regionBadge.hidden = !state.showContinent

    document.getElementById('quiz-flag-img').src = current.svg
    const factEl = document.getElementById('quiz-fact')
    factEl.hidden = true

    updateQuizTogglesUI()

    const optionsEl = document.getElementById('quiz-options')
    optionsEl.innerHTML = ''
    const options = pickQuizDistractors(current, state.quizIndex)

    for (const opt of options) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'option-btn'
      btn.textContent = opt.nome
      btn.dataset.code = opt.code
      btn.addEventListener('click', () => {
        SoundFX.btnClick()
        handleQuizAnswer(opt, btn, current)
      })
      optionsEl.appendChild(btn)
    }

    quizWriteInput.value = ''
    quizWriteInput.disabled = false
    quizWriteInput.className = ''
    quizWriteSuggestions.hidden = true
    if (!state.quizMultipleChoice) {
      setTimeout(() => quizWriteInput.focus(), 40)
    }
  }

  function handleQuizAnswer(chosen, btnEl, target) {
    if (state.quizLocked) return
    state.quizLocked = true

    const allBtns = document.querySelectorAll('#quiz-options .option-btn')
    allBtns.forEach((b) => {
      b.disabled = true
      if (b.dataset.code === target.code) b.classList.add('correct')
    })

    const isCorrect = Boolean(chosen && chosen.code === target.code)

    if (isCorrect) {
      state.quizHits++
      state.streak++
      state.bestStreak = Math.max(state.bestStreak, state.streak)
      const bonus = state.quizMultipleChoice ? 100 : 150
      const earned = bonus + state.streak * 20
      state.score += earned
      if (!state.quizMultipleChoice) {
        quizWriteInput.classList.add('correct')
        quizWriteInput.value = target.nome
      }
      SoundFX.stampCorrect()
      spawnFloatingBadge(`+${earned}`, 'score', btnEl || document.getElementById('quiz-flag-card'))
      if (state.streak >= 3) {
        setTimeout(() => {
          spawnFloatingBadge(`SEQUÊNCIA x${state.streak}! 🔥`, 'streak', document.querySelector('.hud-pill.streak') || document.getElementById('quiz-flag-card'))
        }, 160)
      }
    } else {
      if (btnEl) btnEl.classList.add('wrong')
      if (!state.quizMultipleChoice) {
        quizWriteInput.classList.add('wrong')
        quizWriteInput.value = `Era: ${target.nome}`
      }
      state.streak = 0
      SoundFX.errorDull()
    }

    quizWriteInput.disabled = true
    quizWriteSuggestions.hidden = true
    updateHud()

    const factEl = document.getElementById('quiz-fact')
    factEl.textContent = `🏳️ ${target.nome} · 🏛️ Capital: ${target.capital} · 👥 Pop: ${target.populacao.toLocaleString('pt-BR')}`
    factEl.hidden = false

    setTimeout(() => {
      if (state.quizIndex + 1 >= state.quizQuestions.length) {
        if (state.quizHits >= 7) launchConfetti()
        openSummaryModal(
          `Quiz Concluído (${state.quizHits}/${state.quizQuestions.length})`,
          `Você acertou ${state.quizHits} de ${state.quizQuestions.length} bandeiras na sala ${state.seed}!`,
          `${state.score} pontos · Melhor sequência: 🔥 ${state.bestStreak}`
        )
      } else {
        const flagFrame = document.querySelector('#quiz-flag-card .flag-frame')
        if (flagFrame) {
          flagFrame.classList.remove('slide-enter')
          flagFrame.classList.add('slide-exit')
        }
        setTimeout(() => {
          SoundFX.pageTurn()
          state.quizIndex++
          renderQuizRound()
        }, 220)
      }
    }, 1350)
  }

  function submitQuizWrittenGuess(selectedItem) {
    if (state.quizLocked) return
    const current = state.quizQuestions[state.quizIndex]
    if (!current) return

    let item = selectedItem
    if (!item) {
      const typed = normalizePt(quizWriteInput.value)
      if (!typed) {
        showToast('Digite o nome da bandeira ou clique em Pular!')
        return
      }
      // Check if typed matches current target directly or any alias in pool
      if (normalizePt(current.nome) === typed || current.nomesAceitos.includes(typed)) {
        item = current
      } else {
        item = state.pool.find(
          (c) => normalizePt(c.nome) === typed || c.nomesAceitos.includes(typed)
        ) || { code: '__WRONG__' }
      }
    }

    handleQuizAnswer(item, null, current)
  }

  btnToggleContinent.addEventListener('click', () => {
    state.showContinent = !state.showContinent
    updateQuizTogglesUI()
  })

  btnToggleInputMode.addEventListener('click', () => {
    state.quizMultipleChoice = !state.quizMultipleChoice
    updateQuizTogglesUI()
    if (!state.quizMultipleChoice && !state.quizLocked) {
      setTimeout(() => quizWriteInput.focus(), 40)
    }
  })

  quizWriteInput.addEventListener('input', () => {
    const q = normalizePt(quizWriteInput.value)
    if (!q || state.quizLocked) {
      quizWriteSuggestions.hidden = true
      return
    }
    const matches = state.pool
      .filter(
        (c) =>
          normalizePt(c.nome).includes(q) ||
          c.nomesAceitos.some((alias) => alias.includes(q))
      )
      .slice(0, 5)

    if (matches.length === 0) {
      quizWriteSuggestions.hidden = true
      return
    }

    quizWriteSuggestions.innerHTML = ''
    for (const m of matches) {
      const li = document.createElement('li')
      li.innerHTML = `<span>${m.nome}</span>`
      li.addEventListener('click', () => submitQuizWrittenGuess(m))
      quizWriteSuggestions.appendChild(li)
    }
    quizWriteSuggestions.hidden = false
  })

  quizWriteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const firstMatch = quizWriteSuggestions.querySelector('li')
      if (!quizWriteSuggestions.hidden && firstMatch && normalizePt(quizWriteInput.value).length >= 3) {
        firstMatch.click()
      } else {
        submitQuizWrittenGuess(null)
      }
    }
  })

  btnQuizWriteSubmit.addEventListener('click', () => submitQuizWrittenGuess(null))
  btnQuizWriteSkip.addEventListener('click', () => {
    const current = state.quizQuestions[state.quizIndex]
    if (current) handleQuizAnswer(null, null, current)
  })

  // ==================== MODO 2: FLAGLE & BÚSSOLA ====================
  const flagleInput = document.getElementById('flagle-input')
  const flagleSuggestions = document.getElementById('flagle-suggestions')
  const flagleGuessesEl = document.getElementById('flagle-guesses')
  const flagleMaskGrid = document.getElementById('flagle-mask-grid')

  function startFlagleMode() {
    const shuffled = shuffleWithSeed(state.pool, `flagle:${state.tier}:${state.seed}`)
    state.flagleTarget = shuffled[0]
    state.flagleGuesses = []
    state.flagleRevealedOrder = shuffleWithSeed([0, 1, 2, 3, 4, 5], `mask:${state.seed}`)
    state.flagleRevealedCount = 1 // Start with 1 piece revealed!
    state.flagleOver = false
    state.flagleWon = false

    // Build opaque mask pieces first so the flag never flashes on transition
    flagleMaskGrid.innerHTML = ''
    for (let i = 0; i < 6; i++) {
      const piece = document.createElement('div')
      piece.className = 'mask-piece'
      piece.textContent = '?'
      flagleMaskGrid.appendChild(piece)
    }
    renderFlagleMask()

    document.getElementById('flagle-img').src = state.flagleTarget.svg
    document.getElementById('flagle-status-badge').textContent = 'Tentativa 1 de 6'
    const revealInfo = document.getElementById('flagle-reveal-info')
    revealInfo.hidden = true

    flagleInput.value = ''
    flagleInput.disabled = false
    flagleSuggestions.hidden = true
    flagleGuessesEl.innerHTML = ''
  }

  function renderFlagleMask() {
    const revealedIndices = new Set(
      state.flagleRevealedOrder.slice(0, state.flagleRevealedCount)
    )
    const pieces = flagleMaskGrid.querySelectorAll('.mask-piece')
    pieces.forEach((piece, i) => {
      const isRevealed = state.flagleOver || revealedIndices.has(i)
      piece.classList.toggle('revealed', isRevealed)
      piece.textContent = isRevealed ? '' : '?'
    })
  }

  function handleFlagleGuess(item) {
    if (state.flagleOver) return
    if (!item) {
      const typed = normalizePt(flagleInput.value)
      if (!typed) return
      item = state.pool.find(
        (c) => normalizePt(c.nome) === typed || c.nomesAceitos.includes(typed)
      )
      if (!item) {
        playTone(165, 0.15, 'sawtooth')
        showToast('País ou estado não encontrado neste banco/nível!')
        return
      }
    }

    if (state.flagleGuesses.some((g) => g.code === item.code)) {
      showToast(`Você já chutou ${item.nome}!`)
      return
    }

    const target = state.flagleTarget
    const isCorrect = item.code === target.code
    const distKm = isCorrect
      ? 0
      : calculateDistanceKm(
          item.coordenadas.lat,
          item.coordenadas.lng,
          target.coordenadas.lat,
          target.coordenadas.lng
        )
    const dir = isCorrect
      ? { arrow: '🎯', cardinal: 'ALVO' }
      : getCompassDirection(
          item.coordenadas.lat,
          item.coordenadas.lng,
          target.coordenadas.lat,
          target.coordenadas.lng
        )

    const maxDist = state.tier === 'br' ? 4200 : 19500
    const proximity = isCorrect
      ? 100
      : Math.max(5, Math.min(99, Math.round((1 - distKm / maxDist) * 100)))

    state.flagleGuesses.push({
      code: item.code,
      nome: item.nome,
      svg: item.svg,
      distKm,
      dir,
      proximity,
      isCorrect,
    })

    const row = document.createElement('div')
    row.className = `guess-item${isCorrect ? ' win' : ''}`
    row.innerHTML = `
      <img src="${item.svg}" alt="" />
      <span>${item.nome}</span>
      <span class="guess-dist">${distKm.toLocaleString('pt-BR')} km</span>
      <span class="guess-dir">${dir.arrow} ${dir.cardinal}</span>
      <span class="guess-prox">${proximity}%</span>
    `
    flagleGuessesEl.prepend(row)

    flagleInput.value = ''
    flagleSuggestions.hidden = true

    if (isCorrect) {
      state.flagleOver = true
      state.flagleWon = true
      state.streak++
      state.bestStreak = Math.max(state.bestStreak, state.streak)
      state.score += (7 - state.flagleGuesses.length) * 150
      updateHud()
      renderFlagleMask()
      playChord([523.25, 659.25, 783.99, 1046.5], 70)
      launchConfetti()

      const revealInfo = document.getElementById('flagle-reveal-info')
      revealInfo.textContent = `🎯 ${target.nome} · Capital: ${target.capital} (${target.regiao})`
      revealInfo.hidden = false
      flagleInput.disabled = true

      setTimeout(() => {
        openSummaryModal(
          'Bandeira Descoberta! 🧭',
          `Você encontrou ${target.nome} em ${state.flagleGuesses.length}/6 tentativas!`,
          `Capital: ${target.capital} · Sala: ${state.seed}`
        )
      }, 900)
      return
    }

    playTone(260, 0.1, 'triangle')
    state.flagleRevealedCount = Math.min(6, state.flagleRevealedCount + 1)
    renderFlagleMask()

    if (state.flagleGuesses.length >= 6) {
      state.flagleOver = true
      state.flagleWon = false
      state.streak = 0
      updateHud()
      renderFlagleMask()
      flagleInput.disabled = true
      const revealInfo = document.getElementById('flagle-reveal-info')
      revealInfo.textContent = `Resposta: ${target.nome} (Capital: ${target.capital})`
      revealInfo.hidden = false
      setTimeout(() => {
        openSummaryModal(
          'Fim das 6 Tentativas!',
          `A bandeira secreta era: ${target.nome}`,
          `Capital: ${target.capital} · Região: ${target.regiao}`
        )
      }, 950)
    } else {
      document.getElementById('flagle-status-badge').textContent = `Tentativa ${state.flagleGuesses.length + 1} de 6`
    }
  }

  flagleInput.addEventListener('input', () => {
    const q = normalizePt(flagleInput.value)
    if (!q) {
      flagleSuggestions.hidden = true
      return
    }
    const matches = state.pool
      .filter(
        (c) =>
          normalizePt(c.nome).includes(q) ||
          c.nomesAceitos.some((alias) => alias.includes(q))
      )
      .slice(0, 6)

    if (matches.length === 0) {
      flagleSuggestions.hidden = true
      return
    }

    flagleSuggestions.innerHTML = ''
    for (const m of matches) {
      const li = document.createElement('li')
      li.innerHTML = `<img src="${m.svg}" alt="" /> <span>${m.nome}</span>`
      li.addEventListener('click', () => handleFlagleGuess(m))
      flagleSuggestions.appendChild(li)
    }
    flagleSuggestions.hidden = false
  })

  flagleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const firstMatch = flagleSuggestions.querySelector('li')
      if (!flagleSuggestions.hidden && firstMatch) {
        firstMatch.click()
      } else {
        handleFlagleGuess(null)
      }
    }
  })

  document.getElementById('btn-flagle-guess').addEventListener('click', () => {
    handleFlagleGuess(null)
  })

  // ==================== MODO 3: MAIS OU MENOS (POPULAÇÃO) ====================
  function startHighLowMode() {
    state.hlDeck = shuffleWithSeed(
      state.pool.filter((c) => c.populacao > 0),
      `hl:${state.tier}:${state.seed}`
    )
    state.hlIndex = 0
    state.score = 0
    state.streak = 0
    updateHud()
    renderHighLowPair()
  }

  function renderHighLowPair() {
    state.hlLocked = false
    state.hlLeft = state.hlDeck[state.hlIndex % state.hlDeck.length]
    state.hlRight = state.hlDeck[(state.hlIndex + 1) % state.hlDeck.length]

    document.getElementById('hl-img-left').src = state.hlLeft.svg
    document.getElementById('hl-name-left').textContent = state.hlLeft.nome
    document.getElementById('hl-capital-left').textContent = `Capital: ${state.hlLeft.capital}`
    document.getElementById('hl-pop-left').textContent = state.hlLeft.populacao.toLocaleString('pt-BR')

    document.getElementById('hl-img-right').src = state.hlRight.svg
    document.getElementById('hl-name-right').textContent = state.hlRight.nome
    document.getElementById('hl-capital-right').textContent = `Capital: ${state.hlRight.capital}`

    document.getElementById('hl-actions').hidden = false
    document.getElementById('hl-pop-reveal').hidden = true
  }

  function animatePopulationCount(el, targetVal, done) {
    const steps = 22
    let step = 0
    const timer = setInterval(() => {
      step++
      const val = Math.round((targetVal * step) / steps)
      el.textContent = val.toLocaleString('pt-BR')
      if (step >= steps) {
        clearInterval(timer)
        el.textContent = targetVal.toLocaleString('pt-BR')
        done()
      }
    }, 25)
  }

  function handleHighLowChoice(choiceHigher) {
    if (state.hlLocked) return
    state.hlLocked = true

    document.getElementById('hl-actions').hidden = true
    const revealBox = document.getElementById('hl-pop-reveal')
    const popRightEl = document.getElementById('hl-pop-right')
    revealBox.hidden = false

    const leftPop = state.hlLeft.populacao
    const rightPop = state.hlRight.populacao
    const isCorrect = choiceHigher ? rightPop >= leftPop : rightPop <= leftPop

    animatePopulationCount(popRightEl, rightPop, () => {
      if (isCorrect) {
        state.streak++
        state.bestStreak = Math.max(state.bestStreak, state.streak)
        state.score += 100 * state.streak
        updateHud()
        playChord([523.25, 659.25, 783.99], 65)
        showToast(`✅ Acertou! Sequência: 🔥 ${state.streak}`, 1200)
        setTimeout(() => {
          state.hlIndex++
          renderHighLowPair()
        }, 1250)
      } else {
        playTone(160, 0.25, 'sawtooth', 0.1)
        const finalStreak = state.streak
        state.streak = 0
        updateHud()
        setTimeout(() => {
          openSummaryModal(
            'Fim da Sequência! 📊',
            `${state.hlRight.nome} tem ${rightPop.toLocaleString('pt-BR')} habitantes.`,
            `Você alcançou ${finalStreak} acerto(s) seguido(s) · ${state.score} pts`
          )
        }, 1100)
      }
    })
  }

  document.getElementById('btn-hl-higher').addEventListener('click', () => handleHighLowChoice(true))
  document.getElementById('btn-hl-lower').addEventListener('click', () => handleHighLowChoice(false))

  // ==================== MODO 4 & 5: VERSUS 1v1 & BATTLE ROYALE (ATÉ 6 PLAYERS) ====================
  const ROYALE_BOTS = [
    { id: 'bot_atlas', name: 'Bot Atlas 🤖', color: '#f59e0b' },
    { id: 'bot_mercator', name: 'Bot Mercator 🤖', color: '#a855f7' },
    { id: 'bot_vasco', name: 'Bot Vasco 🤖', color: '#10b981' },
    { id: 'bot_colombo', name: 'Bot Colombo 🤖', color: '#ec4899' },
    { id: 'bot_magalhaes', name: 'Bot Magalhães 🤖', color: '#f43f5e' },
  ]

  let vsRoom = null
  let vsBotInterval = null
  let vsMyLocked = false
  let vsDecks = [[], [], [], [], [], []] // 6 independent de-collided flag decks

  const vsState = {
    roomCode: '',
    arenaType: 'versus', // 'versus' (1v1, max 2) | 'royale' (Battle Royale, max 6)
    maxPlayers: 2,
    status: 'lobby', // 'lobby' | 'playing' | 'gameover'
    tier: '2',
    seed: '',
    showContinent: false,
    multipleChoice: true,
    winner: null,
    loser: null,
    players: [],
  }

  const vsPlayerNameInput = document.getElementById('vs-player-name')
  const vsRoomCodeInput = document.getElementById('vs-room-code')
  const vsRoomChipCode = document.getElementById('vs-room-chip-code')
  const btnVsToggleConfig = document.getElementById('btn-vs-toggle-config')
  const vsConfigDrawer = document.getElementById('vs-config-drawer')
  const vsRoomLabel = document.getElementById('vs-room-label')
  const vsPlayersCount = document.getElementById('vs-players-count')
  const btnVsJoin = document.getElementById('btn-vs-join')
  const btnVsHost = document.getElementById('btn-vs-host')
  const btnVsCopy = document.getElementById('btn-vs-copy')
  const vsP2pStatus = document.getElementById('vs-p2p-status')
  const btnVsContinent = document.getElementById('btn-vs-continent')
  const btnVsInputMode = document.getElementById('btn-vs-inputmode')
  const vsBotControls = document.getElementById('vs-bot-controls')
  const btnVsAddBot = document.getElementById('btn-vs-add-bot')
  const btnVsRemBot = document.getElementById('btn-vs-rem-bot')
  const btnVsStart = document.getElementById('btn-vs-start')
  const vsMyWriteInput = document.getElementById('vs-my-write-input')
  const vsMySuggestions = document.getElementById('vs-my-suggestions')
  const vsOpponentsGrid = document.getElementById('vs-opponents-grid')
  const vsCenterCircle = document.getElementById('vs-center-circle')
  const vsAliveBadge = document.getElementById('vs-alive-badge')

  function getPoolForTier(tierVal) {
    if (tierVal === 'br') {
      return brStatesData.map((st) => ({
        code: st.uf,
        nome: st.nome,
        nomesAceitos: st.nomesAceitos,
        capital: st.capital,
        regiao: `Brasil · ${st.regiao}`,
        populacao: st.populacao,
        svg: `../..${st.bandeira.svg}`,
        parecidas: [],
      }))
    }
    const maxN = Number.parseInt(tierVal, 10) || 2
    return worldData
      .filter((c) => c.nivel <= maxN)
      .map((c) => ({
        code: c.cca2,
        nome: c.nome,
        nomesAceitos: c.nomesAceitos,
        capital: c.capital,
        regiao: c.continente,
        populacao: c.populacao,
        svg: `../..${c.bandeira.svg}`,
        parecidas: c.bandeira.parecidas || [],
      }))
  }

  function buildVersusDecks() {
    const pool = getPoolForTier(vsState.tier)
    const decks = []
    for (let s = 0; s < 6; s++) {
      const d = shuffleWithSeed(pool, `vs-slot-${s}:${vsState.tier}:${vsState.seed}`)
      if (s > 0 && d.length > 1) {
        for (let i = 0; i < d.length; i++) {
          if (decks[0][i] && d[i].code === decks[0][i].code) {
            const swapIdx = (i + s) % d.length
            const tmp = d[i]
            d[i] = d[swapIdx]
            d[swapIdx] = tmp
          }
        }
      }
      decks.push(d)
    }
    vsDecks = decks
  }

  function pickVersusOptions(pool, target, slotIdx, flagIdx) {
    const rng = createSeededRandom(`vsopt:${vsState.seed}:${slotIdx}:${flagIdx}:${target.code}`)
    const candidates = pool.filter((item) => item.code !== target.code)
    const similar = candidates.filter((c) => target.parecidas.includes(c.code))
    const sameRegion = candidates.filter(
      (c) => c.regiao === target.regiao && !target.parecidas.includes(c.code)
    )
    const others = candidates.filter(
      (c) => c.regiao !== target.regiao && !target.parecidas.includes(c.code)
    )
    const picked = []
    for (const group of [similar, sameRegion, others]) {
      const groupShuffled = [...group].sort(() => rng() - 0.5)
      for (const item of groupShuffled) {
        if (picked.length < 3) picked.push(item)
      }
    }
    return [target, ...picked.slice(0, 3)].sort(() => rng() - 0.5)
  }

  function createBotPlayer(botIndex = 0) {
    const meta = ROYALE_BOTS[botIndex % ROYALE_BOTS.length]
    return {
      id: `${meta.id}_${botIndex}`,
      name: meta.name,
      color: meta.color,
      isBot: true,
      errors: 0,
      eliminated: false,
      score: 0,
      flagIndex: 0,
      lastResult: '',
      lastMsg: 'Pronto para a partida!',
    }
  }

  function configureArenaType(type) {
    const isRoyale = type === 'royale'
    vsState.arenaType = isRoyale ? 'royale' : 'versus'
    vsState.maxPlayers = isRoyale ? 6 : 2

    if (vsRoom && vsRoom.isHost && vsState.status !== 'playing') {
      if (!isRoyale && vsState.players.length > 2) {
        vsState.players = vsState.players.slice(0, 2)
      } else if (isRoyale && vsState.players.length < 4) {
        while (vsState.players.length < 4) {
          const usedBots = vsState.players.filter((p) => p.isBot).length
          vsState.players.push(createBotPlayer(usedBots))
        }
      }
      if (vsState.players.length < 2) {
        vsState.players.push(createBotPlayer(0))
      }
      syncVersusToClients()
    } else {
      renderVersusUI()
    }
  }

  function setupVersusAsHost(code) {
    clearInterval(vsBotInterval)
    vsRoom.hostRoom(code)
    const normalized = vsRoom.roomCode || code
    vsState.roomCode = normalized
    vsState.arenaType = state.mode === 'royale' ? 'royale' : 'versus'
    vsState.maxPlayers = vsState.arenaType === 'royale' ? 6 : 2
    vsState.status = 'lobby'
    vsState.tier = state.tier
    vsState.seed = randomSeed()
    vsState.winner = null
    vsState.loser = null

    const initialBotCount = vsState.arenaType === 'royale' ? 3 : 1
    vsState.players = [
      {
        id: vsRoom.profile.id,
        name: vsRoom.profile.name,
        color: '#0ea5e9',
        isBot: false,
        errors: 0,
        eliminated: false,
        score: 0,
        flagIndex: 0,
        lastResult: '',
        lastMsg: 'Clique em Iniciar para começar!',
      },
    ]
    for (let b = 0; b < initialBotCount; b++) {
      vsState.players.push(createBotPlayer(b))
    }

    vsRoomCodeInput.value = normalized
    buildVersusDecks()
    renderVersusUI()
  }

  function syncVersusToClients() {
    if (vsRoom && vsRoom.isHost) {
      vsRoom.broadcastState(vsState)
    }
    renderVersusUI()
  }

  function renderVersusUI() {
    if (state.mode !== 'versus' && state.mode !== 'royale') return
    if (!vsDecks[0].length) buildVersusDecks()
    const pool = getPoolForTier(vsState.tier)
    const isRoyale = vsState.arenaType === 'royale' || state.mode === 'royale'
    const maxP = isRoyale ? 6 : 2

    vsRoomLabel.textContent = isRoyale ? 'Sala Royale (6P):' : 'Sala 1v1:'
    vsPlayersCount.textContent = `👥 ${vsState.players.length}/${maxP}`
    if (vsRoomChipCode) {
      vsRoomChipCode.textContent = vsState.roomCode || 'VS'
    }
    vsCenterCircle.textContent = isRoyale ? '👑 BR' : '1v1'

    const aliveCount = vsState.players.filter((p) => !p.eliminated).length
    vsAliveBadge.textContent =
      vsState.status === 'playing'
        ? `🔥 ${aliveCount}/${vsState.players.length} vivos!`
        : 'Jogo vai até todos errarem 3!'

    const myIdx = vsState.players.findIndex((p) => p.id === vsRoom?.profile.id)
    const mySlot = myIdx !== -1 ? myIdx : 0
    const me = vsState.players[mySlot] || vsState.players[0]

    // Toggles UI
    btnVsContinent.classList.toggle('active', vsState.showContinent)
    btnVsContinent.setAttribute('aria-pressed', String(vsState.showContinent))
    btnVsContinent.innerHTML = `🌍 Continente: <strong>${vsState.showContinent ? 'ON' : 'OFF'}</strong>`

    btnVsInputMode.classList.toggle('active', vsState.multipleChoice)
    btnVsInputMode.setAttribute('aria-pressed', String(vsState.multipleChoice))
    btnVsInputMode.innerHTML = vsState.multipleChoice
      ? `🎯 Múltipla Escolha: <strong>ON</strong>`
      : `⌨️ Modo Escrever: <strong>ON</strong>`

    const isHost = vsRoom ? vsRoom.isHost : true
    btnVsContinent.disabled = !isHost || vsState.status === 'playing'
    btnVsInputMode.disabled = !isHost || vsState.status === 'playing'
    vsBotControls.hidden = !isRoyale || !isHost || vsState.status === 'playing'
    btnVsStart.hidden = !isHost || vsState.status === 'playing'
    btnVsStart.textContent = isRoyale
      ? `▶️ Iniciar Battle Royale (${vsState.players.length}P)`
      : '▶️ Iniciar Duelo 1v1'

    // MY SIDE (Left)
    if (me) {
      const myPanel = document.getElementById('vs-my-panel')
      myPanel.classList.toggle('eliminated', Boolean(me.eliminated))
      document.getElementById('vs-my-dot').textContent = me.name.charAt(0).toUpperCase()
      document.getElementById('vs-my-name').textContent = `${me.name} (Você)`
      document.getElementById('vs-my-sub').textContent = me.eliminated
        ? '💀 Eliminado · Assistindo sobreviventes'
        : 'Seu lado · Bandeira exclusiva'
      const myLivesLeft = Math.max(0, 3 - me.errors)
      document.getElementById('vs-my-lives').textContent = me.eliminated
        ? '💀💀💀'
        : '❤️'.repeat(myLivesLeft) + '💀'.repeat(3 - myLivesLeft)
      document.getElementById('vs-my-errors').textContent = `${me.errors}/3 erros`
      document.getElementById('vs-my-score').textContent = `${me.score} pts`

      const myDeck = vsDecks[mySlot % vsDecks.length] || vsDecks[0]
      const myFlag = myDeck[me.flagIndex % myDeck.length]
      if (myFlag) {
        document.getElementById('vs-my-flag').src = myFlag.svg
        const myReg = document.getElementById('vs-my-region')
        myReg.textContent = myFlag.regiao
        myReg.hidden = !vsState.showContinent
      }

      const myFb = document.getElementById('vs-my-feedback')
      myFb.textContent = me.eliminated
        ? '💀 Você errou 3 bandeiras! Aguardando fim da partida...'
        : me.lastMsg ||
          (vsState.status === 'playing'
            ? `Bandeira #${me.flagIndex + 1} · Não erre 3 vezes!`
            : 'Sala pronta! Convide até 6 amigos ou inicie agora.')
      myFb.className = `vs-feedback ${me.lastResult === 'ok' ? 'ok' : me.lastResult === 'bad' ? 'bad' : ''}`

      const myOptsEl = document.getElementById('vs-my-options')
      const myWriteBox = document.getElementById('vs-my-write-box')
      myOptsEl.hidden = !vsState.multipleChoice
      myWriteBox.hidden = vsState.multipleChoice

      if (vsState.multipleChoice && myFlag) {
        myOptsEl.innerHTML = ''
        const opts = pickVersusOptions(pool, myFlag, mySlot, me.flagIndex)
        for (const opt of opts) {
          const btn = document.createElement('button')
          btn.type = 'button'
          btn.className = 'option-btn'
          btn.textContent = opt.nome
          btn.disabled = vsState.status !== 'playing' || vsMyLocked || me.eliminated
          btn.addEventListener('click', () => submitMyVersusAnswer(opt.code, btn, myFlag.code))
          myOptsEl.appendChild(btn)
        }
      } else {
        vsMyWriteInput.disabled = vsState.status !== 'playing' || vsMyLocked || Boolean(me.eliminated)
      }
    }

    // OPPONENTS SIDE (Right — 1 card in 1v1, up to 5 cards in Battle Royale!)
    const opponents = vsState.players
      .map((p, idx) => ({ player: p, slot: idx }))
      .filter((item) => item.slot !== mySlot)

    vsOpponentsGrid.classList.toggle('multi-grid', opponents.length > 1)
    vsOpponentsGrid.innerHTML = ''

    for (const { player: opp, slot: oppSlot } of opponents) {
      const oppDeck = vsDecks[oppSlot % vsDecks.length] || vsDecks[1]
      const oppFlag = oppDeck[opp.flagIndex % oppDeck.length]
      const oppLivesLeft = Math.max(0, 3 - opp.errors)
      const hearts = opp.eliminated
        ? '💀 ELIMINADO'
        : '❤️'.repeat(oppLivesLeft) + '💀'.repeat(3 - oppLivesLeft)

      const card = document.createElement('div')
      card.id = `vs-opp-panel-${opp.id}`
      card.className = `versus-panel opp-panel${opp.eliminated ? ' eliminated' : ''}`

      const regionHtml =
        vsState.showContinent && oppFlag
          ? `<span class="region-badge">${oppFlag.regiao}</span>`
          : ''

      let optionsHtml = ''
      if (opponents.length === 1 && oppFlag) {
        const oppOpts = pickVersusOptions(pool, oppFlag, oppSlot, opp.flagIndex)
        optionsHtml = `
          <div class="quiz-options vs-options opp-options">
            ${oppOpts.map((o) => `<button type="button" class="option-btn" disabled>${o.nome}</button>`).join('')}
          </div>
        `
      }

      const fbClass = opp.lastResult === 'ok' ? 'ok' : opp.lastResult === 'bad' ? 'bad' : ''
      const fbText = opp.eliminated
        ? `💀 Eliminado com 3 erros (${opp.score} pts)`
        : opp.lastMsg ||
          (vsState.status === 'playing'
            ? `Na bandeira #${opp.flagIndex + 1}...`
            : opp.isBot
              ? 'Bot pronto na sala'
              : 'Amigo conectado')

      card.innerHTML = `
        <div class="vs-player-header">
          <div class="vs-player-id">
            <span class="vs-avatar-dot opp" style="background:${opp.color || '#f59e0b'}">${opp.name.charAt(0).toUpperCase()}</span>
            <div>
              <strong>${opp.name}</strong>
              <small>${opp.isBot ? 'Bot · Outra bandeira' : 'Jogador · Outra bandeira'}</small>
            </div>
          </div>
          <div class="vs-player-stats">
            <span class="vs-lives">${hearts}</span>
            <span class="vs-error-pill">${opp.errors}/3</span>
            <span class="vs-score-pill">${opp.score} pts</span>
          </div>
        </div>
        <div class="flag-showcase vs-flag-card">
          ${regionHtml}
          <div class="flag-frame vs-flag-frame">
            <img src="${oppFlag ? oppFlag.svg : ''}" alt="Bandeira de ${opp.name}" />
          </div>
          <p class="vs-feedback ${fbClass}">${fbText}</p>
        </div>
        ${optionsHtml}
      `
      vsOpponentsGrid.appendChild(card)
    }
  }

  function flashPanel(panelId, isCorrect) {
    const panel = document.getElementById(panelId)
    if (!panel) return
    panel.classList.remove('flash-correct', 'flash-wrong')
    void panel.offsetWidth
    panel.classList.add(isCorrect ? 'flash-correct' : 'flash-wrong')
    setTimeout(() => panel.classList.remove('flash-correct', 'flash-wrong'), 520)
  }

  function startVersusMatchOnHost() {
    if (!vsRoom || !vsRoom.isHost) return
    clearInterval(vsBotInterval)
    vsMyLocked = false
    vsState.arenaType = state.mode === 'royale' ? 'royale' : 'versus'
    vsState.maxPlayers = vsState.arenaType === 'royale' ? 6 : 2
    vsState.status = 'playing'
    vsState.tier = state.tier
    vsState.seed = randomSeed()
    vsState.winner = null
    vsState.loser = null

    if (vsState.players.length < 2) {
      vsState.players.push(createBotPlayer(0))
    }

    for (const p of vsState.players) {
      p.errors = 0
      p.eliminated = false
      p.score = 0
      p.flagIndex = 0
      p.lastResult = ''
      p.lastMsg = 'Valendo! Quem errar 3 é eliminado!'
    }

    buildVersusDecks()
    modalSummary.hidden = true
    if (vsConfigDrawer) {
      vsConfigDrawer.hidden = true
      btnVsToggleConfig?.setAttribute('aria-expanded', 'false')
    }
    playChord([440, 554.37, 659.25], 65)
    syncVersusToClients()
    vsRoom.broadcastEvent({ type: 'VS_START' })
    startVersusBotsLoop()
  }

  function startVersusBotsLoop() {
    clearInterval(vsBotInterval)
    if (!vsRoom?.isHost || vsState.status !== 'playing') return

    vsBotInterval = setInterval(() => {
      if (vsState.status !== 'playing') {
        clearInterval(vsBotInterval)
        return
      }
      const aliveBots = vsState.players.filter((p) => p.isBot && !p.eliminated)
      if (!aliveBots.length) return

      // Pick one random alive bot every tick to answer its flag
      const bot = aliveBots[Math.floor(Math.random() * aliveBots.length)]
      const botSlot = vsState.players.findIndex((p) => p.id === bot.id)
      if (botSlot === -1) return
      const deck = vsDecks[botSlot % vsDecks.length] || vsDecks[1]
      const target = deck[bot.flagIndex % deck.length]
      if (!target) return
      const botCorrect = Math.random() < 0.7
      processVersusAnswerOnHost(bot.id, botCorrect ? target.code : '__BOT_WRONG__')
    }, Math.max(1400, Math.round(3800 / Math.max(1, vsState.players.filter((p) => p.isBot).length))))
  }

  function processVersusAnswerOnHost(playerId, guessedCode) {
    if (!vsRoom.isHost || vsState.status !== 'playing') return
    const slot = vsState.players.findIndex((p) => p.id === playerId)
    if (slot === -1) return

    const player = vsState.players[slot]
    if (player.eliminated) return

    const deck = vsDecks[slot % vsDecks.length] || vsDecks[0]
    const currentFlag = deck[player.flagIndex % deck.length]
    if (!currentFlag) return

    const isCorrect = guessedCode === currentFlag.code
    if (isCorrect) {
      player.score += vsState.multipleChoice ? 100 : 150
      player.lastResult = 'ok'
      player.lastMsg = `✅ Acertou: ${currentFlag.nome}!`
    } else {
      player.errors++
      player.lastResult = 'bad'
      player.lastMsg = `❌ Errou! Era ${currentFlag.nome} (${player.errors}/3)`
      if (player.errors >= 3) {
        player.eliminated = true
        player.lastMsg = `💀 Eliminado! Errou ${currentFlag.nome} (3/3)`
      }
    }

    player.flagIndex++

    const isMe = player.id === vsRoom.profile.id
    flashPanel(isMe ? 'vs-my-panel' : `vs-opp-panel-${player.id}`, isCorrect)
    vsRoom.broadcastEvent({
      type: 'VS_FLASH',
      playerId: player.id,
      isCorrect,
    })

    if (player.eliminated) {
      const alive = vsState.players.filter((p) => !p.eliminated)
      if (alive.length === 0) {
        clearInterval(vsBotInterval)
        const sorted = vsState.players.slice().sort((a, b) => b.score - a.score)
        const champion = sorted[0]
        const lastPlace = sorted[sorted.length - 1]
        vsState.status = 'gameover'
        vsState.winner = champion
        vsState.loser = lastPlace
        syncVersusToClients()
        vsRoom.broadcastEvent({
          type: 'VS_OVER',
          winner: champion,
          loser: lastPlace,
        })
        showVersusGameOverModal(champion, lastPlace)
        return
      }

      const elimMsg = `💥 ${player.name} perdeu as 3 vidas (${player.score} pts)! Restam ${alive.length} jogador(es) em jogo!`
      showToast(elimMsg, 2600)
      vsRoom.broadcastEvent({ type: 'TOAST', message: elimMsg })
    }

    syncVersusToClients()
  }

  function showVersusGameOverModal(winner, loser, customReason = '') {
    const didIWin = winner && winner.id === vsRoom?.profile.id
    const isRoyale = vsState.arenaType === 'royale' || vsState.players.length > 2
    if (didIWin) {
      launchConfetti()
      playChord([523.25, 659.25, 783.99, 1046.5], 75)
    } else {
      playTone(150, 0.3, 'sawtooth', 0.12)
    }

    const ranking = [...vsState.players]
      .sort((a, b) => b.score - a.score)
      .map((p, idx) => `${idx + 1}º ${p.name} (${p.score} pts · ${p.errors}/3 erros)`)
      .join(' · ')

    openSummaryModal(
      didIWin
        ? isRoyale
          ? `👑 Campeão Battle Royale!`
          : `🏆 Você Venceu o Duelo 1v1!`
        : `🏆 ${winner ? winner.name : 'Adversário'} Venceu!`,
      customReason ||
        `Todos perderam as 3 vidas! ${winner ? winner.name : 'Campeão'} venceu com a maior pontuação (${winner ? winner.score : 0} pts)!`,
      ranking
    )
  }

  function submitMyVersusAnswer(guessedCode, clickedBtn, targetCode) {
    if (vsState.status !== 'playing' || vsMyLocked) return
    const me = vsState.players.find((p) => p.id === vsRoom?.profile.id)
    if (me?.eliminated) return
    vsMyLocked = true
    const isCorrect = guessedCode === targetCode
    if (clickedBtn) {
      clickedBtn.classList.add(isCorrect ? 'correct' : 'wrong')
    }
    if (isCorrect) {
      playChord([523.25, 659.25, 783.99], 50)
    } else {
      playTone(165, 0.22, 'sawtooth', 0.12)
    }

    setTimeout(() => {
      vsMyLocked = false
      vsMyWriteInput.value = ''
      vsMySuggestions.hidden = true
      vsRoom.sendToHost({
        type: 'VS_ANSWER',
        playerId: vsRoom.profile.id,
        guessedCode,
      })
    }, 360)
  }

  function submitMyVersusWrittenGuess(selectedItem) {
    if (vsState.status !== 'playing' || vsMyLocked) return
    const myIdx = vsState.players.findIndex((p) => p.id === vsRoom?.profile.id)
    const mySlot = myIdx !== -1 ? myIdx : 0
    const me = vsState.players[mySlot]
    if (!me || me.eliminated) return
    const myDeck = vsDecks[mySlot % vsDecks.length] || vsDecks[0]
    const currentFlag = myDeck[me.flagIndex % myDeck.length]
    if (!currentFlag) return

    let item = selectedItem
    if (!item) {
      const typed = normalizePt(vsMyWriteInput.value)
      if (!typed) {
        showToast('Digite o nome da bandeira ou clique em Pular!')
        return
      }
      const pool = getPoolForTier(vsState.tier)
      if (normalizePt(currentFlag.nome) === typed || currentFlag.nomesAceitos.includes(typed)) {
        item = currentFlag
      } else {
        item = pool.find(
          (c) => normalizePt(c.nome) === typed || c.nomesAceitos.includes(typed)
        ) || { code: '__WRONG__' }
      }
    }
    submitMyVersusAnswer(item.code, null, currentFlag.code)
  }

  function handleVersusOpponentLeft(leavingPlayerId) {
    if (!vsRoom.isHost || !leavingPlayerId || leavingPlayerId === vsRoom.profile.id) return
    const idx = vsState.players.findIndex((p) => p.id === leavingPlayerId && !p.isBot)
    if (idx === -1) return
    const leavingName = vsState.players[idx].name
    const wasPlaying = vsState.status === 'playing'

    vsState.players.splice(idx, 1)
    if (!wasPlaying && vsState.players.length < 2) {
      vsState.players.push(createBotPlayer(0))
    }

    const msg = `🚪 ${leavingName} saiu da sala.`
    showToast(msg, 2800)
    vsRoom.broadcastEvent({ type: 'TOAST', message: msg })

    if (wasPlaying) {
      const alive = vsState.players.filter((p) => !p.eliminated)
      if (alive.length === 0) {
        clearInterval(vsBotInterval)
        const sorted = vsState.players.slice().sort((a, b) => b.score - a.score)
        vsState.status = 'gameover'
        vsState.winner = sorted[0] || vsState.players[0]
        vsState.loser = { name: leavingName, score: 0, errors: 3 }
        syncVersusToClients()
        vsRoom.broadcastEvent({
          type: 'VS_OVER',
          winner: vsState.winner,
          loser: vsState.loser,
        })
        showVersusGameOverModal(
          vsState.winner,
          vsState.loser,
          `${leavingName} saiu e todos os jogadores restantes já terminaram!`
        )
        return
      }
    }
    syncVersusToClients()
  }

  function handleVersusHostLeft(leavingHostId) {
    if (vsRoom.isHost) return
    clearInterval(vsBotInterval)
    const hostIdx = leavingHostId
      ? vsState.players.findIndex((p) => p.id === leavingHostId)
      : 0
    const hostName = vsState.players[hostIdx]?.name || 'O Host'
    if (hostIdx !== -1) {
      vsState.players.splice(hostIdx, 1)
    }

    const nextHost = vsState.players.find((p) => !p.isBot)
    if (!nextHost || nextHost.id === vsRoom.profile.id) {
      if (vsState.status !== 'playing' && vsState.players.length < 2) {
        vsState.players.push(createBotPlayer(0))
      }
      vsRoom.promoteToHost(vsState.players)
      const migMsg = `👑 ${hostName} saiu! ${vsRoom.profile.name} assumiu como Host da sala ${vsState.roomCode}.`
      showToast(migMsg, 3400)
      vsRoom.broadcastEvent({ type: 'TOAST', message: migMsg })

      if (vsState.status === 'playing') {
        const alive = vsState.players.filter((p) => !p.eliminated)
        if (alive.length === 0) {
          const sorted = vsState.players.slice().sort((a, b) => b.score - a.score)
          vsState.status = 'gameover'
          vsState.winner = sorted[0] || vsState.players[0]
          syncVersusToClients()
          showVersusGameOverModal(vsState.winner, { name: hostName, score: 0, errors: 3 }, `${hostName} saiu e todos os jogadores restantes já terminaram!`)
          return
        }
        startVersusBotsLoop()
      }
      syncVersusToClients()
    }
  }

  function initVersusRoom() {
    if (vsRoom) return
    vsRoom = new window.NBPRoom({
      gameId: 'bandeiras-nbp',
      defaultPrefix: 'VS',
      onStatus(st) {
        if (st.connecting) {
          vsP2pStatus.textContent = st.isHost
            ? `🟡 Abrindo ${st.roomCode}...`
            : `🟡 Conectando a ${st.roomCode}...`
        } else if (st.isHost && st.connected) {
          vsP2pStatus.textContent = `🟢 Host Online · ${st.roomCode}`
        } else if (!st.isHost && st.connected) {
          vsP2pStatus.textContent = `🟢 Conectado · ${st.roomCode}`
        } else {
          vsP2pStatus.textContent = `🔴 Offline · ${st.roomCode || ''}`
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
      },
      onError(err) {
        if (err && err.message) showToast(`⚠️ ${err.message}`, 3400)
      },
      onStateSync(remoteState) {
        const prevSeed = vsState.seed
        const prevTier = vsState.tier
        Object.assign(vsState, remoteState)
        vsRoomCodeInput.value = vsState.roomCode
        if (vsState.seed !== prevSeed || vsState.tier !== prevTier || !vsDecks[0].length) {
          buildVersusDecks()
        }
        renderVersusUI()
      },
      onAction(action, senderProfile) {
        if (!action) return
        if (vsRoom.isHost) {
          if (action.type === 'PEER_CONNECTED') {
            syncVersusToClients()
          } else if (
            (action.type === 'JOIN_REQUEST' || action.type === 'HEARTBEAT') &&
            action.profile
          ) {
            const p = action.profile
            if (p.id === vsRoom.profile.id) return
            const existingIdx = vsState.players.findIndex((pl) => pl.id === p.id)
            if (existingIdx === -1) {
              const maxAllowed = vsState.arenaType === 'royale' ? 6 : 2
              const botIdx = vsState.players.findIndex((pl) => pl.isBot)
              const newPlayerObj = {
                id: p.id,
                name: p.name,
                color: p.color || '#38bdf8',
                isBot: false,
                errors: 0,
                eliminated: false,
                score: 0,
                flagIndex: 0,
                lastResult: '',
                lastMsg: 'Conectado na sala!',
              }

              if (vsState.players.length < maxAllowed) {
                if (maxAllowed === 2 && botIdx !== -1) {
                  vsState.players[botIdx] = newPlayerObj
                } else {
                  vsState.players.push(newPlayerObj)
                }
              } else if (botIdx !== -1) {
                // Replace a bot slot with the real human friend!
                vsState.players[botIdx] = newPlayerObj
              } else if (vsState.players.length < 6) {
                // Auto-upgrade room to Battle Royale if a 3rd human joins!
                vsState.arenaType = 'royale'
                vsState.maxPlayers = 6
                vsState.players.push(newPlayerObj)
              } else {
                return
              }

              const joinMsg = `⚔️ ${p.name} entrou na sala (${vsState.players.length}/${vsState.maxPlayers})!`
              showToast(joinMsg, 2800)
              vsRoom.broadcastEvent({ type: 'TOAST', message: joinMsg })
              syncVersusToClients()
            } else if (action.type === 'JOIN_REQUEST') {
              vsState.players[existingIdx].name = p.name
              syncVersusToClients()
            }
          } else if (action.type === 'VS_ANSWER') {
            processVersusAnswerOnHost(action.playerId || senderProfile?.id, action.guessedCode)
          } else if (action.type === 'PLAYER_LEFT') {
            handleVersusOpponentLeft(action.playerId || senderProfile?.id)
          }
        } else {
          if (action.type === 'HOST_LEFT') {
            handleVersusHostLeft(action.hostId || senderProfile?.id)
          } else if (action.type === 'TOAST' && action.message) {
            showToast(action.message, 2800)
          } else if (action.type === 'VS_START') {
            vsMyLocked = false
            modalSummary.hidden = true
            playChord([440, 554.37, 659.25], 65)
          } else if (action.type === 'VS_FLASH') {
            const isMe = action.playerId === vsRoom.profile.id
            flashPanel(isMe ? 'vs-my-panel' : `vs-opp-panel-${action.playerId}`, action.isCorrect)
          } else if (action.type === 'VS_OVER') {
            showVersusGameOverModal(action.winner, action.loser)
          }
        }
      },
    })

    vsPlayerNameInput.value = vsRoom.profile.name
    let searchStr = window.location.search
    try {
      if (!searchStr && window.parent && window.parent !== window && window.parent.location.search) {
        searchStr = window.parent.location.search
      }
    } catch (_) {}
    const params = new URLSearchParams(searchStr)
    const joinParam = params.get('sala') || params.get('room')
    if (joinParam) {
      const code = joinParam.trim().toUpperCase()
      vsRoomCodeInput.value = code
      vsRoom.joinRoom(code)
      showToast(`Conectando à sala ${code}...`)
    } else {
      setupVersusAsHost(`VS-${Math.floor(1000 + Math.random() * 9000)}`)
    }
  }

  btnVsAddBot.addEventListener('click', () => {
    if (!vsRoom?.isHost || vsState.status === 'playing') return
    if (vsState.players.length >= 6) {
      showToast('Limite máximo de 6 jogadores atingido!')
      return
    }
    const botCount = vsState.players.filter((p) => p.isBot).length
    vsState.players.push(createBotPlayer(botCount))
    syncVersusToClients()
  })

  btnVsRemBot.addEventListener('click', () => {
    if (!vsRoom?.isHost || vsState.status === 'playing') return
    if (vsState.players.length <= 2) {
      showToast('A partida precisa de pelo menos 2 jogadores!')
      return
    }
    const lastBotIdx = vsState.players.map((p) => p.isBot).lastIndexOf(true)
    if (lastBotIdx === -1) return
    vsState.players.splice(lastBotIdx, 1)
    syncVersusToClients()
  })

  vsPlayerNameInput.addEventListener('change', () => {
    if (!vsRoom) return
    vsRoom.setPlayerName(vsPlayerNameInput.value)
    const me = vsState.players.find((p) => p.id === vsRoom.profile.id)
    if (me) me.name = vsRoom.profile.name
    if (vsRoom.isHost) syncVersusToClients()
    else vsRoom.sendToHost({ type: 'JOIN_REQUEST', profile: vsRoom.profile })
    showToast(`Nome atualizado para ${vsRoom.profile.name}`)
  })

  btnVsHost.addEventListener('click', () => {
    if (!vsRoom) initVersusRoom()
    const code = vsRoomCodeInput.value.trim().toUpperCase() || `VS-${Math.floor(1000 + Math.random() * 9000)}`
    if (vsRoom.isHost && code === vsState.roomCode && vsRoom.mqttClients.some((c) => c.ready)) {
      navigator.clipboard?.writeText(code).catch(() => {})
      showToast(`Sala ${code} já está ativa! Código copiado 📋`)
      return
    }
    setupVersusAsHost(code)
    showToast(`Sala ${vsRoom.roomCode} criada! Envie o código ao seu amigo.`)
  })

  btnVsJoin.addEventListener('click', () => {
    if (!vsRoom) initVersusRoom()
    const code = vsRoomCodeInput.value.trim().toUpperCase()
    if (!code) {
      showToast('Digite o código da sala do seu amigo!')
      return
    }
    clearInterval(vsBotInterval)
    vsRoom.joinRoom(code)
    vsRoomCodeInput.value = vsRoom.roomCode
    showToast(`Conectando à sala ${vsRoom.roomCode}...`)
  })

  vsRoomCodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      btnVsJoin.click()
    }
  })

  btnVsCopy.addEventListener('click', async () => {
    try {
      let baseOrigin = window.location.origin
      let basePath = '/jogos/bandeiras-nbp'
      try {
        if (window.parent && window.parent !== window) {
          baseOrigin = window.parent.location.origin
          if (window.parent.location.pathname.startsWith('/jogos/')) {
            basePath = window.parent.location.pathname
          }
        }
      } catch (_) {}
      const shareUrl = `${baseOrigin}${basePath}?room=${vsState.roomCode}`
      await navigator.clipboard.writeText(shareUrl)
      showToast(`Link da sala ${vsState.roomCode} copiado! 📋`)
    } catch {
      showToast(`Sala: ${vsState.roomCode}`)
    }
  })

  btnVsContinent.addEventListener('click', () => {
    if (!vsRoom?.isHost) return
    vsState.showContinent = !vsState.showContinent
    syncVersusToClients()
  })

  btnVsInputMode.addEventListener('click', () => {
    if (!vsRoom?.isHost) return
    vsState.multipleChoice = !vsState.multipleChoice
    syncVersusToClients()
  })

  btnVsStart.addEventListener('click', () => {
    startVersusMatchOnHost()
  })

  if (btnVsToggleConfig && vsConfigDrawer) {
    btnVsToggleConfig.addEventListener('click', () => {
      const nextOpen = vsConfigDrawer.hidden
      vsConfigDrawer.hidden = !nextOpen
      btnVsToggleConfig.setAttribute('aria-expanded', String(nextOpen))
    })
  }

  if (btnToggleGeoDrawer && geoDrawer) {
    btnToggleGeoDrawer.addEventListener('click', () => {
      const nextOpen = geoDrawer.hidden
      geoDrawer.hidden = !nextOpen
      btnToggleGeoDrawer.setAttribute('aria-expanded', String(nextOpen))
    })
  }

  vsMyWriteInput.addEventListener('input', () => {
    const q = normalizePt(vsMyWriteInput.value)
    if (!q || vsState.status !== 'playing' || vsMyLocked) {
      vsMySuggestions.hidden = true
      return
    }
    const pool = getPoolForTier(vsState.tier)
    const matches = pool
      .filter(
        (c) =>
          normalizePt(c.nome).includes(q) ||
          c.nomesAceitos.some((alias) => alias.includes(q))
      )
      .slice(0, 5)
    if (!matches.length) {
      vsMySuggestions.hidden = true
      return
    }
    vsMySuggestions.innerHTML = ''
    for (const m of matches) {
      const li = document.createElement('li')
      li.innerHTML = `<span>${m.nome}</span>`
      li.addEventListener('click', () => submitMyVersusWrittenGuess(m))
      vsMySuggestions.appendChild(li)
    }
    vsMySuggestions.hidden = false
  })

  vsMyWriteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const firstLi = vsMySuggestions.querySelector('li')
      if (!vsMySuggestions.hidden && firstLi) firstLi.click()
      else submitMyVersusWrittenGuess(null)
    }
  })

  document.getElementById('btn-vs-write-submit').addEventListener('click', () => {
    submitMyVersusWrittenGuess(null)
  })

  document.getElementById('btn-vs-write-skip').addEventListener('click', () => {
    submitMyVersusAnswer('__SKIP__', null, '__TARGET__')
  })

  // ==================== SUMMARY & SHARE ====================
  function openSummaryModal(title, desc, highlight) {
    document.getElementById('summary-badge').textContent = `SALA ${state.seed} · NÍVEL ${state.tier.toUpperCase()}`
    document.getElementById('summary-title').textContent = title
    document.getElementById('summary-desc').textContent = desc
    document.getElementById('summary-highlight').textContent = highlight
    modalSummary.hidden = false
  }

  function buildGeoShareText() {
    const tierLabel = tierSelect.options[tierSelect.selectedIndex].text
    if (state.mode === 'quiz') {
      return `🌍 NBP Atlas & Bandeiras (Quiz)\n📊 ${tierLabel}\n✅ Acertos: ${state.quizHits}/${state.quizQuestions.length} (${state.score} pts)\n🔑 Sala: ${state.seed}`
    }
    if (state.mode === 'flagle') {
      const rows = state.flagleGuesses
        .map((g) => `${g.dir.arrow} ${g.distKm.toLocaleString('pt-BR')} km (${g.proximity}%)`)
        .join('\n')
      return `🧭 NBP Flagle & Bússola (${tierLabel})\n🔑 Sala: ${state.seed}\n${rows}`
    }
    if (state.mode === 'versus' || state.mode === 'royale') {
      const w = vsState.winner?.name || 'Vencedor'
      const modeName = state.mode === 'royale' ? 'Battle Royale 6P' : 'Versus 1v1'
      return `👑 NBP Atlas & Bandeiras (${modeName})\n📊 ${tierLabel}\n🏆 Campeão: ${w}!\n🔑 Sala: ${vsState.roomCode}`
    }
    return `📊 NBP Mais ou Menos Geográfico (${tierLabel})\n🔥 Sequência: ${state.bestStreak} · Pontos: ${state.score}\n🔑 Sala: ${state.seed}`
  }

  function launchConfetti() {
    const ctx = confettiCanvas.getContext('2d')
    confettiCanvas.width = window.innerWidth
    confettiCanvas.height = window.innerHeight
    const colors = ['#38bdf8', '#10b981', '#facc15', '#f43f5e', '#a855f7']
    const pieces = Array.from({ length: 80 }, () => ({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 200,
      y: window.innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 13,
      vy: -Math.random() * 11 - 4,
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

  function restartCurrentMode(customSeed) {
    state.seed = (customSeed || seedInput.value.trim() || getTodaySeed()).toUpperCase()
    seedInput.value = state.seed
    state.pool = getFilteredPool()
    modalSummary.hidden = true

    viewQuiz.hidden = state.mode !== 'quiz'
    viewFlagle.hidden = state.mode !== 'flagle'
    viewHighlow.hidden = state.mode !== 'highlow'
    viewVersus.hidden = state.mode !== 'versus' && state.mode !== 'royale'

    const isVsMode = state.mode === 'versus' || state.mode === 'royale'
    if (soloHudPills) soloHudPills.hidden = isVsMode
    if (soloSeedBox) soloSeedBox.hidden = isVsMode
    if (btnRandomSeed) btnRandomSeed.hidden = isVsMode
    if (geoDrawer) {
      geoDrawer.hidden = true
      btnToggleGeoDrawer?.setAttribute('aria-expanded', 'false')
    }

    if (state.mode === 'quiz') startQuizMode()
    else if (state.mode === 'flagle') startFlagleMode()
    else if (state.mode === 'highlow') startHighLowMode()
    else if (state.mode === 'versus' || state.mode === 'royale') {
      initVersusRoom()
      configureArenaType(state.mode)
      if (vsRoom && vsRoom.isHost) {
        if (vsState.status === 'gameover') {
          startVersusMatchOnHost()
        } else {
          vsState.tier = state.tier
          buildVersusDecks()
          syncVersusToClients()
        }
      } else {
        renderVersusUI()
      }
    }
    setTimeout(setupFlag3DHover, 60)
  }

  // Controls & Listeners
  document.querySelectorAll('.mode-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-tab').forEach((b) => {
        b.classList.remove('active')
        b.setAttribute('aria-selected', 'false')
      })
      btn.classList.add('active')
      btn.setAttribute('aria-selected', 'true')
      state.mode = btn.dataset.mode
      restartCurrentMode(randomSeed())
    })
  })

  tierSelect.addEventListener('change', () => {
    state.tier = tierSelect.value
    restartCurrentMode(randomSeed())
    showToast(`Banco alterado: ${tierSelect.options[tierSelect.selectedIndex].text}`)
  })

  btnApplySeed.addEventListener('click', () => {
    restartCurrentMode(seedInput.value.trim() || randomSeed())
    showToast(`Sala "${state.seed}" carregada!`)
  })

  const btnDailySeed = document.getElementById('btn-daily-seed')
  if (btnDailySeed) {
    btnDailySeed.addEventListener('click', () => {
      const code = getTodaySeed()
      restartCurrentMode(code)
      showToast(`Desafio do Dia (${code}) carregado!`)
    })
  }

  btnRandomSeed.addEventListener('click', () => {
    const code = randomSeed()
    restartCurrentMode(code)
    showToast(`Nova sala gerada: ${code}`)
  })

  btnSound.addEventListener('click', () => {
    soundEnabled = !soundEnabled
    btnSound.setAttribute('aria-pressed', String(soundEnabled))
    btnSound.textContent = soundEnabled ? '🔊' : '🔇'
  })

  document.getElementById('btn-play-again').addEventListener('click', () => {
    restartCurrentMode(randomSeed())
  })

  document.getElementById('btn-close-summary').addEventListener('click', () => {
    modalSummary.hidden = true
  })

  document.getElementById('btn-share-geo').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(buildGeoShareText())
      showToast('Placar copiado para compartilhar com amigos! 📋')
    } catch {
      showToast('Não foi possível copiar automaticamente.')
    }
  })

  async function init() {
    try {
      const [worldRes, brRes] = await Promise.all([
        fetch('../../data/geografia/paises-e-bandeiras.json'),
        fetch('../../data/geografia/estados-brasil.json'),
      ])
      const worldJson = await worldRes.json()
      const brJson = await brRes.json()
      worldData = worldJson.countries
      brStatesData = brJson.estados
      restartCurrentMode(randomSeed())
    } catch (err) {
      showToast('Erro ao carregar bancos geográficos.', 4000)
      console.error(err)
    }
  }

  init()
})()
