import * as THREE from '../../vendor/three.module.js'

// Posições dos pips anatômicos reais de baralho internacional (Bicycle/Copag)
const PIP_CONFIGS = {
  '5': [
    { x: 0.28, y: 0.24 },
    { x: 0.72, y: 0.24 },
    { x: 0.50, y: 0.50 },
    { x: 0.28, y: 0.76, invert: true },
    { x: 0.72, y: 0.76, invert: true },
  ],
  '6': [
    { x: 0.28, y: 0.24 },
    { x: 0.72, y: 0.24 },
    { x: 0.28, y: 0.50 },
    { x: 0.72, y: 0.50 },
    { x: 0.28, y: 0.76, invert: true },
    { x: 0.72, y: 0.76, invert: true },
  ],
  '7': [
    { x: 0.28, y: 0.24 },
    { x: 0.72, y: 0.24 },
    { x: 0.50, y: 0.37 },
    { x: 0.28, y: 0.50 },
    { x: 0.72, y: 0.50 },
    { x: 0.28, y: 0.76, invert: true },
    { x: 0.72, y: 0.76, invert: true },
  ],
  '8': [
    { x: 0.28, y: 0.22 },
    { x: 0.72, y: 0.22 },
    { x: 0.50, y: 0.36 },
    { x: 0.28, y: 0.50 },
    { x: 0.72, y: 0.50 },
    { x: 0.50, y: 0.64, invert: true },
    { x: 0.28, y: 0.78, invert: true },
    { x: 0.72, y: 0.78, invert: true },
  ],
  '9': [
    { x: 0.28, y: 0.20 },
    { x: 0.72, y: 0.20 },
    { x: 0.28, y: 0.40 },
    { x: 0.72, y: 0.40 },
    { x: 0.50, y: 0.50 },
    { x: 0.28, y: 0.60, invert: true },
    { x: 0.72, y: 0.60, invert: true },
    { x: 0.28, y: 0.80, invert: true },
    { x: 0.72, y: 0.80, invert: true },
  ],
  '10': [
    // 4 na coluna da esquerda
    { x: 0.28, y: 0.20 },
    { x: 0.28, y: 0.40 },
    { x: 0.28, y: 0.60, invert: true },
    { x: 0.28, y: 0.80, invert: true },
    // 2 na coluna do centro
    { x: 0.50, y: 0.30 },
    { x: 0.50, y: 0.70, invert: true },
    // 4 na coluna da direita
    { x: 0.72, y: 0.20 },
    { x: 0.72, y: 0.40 },
    { x: 0.72, y: 0.60, invert: true },
    { x: 0.72, y: 0.80, invert: true },
  ],
}

const SUIT_ORDER = ['diamonds', 'spades', 'hearts', 'clubs']
const FIXED_MANILHA = '10'

function getCardPowerInTrick(item) {
  if (!item || !item.card || item.covered || item.card.covered) return 0
  if (item.card.value === FIXED_MANILHA) {
    return 100 + SUIT_ORDER.indexOf(item.card.suit)
  }
  const idx = ['5', '6', '7', '8', '9'].indexOf(item.card.value)
  return idx >= 0 ? idx + 1 : 0
}

/**
 * Mesa 3D do Truco Goiano (Three.js)
 * Feltro verde de alta densidade, madeira mogno nobre envernizada,
 * SpotLight focal zenital com sombras macias, baralho físico 3D na mesa,
 * impacto tátil nas jogadas de cartas com micro-tremor de câmera,
 * anel de carta vencedora da vaza e recolhimento dinâmico (sweep).
 */
