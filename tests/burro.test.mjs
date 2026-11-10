import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"

const source = readFileSync(new URL("../public/games/burro/game.js", import.meta.url), "utf8").split("// O tabuleiro")[0]
function setup() {
  let nextId = 0
  const timers = new Map(), elements = new Map()
  const element = () => ({dataset:{},style:{setProperty(){}},classList:{add(){},remove(){}},setAttribute(){},replaceChildren(){},value:"normal",textContent:""})
  const document = {getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelector:element}
  class NBPRoom {
    constructor(options){this.options=options;this.profile={id:"host",name:"Host"};this.isHost=true;this.roomCode="BUR-1234"}
    broadcastState(){}
    sendToHost(action){this.options.onAction(action,this.profile)}
  }
  const context=vm.createContext({document,NBPRoom,clearTimeout:id=>timers.delete(id),setTimeout:fn=>{const id=++nextId;timers.set(id,fn);return id}})
  vm.runInContext(source,context)
  const run=code=>vm.runInContext(code,context)
  const fire=()=>{const [id,fn]=timers.entries().next().value||[];assert.ok(fn,"esperava uma ação agendada");timers.delete(id);fn()}
  run(`state={phase:"playing",players:[{id:"host",name:"Host",hand:[{c:"blue",v:"2"}]},{id:"other",name:"Outra pessoa",hand:[{c:"red",v:"4"}]}],turn:0,dir:1,drawn:false,challenge:null,pile:[{c:"red",v:"1"}],color:"red",deck:[]}`)
  return {run,fire,timers}
}
test("compra e passa automaticamente quando a carta comprada não serve",()=>{
  const {run,fire}=setup()
  run(`state.deck=[{c:"green",v:"7"}];sync()`)
  fire()
  assert.equal(run("state.players[0].hand.length"),2)
  assert.equal(run("state.drawn"),true)
  fire()
  assert.equal(run("state.turn"),1)
  assert.match(run("state.notice"),/automaticamente/)
})
test("mantém a escolha do jogador quando a carta comprada pode ser jogada",()=>{
  const {run,fire,timers}=setup()
  run(`state.deck=[{c:"red",v:"8"}];sync()`)
  fire()
  assert.equal(run("state.drawn"),true)
  assert.equal(run("state.turn"),0)
  assert.equal(timers.size,0)
})
test("não automatiza jogadas disponíveis ou decisão de desafio",()=>{
  const {run,timers}=setup()
  run(`state.players[0].hand=[{c:"wild",v:"draw4"}];sync()`)
  assert.equal(timers.size,0)
  run(`state.players[0].hand=[{c:"blue",v:"2"}];state.challenge={offender:"other",illegal:false};sync()`)
  assert.equal(timers.size,0)
})
test("finaliza em empate se não houver compra nem jogada possível",()=>{
  const {run,fire}=setup()
  run(`state.players[1].hand=[{c:"green",v:"9"}];sync()`)
  fire()
  assert.equal(run("state.phase"),"finished")
  assert.match(run("state.notice"),/Empate/)
})
test("heartbeat não reinicia uma ação automática pendente",()=>{
  const {run,timers}=setup()
  run("sync()")
  const before=[...timers.keys()]
  run("sync()")
  assert.deepEqual([...timers.keys()],before)
})
