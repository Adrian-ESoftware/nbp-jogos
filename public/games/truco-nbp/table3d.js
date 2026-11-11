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
 * Feltro verde de alta densidade, aros dourados/mogno, iluminação suave e sombras dinâmicas.
 * Animação fluida de descarte da carta na mesa (igual ao Burro), com feltro limpo e desobstruído.
 */
export function createTrucoTable(canvas) {
  if (!canvas) return { update: () => {}, destroy: () => {} }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
  camera.position.set(0, 6.4, 8.8)
  camera.lookAt(0, 0.1, -0.4)
  scene.add(camera)

  // Iluminação de Cassino / Boteco
  const ambientLight = new THREE.HemisphereLight(0xdcfce7, 0x052e16, 2.0)
  scene.add(ambientLight)

  const sunLight = new THREE.DirectionalLight(0xffedd5, 2.7)
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

  // Feltro Verde Esmeralda Clássico
  const felt = new THREE.Mesh(
    new THREE.CylinderGeometry(4.85, 4.85, 0.08, 96),
    new THREE.MeshStandardMaterial({
      color: 0x064e3b, // Verde esmeralda profundo
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

  // Partículas suspensas criando atmosfera aconchegante
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

  // Geometria e texturas de cartas
  const cardGeo = new THREE.PlaneGeometry(0.85, 1.25)
  const texturesCache = new Map()

  function getCardTexture(card, isCovered = false) {
    const key = isCovered ? 'back' : `${card?.value}_${card?.suit}`
    if (texturesCache.has(key)) return texturesCache.get(key)

    const c = document.createElement('canvas')
    c.width = 256
    c.height = 384
    const ctx = c.getContext('2d')

    if (isCovered || !card) {
      drawCanvasCardBack(ctx, 256, 384)
    } else {
      drawCanvasCardFace(ctx, 256, 384, card)
    }

    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    texturesCache.set(key, tex)
    return tex
  }

  function drawCanvasCardBack(ctx, w, h) {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.roundRect(0, 0, w, h, 20)
    ctx.fill()

    ctx.fillStyle = '#1e3a8a'
    ctx.beginPath()
    ctx.roundRect(10, 10, w - 20, h - 20, 14)
    ctx.fill()

    // Padrão de losangos clássico
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 1.5
    for (let x = 16; x < w - 16; x += 16) {
      ctx.beginPath()
      ctx.moveTo(x, 14)
      ctx.lineTo(x + 120, h - 14)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x, 14)
      ctx.lineTo(x - 120, h - 14)
      ctx.stroke()
    }

    // Medalhão
    ctx.fillStyle = '#0f172a'
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, 42, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 3
    ctx.stroke()

    ctx.fillStyle = '#fde68a'
    ctx.font = '900 28px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('NBP', w / 2, h / 2)
  }

  function drawCanvasCardFace(ctx, w, h, card) {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.roundRect(0, 0, w, h, 20)
    ctx.fill()

    const isRed = card.suit === 'hearts' || card.suit === 'diamonds'
    const color = isRed ? '#dc2626' : '#0f172a'
    const suitSymbol =
      card.suit === 'spades' ? '♠' : card.suit === 'hearts' ? '♥' : card.suit === 'diamonds' ? '♦' : '♣'

    // Cantos (índice + naipe)
    ctx.fillStyle = color
    ctx.font = '900 38px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(card.value, 18, 16)

    ctx.font = '32px sans-serif'
    ctx.fillText(suitSymbol, 19, 58)

    // Canto inferior invertido
    ctx.save()
    ctx.translate(w, h)
    ctx.rotate(Math.PI)
    ctx.font = '900 38px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(card.value, 18, 16)
    ctx.font = '32px sans-serif'
    ctx.fillText(suitSymbol, 19, 58)
    ctx.restore()

    // Centro: Pips reais posicionados exatamente como em baralho de cartas real
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const pipsList = PIP_CONFIGS[card.value]
    if (pipsList && pipsList.length > 0) {
      ctx.font = '32px sans-serif'
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
      ctx.font = '48px sans-serif'
      ctx.fillText(suitSymbol, w / 2, h / 2)
    }
  }

  // Grupo de cartas pousadas no feltro 3D
  const tableCardsGroup = new THREE.Group()
  scene.add(tableCardsGroup)

  // Grupo de cartas atualmente voando / animando para a mesa (como no Burro)
  const flyingCards = []

  // Grupo dos marcadores de jogadores 3D em torno da mesa
  const playersGroup = new THREE.Group()
  scene.add(playersGroup)

  // Posições dos jogadores na mesa conforme quantidade (1v1 ou 2v2)
  function getSeatCoords(seatIndex, totalSeats) {
    if (totalSeats === 2) {
      // 0 = Sul (Local), 1 = Norte (Oponente)
      if (seatIndex === 0) return { x: 0, z: 2.3, rotY: 0, cardX: 0, cardZ: 0.62 }
      return { x: 0, z: -2.3, rotY: Math.PI, cardX: 0, cardZ: -0.62 }
    }
    // 2v2: 0 = Sul (Nós), 1 = Leste (Eles), 2 = Norte (Nós parceiro), 3 = Oeste (Eles)
    const angles = [0, -Math.PI / 2, Math.PI, Math.PI / 2]
    const cardAngles = [0, -Math.PI / 2, Math.PI, Math.PI / 2]
    const rad = 2.25
    const cRad = 0.75
    const a = angles[seatIndex % 4]
    return {
      x: Math.sin(a) * rad * 1.35,
      z: Math.cos(a) * rad,
      rotY: a,
      cardX: Math.sin(cardAngles[seatIndex % 4]) * cRad * 1.35,
      cardZ: Math.cos(cardAngles[seatIndex % 4]) * cRad,
    }
  }

  // Lança a carta voando da mão / assento até o centro da mesa
  function throwCardToTable(item, coords, playIdx, isLocal) {
    const origin = isLocal
      ? new THREE.Vector3(0, 1.4, 3.8)
      : new THREE.Vector3(coords.x * 0.9, 1.0, coords.z * 0.9)

    const targetPos = new THREE.Vector3(coords.cardX, 0.05 + playIdx * 0.007, coords.cardZ)
    const rotZ = (Math.random() - 0.5) * 0.35 - coords.rotY * 0.3
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
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.position.copy(origin)
    mesh.quaternion.copy(startQuat)
    scene.add(mesh)

    flyingCards.push({
      mesh,
      origin,
      targetPos,
      startQuat,
      targetQuat,
      start: performance.now(),
      duration: 420,
    })
  }

  let knownPlayedKeys = new Set()

  function update(state, localPlayerId) {
    if (!state) return

    const played = state.playedCardsInTrick || []
    
    // Se a vaza foi recolhida/zerada
    if (played.length === 0) {
      if (knownPlayedKeys.size > 0) {
        tableCardsGroup.clear()
        flyingCards.forEach((f) => scene.remove(f.mesh))
        flyingCards.length = 0
        knownPlayedKeys.clear()
      }
    }

    // Detecta cartas recém-jogadas para lançar com animação estilo Burro
    const totalPlayers = state.players?.length || 2
    const myIdx = Math.max(0, state.players?.findIndex((p) => p.id === localPlayerId))

    played.forEach((item, playIdx) => {
      const key = `${item.playerId}:${item.card?.value}:${item.card?.suit}:${playIdx}`
      if (!knownPlayedKeys.has(key)) {
        knownPlayedKeys.add(key)

        const pIdx = state.players?.findIndex((p) => p.id === item.playerId)
        const relativeSeat = pIdx >= 0 ? (pIdx - myIdx + totalPlayers) % totalPlayers : playIdx
        const coords = getSeatCoords(relativeSeat, totalPlayers)
        const isLocal = item.playerId === localPlayerId

        throwCardToTable(item, coords, playIdx, isLocal)
      }
    })

    // Atualizar anéis luminosos dos jogadores ao redor da mesa
    playersGroup.clear()
    const all = state.players || []
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
      ring.position.set(coords.x * 0.88, 0.04, coords.z * 0.88)
      playersGroup.add(ring)
    })
  }

  // Loop de Animação e Renderização
  let animId = null
  function animate(t) {
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    if (canvas.width !== Math.floor(width * renderer.getPixelRatio()) || canvas.height !== Math.floor(height * renderer.getPixelRatio())) {
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    // Animação de cartas sendo jogadas na mesa (voo parabólico igual ao Burro)
    for (let i = flyingCards.length - 1; i >= 0; i--) {
      const f = flyingCards[i]
      const elapsed = t - f.start
      const progress = Math.min(1, elapsed / f.duration)
      const eased = 1 - Math.pow(1 - progress, 3)

      f.mesh.position.copy(f.origin).lerp(f.targetPos, eased)
      f.mesh.position.y += Math.sin(Math.PI * progress) * 0.72 // Arco no ar
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
