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

  function normalizePt(str) {
    return str
      .toLocaleLowerCase('pt-BR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
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
    } catch {
      // Ignore audio errors
    }
  }

  function playChord(notes, stepMs = 75) {
    notes.forEach((n, idx) => setTimeout(() => playTone(n, 0.15, 'triangle', 0.1), idx * stepMs))
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
      btn.addEventListener('click', () => handleQuizAnswer(opt, btn, current))
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
      state.score += bonus + state.streak * 20
      if (!state.quizMultipleChoice) {
        quizWriteInput.classList.add('correct')
        quizWriteInput.value = target.nome
      }
      playChord([523.25, 659.25, 783.99], 60)
    } else {
      if (btnEl) btnEl.classList.add('wrong')
      if (!state.quizMultipleChoice) {
        quizWriteInput.classList.add('wrong')
        quizWriteInput.value = `Era: ${target.nome}`
      }
      state.streak = 0
      playTone(170, 0.2, 'sawtooth', 0.1)
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
        state.quizIndex++
        renderQuizRound()
      }
    }, 1450)
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

    if (state.mode === 'quiz') startQuizMode()
    else if (state.mode === 'flagle') startFlagleMode()
    else startHighLowMode()
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
