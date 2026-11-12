;(function () {
  const Engine = window.EKEngine
  const AudioFX = window.EKAudio

  const BOT_NAMES = ['Gato Ninja', 'Sr. Bigodes', 'Laranja Caos', 'Miau Explosivo', 'Sombra Felina']

  const dom = {
    roomStatusPill: document.getElementById('room-status-pill'),
    btnRules: document.getElementById('btn-rules'),
    btnSound: document.getElementById('btn-sound'),
    btnBackLobby: document.getElementById('btn-back-lobby'),

    lobbyView: document.getElementById('lobby-view'),
    lobbySetupStep: document.getElementById('lobby-setup-step'),
    playerNameInput: document.getElementById('player-name-input'),
    soloCountPills: document.getElementById('solo-count-pills'),
    btnStartSolo: document.getElementById('btn-start-solo'),
    btnCreateRoom: document.getElementById('btn-create-room'),
    joinCodeInput: document.getElementById('join-code-input'),
    btnJoinRoom: document.getElementById('btn-join-room'),

    p2pLobbyPanel: document.getElementById('p2p-lobby-panel'),
    p2pRoomCode: document.getElementById('p2p-room-code'),
    btnCopyInvite: document.getElementById('btn-copy-invite'),
    btnAddBotP2p: document.getElementById('btn-add-bot-p2p'),
    btnLeaveRoom: document.getElementById('btn-leave-room'),
    p2pPlayerCount: document.getElementById('p2p-player-count'),
    p2pPlayersList: document.getElementById('p2p-players-list'),
    btnStartP2p: document.getElementById('btn-start-p2p'),
    p2pWaitMsg: document.getElementById('p2p-wait-msg'),

    tableView: document.getElementById('table-view'),
    tableSurface: document.getElementById('table-surface'),
    opponentsRow: document.getElementById('opponents-row'),
    btnDrawCard: document.getElementById('btn-draw-card'),
    drawCountBadge: document.getElementById('draw-count-badge'),
    ekRiskLabel: document.getElementById('ek-risk-label'),
    discardPileBox: document.getElementById('discard-pile-box'),
    discardEmpty: document.getElementById('discard-empty'),
    discardTopImg: document.getElementById('discard-top-img'),
    discardCountBadge: document.getElementById('discard-count-badge'),
    turnBanner: document.getElementById('turn-banner'),
    nopeWindowBox: document.getElementById('nope-window-box'),
    nopeActionText: document.getElementById('nope-action-text'),
    nopeChainBadge: document.getElementById('nope-chain-badge'),
    nopeProgressBar: document.getElementById('nope-progress-bar'),
    btnPlayNope: document.getElementById('btn-play-nope'),
    gameLog: document.getElementById('game-log'),

    meNameLabel: document.getElementById('me-name-label'),
    meTurnPill: document.getElementById('me-turn-pill'),
    meExtraTurns: document.getElementById('me-extra-turns'),
    selectionHint: document.getElementById('selection-hint'),
    btnClearSelection: document.getElementById('btn-clear-selection'),
    btnPlaySelected: document.getElementById('btn-play-selected'),
    btnEndDraw: document.getElementById('btn-end-draw'),
    playerHand: document.getElementById('player-hand'),

    modalBackdrop: document.getElementById('modal-backdrop'),
    modalTitle: document.getElementById('modal-title'),
    modalBody: document.getElementById('modal-body'),
    modalCloseBtn: document.getElementById('modal-close-btn'),

    zoomBackdrop: document.getElementById('zoom-backdrop'),
    zoomImg: document.getElementById('zoom-img'),
    zoomTitle: document.getElementById('zoom-title'),
    zoomDesc: document.getElementById('zoom-desc'),
    btnCloseZoom: document.getElementById('btn-close-zoom'),
  }

  let mode = 'solo' // 'solo' | 'p2p'
  let selectedSoloCount = 4
  let room = null
  let lobbyPlayers = []
  let gameState = null
  let selectedCardIds = new Set()
  let nopeTimerInterval = null
  let botTimeout = null
  let lastShownFutureActionId = null
  let lastModalPhaseKey = null

  function getMyId() {
    if (mode === 'p2p' && room) return room.profile.id
    return 'local_me'
  }

  function getMyName() {
    const val = dom.playerNameInput.value.trim()
    return val || 'Você'
  }

  function isAuthority() {
    return mode === 'solo' || (mode === 'p2p' && room && room.isHost)
  }

  function triggerShake() {
    dom.tableSurface.classList.remove('trigger-shake')
    void dom.tableSurface.offsetWidth
    dom.tableSurface.classList.add('trigger-shake')
  }

  function syncState() {
    render()
    if (mode === 'p2p' && room && room.isHost) {
      room.broadcastState({
        kind: gameState ? 'GAME_STATE' : 'LOBBY_STATE',
        lobbyPlayers,
        gameState,
      })
    }
    scheduleBotIfNeeded()
    scheduleNopeCheckIfNeeded()
  }

  // ==================== P2P SETUP ====================
  function ensureRoom() {
    if (room) return room
    room = new window.NBPRoom({
      gameId: 'exploding-kittens',
      defaultPrefix: 'EXP',
      onStateSync: (payload) => {
        if (!payload) return
        if (payload.lobbyPlayers) lobbyPlayers = payload.lobbyPlayers
        if (payload.gameState !== undefined) {
          const prevLog = gameState?.log?.[0]
          gameState = payload.gameState
          if (gameState?.log?.[0] && gameState.log[0] !== prevLog) {
            if (gameState.log[0].includes('EXPLODIU')) {
              AudioFX.playExplosion()
              triggerShake()
            } else if (gameState.log[0].includes('NÃO!')) {
              AudioFX.playNope()
              triggerShake()
            } else if (gameState.log[0].includes('DESARME')) {
              AudioFX.playDefuse()
            } else if (gameState.log[0].includes('jogou')) {
              AudioFX.playSlap()
            }
          }
        }
        render()
      },
      onAction: (actionData, profile) => {
        if (room.isHost) {
          handleHostAction(actionData, profile)
        } else if (actionData?.type === 'HOST_LEFT') {
          dom.roomStatusPill.textContent = 'Host saiu da sala'
        }
      },
      onStatus: (status) => {
        if (status.connected) {
          dom.roomStatusPill.textContent = room.isHost
            ? `Host • Sala ${room.roomCode}`
            : `Conectado • Sala ${room.roomCode}`
          if (!room.isHost) {
            room.sendToHost({ type: 'JOIN_REQUEST', profile: room.profile })
          }
        } else if (status.connecting) {
          dom.roomStatusPill.textContent = 'Conectando P2P...'
        }
        render()
      },
      onError: (err) => {
        console.error('Erro P2P:', err)
        dom.roomStatusPill.textContent = err?.message || 'Erro de conexão P2P'
      },
    })
    if (room.profile?.name && !dom.playerNameInput.value) {
      dom.playerNameInput.value = room.profile.name
    }
    return room
  }

  function handleHostAction(action, profile) {
    if (!action || !action.type) return

    if (action.type === 'JOIN_REQUEST') {
      const p = action.profile || profile
      if (!p || !p.id) return
      const existing = lobbyPlayers.find((x) => x.id === p.id)
      if (existing) {
        existing.name = p.name || existing.name
      } else if (!gameState && lobbyPlayers.length < 5) {
        lobbyPlayers.push({
          id: p.id,
          name: p.name || 'Jogador',
          isHost: p.id === room.profile.id,
          isBot: false,
        })
      }
      syncState()
      return
    }

    if (!gameState) return
    const actorId = action.playerId || profile?.id

    switch (action.type) {
      case 'PLAY_CARDS': {
        const res = Engine.declarePlay(gameState, actorId, action.cardIds, {
          targetId: action.targetId,
          requestedType: action.requestedType,
          discardCardId: action.discardCardId,
        })
        if (res.ok) {
          AudioFX.playSlap()
          if (action.cardType === 'attack') triggerShake()
          syncState()
        }
        break
      }
      case 'PLAY_NOPE': {
        const res = Engine.playNope(gameState, actorId, action.cardId)
        if (res.ok) {
          AudioFX.playNope()
          triggerShake()
          syncState()
        }
        break
      }
      case 'DRAW_CARD': {
        const res = Engine.drawCard(gameState, actorId)
        if (res.ok) {
          if (res.outcome === 'exploded') {
            AudioFX.playExplosion()
            triggerShake()
          } else if (res.outcome === 'defused') {
            AudioFX.playDefuse()
          } else {
            AudioFX.playDraw()
          }
          syncState()
        }
        break
      }
      case 'FAVOR_GIVE': {
        const res = Engine.resolveFavorGive(gameState, actorId, action.cardId)
        if (res.ok) {
          AudioFX.playSlap()
          syncState()
        }
        break
      }
      case 'DEFUSE_INSERT': {
        const res = Engine.insertDefusedKitten(gameState, actorId, action.position)
        if (res.ok) {
          AudioFX.playSlap()
          syncState()
        }
        break
      }
      case 'RESTART_MATCH': {
        startMatchWithProfiles(lobbyPlayers)
        break
      }
    }
  }

  function dispatchAction(action) {
    if (isAuthority()) {
      handleHostAction({ ...action, playerId: action.playerId || getMyId() }, { id: getMyId(), name: getMyName() })
    } else if (mode === 'p2p' && room) {
      room.sendToHost({ ...action, playerId: getMyId() })
    }
  }

  // ==================== START & LOBBY ====================
  function startSoloMatch() {
    mode = 'solo'
    const count = selectedSoloCount || 4
    const profiles = [{ id: 'local_me', name: getMyName(), isHost: true, isBot: false }]
    for (let i = 0; i < count - 1; i++) {
      profiles.push({
        id: `bot_${i + 1}`,
        name: BOT_NAMES[i % BOT_NAMES.length],
        isHost: false,
        isBot: true,
      })
    }
    lobbyPlayers = profiles
    dom.roomStatusPill.textContent = `Solo vs ${count - 1} Bots`
    startMatchWithProfiles(profiles)
  }

  function startMatchWithProfiles(profiles) {
    selectedCardIds.clear()
    lastShownFutureActionId = null
    lastModalPhaseKey = null
    gameState = Engine.createMatchState(profiles)
    AudioFX.playShuffle()
    closeModal()
    syncState()
  }

  function createP2PRoom() {
    mode = 'p2p'
    const r = ensureRoom()
    r.setPlayerName(getMyName())
    const code = `EXP-${Math.floor(1000 + Math.random() * 9000)}`
    r.hostRoom(code)
    lobbyPlayers = [{ id: r.profile.id, name: r.profile.name, isHost: true, isBot: false }]
    gameState = null
    syncState()
  }

  function joinP2PRoom(rawCode) {
    const code = (rawCode || dom.joinCodeInput.value || '').trim().toUpperCase()
    if (!code) return
    mode = 'p2p'
    const r = ensureRoom()
    r.setPlayerName(getMyName())
    r.joinRoom(code)
    r.sendToHost({ type: 'JOIN_REQUEST', profile: r.profile })
    render()
  }

  function leaveCurrentRoom() {
    clearTimeout(botTimeout)
    clearInterval(nopeTimerInterval)
    if (room) {
      room.cleanup(true)
    }
    gameState = null
    lobbyPlayers = []
    mode = 'solo'
    selectedCardIds.clear()
    closeModal()
    dom.roomStatusPill.textContent = 'Modo Local'
    render()
  }

  // ==================== TIMERS: NOPE & BOTS ====================
  function scheduleNopeCheckIfNeeded() {
    clearInterval(nopeTimerInterval)
    if (!gameState || gameState.phase !== 'nope_window' || !gameState.pendingAction) return

    nopeTimerInterval = setInterval(() => {
      if (!gameState || gameState.phase !== 'nope_window' || !gameState.pendingAction) {
        clearInterval(nopeTimerInterval)
        return
      }
      const total = 4500
      const remaining = Math.max(0, gameState.pendingAction.deadline - Date.now())
      const pct = Math.min(100, (remaining / total) * 100)
      dom.nopeProgressBar.style.width = `${pct}%`

      if (remaining <= 0) {
        clearInterval(nopeTimerInterval)
        if (isAuthority()) {
          const prevPhase = gameState.phase
          const act = gameState.pendingAction
          const res = Engine.resolvePendingAction(gameState)
          if (res.ok) {
            if (act?.cardType === 'shuffle' && !res.canceled) AudioFX.playShuffle()
            if (res.canceled) AudioFX.playNope()
            syncState()
          } else if (prevPhase === 'nope_window') {
            syncState()
          }
        }
      }
    }, 60)
  }

  function scheduleBotIfNeeded() {
    clearTimeout(botTimeout)
    if (!isAuthority() || !gameState || gameState.phase === 'finished') return

    // Bot reagindo com Não! na janela de reação
    if (gameState.phase === 'nope_window' && gameState.pendingAction) {
      const act = gameState.pendingAction
      const lastActor = act.lastNopeBy || act.actorId
      const targetBot = gameState.players.find(
        (p) =>
          p.alive &&
          p.isBot &&
          p.id !== lastActor &&
          p.hand.some((c) => c.type === 'nope') &&
          (act.targetId === p.id || (act.cardType === 'attack' && Math.random() < 0.45))
      )
      if (targetBot) {
        botTimeout = setTimeout(() => {
          if (gameState?.phase === 'nope_window') {
            const nopeCard = targetBot.hand.find((c) => c.type === 'nope')
            if (nopeCard) {
              Engine.playNope(gameState, targetBot.id, nopeCard.id)
              AudioFX.playNope()
              triggerShake()
              syncState()
            }
          }
        }, 1200)
      }
      return
    }

    // Bot entregando carta de Presente
    if (gameState.phase === 'choose_favor_give' && gameState.favorPending) {
      const bot = gameState.players.find((p) => p.id === gameState.favorPending.fromId && p.isBot)
      if (bot && bot.hand.length > 0) {
        botTimeout = setTimeout(() => {
          const sorted = bot.hand.slice().sort((a, b) => scoreCardKeep(a.type) - scoreCardKeep(b.type))
          Engine.resolveFavorGive(gameState, bot.id, sorted[0].id)
          AudioFX.playSlap()
          syncState()
        }, 900)
      }
      return
    }

    // Bot devolvendo Exploding Kitten após Desarme
    if (gameState.phase === 'defuse_insert' && gameState.defusePending) {
      const bot = gameState.players.find((p) => p.id === gameState.defusePending.playerId && p.isBot)
      if (bot) {
        botTimeout = setTimeout(() => {
          const pos = Math.floor(Math.random() * (gameState.drawPile.length + 1))
          Engine.insertDefusedKitten(gameState, bot.id, pos)
          AudioFX.playSlap()
          syncState()
        }, 1000)
      }
      return
    }

    // Turno normal do Bot
    if (gameState.phase === 'playing') {
      const current = gameState.players[gameState.currentPlayerIndex]
      if (!current || !current.isBot || !current.alive) return

      botTimeout = setTimeout(() => {
        runBotTurn(current)
      }, 950)
    }
  }

  function scoreCardKeep(type) {
    if (type === 'defuse') return 100
    if (type === 'nope') return 70
    if (type === 'attack' || type === 'skip') return 55
    if (type === 'future' || type === 'shuffle') return 40
    if (type === 'favor') return 30
    return 10
  }

  function runBotTurn(bot) {
    if (!gameState || gameState.phase !== 'playing') return
    const current = gameState.players[gameState.currentPlayerIndex]
    if (!current || current.id !== bot.id) return

    const deckLen = gameState.drawPile.length
    const eksLeft = gameState.players.filter((p) => p.alive).length - 1
    const risk = deckLen > 0 ? eksLeft / deckLen : 1
    const hasDefuse = bot.hand.some((c) => c.type === 'defuse')

    // Se risco for alto ou não tiver Desarme, tenta usar Ataque, Pulo, Embaralhar ou Futuro
    if (risk >= 0.25 || !hasDefuse || Math.random() < 0.38) {
      const skip = bot.hand.find((c) => c.type === 'skip')
      const attack = bot.hand.find((c) => c.type === 'attack')
      if (attack && Math.random() < 0.65) {
        Engine.declarePlay(gameState, bot.id, [attack.id])
        AudioFX.playSlap()
        triggerShake()
        syncState()
        return
      }
      if (skip && (risk >= 0.22 || !hasDefuse)) {
        Engine.declarePlay(gameState, bot.id, [skip.id])
        AudioFX.playSlap()
        syncState()
        return
      }
    }

    // Tenta jogar um Par de Gatos se tiver
    const byType = {}
    bot.hand.forEach((c) => {
      if (c.type.startsWith('cat_')) {
        byType[c.type] = byType[c.type] || []
        byType[c.type].push(c)
      }
    })
    const pairEntry = Object.values(byType).find((arr) => arr.length >= 2)
    const aliveTargets = gameState.players.filter((p) => p.alive && p.id !== bot.id && p.hand.length > 0)
    if (pairEntry && aliveTargets.length > 0 && Math.random() < 0.55) {
      const target = aliveTargets[Math.floor(Math.random() * aliveTargets.length)]
      Engine.declarePlay(gameState, bot.id, [pairEntry[0].id, pairEntry[1].id], { targetId: target.id })
      AudioFX.playSlap()
      syncState()
      return
    }

    // Senão, compra carta!
    const res = Engine.drawCard(gameState, bot.id)
    if (res.ok) {
      if (res.outcome === 'exploded') {
        AudioFX.playExplosion()
        triggerShake()
      } else if (res.outcome === 'defused') {
        AudioFX.playDefuse()
      } else {
        AudioFX.playDraw()
      }
      syncState()
    }
  }

  // ==================== UI & MODALS ====================
  function setupCard3DTilt(cardEl) {
    const sheen = document.createElement('div')
    sheen.className = 'card-specular-sheen'
    cardEl.appendChild(sheen)

    cardEl.addEventListener('pointermove', (e) => {
      if (cardEl.classList.contains('is-selected')) return
      const rect = cardEl.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const px = (x / rect.width) * 100
      const py = (y / rect.height) * 100
      const rotY = ((x - rect.width / 2) / (rect.width / 2)) * 12
      const rotX = -((y - rect.height / 2) / (rect.height / 2)) * 12
      cardEl.style.transform = `perspective(700px) rotateX(${rotX.toFixed(1)}deg) rotateY(${rotY.toFixed(1)}deg) translateY(-10px) scale(1.05)`
      sheen.style.opacity = '1'
      sheen.style.background = `radial-gradient(circle at ${px.toFixed(0)}% ${py.toFixed(0)}%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 65%)`
    })

    cardEl.addEventListener('pointerleave', () => {
      if (!cardEl.classList.contains('is-selected')) {
        cardEl.style.transform = ''
      }
      sheen.style.opacity = '0'
    })
  }

  function openModal(title, contentEl, closable = true) {
    dom.modalTitle.textContent = title
    dom.modalBody.innerHTML = ''
    dom.modalBody.appendChild(contentEl)
    dom.modalCloseBtn.hidden = !closable
    dom.modalBackdrop.hidden = false
  }

  function closeModal() {
    dom.modalBackdrop.hidden = true
  }

  function openZoom(card) {
    const meta = Engine.CARD_TYPES[card.type]
    dom.zoomImg.src = card.img
    dom.zoomTitle.textContent = `${meta?.name || card.name}${card.subtitle ? ` — ${card.subtitle}` : ''}`
    dom.zoomDesc.textContent = meta?.description || ''
    dom.zoomBackdrop.hidden = false
  }

  function openRulesModal() {
    const div = document.createElement('div')
    div.className = 'ek-rules-list'
    div.innerHTML = `
      <p><strong>Objetivo:</strong> Seja o último jogador vivo! Se você comprar um <strong>Exploding Kitten</strong> sem ter um <strong>Desarme</strong>, você explode e é eliminado.</p>
      <p><strong>No seu turno:</strong> Jogue quantas cartas quiser (ou nenhuma) e clique em <strong>Comprar Carta</strong> para encerrar sua vez.</p>
      <p><strong>Cartas de Ação:</strong></p>
      <ul>
        <li><strong>Desarme:</strong> Salva você de um Exploding Kitten e permite colocá-lo secretamente de volta em qualquer lugar da Pilha de Compra.</li>
        <li><strong>Ataque:</strong> Encerra seu turno sem comprar e obriga o próximo jogador a jogar 2 vezes seguidas.</li>
        <li><strong>Pulo:</strong> Encerra seu turno imediatamente sem comprar carta (cancela 1 turno de Ataque).</li>
        <li><strong>Veja o Futuro:</strong> Veja secretamente as 3 cartas do topo do baralho.</li>
        <li><strong>Embaralhar:</strong> Embaralha a Pilha de Compra.</li>
        <li><strong>Presente:</strong> Escolha um jogador para lhe dar 1 carta à escolha dele.</li>
        <li><strong>Não!:</strong> Jogue a qualquer momento para cancelar uma ação (ou em cima de outro Não! para virar SIM!).</li>
      </ul>
      <p><strong>Combos Especiais:</strong></p>
      <ul>
        <li><strong>2 Cartas Iguais (Par):</strong> Roube 1 carta aleatória de qualquer jogador.</li>
        <li><strong>3 Cartas Iguais (Trio):</strong> Peça uma carta específica de qualquer jogador.</li>
        <li><strong>5 Cartas Diferentes:</strong> Pegue qualquer carta da Pilha de Descartes!</li>
      </ul>
    `
    openModal('Regras Oficiais · Exploding Kittens', div, true)
  }

  function promptTargetAndPlay(cards, check) {
    const myId = getMyId()
    const targets = gameState.players.filter((p) => p.alive && p.id !== myId && p.hand.length > 0)
    if (targets.length === 0) {
      dom.selectionHint.textContent = 'Nenhum oponente com cartas na mão!'
      return
    }

    const wrap = document.createElement('div')
    wrap.className = 'ek-modal-body'

    let selectedTargetId = targets[0].id
    let selectedReqType = 'defuse'

    const targetLabel = document.createElement('p')
    targetLabel.textContent = 'Escolha o jogador alvo:'
    targetLabel.style.margin = '0'
    wrap.appendChild(targetLabel)

    const targetGrid = document.createElement('div')
    targetGrid.className = 'ek-modal-grid'
    targets.forEach((t, idx) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'ek-choice-card'
      if (idx === 0) btn.style.borderColor = '#fbbf24'
      btn.innerHTML = `<span>${t.name}</span><small>${t.hand.length} cartas</small>`
      btn.addEventListener('click', () => {
        selectedTargetId = t.id
        Array.from(targetGrid.children).forEach((c) => (c.style.borderColor = ''))
        btn.style.borderColor = '#fbbf24'
      })
      targetGrid.appendChild(btn)
    })
    wrap.appendChild(targetGrid)

    if (check.kind === 'combo3') {
      const reqLabel = document.createElement('p')
      reqLabel.textContent = 'Qual carta deseja pedir no Trio?'
      reqLabel.style.margin = '6px 0 0'
      wrap.appendChild(reqLabel)

      const select = document.createElement('select')
      select.style.padding = '10px'
      select.style.borderRadius = '10px'
      select.style.background = '#110704'
      select.style.color = '#fff'
      select.style.border = '1px solid #c58b38'
      Object.values(Engine.CARD_TYPES)
        .filter((t) => t.type !== 'ek')
        .forEach((t) => {
          const opt = document.createElement('option')
          opt.value = t.type
          opt.textContent = t.name
          select.appendChild(opt)
        })
      select.addEventListener('change', () => {
        selectedReqType = select.value
      })
      wrap.appendChild(select)
    }

    const confirmBtn = document.createElement('button')
    confirmBtn.type = 'button'
    confirmBtn.className = 'btn-tactile btn-primary btn-full'
    confirmBtn.textContent = 'Confirmar Jogada'
    confirmBtn.addEventListener('click', () => {
      closeModal()
      const ids = cards.map((c) => c.id)
      selectedCardIds.clear()
      dispatchAction({
        type: 'PLAY_CARDS',
        cardIds: ids,
        cardType: check.cardType,
        targetId: selectedTargetId,
        requestedType: check.kind === 'combo3' ? selectedReqType : undefined,
      })
    })
    wrap.appendChild(confirmBtn)

    openModal(
      check.kind === 'combo2'
        ? 'Par! Roubar Carta Aleatória'
        : check.kind === 'combo3'
          ? 'Trio! Pedir Carta Específica'
          : 'Presente! Pedir 1 Carta',
      wrap,
      true
    )
  }

  function promptDiscardPickAndPlay(cards) {
    const wrap = document.createElement('div')
    wrap.className = 'ek-modal-grid'
    const uniqueVisible = gameState.discardPile.slice().reverse()
    uniqueVisible.forEach((c) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'ek-choice-card'
      btn.innerHTML = `<img src="${c.img}" alt="${c.name}" /><span>${c.name}</span>`
      btn.addEventListener('click', () => {
        closeModal()
        const ids = cards.map((x) => x.id)
        selectedCardIds.clear()
        dispatchAction({
          type: 'PLAY_CARDS',
          cardIds: ids,
          discardCardId: c.id,
        })
      })
      wrap.appendChild(btn)
    })
    openModal('5 Cartas Diferentes — Pegar do Descarte', wrap, true)
  }

  function openFutureModal(cards) {
    const wrap = document.createElement('div')
    wrap.className = 'ek-future-row'
    cards.forEach((c, idx) => {
      const item = document.createElement('div')
      item.className = 'ek-future-item'
      item.innerHTML = `
        <strong>#${idx + 1} ${idx === 0 ? '(Topo)' : ''}</strong>
        <img src="${c.img}" alt="${c.name}" />
        <span>${c.name}</span>
      `
      wrap.appendChild(item)
    })
    openModal('Veja o Futuro (Só você vê!)', wrap, true)
  }

  function openDefuseModal() {
    const maxPos = gameState.drawPile.length
    let chosenPos = Math.floor(maxPos / 2)

    const wrap = document.createElement('div')
    wrap.className = 'ek-modal-body'

    const info = document.createElement('p')
    info.style.margin = '0'
    info.textContent = `Você usou DESARME! Escolha secretamente onde esconder o Exploding Kitten na Pilha de Compra (0 = Topo / próxima carta, ${maxPos} = Fundo):`
    wrap.appendChild(info)

    const sliderWrap = document.createElement('div')
    sliderWrap.className = 'ek-defuse-slider-wrap'

    const posLabel = document.createElement('strong')
    const updateLabel = () => {
      posLabel.textContent =
        chosenPos === 0
          ? 'Posição: 1ª carta (TOPO!)'
          : chosenPos === maxPos
            ? `Posição: Última carta (${maxPos + 1}ª / FUNDO)`
            : `Posição: ${chosenPos + 1}ª carta do topo`
    }
    updateLabel()

    const slider = document.createElement('input')
    slider.type = 'range'
    slider.min = '0'
    slider.max = String(maxPos)
    slider.value = String(chosenPos)
    slider.addEventListener('input', () => {
      chosenPos = parseInt(slider.value, 10)
      updateLabel()
    })

    const presets = document.createElement('div')
    presets.className = 'ek-defuse-presets'
    ;[
      { label: 'Topo (1ª)', val: 0 },
      { label: '2ª Carta', val: Math.min(1, maxPos) },
      { label: 'Meio', val: Math.floor(maxPos / 2) },
      { label: 'Fundo', val: maxPos },
      { label: 'Aleatório', val: -1 },
    ].forEach((p) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'btn-tactile btn-secondary'
      b.textContent = p.label
      b.addEventListener('click', () => {
        chosenPos = p.val === -1 ? Math.floor(Math.random() * (maxPos + 1)) : p.val
        slider.value = String(chosenPos)
        updateLabel()
      })
      presets.appendChild(b)
    })

    sliderWrap.appendChild(posLabel)
    sliderWrap.appendChild(slider)
    sliderWrap.appendChild(presets)
    wrap.appendChild(sliderWrap)

    const confirmBtn = document.createElement('button')
    confirmBtn.type = 'button'
    confirmBtn.className = 'btn-tactile btn-primary btn-full'
    confirmBtn.textContent = 'Esconder Gatinho no Baralho'
    confirmBtn.addEventListener('click', () => {
      closeModal()
      dispatchAction({ type: 'DEFUSE_INSERT', position: chosenPos })
    })
    wrap.appendChild(confirmBtn)

    openModal('Exploding Kitten Desarmado!', wrap, false)
  }

  function openFavorGiveModal(me) {
    const fromPlayer = gameState.players.find((p) => p.id === gameState.favorPending.toId)
    const wrap = document.createElement('div')
    wrap.className = 'ek-modal-body'

    const p = document.createElement('p')
    p.style.margin = '0'
    p.textContent = `${fromPlayer?.name || 'Alguém'} jogou PRESENTE em você! Escolha qual carta da sua mão você quer entregar:`
    wrap.appendChild(p)

    const grid = document.createElement('div')
    grid.className = 'ek-modal-grid'
    me.hand.forEach((c) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'ek-choice-card'
      btn.innerHTML = `<img src="${c.img}" alt="${c.name}" /><span>${c.name}</span>`
      btn.addEventListener('click', () => {
        closeModal()
        dispatchAction({ type: 'FAVOR_GIVE', cardId: c.id })
      })
      grid.appendChild(btn)
    })
    wrap.appendChild(grid)

    openModal('Entregar Presente', wrap, false)
  }

  function openVictoryModal() {
    const winner = gameState.players.find((p) => p.id === gameState.winnerId)
    AudioFX.playVictory()
    const wrap = document.createElement('div')
    wrap.className = 'ek-modal-body'
    wrap.innerHTML = `
      <p style="font-size:1.1rem;font-weight:800;margin:0;text-align:center;">
        ${winner ? `${winner.name} sobreviveu a todos os Exploding Kittens e venceu a partida!` : 'Partida encerrada!'}
      </p>
    `
    if (isAuthority()) {
      const againBtn = document.createElement('button')
      againBtn.type = 'button'
      againBtn.className = 'btn-tactile btn-primary btn-full'
      againBtn.textContent = 'Jogar Novamente'
      againBtn.addEventListener('click', () => {
        closeModal()
        dispatchAction({ type: 'RESTART_MATCH' })
      })
      wrap.appendChild(againBtn)
    }
    const backBtn = document.createElement('button')
    backBtn.type = 'button'
    backBtn.className = 'btn-tactile btn-secondary btn-full'
    backBtn.textContent = 'Voltar ao Lobby'
    backBtn.addEventListener('click', () => {
      closeModal()
      leaveCurrentRoom()
    })
    wrap.appendChild(backBtn)

    openModal('Vitória!', wrap, false)
  }

  // ==================== RENDER ====================
  function render() {
    const inGame = !!gameState
    dom.lobbyView.hidden = inGame
    dom.tableView.hidden = !inGame
    dom.btnBackLobby.hidden = !inGame

    if (!inGame) {
      renderLobby()
      return
    }
    renderTable()
  }

  function renderLobby() {
    const inP2P = mode === 'p2p' && room && room.roomCode
    dom.lobbySetupStep.hidden = inP2P
    dom.p2pLobbyPanel.hidden = !inP2P
    if (!inP2P) return

    dom.p2pRoomCode.textContent = room.roomCode
    dom.p2pPlayerCount.textContent = String(lobbyPlayers.length)
    dom.btnAddBotP2p.hidden = !(room.isHost && lobbyPlayers.length < 5)
    dom.btnStartP2p.hidden = !room.isHost
    dom.p2pWaitMsg.hidden = room.isHost
    dom.btnStartP2p.disabled = lobbyPlayers.length < 2

    dom.p2pPlayersList.innerHTML = ''
    lobbyPlayers.forEach((p) => {
      const li = document.createElement('li')
      li.className = 'ek-p2p-player-item'
      const badge = p.isHost ? 'Host' : p.isBot ? 'Bot' : 'Jogador'
      li.innerHTML = `<span>${p.name}</span><span class="ek-badge">${badge}</span>`
      dom.p2pPlayersList.appendChild(li)
    })
  }

  function renderTable() {
    const myId = getMyId()
    const me = gameState.players.find((p) => p.id === myId) || gameState.players[0]
    const current = gameState.players[gameState.currentPlayerIndex]
    const isMyTurn = gameState.phase === 'playing' && current?.id === me.id && me.alive

    // Opponents
    dom.opponentsRow.innerHTML = ''
    const others = gameState.players.filter((p) => p.id !== me.id)
    others.forEach((p) => {
      const card = document.createElement('div')
      card.className = 'ek-opp-card'
      if (current?.id === p.id && p.alive && gameState.phase !== 'finished') card.classList.add('is-active')
      if (!p.alive) card.classList.add('is-dead')

      const miniCount = Math.min(8, p.hand.length)
      let minisHtml = ''
      for (let i = 0; i < miniCount; i++) {
        minisHtml += `<img class="ek-mini-back" src="./cards/back.png" alt="" />`
      }

      const statusText = !p.alive
        ? 'EXPLODIU!'
        : current?.id === p.id
          ? gameState.turnsRemaining > 1
            ? `Jogando (${gameState.turnsRemaining}x)`
            : 'Jogando agora'
          : p.isBot
            ? 'Bot'
            : 'Aguardando'

      card.innerHTML = `
        <div class="ek-opp-top">
          <span class="ek-opp-name">${p.name}</span>
          <span class="ek-opp-count">${p.hand.length} cartas</span>
        </div>
        <div class="ek-opp-mini-cards">${minisHtml}</div>
        <div class="ek-opp-status">${statusText}</div>
      `
      dom.opponentsRow.appendChild(card)
    })

    // Piles
    const deckCount = gameState.drawPile.length
    const eksLeft = Math.max(0, gameState.players.filter((p) => p.alive).length - 1)
    const riskPct = deckCount > 0 ? Math.min(100, Math.round((eksLeft / deckCount) * 100)) : 0
    dom.drawCountBadge.textContent = String(deckCount)
    dom.ekRiskLabel.textContent = `${riskPct}% EK`
    dom.btnDrawCard.disabled = !isMyTurn || deckCount === 0
    dom.btnEndDraw.disabled = !isMyTurn || deckCount === 0

    const discCount = gameState.discardPile.length
    dom.discardCountBadge.textContent = String(discCount)
    if (discCount > 0) {
      const top = gameState.discardPile[discCount - 1]
      dom.discardTopImg.src = top.img
      dom.discardTopImg.hidden = false
      dom.discardEmpty.hidden = true
    } else {
      dom.discardTopImg.hidden = true
      dom.discardEmpty.hidden = false
    }

    // Turn Banner (inclui última ação de forma limpa)
    const lastEvent = gameState.log?.[0] || ''
    dom.turnBanner.classList.toggle('is-my-turn', isMyTurn)
    if (gameState.phase === 'finished') {
      const w = gameState.players.find((p) => p.id === gameState.winnerId)
      dom.turnBanner.textContent = `Fim de Jogo! Vencedor: ${w?.name || '---'}`
    } else if (!me.alive) {
      dom.turnBanner.textContent = `Você explodiu! ${lastEvent}`
    } else if (isMyTurn) {
      dom.turnBanner.textContent =
        gameState.turnsRemaining > 1
          ? `SEU TURNO (${gameState.turnsRemaining}x) · ${lastEvent}`
          : `SEU TURNO · Jogue cartas ou compre para terminar`
    } else {
      dom.turnBanner.textContent = `Vez de ${current?.name || '...'} · ${lastEvent}`
    }

    // Nope Window
    const inNope = gameState.phase === 'nope_window' && gameState.pendingAction
    dom.nopeWindowBox.hidden = !inNope
    if (inNope) {
      const act = gameState.pendingAction
      const lastActor = act.lastNopeBy || act.actorId
      const canINope = me.alive && lastActor !== me.id && me.hand.some((c) => c.type === 'nope')
      const actLabel =
        act.kind === 'single'
          ? Engine.CARD_TYPES[act.cardType]?.name
          : act.kind === 'combo2'
            ? 'Par de Cartas'
            : act.kind === 'combo3'
              ? 'Trio de Cartas'
              : 'Combo 5 Diferentes'
      dom.nopeActionText.textContent = `${act.actorName} jogou ${actLabel}!`
      dom.nopeChainBadge.hidden = act.nopeCount === 0
      dom.nopeChainBadge.textContent = act.nopeCount % 2 === 1 ? `ANULADO (${act.nopeCount}x)` : `SIM! (${act.nopeCount}x)`
      dom.btnPlayNope.disabled = !canINope
    }

    // Me status
    dom.meNameLabel.textContent = me.name
    dom.meTurnPill.hidden = !isMyTurn
    dom.meExtraTurns.hidden = !(isMyTurn && gameState.turnsRemaining > 1)
    dom.meExtraTurns.textContent = `${gameState.turnsRemaining} turnos`

    // Prune invalid selection IDs
    const myIds = new Set(me.hand.map((c) => c.id))
    for (const id of Array.from(selectedCardIds)) {
      if (!myIds.has(id)) selectedCardIds.delete(id)
    }

    // Selection bar (limpa: só mostra botões de jogar/limpar quando seleciona algo)
    const selectedCards = me.hand.filter((c) => selectedCardIds.has(c.id))
    dom.btnClearSelection.hidden = selectedCards.length === 0
    dom.btnPlaySelected.hidden = selectedCards.length === 0
    if (selectedCards.length === 0) {
      dom.selectionHint.textContent = 'Clique nas cartas para jogar (2x amplia) ou no baralho para comprar'
      dom.btnPlaySelected.disabled = true
    } else {
      const check = Engine.validateSelection(selectedCards, gameState.discardPile.length)
      if (!isMyTurn) {
        dom.selectionHint.textContent = `${selectedCards.length} selecionada(s) — aguarde seu turno`
        dom.btnPlaySelected.disabled = true
        dom.btnPlaySelected.textContent = 'Aguarde'
      } else if (check.valid) {
        dom.selectionHint.textContent =
          check.kind === 'single'
            ? `${Engine.CARD_TYPES[check.cardType].name}`
            : check.kind === 'combo2'
              ? 'Par (Roubar Aleatória)'
              : check.kind === 'combo3'
                ? 'Trio (Pedir Carta)'
                : '5 Diferentes (Pegar do Descarte)'
        dom.btnPlaySelected.disabled = false
        dom.btnPlaySelected.textContent =
          check.kind === 'single' ? `Jogar ${Engine.CARD_TYPES[check.cardType].shortName}` : 'Jogar Combo'
      } else {
        dom.selectionHint.textContent = check.reason
        dom.btnPlaySelected.disabled = true
        dom.btnPlaySelected.textContent = 'Seleção Inválida'
      }
    }

    // Hand (cartas limpas, sem botão + poluindo; clique seleciona, duplo clique ou botão direito amplia)
    dom.playerHand.innerHTML = ''
    me.hand.forEach((card) => {
      const cardEl = document.createElement('div')
      cardEl.className = 'ek-hand-card'
      if (selectedCardIds.has(card.id)) cardEl.classList.add('is-selected')

      const img = document.createElement('img')
      img.src = card.img
      img.alt = card.name
      img.draggable = false
      cardEl.appendChild(img)

      setupCard3DTilt(cardEl)

      cardEl.addEventListener('click', () => {
        if (selectedCardIds.has(card.id)) {
          selectedCardIds.delete(card.id)
        } else {
          selectedCardIds.add(card.id)
        }
        renderTable()
      })

      cardEl.addEventListener('dblclick', (e) => {
        e.preventDefault()
        openZoom(card)
      })

      cardEl.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        openZoom(card)
      })

      dom.playerHand.appendChild(cardEl)
    })

    // Modais automáticos de fase
    if (gameState.futurePeek && gameState.futurePeek.playerId === me.id) {
      const key = `future_${gameState.turnCounter}_${gameState.futurePeek.cards.map((c) => c.id).join(',')}`
      if (lastShownFutureActionId !== key) {
        lastShownFutureActionId = key
        openFutureModal(gameState.futurePeek.cards)
      }
    }

    const phaseKey = `${gameState.phase}_${gameState.turnCounter}_${gameState.defusePending?.playerId || ''}_${gameState.favorPending?.fromId || ''}_${gameState.winnerId || ''}`
    if (phaseKey !== lastModalPhaseKey) {
      if (gameState.phase === 'defuse_insert' && gameState.defusePending?.playerId === me.id) {
        lastModalPhaseKey = phaseKey
        openDefuseModal()
      } else if (gameState.phase === 'choose_favor_give' && gameState.favorPending?.fromId === me.id) {
        lastModalPhaseKey = phaseKey
        openFavorGiveModal(me)
      } else if (gameState.phase === 'finished') {
        lastModalPhaseKey = phaseKey
        openVictoryModal()
      }
    }
  }

  // ==================== EVENT LISTENERS ====================
  dom.btnSound.addEventListener('click', () => {
    const muted = AudioFX.toggleMute()
    dom.btnSound.textContent = muted ? 'Som: OFF' : 'Som: ON'
  })

  dom.btnRules.addEventListener('click', openRulesModal)
  dom.modalCloseBtn.addEventListener('click', closeModal)
  dom.btnCloseZoom.addEventListener('click', () => {
    dom.zoomBackdrop.hidden = true
  })
  dom.zoomBackdrop.addEventListener('click', (e) => {
    if (e.target === dom.zoomBackdrop) dom.zoomBackdrop.hidden = true
  })

  dom.soloCountPills.addEventListener('click', (e) => {
    const btn = e.target.closest('.ek-count-pill')
    if (!btn) return
    selectedSoloCount = parseInt(btn.dataset.count, 10) || 4
    dom.soloCountPills.querySelectorAll('.ek-count-pill').forEach((b) => {
      b.classList.toggle('is-active', b === btn)
    })
  })

  dom.btnStartSolo.addEventListener('click', startSoloMatch)
  dom.btnCreateRoom.addEventListener('click', createP2PRoom)
  dom.btnJoinRoom.addEventListener('click', () => joinP2PRoom())
  dom.btnLeaveRoom.addEventListener('click', leaveCurrentRoom)
  dom.btnBackLobby.addEventListener('click', leaveCurrentRoom)

  dom.playerNameInput.addEventListener('change', () => {
    const clean = getMyName()
    if (mode === 'p2p' && room) {
      room.setPlayerName(clean)
      if (room.isHost) {
        const me = lobbyPlayers.find((p) => p.id === room.profile.id)
        if (me) me.name = clean
        syncState()
      } else if (room.roomCode) {
        room.sendToHost({ type: 'JOIN_REQUEST', profile: room.profile })
      }
    }
  })

  dom.btnCopyInvite.addEventListener('click', () => {
    if (!room?.roomCode) return
    const url = `${window.location.origin}/jogos/exploding-kittens?room=${room.roomCode}`
    navigator.clipboard?.writeText(url).catch(() => {})
    dom.btnCopyInvite.textContent = 'Link Copiado!'
    setTimeout(() => {
      dom.btnCopyInvite.textContent = 'Copiar Convite'
    }, 1800)
  })

  dom.btnAddBotP2p.addEventListener('click', () => {
    if (!room?.isHost || lobbyPlayers.length >= 5) return
    const botIdx = lobbyPlayers.filter((p) => p.isBot).length
    lobbyPlayers.push({
      id: `bot_${Date.now()}_${botIdx}`,
      name: BOT_NAMES[botIdx % BOT_NAMES.length],
      isHost: false,
      isBot: true,
    })
    syncState()
  })

  dom.btnStartP2p.addEventListener('click', () => {
    if (!room?.isHost || lobbyPlayers.length < 2) return
    startMatchWithProfiles(lobbyPlayers)
  })

  dom.btnClearSelection.addEventListener('click', () => {
    selectedCardIds.clear()
    renderTable()
  })

  dom.btnPlaySelected.addEventListener('click', () => {
    if (!gameState || gameState.phase !== 'playing') return
    const me = gameState.players.find((p) => p.id === getMyId())
    if (!me) return
    const cards = me.hand.filter((c) => selectedCardIds.has(c.id))
    const check = Engine.validateSelection(cards, gameState.discardPile.length)
    if (!check.valid) return

    if (
      (check.kind === 'single' && check.cardType === 'favor') ||
      check.kind === 'combo2' ||
      check.kind === 'combo3'
    ) {
      promptTargetAndPlay(cards, check)
      return
    }
    if (check.kind === 'combo5') {
      promptDiscardPickAndPlay(cards)
      return
    }

    const ids = cards.map((c) => c.id)
    selectedCardIds.clear()
    dispatchAction({ type: 'PLAY_CARDS', cardIds: ids, cardType: check.cardType })
  })

  function handleDrawClick() {
    if (!gameState || gameState.phase !== 'playing') return
    selectedCardIds.clear()
    dispatchAction({ type: 'DRAW_CARD' })
  }

  dom.btnDrawCard.addEventListener('click', handleDrawClick)
  dom.btnEndDraw.addEventListener('click', handleDrawClick)

  dom.btnPlayNope.addEventListener('click', () => {
    if (!gameState || gameState.phase !== 'nope_window') return
    const me = gameState.players.find((p) => p.id === getMyId())
    const nopeCard = me?.hand.find((c) => c.type === 'nope')
    if (!nopeCard) return
    dispatchAction({ type: 'PLAY_NOPE', cardId: nopeCard.id })
  })

  dom.discardPileBox.addEventListener('click', () => {
    if (!gameState || gameState.discardPile.length === 0) return
    const wrap = document.createElement('div')
    wrap.className = 'ek-modal-grid'
    gameState.discardPile
      .slice()
      .reverse()
      .forEach((c) => {
        const div = document.createElement('div')
        div.className = 'ek-choice-card'
        div.innerHTML = `<img src="${c.img}" alt="${c.name}" /><span>${c.name}</span>`
        div.addEventListener('click', () => openZoom(c))
        wrap.appendChild(div)
      })
    openModal(`Pilha de Descartes (${gameState.discardPile.length})`, wrap, true)
  })

  // ==================== INIT ====================
  window.addEventListener('DOMContentLoaded', () => {
    dom.btnSound.textContent = AudioFX.muted ? 'Som: OFF' : 'Som: ON'

    let search = window.location.search
    try {
      if (!search && window.parent && window.parent !== window) {
        search = window.parent.location.search
      }
    } catch {}

    const params = new URLSearchParams(search)
    const roomParam = params.get('room') || params.get('sala')
    const nickParam = params.get('nick') || params.get('nome')

    if (nickParam) {
      dom.playerNameInput.value = nickParam
    }
    if (roomParam) {
      dom.joinCodeInput.value = roomParam.trim().toUpperCase()
      joinP2PRoom(roomParam.trim().toUpperCase())
    } else {
      render()
    }
  })
})()
