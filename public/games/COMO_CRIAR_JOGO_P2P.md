# Guia Rápido: Como Criar e Conectar Jogos Multiplayer com NBPRoom

Para criar ou atualizar qualquer jogo em `public/games/<id>/`, consulte as regras obrigatórias de rede P2P:

### ⚠️ Métodos Proibidos vs Métodos Corretos

| Errado ❌ | Correto ✅ |
| :--- | :--- |
| `room.createRoom()` | `room.hostRoom(code)` |
| `room.updateProfile(...)` | `room.setPlayerName(name)` |
| `room.sendAction(...)` | `room.sendToHost(action)` |

---

### Snippet de Inicialização:

```javascript
// Scripts no index.html:
// <script src="../../vendor/peerjs.min.js"></script>
// <script src="../../vendor/nbp-p2p.js"></script>
// <script src="game.js"></script>

const room = new window.NBPRoom({
  gameId: 'meu-jogo',
  defaultPrefix: 'JOG',
  onStateSync: (remoteState) => {
    state = remoteState
    render()
  },
  onAction: (action, profile) => {
    if (room.isHost) handleHostAction(action, profile)
    else if (action?.type === 'HOST_LEFT') migrateHost(action.hostId)
  },
  onStatus: (status) => {
    if (status.connected && !room.isHost) {
      room.sendToHost({ type: 'JOIN_REQUEST', profile: room.profile })
    }
  }
})

function initHostRoom(customCode = '') {
  const code = (customCode || `JOG-${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase()
  room.hostRoom(code)
  state.players = [{ id: room.profile.id, name: room.profile.name }]
  render()
  room.broadcastState(state)
}

function joinExistingRoom(code) {
  room.joinRoom(code)
  room.sendToHost({ type: 'JOIN_REQUEST', profile: room.profile })
}

function sendAction(action) {
  if (room.isHost) handleHostAction(action, room.profile)
  else room.sendToHost(action)
}
```

Consulte a documentação completa em `docs/multiplayer-p2p.md`.
