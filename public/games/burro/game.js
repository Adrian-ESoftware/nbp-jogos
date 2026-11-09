const $ = id => document.getElementById(id)
const colors = ["red", "yellow", "green", "blue"]
const names = {red:"vermelho",yellow:"amarelo",green:"verde",blue:"azul"}
const labels = {skip:"⊘",reverse:"⇄",draw2:"+2",wild:"★",draw4:"+4"}
let state = null, announced = false, botTimer = null, soundEnabled = false, lastCard = ""
const room = new NBPRoom({gameId:"burro",defaultPrefix:"BUR",onStateSync:s=>{state=s; render()},onStatus:s=>{$("connection").textContent=s.error?"Sala não encontrada.":s.connected?`Conectado à sala ${s.roomCode}`:`Conectando à sala ${s.roomCode}...`},onError:e=>{$("connection").textContent=e.message},onAction:(a,p)=>{if(room.isHost) action(a,p); else if(a?.type === "HOST_LEFT") migrateHost(a.hostId)}})
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function deck(){let d=[]; for(const c of colors){d.push({c,v:"0"});for(let n=1;n<=9;n++)for(let i=0;i<2;i++)d.push({c,v:String(n)});for(const v of ["skip","reverse","draw2"])for(let i=0;i<2;i++)d.push({c,v})}for(let i=0;i<4;i++)for(const v of ["wild","draw4"])d.push({c:"wild",v});return shuffle(d)}
function sync(){render();room.broadcastState(state);scheduleBot()}
function scheduleBot(){
 clearTimeout(botTimer); botTimer=null
 if(!room.isHost || state?.phase!=="playing")return
 const bot=state.players[state.turn]; if(!bot?.isBot && !bot?.disconnected)return
 botTimer=setTimeout(()=>{
  if(!room.isHost || state?.phase!=="playing" || state.players[state.turn]?.id!==bot.id)return
  if(state.challenge){action({type:Math.random() < (bot.difficulty==="hard"?.55:.25)?"CHALLENGE":"ACCEPT"},{id:bot.id});return}
  const top=state.pile.at(-1)
  const playable=(card,i)=>(!state.drawn||i===bot.hand.length-1)&&(card.c==="wild"||card.c===state.color||card.v===top.v)&&(card.v!=="draw4"||bot.difficulty==="easy"||!bot.hand.some(c=>c.c===state.color))
  const choices=bot.hand.map((card,i)=>({card,i})).filter(({card,i})=>playable(card,i))
  if(bot.difficulty==="hard") choices.sort((a,b)=>(b.card.v==="draw2"||b.card.v==="skip"?1:0)-(a.card.v==="draw2"||a.card.v==="skip"?1:0))
  const index=choices.length?(bot.difficulty==="easy"?choices[Math.floor(Math.random()*choices.length)].i:choices[0].i):-1
  if(index>=0){
   const counts=Object.fromEntries(colors.map(c=>[c,bot.hand.filter((card,i)=>i!==index&&card.c===c).length]))
   const color=colors.reduce((best,c)=>counts[c]>counts[best]?c:best,colors[0])
   action({type:"PLAY",index,color,announced:true},{id:bot.id})
  }else action({type:state.drawn?"PASS":"DRAW"},{id:bot.id})
 },800)
}
function migrateHost(oldId){
 if(!state)return
 const remaining=state.players.filter(p=>!p.isBot&&!p.disconnected&&p.id!==oldId).sort((a,b)=>a.id.localeCompare(b.id))
 if(remaining[0]?.id!==room.profile.id){$("connection").textContent="Reconectando ao novo anfitrião...";return}
 room.promoteToHost(remaining)
 const old=state.players.find(p=>p.id===oldId);if(old){old.disconnected=true;old.isBot=true;old.name=old.name.replace(/ · desconectado$/,"")+" · desconectado"}
 state.notice="O anfitrião saiu. A partida continua com um novo anfitrião."
 sync()
}
function finish(winner){
 const points=state.players.filter(p=>p.id!==winner.id).flatMap(p=>p.hand).reduce((sum,c)=>sum+(c.c==="wild"?50:/^\d$/.test(c.v)?Number(c.v):20),0)
 winner.score=(winner.score||0)+points;state.phase="finished";state.notice=`${winner.name} venceu a rodada e ganhou ${points} pontos!`;state.challenge=null
}
function take(p,n){for(let i=0;i<n;i++){if(!state.deck.length){if(state.pile.length<=1)break;const top=state.pile.pop();state.deck=shuffle(state.pile);state.pile=[top]}p.hand.push(state.deck.pop())}}
function advance(n=1){state.turn=(state.turn+state.dir*n%state.players.length+state.players.length)%state.players.length}
function action(a,profile){if(!state||!a)return;const id=profile?.id||a.playerId;const p=state.players.find(x=>x.id===id)
 if((a.type==="JOIN_REQUEST" || a.type==="HEARTBEAT") && profile){
  if(p?.disconnected){p.disconnected=false;p.isBot=false;p.name=profile.name;state.notice=`${p.name} voltou à partida.`}
  else if(!p && a.type==="JOIN_REQUEST" && state.phase!=="playing" && state.players.length<10)state.players.push({id:profile.id,name:profile.name,hand:[],score:0})
  sync();return
 }
 if(a.type==="PLAYER_LEFT"){const left=state.players.find(x=>x.id===a.playerId);if(left){if(state.phase==="playing"){left.disconnected=true;state.notice=`${left.name} desconectou; um bot assume até seu retorno.`}else state.players=state.players.filter(x=>x.id!==a.playerId);sync()}return}
 if((a.type==="ADD_BOT"||a.type==="REMOVE_BOT") && id===room.profile.id && state.phase!=="playing"){
  if(a.type==="ADD_BOT" && state.players.length<10){let n=1;while(state.players.some(x=>x.name===`Bot ${n}`))n++;state.players.push({id:`bot_${Date.now()}_${Math.random().toString(36).slice(2)}`,name:`Bot ${n}`,isBot:true,difficulty:$("difficulty").value,score:0,hand:[]})}
  if(a.type==="REMOVE_BOT"){const index=state.players.findLastIndex(x=>x.isBot);if(index>=0)state.players.splice(index,1)}
  sync();return
 }
 if(a.type==="START" && id===room.profile.id && state.players.length>=2){
  state.deck=deck();state.pile=[];state.dir=1;state.turn=0;state.drawn=false;state.challenge=null;state.players.forEach(x=>{x.hand=[];take(x,7)})
  let first=state.deck.findIndex(x=>x.v!=="draw4");const card=state.deck.splice(first,1)[0];state.pile.push(card);state.color=card.c==="wild"?colors[Math.floor(Math.random()*4)]:card.c;state.phase="playing";state.notice="Partida iniciada!"
  if(card.v==="skip")advance();else if(card.v==="reverse"){state.dir=-1;advance()}else if(card.v==="draw2"){take(state.players[state.turn],2);advance()}
  sync();return
 }
 if(state.phase!=="playing"||!p||state.players[state.turn].id!==id)return
 if(state.challenge){
  if(a.type!=="ACCEPT"&&a.type!=="CHALLENGE")return
  const challenge=state.challenge, offender=state.players.find(x=>x.id===challenge.offender)
  state.challenge=null
  if(a.type==="CHALLENGE" && challenge.illegal){take(offender,4);state.notice=`${p.name} acertou o desafio! ${offender.name} compra 4 cartas.`;if(challenge.winner)challenge.winner=null}
  else{take(p,a.type==="CHALLENGE"?6:4);state.notice=a.type==="CHALLENGE"?`${p.name} perdeu o desafio e comprou 6 cartas.`:`${p.name} aceitou e comprou 4 cartas.`;advance()}
  if(challenge.winner)finish(offender)
  sync();return
 }
 if(a.type==="PLAY"){
  const card=p.hand[a.index], top=state.pile.at(-1)
  if(!card || (state.drawn && a.index!==p.hand.length-1) || !(card.c==="wild"||card.c===state.color||card.v===top.v))return
  if(card.c==="wild"&&!colors.includes(a.color))return
  const illegal=card.v==="draw4" && p.hand.some((x,i)=>i!==a.index&&x.c===state.color)
  p.hand.splice(a.index,1);state.pile.push(card);state.color=card.c==="wild"?a.color:card.c;state.drawn=false
  if(p.hand.length===1&&!a.announced){take(p,2);state.notice=`${p.name} esqueceu de gritar BURRO e comprou 2 cartas!`}else state.notice=`${p.name} jogou ${labels[card.v]||card.v}.`
  if(card.v==="draw4"){state.challenge={offender:p.id,illegal,winner:p.hand.length===0};advance();state.notice+=` ${state.players[state.turn].name} pode aceitar ou desafiar.`;sync();return}
  if(card.v==="draw2"){advance();take(state.players[state.turn],2);if(!p.hand.length){finish(p);sync();return}advance()}
  else if(!p.hand.length){finish(p);sync();return}
  else if(card.v==="reverse"){state.dir*=-1;advance(state.players.length===2?2:1)}else if(card.v==="skip")advance(2);else advance()
  sync();return
 }
 if(a.type==="DRAW"&&!state.drawn){const count=p.hand.length;take(p,1);if(p.hand.length===count){state.notice="Não há cartas para comprar.";advance()}else{state.drawn=true;state.notice=`${p.name} comprou uma carta.`}sync()}else if(a.type==="PASS"&&state.drawn){state.drawn=false;advance();sync()}}
