# Guia Definitivo do Multiplayer P2P (NBPRoom) · NBP Games

Este documento define a arquitetura, métodos públicos e o fluxo obrigatório para jogos multiplayer em tempo real na plataforma **NBP Games**, utilizando o motor `public/vendor/nbp-p2p.js`.

---

## 1. O que é o `NBPRoom`?

O `NBPRoom` é o gerenciador de salas híbrido do NBP Games. Ele combina:
1. **MQTT sobre WebSockets seguros (HiveMQ + EMQX)**: Conexão resiliente à prova de NAT, CGNAT e abas anônimas.
2. **WebRTC DataChannels via PeerJS**: P2P direto de baixa latência quando portas UDP estão liberadas.
3. **BroadcastChannel**: Sincronização instantânea (0ms) entre abas locais do mesmo navegador.
4. **Heartbeat & Monitor de Presença**: Detecta quedas de clientes e permite migração de Host (*Host Migration*).

---

## 2. Métodos Públicos Oficiais da Classe `NBPRoom`

> ⚠️ **ATENÇÃO / ERRO COMUM**:
> - ❌ **NÃO existe** `room.createRoom()`. O método correto é **`room.hostRoom(code)`**!
> - ❌ **NÃO existe** `room.updateProfile()`. O método correto é **`room.setPlayerName(name)`**!
> - ❌ **NÃO existe** `room.sendAction()`. O método correto do cliente para o host é **`room.sendToHost(action)`**!

| Método | Quem chama | Descrição |
| :--- | :--- | :--- |
| `new NBPRoom(options)` | Ambos | Instancia o gerenciador de sala com callbacks (`onStateSync`, `onAction`, `onStatus`, `onError`). |
| `room.hostRoom(code)` | **Host** | Cria e abre uma nova sala com o código fornecido (ex: `GOL-1234`). |
| `room.joinRoom(code)` | **Cliente** | Conecta-se a uma sala existente com o código fornecido. |
| `room.sendToHost(action)` | **Cliente** | Envia um pacote/ação diretamente para o Host da sala. |
| `room.broadcastState(state)` | **Host** | Envia o estado completo do jogo para todos os clientes conectados. |
| `room.broadcastEvent(event)` | **Host** | Envia um evento pontual para todos os clientes. |
| `room.setPlayerName(name)` | Ambos | Atualiza o apelido do jogador local (salva em `localStorage`). |
| `room.promoteToHost(players)` | **Novo Host** | Assume como novo Host caso o Host anterior saia (*Host Migration*). |
| `room.cleanup(notifyLeave)` | Ambos | Fecha conexões e limpa timers e canais. |

---

## 3. Propriedades Públicas do `room`

- `room.isHost` (*boolean*): `true` se a instância atual é o Host da sala; `false` se for um Cliente conectado.
- `room.roomCode` (*string*): Código atual da sala formatado (ex: `GOL-2384`).
- `room.profile` (*object*): Perfil do jogador local: `{ id, name, color }`.

---

## 4. Template Padrão de Integração (`game.js`)

Ao criar qualquer novo jogo multiplayer em `public/games/<id>/game.js`, siga rigorosamente este modelo:

```javascript
// 1. Instanciação do NBPRoom
const room = new window.NBPRoom({
  gameId: 'meu-jogo',
  defaultPrefix: 'JOG',
  onStateSync: (remoteState) => {
    gameState = remoteState
    render()
  },
  onAction: (actionData, profile) => {
    if (room.isHost) {
      handleHostAction(actionData, profile)
    } else if (actionData?.type === 'HOST_LEFT') {
      migrateHost(actionData.hostId)
    }
  },
  onStatus: (status) => {
    updateStatusUI(status)
    // Se conectou como cliente, avisa o Host imediatamente:
    if (status.connected && !room.isHost) {
      room.sendToHost({ type: 'JOIN_REQUEST', profile: room.profile })
    }
  },
  onError: (err) => {
    console.error('Erro de rede P2P:', err)
  },
})

// 2. Criação da Sala (Host)
function initHostRoom(customCode = '') {
  const code = (customCode || `JOG-${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase()
  room.hostRoom(code)
  
  // Inicializa o estado do jogo
  gameState.roomCode = code
  gameState.players = [
    { id: room.profile.id, name: room.profile.name, isHost: true }
  ]
  syncState()
}

// 3. Entrada na Sala (Cliente)
function joinExistingRoom(code) {
  if (!code) return
  room.joinRoom(code)
  room.sendToHost({ type: 'JOIN_REQUEST', profile: room.profile })
}

// 4. Envio de Ação
function sendAction(actionData) {
  if (room.isHost) {
    handleHostAction(actionData, room.profile)
  } else {
    room.sendToHost(actionData)
  }
}

// 5. Sincronização do Estado pelo Host
function syncState() {
  render()
  if (room.isHost) {
    room.broadcastState(gameState)
  }
}

// 6. Atualização de Apelido
function updateNickname(newName) {
  const clean = newName.trim()
  room.setPlayerName(clean)
  if (!room.isHost) {
    room.sendToHost({ type: 'JOIN_REQUEST', profile: room.profile })
  } else {
    const me = gameState.players.find(p => p.id === room.profile.id)
    if (me) me.name = clean
    syncState()
  }
}

// 7. Auto-Inicialização via URL (DOMContentLoaded)
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search)
  const roomParam = params.get('room') || params.get('sala')
  const nickParam = params.get('nick') || params.get('nome')

  if (nickParam) {
    room.setPlayerName(nickParam)
  }

  if (roomParam) {
    joinExistingRoom(roomParam.trim().toUpperCase())
  } else {
    initHostRoom()
  }
})
```

---

## 5. Parâmetros de Convite de Sala

Para convidar amigos:
- Sempre use o parâmetro limpo: `?room=${code}` (sem duplicar `?room=X&sala=X`).
- Exemplo: `https://jogos.arkadice.com/jogos/golpe-nbp?room=GOL-1234`.
