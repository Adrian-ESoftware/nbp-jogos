import * as THREE from "../../vendor/three.module.js"

export function createTable(canvas) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true})
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(43, 1, .1, 80)
  camera.position.set(0, 5.9, 10.3)
  camera.lookAt(0, .25, -.6)
  scene.add(camera)
  scene.add(new THREE.HemisphereLight(0xc3ffed, 0x071518, 1.8))
  const light = new THREE.DirectionalLight(0xffe2a3, 2.5)
  light.position.set(-4, 10, 6)
  light.castShadow = true
  light.shadow.mapSize.set(1024, 1024)
  light.shadow.camera.left = light.shadow.camera.bottom = -9
  light.shadow.camera.right = light.shadow.camera.top = 9
  scene.add(light)

  const base = new THREE.Mesh(new THREE.CylinderGeometry(5.35, 5.55, .48, 96), new THREE.MeshStandardMaterial({color: 0x142e2c, roughness: .5, metalness: .4}))
  base.scale.z = .69
  base.position.y = -.25
  base.receiveShadow = true
  scene.add(base)
  const felt = new THREE.Mesh(new THREE.CylinderGeometry(5.02, 5.02, .08, 96), new THREE.MeshStandardMaterial({color: 0x13634f, roughness: .92}))
  felt.scale.z = .69
  felt.receiveShadow = true
  scene.add(felt)
  for (const [radius, tube, color] of [[5.15,.06,0xd2a850],[4.82,.018,0x80c8a3],[4.65,.012,0x3d967c]]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius,tube,8,128),new THREE.MeshStandardMaterial({color,metalness:.6,roughness:.4}))
    rim.rotation.x = Math.PI/2
    rim.scale.y = .69
    rim.position.y = .07
    scene.add(rim)
  }

  const stars = new THREE.BufferGeometry()
  const points = []
  for(let i=0;i<100;i++) points.push((Math.random()-.5)*24, Math.random()*5+.2, (Math.random()-.5)*16)
  stars.setAttribute("position",new THREE.Float32BufferAttribute(points,3))
  const particles = new THREE.Points(stars,new THREE.PointsMaterial({color:0x9de1b6,size:.025,transparent:true,opacity:.5}))
  scene.add(particles)

  const art = document.createElement("canvas")
  art.width=256; art.height=384
  const ctx=art.getContext("2d")
  ctx.fillStyle="#fff7e7";ctx.beginPath();ctx.roundRect(0,0,256,384,24);ctx.fill()
  ctx.fillStyle="#152b30";ctx.beginPath();ctx.roundRect(12,12,232,360,16);ctx.fill()
  ctx.save();ctx.translate(128,192);ctx.rotate(-.35)
  ctx.fillStyle="#e45450";ctx.beginPath();ctx.ellipse(0,0,74,130,0,0,Math.PI*2);ctx.fill()
  ctx.fillStyle="#ffd25c";ctx.font="900 48px system-ui";ctx.textAlign="center";ctx.fillText("BURRO!",0,17);ctx.restore()
  const texture=new THREE.CanvasTexture(art)
  texture.colorSpace=THREE.SRGBColorSpace
  const material=new THREE.MeshStandardMaterial({map:texture,roughness:.55,side:THREE.DoubleSide,transparent:true,alphaTest:.05})
  const geometry=new THREE.PlaneGeometry(.55,.82)

  // A mão é presa à câmera: acompanha o jogador, mas suas cartas são malhas 3D.
  const handGroup = new THREE.Group()
  camera.add(handGroup)
  const handGeometry = new THREE.PlaneGeometry(.68, 1.02)
  const faceMaterials = new Map()
  const colorMap = {red:"#e85350",yellow:"#dba21f",green:"#239b73",blue:"#3677d7",wild:"#25253a"}
  const symbols = {skip:"⊘",reverse:"⇄",draw2:"+2",wild:"★",draw4:"+4"}
  function faceMaterial(card) {
    const key=card.c+":"+card.v
    if(faceMaterials.has(key))return faceMaterials.get(key)
    const image=document.createElement("canvas");image.width=256;image.height=384
    const c=image.getContext("2d"), color=colorMap[card.c]||"#37504a", value=symbols[card.v]||card.v
    c.fillStyle="#fff9e9";c.beginPath();c.roundRect(0,0,256,384,24);c.fill()
    c.fillStyle=color;c.beginPath();c.roundRect(12,12,232,360,15);c.fill()
    if(card.c==="wild"){
      c.save();c.beginPath();c.roundRect(12,12,232,360,15);c.clip()
      c.fillStyle="#e85350";c.fillRect(12,12,116,180)
      c.fillStyle="#3677d7";c.fillRect(128,12,116,180)
      c.fillStyle="#239b73";c.fillRect(12,192,116,180)
      c.fillStyle="#dba21f";c.fillRect(128,192,116,180);c.restore()
    }
    c.save();c.translate(128,192);c.rotate(.45);c.fillStyle=card.c==="wild"?"#25253a":"#fff9e9"
    c.beginPath();c.ellipse(0,0,76,145,0,0,Math.PI*2);c.fill();c.restore()
    c.textAlign="center";c.textBaseline="middle";c.font="900 "+(value.length>1?104:140)+"px system-ui"
    c.fillStyle=card.c==="wild"?"#fff9e9":color;c.fillText(value,128,194)
    c.font="900 38px system-ui";c.textAlign="left";c.fillStyle="#fff9e9";c.fillText(value,24,44)
    c.save();c.translate(232,340);c.rotate(Math.PI);c.fillText(value,0,0);c.restore()
    const tex=new THREE.CanvasTexture(image);tex.colorSpace=THREE.SRGBColorSpace
    const mat=new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide,transparent:true,alphaTest:.05})
    faceMaterials.set(key,mat);return mat
  }
  const tableCards=new THREE.Group();scene.add(tableCards)
  const cardPlane=new THREE.PlaneGeometry(.92,1.38)
  const drawPile=new THREE.Mesh(cardPlane,material)
  drawPile.rotation.x=-Math.PI/2;drawPile.rotation.z=-.13;drawPile.position.set(-.75,.11,.1)
  drawPile.userData.action="draw";drawPile.castShadow=true;tableCards.add(drawPile)
  const discard=new THREE.Mesh(cardPlane,faceMaterial({c:"placeholder",v:"?"}))
  discard.rotation.x=-Math.PI/2;discard.rotation.z=.1;discard.position.set(.7,.11,.1);discard.castShadow=true;tableCards.add(discard)
  let handSignature="", lastMoveId=null, initialized=false, flying=null
  const moveQueue=[]
  const reducedMotion=window.matchMedia?.("(prefers-reduced-motion: reduce)")
  function clearAnimations(){
    moveQueue.length=0
    if(flying){scene.remove(flying.mesh);flying=null}
  }
  function queueMove(move,myId){
    scene.updateMatrixWorld(true)
    let origin,rotation
    if(move.playerId===myId){
      const source=handGroup.children[move.index]
      origin=source?source.getWorldPosition(new THREE.Vector3()):camera.localToWorld(new THREE.Vector3(0,-1,-3.8))
      rotation=source?source.getWorldQuaternion(new THREE.Quaternion()):camera.getWorldQuaternion(new THREE.Quaternion())
    }else{
      const seat=seats.get(move.playerId)
      origin=seat?seat.clone().add(new THREE.Vector3(0,-.7,.2)):new THREE.Vector3(0,.7,-2)
      rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(-.22,0,0))
    }
    moveQueue.push({card:move.card,origin,rotation})
  }
  function animateMove(time){
    if(!flying && moveQueue.length){
      const move=moveQueue.shift()
      const mesh=new THREE.Mesh(cardPlane,faceMaterial(move.card));mesh.castShadow=true;scene.add(mesh)
      flying={...move,mesh,start:time}
    }
    if(!flying)return
    const t=Math.min(1,(time-flying.start)/650), eased=1-Math.pow(1-t,3)
    flying.mesh.position.copy(flying.origin).lerp(discard.position,eased)
    flying.mesh.position.y+=Math.sin(Math.PI*t)*.65
    flying.mesh.quaternion.copy(flying.rotation).slerp(discard.quaternion,eased)
    if(t===1){discard.material=faceMaterial(flying.card);scene.remove(flying.mesh);flying=null}
  }
  function updateCards(current,myId){
    const player=current?.players?.find(p=>p.id===myId)
    const cards=player?.hand||[]
    const top=current?.pile?.at(-1)
    const move=current?.lastMove
    if(!initialized || !move){
      clearAnimations();lastMoveId=move?.id||null;initialized=true
      discard.material=faceMaterial(top||{c:"placeholder",v:"?"})
    }else if(move.id!==lastMoveId){
      lastMoveId=move.id
      if(reducedMotion?.matches)discard.material=faceMaterial(top||{c:"placeholder",v:"?"})
      else queueMove(move,myId)
    }
    const signature=JSON.stringify([cards,myId,current?.phase,current?.turn,current?.drawn,current?.challenge,current?.color,top])
    if(signature===handSignature)return
    handSignature=signature
    const previousCards=[...handGroup.children]
    handGroup.clear()
    cards.forEach((card,index)=>{
      const valid=current?.phase==="playing" && current.players[current.turn]?.id===myId && !current.challenge && (!current.drawn || index===cards.length-1) && (card.c==="wild"||card.c===current.color||card.v===top?.v)
      const key=card.c+":"+card.v
      const oldIndex=previousCards.findIndex(mesh=>mesh.userData.cardKey===key)
      let mesh
      if(oldIndex>=0){mesh=previousCards.splice(oldIndex,1)[0]}
      else{mesh=new THREE.Mesh(handGeometry,faceMaterial(card).clone());mesh.userData.cardKey=key;mesh.userData.bornAt=performance.now();mesh.position.set(0,-2.1,-3.8)}
      mesh.material.color.set(valid?0xffffff:0x969d99)
      mesh.userData.index=index
      handGroup.add(mesh)
    })
    previousCards.forEach(mesh=>mesh.material.dispose())
    layoutHand()
  }
  function layoutHand(){
    const n=handGroup.children.length
    const available=Math.max(1.2,Math.min(7,3.8*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect*2-.4))
    const step=n>1?Math.min(.52,(available-.68)/(n-1)):0
    handGroup.children.forEach((card,index)=>{
      const offset=index-(n-1)/2
      card.userData.target=new THREE.Vector3(offset*step,-1.13-Math.min(.2,offset*offset*.008),-3.8-index*.001)
      card.userData.targetRotation=-offset*Math.min(.045,.38/Math.max(1,n))
    })
  }
  const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2()
  let hovered=null
  function pick(event){
    const rect=canvas.getBoundingClientRect()
    pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1)
    camera.updateMatrixWorld();scene.updateMatrixWorld(true)
    raycaster.setFromCamera(pointer,camera)
    const handHit=raycaster.intersectObjects(handGroup.children)[0]
    if(handHit)return {object:handHit.object,button:document.querySelectorAll("#hand button")[handHit.object.userData.index]}
    const pileHit=raycaster.intersectObject(drawPile)[0]
    if(pileHit)return {object:pileHit.object,button:document.getElementById("draw")}
    return null
  }
  canvas.addEventListener("pointermove",event=>{
    const hit=pick(event)
    hovered=hit?.button&&!hit.button.disabled?hit.object:null
    canvas.style.cursor=hovered?"pointer":"default"
  })
  canvas.addEventListener("pointerleave",()=>{hovered=null;canvas.style.cursor="default"})
  canvas.addEventListener("click",event=>{const hit=pick(event);if(hit?.button&&!hit.button.disabled)hit.button.click()})
  const opponents=new THREE.Group()
  scene.add(opponents)
  const seats = new Map()
  const playerGeo = new THREE.SphereGeometry(.27, 20, 12)
  const playerColors = [0x62b7ef,0xf1ab60,0xc58dea,0x75d5a5,0xf48487,0xefd27b]
  let previous=""
  function update(current, myId) {
    updateCards(current,myId)
    const all=current?.players||[]
    const myIndex=all.findIndex(p=>p.id===myId)
    const players=myIndex<0?all:all.slice(myIndex+1).concat(all.slice(0,myIndex))
    const signature=players.map(p=>p.id+":"+p.hand.length).join("|")
    if(signature===previous)return
    previous=signature
    opponents.traverse(object=>{if(object.userData.ownedMaterial)object.material.dispose()})
    opponents.clear()
    seats.clear()
    players.forEach((player,index)=>{
      const angle=players.length===1?0:(index/(players.length-1)-.5)*2.65
      const x=Math.sin(angle)*4.5, z=-Math.cos(angle)*2.65
      seats.set(player.id,new THREE.Vector3(x,1.32,z))
      const marker=new THREE.Mesh(playerGeo,new THREE.MeshStandardMaterial({color:playerColors[index%playerColors.length],roughness:.48,metalness:.15}))
      marker.userData.ownedMaterial=true
      marker.position.set(x, .87, z)
      marker.castShadow=true
      opponents.add(marker)
      const count=Math.min(player.hand.length,7)
      for(let i=0;i<count;i++){
        const card=new THREE.Mesh(geometry,material)
        card.position.set(x+(i-(count-1)/2)*.16,.46+i*.005,z+.2)
        card.rotation.x=-.22
        card.rotation.z=-(i-(count-1)/2)*.055
        card.castShadow=true
        opponents.add(card)
      }
    })
  }
  const projected=new THREE.Vector3()
  function positionLabels() {
    const layer=document.getElementById("players")
    if(!layer)return
    const width=canvas.clientWidth,height=canvas.clientHeight
    for(const label of layer.children){
      if(label.classList.contains("self"))continue
      const seat=seats.get(label.dataset.playerId)
      if(!seat){label.style.visibility="hidden";continue}
      projected.copy(seat).project(camera)
      label.style.visibility=projected.z<1?"visible":"hidden"
      const x=Math.max(65,Math.min(width-65,(projected.x+1)*width/2))
      const y=Math.max(50,Math.min(height-80,(1-projected.y)*height/2))
      label.style.left=x+"px"
      label.style.top=y+"px"
    }
  }
  let previousFrame=0
  const targetPosition=new THREE.Vector3()
  const targetPileScale=new THREE.Vector3()
  function frame(time){
    const width=canvas.clientWidth,height=canvas.clientHeight
    if(width && height && (canvas.width!==Math.floor(width*renderer.getPixelRatio())||canvas.height!==Math.floor(height*renderer.getPixelRatio()))){
      renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();layoutHand()
    }
    const delta=previousFrame?Math.min((time-previousFrame)/1000,.05):.016
    previousFrame=time
    const smoothing=reducedMotion?.matches?1:1-Math.exp(-delta*12)
    for(const card of handGroup.children){
      if(!card.userData.target)continue
      targetPosition.copy(card.userData.target)
      if(card===hovered)targetPosition.y+=.16
      if(!reducedMotion?.matches && card.userData.bornAt){
        const age=(time-card.userData.bornAt)/1000
        if(age<.8)targetPosition.y+=.12*Math.exp(-age*5)*Math.sin(age*19)
      }
      card.position.lerp(targetPosition,smoothing)
      card.rotation.z=THREE.MathUtils.lerp(card.rotation.z,card.userData.targetRotation,smoothing)
    }
    const pileScale=hovered===drawPile?1.08:1
    drawPile.scale.lerp(targetPileScale.set(pileScale,pileScale,pileScale),smoothing)
    positionLabels()
    animateMove(time)
    particles.rotation.y=time*.000015
    renderer.render(scene,camera)
    requestAnimationFrame(frame)
  }
  canvas.parentElement.classList.add("has-3d")
  canvas.closest("main").classList.add("game-3d")
  requestAnimationFrame(frame)
  return update
}