function send(a){room.sendToHost(a)}
function render(){if(!state)return;const me=state.players.find(p=>p.id===room.profile.id), current=state.players[state.turn];$("room-label").textContent=`SALA ${room.roomCode}`;$("direction").textContent=state.dir===-1?"↺ Sentido anti-horário":"↻ Sentido horário";$("players").replaceChildren(...state.players.map(p=>{let e=document.createElement("div");e.className="player"+(state.phase==="playing"&&p.id===current?.id?" active":"");e.textContent=`${p.name}${p.isBot?" 🤖":""}${p.id===room.profile.id?" (você)":""} · ${p.hand.length} cartas · ${p.score||0} pts`;return e}));$("message").textContent=state.phase==="lobby"?(state.notice||"Aguardando jogadores. Compartilhe o código da sala."):state.phase==="finished"?state.notice:`${state.notice} Vez de ${current?.name}.`;$("difficulty-label").hidden=$("add-bot").hidden=$("remove-bot").hidden=!room.isHost||state.phase==="playing";$("add-bot").disabled=state.players.length>=10;$("remove-bot").disabled=!state.players.some(p=>p.isBot);$("start").hidden=!room.isHost||state.phase==="playing";$("start").disabled=state.players.length<2;$("start").textContent=state.phase==="finished"?"Jogar novamente":"Começar partida";const top=state.pile?.at(-1);$("discard").className=`card ${top?.c||"placeholder"}`;$("discard").textContent=top?(labels[top.v]||top.v):"?";$("color").textContent=top?`Cor: ${names[state.color]}`:"Aguardando partida";const turn=state.phase==="playing"&&current?.id===room.profile.id;
 const pending=turn&&!!state.challenge;$("accept").hidden=$("challenge").hidden=!pending
 const key=top?JSON.stringify(top)+state.pile.length:"";if(key&&key!==lastCard){lastCard=key;const discard=$("discard");discard.classList.remove("changed");void discard.offsetWidth;discard.classList.add("changed");if(soundEnabled)beep()}
 $("draw").disabled=!turn||state.drawn||pending;$("pass").disabled=!turn||!state.drawn||pending;$("call").disabled=!turn||pending||me?.hand.length!==2;$("call").textContent=announced?"BURRO anunciado!":"Gritar BURRO!";$("hint").textContent=turn?"Sua vez! Escolha uma carta ou compre.":state.phase==="playing"?"Aguarde sua vez.":"As cartas aparecem aqui quando a partida começar.";$("hand").replaceChildren(...(me?.hand||[]).map((c,i)=>{const b=document.createElement("button");b.className=`card ${c.c}`;b.textContent=labels[c.v]||c.v;b.title=`${names[c.c]||"Coringa"} ${labels[c.v]||c.v}`;b.disabled=!turn||pending||(state.drawn&&i!==me.hand.length-1)||!(c.c==="wild"||c.c===state.color||c.v===top?.v);b.onclick=()=>{if(c.c==="wild"){const dialog=$("choose");dialog.showModal();dialog.onclose=()=>{if(colors.includes(dialog.returnValue))send({type:"PLAY",index:i,color:dialog.returnValue,announced});announced=false}}else{send({type:"PLAY",index:i,announced});announced=false}};return b}))}
