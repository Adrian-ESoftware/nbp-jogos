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
    // 2 na coluna do centro (superior e inferior invertido)
    { x: 0.50, y: 0.30 },
    { x: 0.50, y: 0.70, invert: true },
    // 4 na coluna da direita
    { x: 0.72, y: 0.20 },
    { x: 0.72, y: 0.40 },
    { x: 0.72, y: 0.60, invert: true },
    { x: 0.72, y: 0.80, invert: true },
  ],
}

/**
 * Mesa 3D do Truco Goiano (Three.js)
 * Feltro verde de alta densidade, iluminação suave, baralho 3D clássico na mesa
 * e cartas da vaza jogadas com arco suave no feltro central.
 */
export function createTrucoTable(canvas) {
  if (!canvas) return { update: () => {}, destroy: () => {} }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(40, 1.6, 0.1, 100)
  camera.position.set(0, 6.8, 8.4)
  camera.lookAt(0, 0, -0.45)
  scene.add(camera)

  // Iluminação
  const ambientLight = new THREE.HemisphereLight(0xdcfce7, 0x052e16, 2.2)
  scene.add(ambientLight)

  const sunLight = new THREE.DirectionalLight(0xffedd5, 2.8)
  sunLight.position.set(-3.5, 11, 5.5)
  sunLight.castShadow = true
  sunLight.shadow.mapSize.set(1024, 1024)
  sunLight.shadow.camera.left = sunLight.shadow.camera.bottom = -7
  sunLight.shadow.camera.right = sunLight.shadow.camera.top = 7
  scene.add(sunLight)

  // Mesa Oval: Base de Madeira Mogno Nobre
  const tableBase = new THREE.Mesh(
    new THREE.CylinderGeometry(5.2, 5.4, 0.45, 96),
    new THREE.MeshStandardMaterial({
      color: 0x1b130e,
      roughness: 0.45,
      metalness: 0.25,
    })
  )
  tableBase.scale.z = 0.72
  tableBase.position.y = -0.24
  tableBase.receiveShadow = true
  scene.add(tableBase)

  // Feltro Verde Esmeralda Clássico (topo em y = 0.06)
  const felt = new THREE.Mesh(
    new THREE.CylinderGeometry(4.85, 4.85, 0.08, 96),
    new THREE.MeshStandardMaterial({
      color: 0x064e3b,
      roughness: 0.94,
      metalness: 0.05,
    })
  )
  felt.scale.z = 0.72
  felt.position.y = 0.02
  felt.receiveShadow = true
  scene.add(felt)

  // Aros dourados da borda
  const rims = [
    [4.96, 0.065, 0xd97706, 0.65],
    [4.65, 0.02, 0x10b981, 0.3],
    [4.5, 0.012, 0xf59e0b, 0.8],
  ]
  rims.forEach(([radius, tube, color, metal]) => {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(radius, tube, 8, 128),
      new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: 0.35 })
    )
    rim.rotation.x = Math.PI / 2
    rim.scale.y = 0.72
    rim.position.y = 0.06
    scene.add(rim)
  })

  // Partículas de luz ambiente
  const particleGeo = new THREE.BufferGeometry()
  const pCoords = []
  for (let i = 0; i < 90; i++) {
    pCoords.push((Math.random() - 0.5) * 20, Math.random() * 4.5 + 0.1, (Math.random() - 0.5) * 14)
  }
  particleGeo.setAttribute('position', new THREE.Float32BufferAttribute(pCoords, 3))
  const particles = new THREE.Points(
    particleGeo,
    new THREE.PointsMaterial({ color: 0xfde68a, size: 0.028, transparent: true, opacity: 0.45 })
  )
  scene.add(particles)

  // Geometria e texturas de cartas em escala de mesa
  const cardGeo = new THREE.PlaneGeometry(0.92, 1.34)
  const texturesCache = new Map()

  function getCardTexture(card, isCovered = false) {
    const key = isCovered ? 'back' : `${card?.value}_${card?.suit}`
    if (texturesCache.has(key)) return texturesCache.get(key)

    const c = document.createElement('canvas')
    c.width = 512
    c.height = 768
    const ctx = c.getContext('2d')

    if (isCovered || !card) {
      drawCanvasCardBack(ctx, 512, 768)
    } else {
      drawCanvasCardFace(ctx, 512, 768, card)
    }

    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
    texturesCache.set(key, tex)
    return tex
  }

  function drawCanvasCardBack(ctx, w, h) {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.roundRect(0, 0, w, h, 28)
    ctx.fill()

    ctx.fillStyle = '#1e3a8a'
    ctx.beginPath()
    ctx.roundRect(14, 14, w - 28, h - 28, 20)
    ctx.fill()

    // Losangos do verso Copag
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 2.5
    for (let x = 20; x < w - 20; x += 28) {
      ctx.beginPath()
      ctx.moveTo(x, 16)
      ctx.lineTo(x + 220, h - 16)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x, 16)
      ctx.lineTo(x - 220, h - 16)
      ctx.stroke()
    }

    // Medalhão NBP Central
    ctx.fillStyle = '#0f172a'
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, 70, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 5
    ctx.stroke()

    ctx.fillStyle = '#fde68a'
    ctx.font = '900 48px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('NBP', w / 2, h / 2)
  }

  function drawCanvasCardFace(ctx, w, h, card) {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.roundRect(0, 0, w, h, 28)
    ctx.fill()

    const isRed = card.suit === 'hearts' || card.suit === 'diamonds'
    const color = isRed ? '#dc2626' : '#0f172a'
    const suitSymbol =
      card.suit === 'spades' ? '♠' : card.suit === 'hearts' ? '♥' : card.suit === 'diamonds' ? '♦' : '♣'

    // Cantos (índice + naipe)
    ctx.fillStyle = color
    ctx.font = '900 64px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(card.value, 28, 22)

    ctx.font = '54px sans-serif'
    ctx.fillText(suitSymbol, 30, 96)

    // Canto inferior invertido
    ctx.save()
    ctx.translate(w, h)
    ctx.rotate(Math.PI)
    ctx.font = '900 64px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(card.value, 28, 22)
    ctx.font = '54px sans-serif'
    ctx.fillText(suitSymbol, 30, 96)
    ctx.restore()

    // Centro: Pips reais posicionados exatamente como em baralho de cartas real
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const pipsList = PIP_CONFIGS[card.value]
    if (pipsList && pipsList.length > 0) {
      ctx.font = '52px sans-serif'
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
      ctx.font = '72px sans-serif'
      ctx.fillText(suitSymbol, w / 2, h / 2)
    }
  }

  // ------------------------------------------------------------------
  // O BARALHO NA MESA (Monte virado para baixo no feltro verde)
  // ------------------------------------------------------------------
  const deckGroup = new THREE.Group()
  const deckBackTexture = getCardTexture(null, true)
  const deckTopMat = new THREE.MeshStandardMaterial({
    map: deckBackTexture,
    roughness: 0.45,
    metalness: 0.1,
    side: THREE.DoubleSide,
  })

  // Bloco volumétrico do maço de cartas
  const deckBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.94, 0.08, 1.36),
    new THREE.MeshStandardMaterial({ color: 0xf5eedc, roughness: 0.7 })
  )
  deckBlock.position.set(-1.8, 0.10, -0.45)
  deckBlock.rotation.y = 0.1
  deckBlock.castShadow = true
  deckBlock.receiveShadow = true
  deckGroup.add(deckBlock)

  // Carta do topo do monte
  const deckTopCard = new THREE.Mesh(cardGeo, deckTopMat)
  deckTopCard.rotation.x = -Math.PI / 2
  deckTopCard.rotation.z = -0.1
  deckTopCard.position.set(-1.8, 0.145, -0.45)
  deckTopCard.castShadow = true
  deckGroup.add(deckTopCard)
  scene.add(deckGroup)

  // Grupo de cartas pousadas no feltro 3D
  const tableCardsGroup = new THREE.Group()
  scene.add(tableCardsGroup)

  // Grupo de cartas atualmente voando / animando para a mesa (como no Burro)
  const flyingCards = []

  // Grupo dos marcadores de jogadores 3D em torno da mesa
  const playersGroup = new THREE.Group()
  scene.add(playersGroup)

  // Posições dos jogadores na borda e das cartas pousadas perfeitamente no centro do feltro
  function getSeatCoords(seatIndex, totalSeats) {
    if (totalSeats === 2) {
      // 1v1: Cartas lado a lado centralizadas no meio do feltro (em y=0.10, z=-0.42)
      if (seatIndex === 0) {
        return { x: 0, z: 2.4, rotY: 0, cardX: -0.54, cardZ: -0.42, cardRot: 0.04 }
      }
      return { x: 0, z: -2.4, rotY: Math.PI, cardX: 0.54, cardZ: -0.42, cardRot: -0.04 }
    }

    // 2v2: 4 cartas formando uma disputa central na mesa
    const angles = [0, -Math.PI / 2, Math.PI, Math.PI / 2]
    const rad = 2.3
    const a = angles[seatIndex % 4]

    const cardSpots = [
      { x: -0.38, z: -0.15, rot: 0.04 },  // Jogador 0 (Sul)
      { x: 0.48, z: -0.45, rot: -0.10 },  // Jogador 1 (Leste)
      { x: 0.38, z: -0.75, rot: 0.08 },   // Jogador 2 (Norte)
      { x: -0.48, z: -0.45, rot: -0.04 }, // Jogador 3 (Oeste)
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

  // Lança a carta voando da mão / assento até o centro da mesa
  function throwCardToTable(item, coords, playIdx, isLocal, key) {
    const origin = isLocal
      ? new THREE.Vector3(0, 1.4, 3.8)
      : new THREE.Vector3(coords.x * 0.9, 1.0, coords.z * 0.9)

    // Altura y = 0.10 garante que repousa BEM SOBRE o feltro (que fica em y = 0.06)
    const targetPos = new THREE.Vector3(coords.cardX, 0.10 + playIdx * 0.012, coords.cardZ)
    const rotZ = coords.cardRot + (Math.random() - 0.5) * 0.06
    const targetQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, rotZ))
    const startQuat = isLocal
      ? new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.4, 0, 0))
      : new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.25, coords.rotY, 0))

    const isCovered = item.covered || item.card?.covered
    const tex = getCardTexture(item.card, isCovered)
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.45,
      metalness: 0.1,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(cardGeo, mat)
    mesh.userData.key = key
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.position.copy(origin)
    mesh.quaternion.copy(startQuat)
    scene.add(mesh)

    flyingCards.push({
      key,
      mesh,
      origin,
      targetPos,
      startQuat,
      targetQuat,
      start: performance.now(),
      duration: 440,
    })
  }

  let knownPlayedKeys = new Set()

  function update(state, localPlayerId) {
    if (!state) return

    const played = state.playedCardsInTrick || []
    
    // Se a vaza foi recolhida/zerada
    if (played.length === 0) {
      if (knownPlayedKeys.size > 0 || tableCardsGroup.children.length > 0) {
        tableCardsGroup.clear()
        flyingCards.forEach((f) => scene.remove(f.mesh))
        flyingCards.length = 0
        knownPlayedKeys.clear()
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
          // Garante que se a carta já existe e não está voando, esteja no tableCardsGroup visível
          const isFlying = flyingCards.some((f) => f.key === key)
          const isPushed = tableCardsGroup.children.some((m) => m.userData.key === key)
          if (!isFlying && !isPushed) {
            const isCovered = item.covered || item.card?.covered
            const tex = getCardTexture(item.card, isCovered)
            const mat = new THREE.MeshStandardMaterial({
              map: tex,
              roughness: 0.45,
              metalness: 0.1,
              side: THREE.DoubleSide,
            })
            const mesh = new THREE.Mesh(cardGeo, mat)
            mesh.userData.key = key
            mesh.rotation.x = -Math.PI / 2
            mesh.rotation.z = coords.cardRot
            mesh.position.set(coords.cardX, 0.10 + playIdx * 0.012, coords.cardZ)
            mesh.castShadow = true
            mesh.receiveShadow = true
            tableCardsGroup.add(mesh)
          }
        }
      })
    }

    // Atualizar anéis luminosos dos jogadores ao redor da mesa
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

  // Loop de Animação e Renderização
  let animId = null
  function animate(t) {
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    // Proteção estrita contra 0 e NaN quando o canvas inicia oculto
    if (width > 20 && height > 20) {
      const targetW = Math.floor(width * renderer.getPixelRatio())
      const targetH = Math.floor(height * renderer.getPixelRatio())
      if (canvas.width !== targetW || canvas.height !== targetH) {
        renderer.setSize(width, height, false)
        camera.aspect = width / height
        camera.updateProjectionMatrix()
      }
    }

    // Animação de cartas sendo jogadas na mesa (arco parabólico estilo Burro)
    for (let i = flyingCards.length - 1; i >= 0; i--) {
      const f = flyingCards[i]
      const elapsed = t - f.start
      const progress = Math.min(1, elapsed / f.duration)
      const eased = 1 - Math.pow(1 - progress, 3)

      f.mesh.position.copy(f.origin).lerp(f.targetPos, eased)
      f.mesh.position.y += Math.sin(Math.PI * progress) * 0.72
      f.mesh.quaternion.copy(f.startQuat).slerp(f.targetQuat, eased)

      if (progress >= 1) {
        f.mesh.position.copy(f.targetPos)
        f.mesh.quaternion.copy(f.targetQuat)
        scene.remove(f.mesh)
        tableCardsGroup.add(f.mesh)
        flyingCards.splice(i, 1)
      }
    }

    particles.rotation.y = t * 0.00008
    renderer.render(scene, camera)
    animId = requestAnimationFrame(animate)
  }
  animId = requestAnimationFrame(animate)

  function destroy() {
    if (animId) cancelAnimationFrame(animId)
    renderer.dispose()
  }

  return { update, destroy }
}
