;(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory()
  } else {
    root.EKEngine = factory()
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const CARD_TYPES = {
    ek: {
      type: 'ek',
      name: 'Exploding Kitten',
      shortName: 'Exploding Kitten',
      color: '#1f1b18',
      accent: '#ff6d00',
      playableInTurn: false,
      description: 'Se comprar esta carta sem ter um Desarme, você explode e sai do jogo!',
    },
    defuse: {
      type: 'defuse',
      name: 'Desarme',
      shortName: 'Desarme',
      color: '#689f38',
      accent: '#aed581',
      playableInTurn: false,
      description: 'Salva você de um Exploding Kitten e permite devolvê-lo secretamente ao baralho.',
    },
    attack: {
      type: 'attack',
      name: 'Ataque',
      shortName: 'Ataque',
      color: '#ef6c00',
      accent: '#ffb74d',
      playableInTurn: true,
      description: 'Termine seu turno sem comprar e obrigue o próximo jogador a jogar 2 vezes seguidas.',
    },
    skip: {
      type: 'skip',
      name: 'Pulo',
      shortName: 'Pulo',
      color: '#0288d1',
      accent: '#4fc3f7',
      playableInTurn: true,
      description: 'Termine seu turno imediatamente sem comprar nenhuma carta.',
    },
    favor: {
      type: 'favor',
      name: 'Presente',
      shortName: 'Presente',
      color: '#3e3a35',
      accent: '#bcaaa4',
      playableInTurn: true,
      needsTarget: true,
      description: 'Obrigue outro jogador a escolher 1 carta da mão dele para dar a você.',
    },
    shuffle: {
      type: 'shuffle',
      name: 'Embaralhar',
      shortName: 'Embaralhar',
      color: '#8d6e63',
      accent: '#d7ccc8',
      playableInTurn: true,
      description: 'Embaralhe completamente a Pilha de Compra.',
    },
    future: {
      type: 'future',
      name: 'Veja o Futuro',
      shortName: 'Veja o Futuro',
      color: '#d81b60',
      accent: '#f48fb1',
      playableInTurn: true,
      description: 'Veja secretamente as 3 cartas do topo da Pilha de Compra.',
    },
    nope: {
      type: 'nope',
      name: 'Não!',
      shortName: 'Não!',
      color: '#c62828',
      accent: '#ef9a9a',
      playableInTurn: false,
      isReaction: true,
      description: 'Cancele a ação de outro jogador a qualquer momento (exceto Exploding Kitten e Desarme).',
    },
    cat_rainbow: {
      type: 'cat_rainbow',
      name: 'Gato Arco-Íris',
      shortName: 'Arco-Íris',
      color: '#546e7a',
      accent: '#ffd54f',
      playableInTurn: false,
      isCat: true,
      description: 'Carta de gato! Jogue 2 iguais para roubar 1 carta aleatória, ou 3 iguais para pedir uma carta específica.',
    },
    cat_potato: {
      type: 'cat_potato',
      name: 'Gato Batata',
      shortName: 'Batata',
      color: '#795548',
      accent: '#d7ccc8',
      playableInTurn: false,
      isCat: true,
      description: 'Carta de gato! Jogue em combos de 2, 3 ou 5 cartas diferentes.',
    },
    cat_melon: {
      type: 'cat_melon',
      name: 'Melancigato',
      shortName: 'Melancigato',
      color: '#2e7d32',
      accent: '#a5d6a7',
      playableInTurn: false,
      isCat: true,
      description: 'Carta de gato! Jogue em combos de 2, 3 ou 5 cartas diferentes.',
    },
    cat_beard: {
      type: 'cat_beard',
      name: 'Barba-Gato',
      shortName: 'Barba-Gato',
      color: '#424242',
      accent: '#bdbdbd',
      playableInTurn: false,
      isCat: true,
      description: 'Carta de gato! Jogue em combos de 2, 3 ou 5 cartas diferentes.',
    },
    cat_taco: {
      type: 'cat_taco',
      name: 'Tacogato',
      shortName: 'Tacogato',
      color: '#f9a825',
      accent: '#fff59d',
      playableInTurn: false,
      isCat: true,
      description: 'Carta de gato! Jogue em combos de 2, 3 ou 5 cartas diferentes.',
    },
  }

  const CARD_DEFINITIONS = [
    // Ataque (4)
    { type: 'attack', img: './cards/ataque-1.png', subtitle: 'Tentáculo de Lula' },
    { type: 'attack', img: './cards/ataque-2.png', subtitle: 'Pintos de Borracha' },
    { type: 'attack', img: './cards/ataque-3.png', subtitle: 'Pinguim com Diarreia' },
    { type: 'attack', img: './cards/ataque-4.png', subtitle: 'Coelhos de Tortura' },
    // Desarme (6)
    { type: 'defuse', img: './cards/desarme-1.png', subtitle: 'Caneta Laser' },
    { type: 'defuse', img: './cards/desarme-2.png', subtitle: 'Gatoterapia' },
    { type: 'defuse', img: './cards/desarme-3.png', subtitle: 'Sanduíches Mordidos' },
    { type: 'defuse', img: './cards/desarme-4.png', subtitle: 'Gatoyoga' },
    { type: 'defuse', img: './cards/desarme-5.png', subtitle: 'Carinhos na Barriga' },
    { type: 'defuse', img: './cards/desarme-6.png', subtitle: 'Flatulências das 3:00' },
    // Embaralhar (4)
    { type: 'shuffle', img: './cards/embaralhar-1.png', subtitle: 'Dragão de Aspargos' },
    { type: 'shuffle', img: './cards/embaralhar-2.png', subtitle: 'Lobisomem na Privada' },
    { type: 'shuffle', img: './cards/embaralhar-3.png', subtitle: 'Kraken Chateado' },
    { type: 'shuffle', img: './cards/embaralhar-4.png', subtitle: 'Bebê Coruja' },
    // Não! (5)
    { type: 'nope', img: './cards/nao-1.png', subtitle: 'Pula Corda' },
    { type: 'nope', img: './cards/nao-1.png', subtitle: 'Pula Corda' },
    { type: 'nope', img: './cards/nao-2.png', subtitle: 'Gravatas de Nãos' },
    { type: 'nope', img: './cards/nao-3.png', subtitle: 'Papa do Não' },
    { type: 'nope', img: './cards/nao-4.png', subtitle: 'Desperte o Não' },
    // Presente (4)
    { type: 'favor', img: './cards/presente-1.png', subtitle: 'Howrowrow' },
    { type: 'favor', img: './cards/presente-2.png', subtitle: 'Se Apaixonar' },
    { type: 'favor', img: './cards/presente-3.png', subtitle: 'Novo Palíndromo' },
    { type: 'favor', img: './cards/presente-4.png', subtitle: 'Ciência dos Gatos' },
    // Pulo (4)
    { type: 'skip', img: './cards/pulo-1.png', subtitle: 'Balão Livre' },
    { type: 'skip', img: './cards/pulo-2.png', subtitle: 'Baleia Animada' },
    { type: 'skip', img: './cards/pulo-3.png', subtitle: 'Peitos de Velha' },
    { type: 'skip', img: './cards/pulo-4.png', subtitle: 'Cuecas do Pé-Grande' },
    // Veja o Futuro (5)
    { type: 'future', img: './cards/futuro-1.png', subtitle: 'Enchilada de Unicórnio' },
    { type: 'future', img: './cards/futuro-2.png', subtitle: 'Coelhos Special-Ops' },
    { type: 'future', img: './cards/futuro-3.png', subtitle: 'Barriga do Porco' },
    { type: 'future', img: './cards/futuro-4.png', subtitle: 'Cabra que Tudo Vê' },
    { type: 'future', img: './cards/futuro-5.png', subtitle: 'Mago dos Segredos' },
    // Exploding Kitten (4)
    { type: 'ek', img: './cards/ek-1.png', subtitle: 'Casa em Chamas' },
    { type: 'ek', img: './cards/ek-2.png', subtitle: 'Cientista Explosivo' },
    { type: 'ek', img: './cards/ek-3.png', subtitle: 'Navio de TNT' },
    { type: 'ek', img: './cards/ek-4.png', subtitle: 'Núcleo de Dobra' },
    // Gatos (20 = 4 de cada)
    ...Array.from({ length: 4 }, () => ({ type: 'cat_rainbow', img: './cards/gato-arcoiris.png', subtitle: 'Gato Arco-Íris' })),
    ...Array.from({ length: 4 }, () => ({ type: 'cat_potato', img: './cards/gato-batata.png', subtitle: 'Gato Batata' })),
    ...Array.from({ length: 4 }, () => ({ type: 'cat_melon', img: './cards/gato-melancia.png', subtitle: 'Melancigato' })),
    ...Array.from({ length: 4 }, () => ({ type: 'cat_beard', img: './cards/gato-barba.png', subtitle: 'Barba-Gato' })),
    ...Array.from({ length: 4 }, () => ({ type: 'cat_taco', img: './cards/gato-taco.png', subtitle: 'Tacogato' })),
  ]

  function shuffleArray(arr, rng = Math.random) {
    const copy = arr.slice()
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      const tmp = copy[i]
      copy[i] = copy[j]
      copy[j] = tmp
    }
    return copy
  }

  function createFullDeck() {
    return CARD_DEFINITIONS.map((def, idx) => ({
      id: `c_${idx + 1}_${def.type}`,
      type: def.type,
      name: CARD_TYPES[def.type].name,
      subtitle: def.subtitle,
      img: def.img,
    }))
  }

  function createMatchState(playerProfiles, options = {}) {
    const count = playerProfiles.length
    if (count < 2 || count > 5) {
      throw new Error('Exploding Kittens suporta de 2 a 5 jogadores.')
    }
    const rng = options.rng || Math.random
    const allCards = createFullDeck()
    const eks = shuffleArray(allCards.filter((c) => c.type === 'ek'), rng)
    const defuses = shuffleArray(allCards.filter((c) => c.type === 'defuse'), rng)
    const baseDeck = shuffleArray(
      allCards.filter((c) => c.type !== 'ek' && c.type !== 'defuse'),
      rng
    )

    // 7 cartas normais + 1 Desarme para cada jogador
    const players = playerProfiles.map((prof) => {
      const hand = baseDeck.splice(0, 7)
      hand.push(defuses.pop())
      return {
        id: prof.id,
        name: prof.name,
        isHost: !!prof.isHost,
        isBot: !!prof.isBot,
        alive: true,
        hand,
        explodedBy: null,
      }
    })

    // Regra oficial: em 2 jogadores, apenas 2 cartas Desarme extras voltam ao baralho
    const extraDefusesToReturn = count === 2 ? defuses.slice(0, 2) : defuses
    const activeEks = eks.slice(0, count - 1)
    const drawPile = shuffleArray([...baseDeck, ...extraDefusesToReturn, ...activeEks], rng)

    return {
      phase: 'playing', // playing | nope_window | choose_favor_give | defuse_insert | finished
      players,
      currentPlayerIndex: 0,
      turnsRemaining: 1,
      drawPile,
      discardPile: [],
      pendingAction: null,
      defusePending: null, // { playerId, ekCard }
      favorPending: null, // { fromId, toId }
      futurePeek: null, // { playerId, cards: [...] }
      winnerId: null,
      turnCounter: 1,
      log: ['Partida iniciada! Cada treinador recebeu 7 cartas + 1 Desarme.'],
    }
  }

  function validateSelection(cards, discardPileLength = 0) {
    if (!Array.isArray(cards) || cards.length === 0) {
      return { valid: false, reason: 'Selecione uma carta ou combo para jogar.' }
    }
    if (cards.length === 1) {
      const card = cards[0]
      const meta = CARD_TYPES[card.type]
      if (!meta || !meta.playableInTurn) {
        return {
          valid: false,
          reason:
            card.type === 'nope'
              ? '"Não!" só pode ser jogada como reação à ação de outro jogador.'
              : 'Esta carta não pode ser jogada sozinha. Selecione 2, 3 iguais ou 5 diferentes!',
        }
      }
      return { valid: true, kind: 'single', cardType: card.type }
    }
    if (cards.length === 2) {
      if (cards[0].type !== cards[1].type) {
        return { valid: false, reason: 'Para um Par, as 2 cartas precisam ser do mesmo tipo.' }
      }
      if (cards[0].type === 'ek') {
        return { valid: false, reason: 'Exploding Kitten não pode ser jogado em combo.' }
      }
      return { valid: true, kind: 'combo2', cardType: cards[0].type }
    }
    if (cards.length === 3) {
      if (cards[0].type !== cards[1].type || cards[1].type !== cards[2].type) {
        return { valid: false, reason: 'Para um Trio, as 3 cartas precisam ser do mesmo tipo.' }
      }
      if (cards[0].type === 'ek') {
        return { valid: false, reason: 'Exploding Kitten não pode ser jogado em combo.' }
      }
      return { valid: true, kind: 'combo3', cardType: cards[0].type }
    }
    if (cards.length === 5) {
      const types = new Set(cards.map((c) => c.type))
      if (types.size !== 5) {
        return { valid: false, reason: 'Para o Combo de 5, todas as 5 cartas devem ter tipos diferentes.' }
      }
      if (discardPileLength === 0) {
        return { valid: false, reason: 'A Pilha de Descartes está vazia no momento.' }
      }
      return { valid: true, kind: 'combo5' }
    }
    return {
      valid: false,
      reason: 'Combinações válidas: 1 carta de ação, 2 iguais, 3 iguais ou 5 diferentes.',
    }
  }

  function getNextAliveIndex(players, fromIndex) {
    const n = players.length
    for (let step = 1; step <= n; step++) {
      const idx = (fromIndex + step) % n
      if (players[idx].alive) return idx
    }
    return fromIndex
  }

  function advanceTurn(state, forceNextPlayer = false) {
    const aliveCount = state.players.filter((p) => p.alive).length
    if (aliveCount <= 1) {
      const winner = state.players.find((p) => p.alive)
      state.phase = 'finished'
      state.winnerId = winner ? winner.id : null
      return state
    }

    if (!forceNextPlayer && state.turnsRemaining > 1 && state.players[state.currentPlayerIndex]?.alive) {
      state.turnsRemaining -= 1
    } else {
      state.currentPlayerIndex = getNextAliveIndex(state.players, state.currentPlayerIndex)
      state.turnsRemaining = 1
    }
    state.turnCounter += 1
    return state
  }

  function declarePlay(state, playerId, cardIds, options = {}) {
    if (state.phase !== 'playing') {
      return { ok: false, error: 'Aguarde a resolução da ação atual.' }
    }
    const current = state.players[state.currentPlayerIndex]
    if (!current || current.id !== playerId || !current.alive) {
      return { ok: false, error: 'Não é o seu turno.' }
    }

    const cards = cardIds.map((id) => current.hand.find((c) => c.id === id)).filter(Boolean)
    if (cards.length !== cardIds.length) {
      return { ok: false, error: 'Carta não encontrada na mão.' }
    }

    const check = validateSelection(cards, state.discardPile.length)
    if (!check.valid) {
      return { ok: false, error: check.reason }
    }

    const needsTarget =
      (check.kind === 'single' && check.cardType === 'favor') ||
      check.kind === 'combo2' ||
      check.kind === 'combo3'

    if (needsTarget) {
      const target = state.players.find((p) => p.id === options.targetId && p.alive && p.id !== playerId)
      if (!target) {
        return { ok: false, error: 'Escolha um jogador alvo válido.' }
      }
      if (target.hand.length === 0) {
        return { ok: false, error: `${target.name} não possui cartas na mão.` }
      }
    }

    if (check.kind === 'combo3' && !CARD_TYPES[options.requestedType]) {
      return { ok: false, error: 'Escolha qual carta deseja pedir no Trio.' }
    }

    if (check.kind === 'combo5') {
      const wanted = state.discardPile.find((c) => c.id === options.discardCardId)
      if (!wanted) {
        return { ok: false, error: 'Escolha uma carta válida da Pilha de Descartes.' }
      }
    }

    // Remove cartas da mão e coloca no descarte
    const idSet = new Set(cardIds)
    current.hand = current.hand.filter((c) => !idSet.has(c.id))
    state.discardPile.push(...cards)
    state.futurePeek = null

    const now = options.now || Date.now()
    const nopeWindowMs = options.nopeWindowMs ?? 4500

    state.phase = 'nope_window'
    state.pendingAction = {
      id: `act_${now}_${Math.random().toString(36).slice(2, 6)}`,
      actorId: playerId,
      actorName: current.name,
      kind: check.kind,
      cardType: check.cardType || null,
      cards,
      targetId: options.targetId || null,
      requestedType: options.requestedType || null,
      discardCardId: options.discardCardId || null,
      nopeCount: 0,
      lastNopeBy: null,
      deadline: now + nopeWindowMs,
    }

    const label =
      check.kind === 'single'
        ? CARD_TYPES[check.cardType].name
        : check.kind === 'combo2'
          ? `Par de ${CARD_TYPES[check.cardType].shortName}`
          : check.kind === 'combo3'
            ? `Trio de ${CARD_TYPES[check.cardType].shortName}`
            : 'Combo de 5 Cartas Diferentes'

    state.log.unshift(`${current.name} jogou ${label}!`)
    state.log = state.log.slice(0, 30)

    return { ok: true, pendingAction: state.pendingAction }
  }

  function playNope(state, playerId, cardId, options = {}) {
    if (state.phase !== 'nope_window' || !state.pendingAction) {
      return { ok: false, error: 'Não há ação aguardando reação.' }
    }
    const player = state.players.find((p) => p.id === playerId && p.alive)
    if (!player) {
      return { ok: false, error: 'Jogador inválido.' }
    }
    // Quem acabou de jogar a ação (ou o último Não) não precisa anular a si mesmo
    const lastActor = state.pendingAction.lastNopeBy || state.pendingAction.actorId
    if (lastActor === playerId) {
      return { ok: false, error: 'Aguarde outro jogador reagir.' }
    }

    const nopeCard = cardId
      ? player.hand.find((c) => c.id === cardId && c.type === 'nope')
      : player.hand.find((c) => c.type === 'nope')
    if (!nopeCard) {
      return { ok: false, error: 'Você não possui nenhuma carta "Não!".' }
    }

    player.hand = player.hand.filter((c) => c.id !== nopeCard.id)
    state.discardPile.push(nopeCard)
    state.pendingAction.nopeCount += 1
    state.pendingAction.lastNopeBy = playerId

    const now = options.now || Date.now()
    const nopeWindowMs = options.nopeWindowMs ?? 4000
    state.pendingAction.deadline = now + nopeWindowMs

    const isSim = state.pendingAction.nopeCount % 2 === 0
    state.log.unshift(
      isSim
        ? `${player.name} jogou NÃO! no NÃO! (Virou SIM!)`
        : `${player.name} jogou NÃO! Tentando cancelar a jogada!`
    )
    state.log = state.log.slice(0, 30)

    return { ok: true, nopeCount: state.pendingAction.nopeCount, isCanceled: !isSim }
  }

  function resolvePendingAction(state, rng = Math.random) {
    if (state.phase !== 'nope_window' || !state.pendingAction) {
      return { ok: false, error: 'Nenhuma ação pendente.' }
    }

    const act = state.pendingAction
    state.pendingAction = null

    // Ímpar = anulada!
    if (act.nopeCount % 2 === 1) {
      state.phase = 'playing'
      state.log.unshift(`A jogada de ${act.actorName} foi ANULADA pelo NÃO!`)
      state.log = state.log.slice(0, 30)
      return { ok: true, canceled: true }
    }

    const actor = state.players.find((p) => p.id === act.actorId)
    state.phase = 'playing'

    if (act.kind === 'single') {
      switch (act.cardType) {
        case 'skip': {
          state.log.unshift(`${actor.name} pulou o turno sem comprar carta.`)
          advanceTurn(state, false)
          break
        }
        case 'attack': {
          const nextIdx = getNextAliveIndex(state.players, state.currentPlayerIndex)
          state.currentPlayerIndex = nextIdx
          state.turnsRemaining = 2
          state.turnCounter += 1
          state.log.unshift(
            `${actor.name} atacou ${state.players[nextIdx].name}! Agora ${state.players[nextIdx].name} joga 2 vezes seguidas!`
          )
          break
        }
        case 'shuffle': {
          state.drawPile = shuffleArray(state.drawPile, rng)
          state.log.unshift(`${actor.name} embaralhou a Pilha de Compra!`)
          break
        }
        case 'future': {
          const top3 = state.drawPile.slice(0, 3)
          state.futurePeek = { playerId: actor.id, cards: top3 }
          state.log.unshift(`${actor.name} espiou as 3 cartas do topo do baralho.`)
          break
        }
        case 'favor': {
          const target = state.players.find((p) => p.id === act.targetId && p.alive)
          if (target && target.hand.length > 0) {
            state.phase = 'choose_favor_give'
            state.favorPending = { fromId: target.id, toId: actor.id }
            state.log.unshift(`${actor.name} pediu um Presente para ${target.name}.`)
          }
          break
        }
      }
    } else if (act.kind === 'combo2') {
      const target = state.players.find((p) => p.id === act.targetId && p.alive)
      if (target && target.hand.length > 0) {
        const randIdx = Math.floor(rng() * target.hand.length)
        const [stolen] = target.hand.splice(randIdx, 1)
        actor.hand.push(stolen)
        state.log.unshift(`${actor.name} roubou 1 carta aleatória de ${target.name} com um Par!`)
      }
    } else if (act.kind === 'combo3') {
      const target = state.players.find((p) => p.id === act.targetId && p.alive)
      const reqName = CARD_TYPES[act.requestedType]?.name || act.requestedType
      if (target) {
        const foundIdx = target.hand.findIndex((c) => c.type === act.requestedType)
        if (foundIdx >= 0) {
          const [stolen] = target.hand.splice(foundIdx, 1)
          actor.hand.push(stolen)
          state.log.unshift(`${actor.name} acertou o Trio e pegou ${reqName} de ${target.name}!`)
        } else {
          state.log.unshift(`${actor.name} pediu ${reqName}, mas ${target.name} não tinha!`)
        }
      }
    } else if (act.kind === 'combo5') {
      const idx = state.discardPile.findIndex((c) => c.id === act.discardCardId)
      if (idx >= 0) {
        const [picked] = state.discardPile.splice(idx, 1)
        actor.hand.push(picked)
        state.log.unshift(`${actor.name} recuperou ${picked.name} da Pilha de Descartes!`)
      }
    }

    state.log = state.log.slice(0, 30)
    return { ok: true, canceled: false, action: act }
  }

  function resolveFavorGive(state, fromId, cardId) {
    if (state.phase !== 'choose_favor_give' || !state.favorPending) {
      return { ok: false, error: 'Nenhum pedido de Presente pendente.' }
    }
    if (state.favorPending.fromId !== fromId) {
      return { ok: false, error: 'Não é você quem deve entregar a carta.' }
    }
    const fromPlayer = state.players.find((p) => p.id === fromId)
    const toPlayer = state.players.find((p) => p.id === state.favorPending.toId)
    const idx = fromPlayer?.hand.findIndex((c) => c.id === cardId) ?? -1
    if (idx < 0) {
      return { ok: false, error: 'Carta inválida.' }
    }
    const [given] = fromPlayer.hand.splice(idx, 1)
    toPlayer.hand.push(given)
    state.favorPending = null
    state.phase = 'playing'
    state.log.unshift(`${fromPlayer.name} entregou 1 carta de Presente para ${toPlayer.name}.`)
    state.log = state.log.slice(0, 30)
    return { ok: true, given }
  }

  function drawCard(state, playerId) {
    if (state.phase !== 'playing') {
      return { ok: false, error: 'Aguarde a resolução da ação atual.' }
    }
    const current = state.players[state.currentPlayerIndex]
    if (!current || current.id !== playerId || !current.alive) {
      return { ok: false, error: 'Não é o seu turno.' }
    }
    if (state.drawPile.length === 0) {
      return { ok: false, error: 'A Pilha de Compra acabou!' }
    }

    state.futurePeek = null
    const drawn = state.drawPile.shift()

    if (drawn.type !== 'ek') {
      current.hand.push(drawn)
      state.log.unshift(`${current.name} comprou uma carta e sobreviveu.`)
      state.log = state.log.slice(0, 30)
      advanceTurn(state, false)
      return { ok: true, outcome: 'safe', card: drawn }
    }

    // Comprou Exploding Kitten!
    const defuseIdx = current.hand.findIndex((c) => c.type === 'defuse')
    if (defuseIdx >= 0) {
      const [defuseCard] = current.hand.splice(defuseIdx, 1)
      state.discardPile.push(defuseCard)
      state.phase = 'defuse_insert'
      state.defusePending = {
        playerId: current.id,
        ekCard: drawn,
        defuseCard,
      }
      state.log.unshift(`${current.name} comprou um EXPLODING KITTEN, mas usou DESARME!`)
      state.log = state.log.slice(0, 30)
      return { ok: true, outcome: 'defused', card: drawn, defuseCard }
    }

    // KABOOM! Sem Desarme -> eliminado!
    current.alive = false
    current.explodedBy = drawn
    state.discardPile.push(drawn)
    state.log.unshift(`KABOOM! ${current.name} comprou um Exploding Kitten sem Desarme e EXPLODIU!`)
    state.log = state.log.slice(0, 30)
    advanceTurn(state, true)
    return { ok: true, outcome: 'exploded', card: drawn }
  }

  function insertDefusedKitten(state, playerId, positionIndex) {
    if (state.phase !== 'defuse_insert' || !state.defusePending) {
      return { ok: false, error: 'Nenhum Exploding Kitten pendente para devolver.' }
    }
    if (state.defusePending.playerId !== playerId) {
      return { ok: false, error: 'Outro jogador está desarmando o gatinho.' }
    }
    const maxPos = state.drawPile.length
    const clamped = Math.max(0, Math.min(maxPos, Math.floor(positionIndex)))
    state.drawPile.splice(clamped, 0, state.defusePending.ekCard)
    state.defusePending = null
    state.phase = 'playing'

    const player = state.players.find((p) => p.id === playerId)
    state.log.unshift(`${player?.name || 'Jogador'} devolveu o Exploding Kitten secretamente ao baralho.`)
    state.log = state.log.slice(0, 30)
    advanceTurn(state, false)
    return { ok: true, position: clamped }
  }

  return {
    CARD_TYPES,
    CARD_DEFINITIONS,
    shuffleArray,
    createFullDeck,
    createMatchState,
    validateSelection,
    declarePlay,
    playNope,
    resolvePendingAction,
    resolveFavorGive,
    drawCard,
    insertDefusedKitten,
    getNextAliveIndex,
  }
})