$("create").onclick=()=>{room.setPlayerName($("name").value);const code=$("code").value.trim()||`BUR-${Math.floor(1000+Math.random()*9000)}`;$("code").value=code;state={phase:"lobby",players:[{id:room.profile.id,name:room.profile.name,hand:[]}],turn:0,dir:1,pile:[],notice:""};room.hostRoom(code);sync()};$("join").onclick=()=>{if(!$("code").value.trim()){$("connection").textContent="Informe o código da sala.";return}room.setPlayerName($("name").value);room.joinRoom($("code").value)};$("add-bot").onclick=()=>send({type:"ADD_BOT"});$("remove-bot").onclick=()=>send({type:"REMOVE_BOT"});$("start").onclick=()=>send({type:"START"});$("draw").onclick=()=>send({type:"DRAW"});$("pass").onclick=()=>send({type:"PASS"});$("call").onclick=()=>{announced=true;render()};$("accept").onclick=()=>send({type:"ACCEPT"});$("challenge").onclick=()=>send({type:"CHALLENGE"});$("sound").onclick=()=>{soundEnabled=!soundEnabled;$("sound").setAttribute("aria-pressed",String(soundEnabled));$("sound").textContent=soundEnabled?"🔊 Som":"🔇 Som";if(soundEnabled)beep()}
function beep(){try{const AudioContext=window.AudioContext||window.webkitAudioContext;const ctx=new AudioContext(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=440;gain.gain.setValueAtTime(.04,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.12);osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.12);osc.onended=()=>ctx.close()}catch{}}
// A mesa continua jogável se WebGL não estiver disponível.
import("../../vendor/three.module.js").then(THREE=>{const canvas=$("table"),renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,1,.1,100);camera.position.set(0,8,8);camera.lookAt(0,0,0);scene.add(new THREE.HemisphereLight(0xffffff,0x173c31,2));const table=new THREE.Mesh(new THREE.CylinderGeometry(5,5,.25,64),new THREE.MeshStandardMaterial({color:0x236c57,roughness:.85}));scene.add(table);const ring=new THREE.Mesh(new THREE.TorusGeometry(4.8,.035,8,80),new THREE.MeshStandardMaterial({color:0xa9cbb1}));ring.rotation.x=Math.PI/2;ring.position.y=.15;scene.add(ring);function draw(){const w=canvas.clientWidth,h=canvas.clientHeight;if(canvas.width!==w*devicePixelRatio||canvas.height!==h*devicePixelRatio){renderer.setPixelRatio(devicePixelRatio);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}renderer.render(scene,camera);requestAnimationFrame(draw)}draw()}).catch(()=>{})