export function createTrucoTable(canvas, options = {}) {
  if (!canvas) {
    return {
      update: () => {},
      destroy: () => {},
      triggerCameraShake: () => {},
      sweepCards: () => {},
    }
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  const baseCamPos = new THREE.Vector3(0, 6.6, 3.7)
  const camera = new THREE.PerspectiveCamera(44, 1.6, 0.1, 100)
  camera.position.copy(baseCamPos)
  camera.lookAt(0, 0, -0.35)
  scene.add(camera)

  // Tremores de câmera
  let shakeUntil = 0
  let shakeIntensity = 0
  function triggerCameraShake(durationMs = 80, intensity = 0.05) {
    shakeUntil = performance.now() + durationMs
    shakeIntensity = intensity
  }

  // Parallax suave do mouse sobre a mesa
  const mouseTarget = { x: 0, y: 0 }
  const mouseCurrent = { x: 0, y: 0 }
  function handlePointerMove(e) {
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
    mouseTarget.x = nx * 0.18
    mouseTarget.y = ny * 0.12
  }
  window.addEventListener('pointermove', handlePointerMove, { passive: true })

  // 1. Iluminação: Luz Ambiente Hemisférica + Sol Direcional + SpotLight Zenital de Boteco
  const ambientLight = new THREE.HemisphereLight(0xfff7ed, 0x064e3b, 2.2)
  scene.add(ambientLight)

  const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.4)
  sunLight.position.set(-3.2, 11, 4.2)
  sunLight.castShadow = true
  sunLight.shadow.mapSize.set(1024, 1024)
  sunLight.shadow.camera.left = sunLight.shadow.camera.bottom = -7
  sunLight.shadow.camera.right = sunLight.shadow.camera.top = 7
  scene.add(sunLight)

  // SpotLight zenital quente e focal sobre o centro da mesa
  const tableSpot = new THREE.SpotLight(0xfff3db, 3.8, 16, Math.PI / 3.2, 0.65, 1.2)
  tableSpot.position.set(0, 8.2, 0)
  tableSpot.target.position.set(0, 0, -0.35)
  tableSpot.castShadow = true
  tableSpot.shadow.mapSize.set(1024, 1024)
  scene.add(tableSpot)
  scene.add(tableSpot.target)

  // 2. Mesa Oval: Base de Madeira Mogno Nobre com Chanfro
  const tableBase = new THREE.Mesh(
    new THREE.CylinderGeometry(5.2, 5.4, 0.45, 96),
    new THREE.MeshStandardMaterial({
      color: 0x160c07,
      roughness: 0.38,
      metalness: 0.22,
    })
  )
  tableBase.scale.z = 0.72
  tableBase.position.y = -0.24
  tableBase.receiveShadow = true
  scene.add(tableBase)

  // Feltro Verde Esmeralda Clássico de Bar / Boteco (topo em y = 0.06)
  const felt = new THREE.Mesh(
    new THREE.CylinderGeometry(4.85, 4.85, 0.08, 96),
    new THREE.MeshStandardMaterial({
      color: 0x073f26,
      roughness: 0.92,
      metalness: 0.04,
    })
  )
  felt.scale.z = 0.72
  felt.position.y = 0.02
  felt.receiveShadow = true
  scene.add(felt)

  // Aros ornamentados da borda da mesa (ouro envelhecido e esmeralda)
  const rims = [
    [4.96, 0.065, 0xd97706, 0.65],
    [4.65, 0.02, 0x10b981, 0.3],
    [4.5, 0.012, 0xf59e0b, 0.85],
  ]
  rims.forEach(([radius, tube, color, metal]) => {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(radius, tube, 8, 128),
      new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: 0.32 })
    )
    rim.rotation.x = Math.PI / 2
    rim.scale.y = 0.72
    rim.position.y = 0.06
    scene.add(rim)
  })

  // Partículas de luz e poeira dourada no ar
  const particleGeo = new THREE.BufferGeometry()
  const pCoords = []
  for (let i = 0; i < 90; i++) {
    pCoords.push((Math.random() - 0.5) * 20, Math.random() * 4.5 + 0.1, (Math.random() - 0.5) * 14)
  }
  particleGeo.setAttribute('position', new THREE.Float32BufferAttribute(pCoords, 3))
  const particles = new THREE.Points(
    particleGeo,
    new THREE.PointsMaterial({ color: 0xfde68a, size: 0.026, transparent: true, opacity: 0.4 })
  )
  scene.add(particles)

  // Geometria e texturas de cartas em escala de baralho físico (proporção 5/7)
  const cardGeo = new THREE.PlaneGeometry(1.28, 1.80)
  const texturesCache = new Map()

  function getCardTexture(card, isCovered = false) {
    const isManilha = card?.value === FIXED_MANILHA
    const key = isCovered ? 'back' : `${card?.value}_${card?.suit}_${isManilha ? 'm' : 'n'}`
    if (texturesCache.has(key)) return texturesCache.get(key)

    const c = document.createElement('canvas')
    c.width = 512
    c.height = 716
    const ctx = c.getContext('2d')

    if (isCovered || !card) {
      drawCanvasCardBack(ctx, 512, 716)
    } else {
      drawCanvasCardFace(ctx, 512, 716, card, isManilha)
    }

    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
    texturesCache.set(key, tex)
    return tex
  }

  function drawCanvasCardBack(ctx, w, h) {
    // Fundo branco com borda de cartão
    ctx.fillStyle = '#f8fafc'
    ctx.beginPath()
    ctx.roundRect(0, 0, w, h, 28)
    ctx.fill()

    // Borda interna azul Copag
    ctx.fillStyle = '#1e3a8a'
    ctx.beginPath()
    ctx.roundRect(16, 16, w - 32, h - 32, 20)
    ctx.fill()

    // Padrão de losangos clássico
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'
    ctx.lineWidth = 2.5
    for (let x = 20; x < w - 20; x += 28) {
      ctx.beginPath()
      ctx.moveTo(x, 18)
      ctx.lineTo(x + 220, h - 18)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x, 18)
      ctx.lineTo(x - 220, h - 18)
      ctx.stroke()
    }

    // Medalhão NBP Central
    ctx.fillStyle = '#0f172a'
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, 72, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 6
    ctx.stroke()

    ctx.fillStyle = '#fde68a'
    ctx.font = '900 46px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('TRUCO', w / 2, h / 2 - 8)
    ctx.font = '700 22px sans-serif'
    ctx.fillStyle = '#60a5fa'
    ctx.fillText('NBP', w / 2, h / 2 + 24)
  }

  function drawCanvasCardFace(ctx, w, h, card, isManilha) {
    // Fundo esbranquiçado de papel plastificado
    const bgGrad = ctx.createLinearGradient(0, 0, w, h)
    bgGrad.addColorStop(0, '#ffffff')
    bgGrad.addColorStop(0.7, '#faf9f5')
    bgGrad.addColorStop(1, '#f2efe9')
    ctx.fillStyle = bgGrad
    ctx.beginPath()
    ctx.roundRect(0, 0, w, h, 28)
    ctx.fill()

    // Borda externa
    ctx.strokeStyle = isManilha ? '#f59e0b' : '#cbd5e1'
    ctx.lineWidth = isManilha ? 8 : 4
    ctx.stroke()

    // Se for manilha, borda interna dourada brilhante
    if (isManilha) {
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.roundRect(14, 14, w - 28, h - 28, 18)
      ctx.stroke()

      // Faixa dourada no topo "MANILHA"
      ctx.fillStyle = '#f59e0b'
      ctx.beginPath()
      ctx.roundRect(w / 2 - 80, 10, 160, 26, 8)
      ctx.fill()
      ctx.fillStyle = '#1c1917'
      ctx.font = '900 16px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('★ MANILHA ★', w / 2, 23)
    }

    const isRed = card.suit === 'hearts' || card.suit === 'diamonds'
    const color = isRed ? '#dc2626' : '#0f172a'
    const suitSymbol =
      card.suit === 'spades' ? '♠' : card.suit === 'hearts' ? '♥' : card.suit === 'diamonds' ? '♦' : '♣'

    // Cantos superiores (índice + naipe)
    ctx.fillStyle = color
    ctx.font = '900 82px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(card.value, 56, 24)

    ctx.font = '68px sans-serif'
    ctx.fillText(suitSymbol, 56, 110)

    // Canto inferior invertido
    ctx.save()
    ctx.translate(w, h)
    ctx.rotate(Math.PI)
    ctx.font = '900 82px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(card.value, 56, 24)
    ctx.font = '68px sans-serif'
    ctx.fillText(suitSymbol, 56, 110)
    ctx.restore()

    // Centro: Pips reais posicionados anatomicamente
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const pipsList = PIP_CONFIGS[card.value]
    if (pipsList && pipsList.length > 0) {
      ctx.font = '66px sans-serif'
      pipsList.forEach((p) => {
        ctx.save()
        const px = p.x * w
        const py = p.y * h
        ctx.translate(px, py)
        if (p.invert) ctx.rotate(Math.PI)
        ctx.fillText(suitSymbol, 0, 0)
        ctx.restore()
      })
    } else {
      ctx.font = '114px sans-serif'
      ctx.fillText(suitSymbol, w / 2, h / 2)
    }
  }

  // 3. O BARALHO NA MESA (Monte virado para baixo no feltro verde)
  const deckGroup = new THREE.Group()
  const deckBackTexture = getCardTexture(null, true)
  const deckTopMat = new THREE.MeshStandardMaterial({
    map: deckBackTexture,
    roughness: 0.35,
    metalness: 0.05,
    side: THREE.DoubleSide,
  })

  // Bloco volumétrico do maço de cartas
  const deckBlock = new THREE.Mesh(
    new THREE.BoxGeometry(1.28, 0.12, 1.80),
    new THREE.MeshStandardMaterial({ color: 0xf5eedc, roughness: 0.7 })
  )
  deckBlock.position.set(-2.4, 0.12, -0.35)
  deckBlock.rotation.y = 0.08
  deckBlock.castShadow = true
  deckBlock.receiveShadow = true
  deckGroup.add(deckBlock)

  // Carta do topo do monte
  const deckTopCard = new THREE.Mesh(cardGeo, deckTopMat)
  deckTopCard.rotation.x = -Math.PI / 2
  deckTopCard.rotation.z = -0.08
  deckTopCard.position.set(-2.4, 0.185, -0.35)
  deckTopCard.castShadow = true
  deckGroup.add(deckTopCard)
  scene.add(deckGroup)

  // 4. Grupo de cartas pousadas no feltro 3D
  const tableCardsGroup = new THREE.Group()
  scene.add(tableCardsGroup)

  // 5. Anel / Brilho de Carta Vencedora Temporária da Vaza
  const winnerRingMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  })
  const winnerRing = new THREE.Mesh(new THREE.RingGeometry(0.82, 0.94, 48), winnerRingMat)
  winnerRing.rotation.x = Math.PI / 2
  winnerRing.position.set(0, 0.065, 0)
  winnerRing.visible = false
  scene.add(winnerRing)

  // Grupo de cartas voando / animando com pancada de truco
  const flyingCards = []

  // Grupo de cartas em varredura (trick sweep)
  const sweepingCards = []

  // Marcadores de jogadores ao redor da mesa
  const playersGroup = new THREE.Group()
  scene.add(playersGroup)

  function getSeatCoords(seatIndex, totalSeats) {
    if (totalSeats === 2) {
      if (seatIndex === 0) {
        return { x: 0, z: 2.4, rotY: 0, cardX: -0.74, cardZ: -0.35, cardRot: 0.04 }
      }
      return { x: 0, z: -2.4, rotY: Math.PI, cardX: 0.74, cardZ: -0.35, cardRot: -0.04 }
    }

    const angles = [0, -Math.PI / 2, Math.PI, Math.PI / 2]
    const rad = 2.3
    const a = angles[seatIndex % 4]

    const cardSpots = [
      { x: -0.65, z: 0.10, rot: 0.04 },
      { x: 0.78, z: -0.35, rot: -0.08 },
      { x: 0.50, z: -0.78, rot: 0.06 },
      { x: -0.78, z: -0.35, rot: -0.04 },
    ]
    const spot = cardSpots[seatIndex % 4]

    return {
      x: Math.sin(a) * rad * 1.35,
      z: Math.cos(a) * rad,
      rotY: a,
      cardX: spot.x,
      cardZ: spot.z,
      cardRot: spot.rot,
    }
  }

  // Lança a carta com arco enérgico, escala no ápice, rotação 180° se coberta e impacto forte (slap)
  function throwCardToTable(item, coords, playIdx, isLocal, key) {
    const origin = isLocal
      ? new THREE.Vector3(0, 1.4, 3.4)
      : new THREE.Vector3(coords.x * 0.9, 1.0, coords.z * 0.9)

    // Ângulo orgânico sutilmente randômico (-8° a +8°)
    const randomAngle = (Math.random() - 0.5) * 0.26
    const targetRotZ = coords.cardRot + randomAngle
    const targetPos = new THREE.Vector3(coords.cardX, 0.11 + playIdx * 0.016, coords.cardZ)

    const isCovered = !!(item.covered || item.card?.covered)
    const tex = getCardTexture(item.card, isCovered)
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.35,
      metalness: 0.02,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(cardGeo, mat)
    mesh.userData.key = key
    mesh.userData.item = item
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.position.copy(origin)

    // Se for carta coberta, o targetQuat tem rotação extra para simular a carta virando de bruços
    const targetEuler = new THREE.Euler(-Math.PI / 2, isCovered ? Math.PI : 0, targetRotZ)
    const targetQuat = new THREE.Quaternion().setFromEuler(targetEuler)

    const startEuler = isLocal
      ? new THREE.Euler(-0.4, 0, 0)
      : new THREE.Euler(-0.25, coords.rotY, 0)
    const startQuat = new THREE.Quaternion().setFromEuler(startEuler)
    mesh.quaternion.copy(startQuat)
    scene.add(mesh)

    flyingCards.push({
      key,
      mesh,
      origin,
      targetPos,
      startQuat,
      targetQuat,
      isCovered,
      start: performance.now(),
      duration: 380, // Duração rápida com aceleração forte (slap de Truco)
    })
  }

  let knownPlayedKeys = new Set()

  function update(state, localPlayerId) {
    if (!state) return

    const played = state.playedCardsInTrick || []

    if (played.length === 0) {
      if (knownPlayedKeys.size > 0 || tableCardsGroup.children.length > 0) {
        tableCardsGroup.clear()
        flyingCards.forEach((f) => scene.remove(f.mesh))
        flyingCards.length = 0
        knownPlayedKeys.clear()
        winnerRing.visible = false
      }
    } else {
      const totalPlayers = state.players?.length || 2
      const myIdx = Math.max(0, state.players?.findIndex((p) => p.id === localPlayerId))

      played.forEach((item, playIdx) => {
        const key = `${item.playerId}:${item.card?.value}:${item.card?.suit}:${playIdx}`
        const pIdx = state.players?.findIndex((p) => p.id === item.playerId)
        const relativeSeat = pIdx >= 0 ? (pIdx - myIdx + totalPlayers) % totalPlayers : playIdx
        const coords = getSeatCoords(relativeSeat, totalPlayers)
        const isLocal = item.playerId === localPlayerId

        if (!knownPlayedKeys.has(key)) {
          knownPlayedKeys.add(key)
          throwCardToTable(item, coords, playIdx, isLocal, key)
        } else {
          const isFlying = flyingCards.some((f) => f.key === key)
          const isPushed = tableCardsGroup.children.some((m) => m.userData.key === key)
          if (!isFlying && !isPushed) {
            const isCovered = !!(item.covered || item.card?.covered)
            const tex = getCardTexture(item.card, isCovered)
            const mat = new THREE.MeshStandardMaterial({
              map: tex,
              roughness: 0.35,
              metalness: 0.02,
              side: THREE.DoubleSide,
            })
            const mesh = new THREE.Mesh(cardGeo, mat)
            mesh.userData.key = key
            mesh.userData.item = item
            mesh.rotation.x = -Math.PI / 2
            if (isCovered) mesh.rotation.y = Math.PI
            mesh.rotation.z = coords.cardRot
            mesh.position.set(coords.cardX, 0.11 + playIdx * 0.016, coords.cardZ)
            mesh.castShadow = true
            mesh.receiveShadow = true
            tableCardsGroup.add(mesh)
          }
        }
      })

      // Atualiza carta vencedora e posiciona anel sob ela
      updateWinnerGlow(played)
    }

    // Atualizar anéis luminosos dos assentos dos jogadores
    playersGroup.clear()
    const all = state.players || []
    const totalPlayers = all.length || 2
    const myIdx = Math.max(0, all.findIndex((p) => p.id === localPlayerId))

    all.forEach((player, idx) => {
      const rel = (idx - myIdx + totalPlayers) % totalPlayers
      const coords = getSeatCoords(rel, totalPlayers)
      const isUs = idx % 2 === myIdx % 2
      const teamColor = isUs ? 0x10b981 : 0xf59e0b

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.24, 0.28, 32),
        new THREE.MeshBasicMaterial({ color: teamColor, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
      )
      ring.rotation.x = Math.PI / 2
      ring.position.set(coords.x * 0.88, 0.065, coords.z * 0.88)
      playersGroup.add(ring)
    })
  }

  function updateWinnerGlow(played) {
    if (!played || played.length === 0) {
      winnerRing.visible = false
      return
    }

    let maxPower = -1
    let leaderItem = null
    let isTied = false

    played.forEach((item) => {
      const p = getCardPowerInTrick(item)
      if (p > maxPower) {
        maxPower = p
        leaderItem = item
        isTied = false
      } else if (p === maxPower && maxPower > 0) {
        isTied = true
      }
    })

    if (!leaderItem || isTied || maxPower <= 0) {
      winnerRing.visible = false
      return
    }

    // Encontra a mesh correspondente na mesa
    const leaderKeyPrefix = `${leaderItem.playerId}:${leaderItem.card?.value}:${leaderItem.card?.suit}:`
    let targetMesh = tableCardsGroup.children.find((m) => m.userData.key?.startsWith(leaderKeyPrefix))
    if (!targetMesh) {
      const flying = flyingCards.find((f) => f.key?.startsWith(leaderKeyPrefix))
      if (flying) targetMesh = flying.mesh
    }

    if (targetMesh) {
      winnerRing.position.x = targetMesh.position.x
      winnerRing.position.z = targetMesh.position.z
      winnerRing.position.y = 0.065
      winnerRing.visible = true
    } else {
      winnerRing.visible = false
    }
  }

  // Animação de varredura das cartas para o lado da equipe vencedora
  function sweepCards(winningTeam, onComplete) {
    winnerRing.visible = false
    const cardsToSweep = [...tableCardsGroup.children]
    if (cardsToSweep.length === 0) {
      if (onComplete) onComplete()
      return
    }

    tableCardsGroup.clear()
    const targetZ = winningTeam === 'us' ? 4.2 : winningTeam === 'them' ? -4.2 : 0

    cardsToSweep.forEach((mesh) => {
      scene.add(mesh)
      sweepingCards.push({
        mesh,
        originPos: mesh.position.clone(),
        targetPos: new THREE.Vector3(mesh.position.x * 0.4, mesh.position.y + 0.15, targetZ),
        start: performance.now(),
        duration: 420,
      })
    })

    if (options.onSweep) options.onSweep()

    setTimeout(() => {
      if (onComplete) onComplete()
    }, 450)
  }

  // Loop de Renderização e Animação
  let animId = null
  function animate(t) {
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    if (width > 20 && height > 20) {
      const targetW = Math.floor(width * renderer.getPixelRatio())
      const targetH = Math.floor(height * renderer.getPixelRatio())
      if (canvas.width !== targetW || canvas.height !== targetH) {
        renderer.setSize(width, height, false)
        camera.aspect = width / height
        camera.updateProjectionMatrix()
      }
    }

    // Parallax suave
    mouseCurrent.x += (mouseTarget.x - mouseCurrent.x) * 0.05
    mouseCurrent.y += (mouseTarget.y - mouseCurrent.y) * 0.05

    // Tremor de câmera pós-pancada (slap) ou pós-grito
    let shakeOffset = { x: 0, y: 0, z: 0 }
    if (t < shakeUntil) {
      const remain = (shakeUntil - t) / 80
      shakeOffset.x = (Math.random() - 0.5) * shakeIntensity * remain
      shakeOffset.y = (Math.random() - 0.5) * shakeIntensity * remain
      shakeOffset.z = (Math.random() - 0.5) * shakeIntensity * remain
    }

    camera.position.set(
      baseCamPos.x + mouseCurrent.x + shakeOffset.x,
      baseCamPos.y + mouseCurrent.y + shakeOffset.y,
      baseCamPos.z + shakeOffset.z
    )
    camera.lookAt(0, 0, -0.35)

    // Animação de cartas sendo jogadas (arco parabólico alto + aceleração de pancada)
    for (let i = flyingCards.length - 1; i >= 0; i--) {
      const f = flyingCards[i]
      const elapsed = t - f.start
      const progress = Math.min(1, elapsed / f.duration)

      // Curva de interpolação com impacto seco (power4.out)
      const eased = 1 - Math.pow(1 - progress, 4)

      f.mesh.position.copy(f.origin).lerp(f.targetPos, eased)
      // Arco parabólico vigoroso com elevação
      f.mesh.position.y += Math.sin(Math.PI * progress) * 1.45

      // Escala maior no ápice do vôo (1.22x)
      const scaleBump = 1 + Math.sin(Math.PI * progress) * 0.22
      f.mesh.scale.set(scaleBump, scaleBump, scaleBump)

      f.mesh.quaternion.copy(f.startQuat).slerp(f.targetQuat, eased)

      if (progress >= 1) {
        f.mesh.position.copy(f.targetPos)
        f.mesh.scale.set(1, 1, 1)
        f.mesh.quaternion.copy(f.targetQuat)
        scene.remove(f.mesh)
        tableCardsGroup.add(f.mesh)
        flyingCards.splice(i, 1)

        // Impacto no feltro: micro-tremor de 80ms e áudio slap
        triggerCameraShake(80, 0.055)
        if (options.onSlam) options.onSlam()
      }
    }

    // Animação de varredura (sweeping) das cartas
    for (let i = sweepingCards.length - 1; i >= 0; i--) {
      const s = sweepingCards[i]
      const elapsed = t - s.start
      const progress = Math.min(1, elapsed / s.duration)
      const eased = Math.pow(progress, 2.5) // Acelera saindo da mesa

      s.mesh.position.copy(s.originPos).lerp(s.targetPos, eased)
      s.mesh.scale.setScalar(Math.max(0.01, 1 - progress * 0.6))

      if (progress >= 1) {
        scene.remove(s.mesh)
        sweepingCards.splice(i, 1)
      }
    }

    // Pulsação suave do anel de carta vencedora
    if (winnerRing.visible) {
      winnerRingMat.opacity = 0.65 + Math.sin(t * 0.007) * 0.25
    }

    particles.rotation.y = t * 0.00008
    renderer.render(scene, camera)
    animId = requestAnimationFrame(animate)
  }
  animId = requestAnimationFrame(animate)

  function destroy() {
    if (animId) cancelAnimationFrame(animId)
    window.removeEventListener('pointermove', handlePointerMove)
    renderer.dispose()
  }

  return {
    update,
    destroy,
    triggerCameraShake,
    sweepCards,
  }
}
