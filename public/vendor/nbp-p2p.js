/**
 * NBP Games - P2P Multiplayer Room Manager (WebRTC via PeerJS + BroadcastChannel)
 * Allows browser-to-browser real-time rooms with zero backend cost.
 */
;(() => {
  const PEER_PREFIX = 'nbp-jogos-room-v1-'

  function getLocalAccountProfile() {
    try {
      const sessRaw =
        localStorage.getItem('playground.session.v1') ||
        sessionStorage.getItem('playground.session.v1')
      const dbRaw = localStorage.getItem('playground.accounts.v1')
      if (sessRaw && dbRaw) {
        const sess = JSON.parse(sessRaw)
        const db = JSON.parse(dbRaw)
        const user = (db.users || []).find((u) => u.id === sess.userId)
        if (user) {
          return {
            id: user.id,
            name: user.name || user.username || 'Jogador',
            color: user.color || '#38bdf8',
          }
        }
      }
    } catch {
      // ignore storage read errors
    }

    let guestId = sessionStorage.getItem('nbp_guest_id')
    if (!guestId) {
      guestId = 'p_' + Math.random().toString(36).slice(2, 9)
      sessionStorage.setItem('nbp_guest_id', guestId)
    }
    const savedName = localStorage.getItem('nbp_guest_name') || `Jogador ${Math.floor(10 + Math.random() * 89)}`
    const colors = ['#38bdf8', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#f43f5e']
    const color = colors[Math.abs(guestId.charCodeAt(2) || 0) % colors.length]
    return { id: guestId, name: savedName, color }
  }

  class NBPRoom {
    constructor(options = {}) {
      this.gameId = options.gameId || 'game'
      this.onStateSync = options.onStateSync || (() => {})
      this.onAction = options.onAction || (() => {})
      this.onStatus = options.onStatus || (() => {})
      this.onError = options.onError || (() => {})

      this.profile = getLocalAccountProfile()
      this.roomCode = ''
      this.isHost = false
      this.peer = null
      this.hostConn = null
      this.clientConns = new Map() // peerId -> DataConnection
      this.bc = null
    }

    setPlayerName(name) {
      const clean = String(name || '').trim().slice(0, 20)
      if (clean) {
        this.profile.name = clean
        try {
          localStorage.setItem('nbp_guest_name', clean)
        } catch {
          // ignore
        }
      }
    }

    cleanup() {
      if (this.bc) {
        try {
          this.bc.close()
        } catch {}
        this.bc = null
      }
      if (this.hostConn) {
        try {
          this.hostConn.close()
        } catch {}
        this.hostConn = null
      }
      for (const conn of this.clientConns.values()) {
        try {
          conn.close()
        } catch {}
      }
      this.clientConns.clear()
      if (this.peer) {
        try {
          this.peer.destroy()
        } catch {}
        this.peer = null
      }
    }

    _setupBroadcastChannel(roomCode) {
      if (typeof BroadcastChannel === 'undefined') return
      this.bc = new BroadcastChannel(`nbp:${this.gameId}:${roomCode}`)
      this.bc.onmessage = (ev) => {
        const msg = ev.data
        if (!msg || msg.senderId === this.profile.id) return
        if (this.isHost && msg.target === 'host') {
          this.onAction(msg.payload, msg.senderProfile)
        } else if (!this.isHost && msg.target === 'clients') {
          if (msg.type === 'STATE_SYNC') {
            this.onStateSync(msg.state)
          } else if (msg.type === 'EVENT') {
            this.onAction(msg.payload, msg.senderProfile)
          }
        }
      }
    }

    hostRoom(roomCode) {
      this.cleanup()
      this.roomCode = String(roomCode).trim().toUpperCase()
      this.isHost = true
      this._setupBroadcastChannel(this.roomCode)

      if (typeof window.Peer === 'undefined') {
        this.onStatus({ connected: true, mode: 'local', roomCode: this.roomCode, isHost: true })
        return
      }

      const hostPeerId = `${PEER_PREFIX}${this.gameId}-${this.roomCode.toLowerCase()}`
      try {
        this.peer = new window.Peer(hostPeerId, {
          debug: 0,
        })

        this.peer.on('open', () => {
          this.onStatus({ connected: true, mode: 'webrtc', roomCode: this.roomCode, isHost: true })
        })

        this.peer.on('connection', (conn) => {
          conn.on('open', () => {
            this.clientConns.set(conn.peer, conn)
          })
          conn.on('data', (data) => {
            if (data && data.type === 'ACTION') {
              this.onAction(data.payload, data.senderProfile)
            }
          })
          conn.on('close', () => {
            this.clientConns.delete(conn.peer)
            this.onAction({ type: 'PEER_LEFT', peerId: conn.peer }, null)
          })
        })

        this.peer.on('error', (err) => {
          // Still works via BroadcastChannel even if PeerServer is unreachable or ID taken
          this.onStatus({
            connected: true,
            mode: 'local-fallback',
            roomCode: this.roomCode,
            isHost: true,
            warning: err?.type,
          })
        })
      } catch (err) {
        this.onError(err)
      }
    }

    joinRoom(roomCode) {
      this.cleanup()
      this.roomCode = String(roomCode).trim().toUpperCase()
      this.isHost = false
      this._setupBroadcastChannel(this.roomCode)

      // Announce via BroadcastChannel immediately (instant same-device multi-tab support!)
      if (this.bc) {
        this.bc.postMessage({
          target: 'host',
          senderId: this.profile.id,
          senderProfile: this.profile,
          payload: { type: 'JOIN_REQUEST', profile: this.profile },
        })
      }

      if (typeof window.Peer === 'undefined') {
        this.onStatus({ connected: true, mode: 'local', roomCode: this.roomCode, isHost: false })
        return
      }

      const hostPeerId = `${PEER_PREFIX}${this.gameId}-${this.roomCode.toLowerCase()}`
      try {
        this.peer = new window.Peer({ debug: 0 })
        this.peer.on('open', () => {
          const conn = this.peer.connect(hostPeerId, { reliable: true })
          this.hostConn = conn
          conn.on('open', () => {
            this.onStatus({ connected: true, mode: 'webrtc', roomCode: this.roomCode, isHost: false })
            this.sendToHost({ type: 'JOIN_REQUEST', profile: this.profile })
          })
          conn.on('data', (msg) => {
            if (!msg) return
            if (msg.type === 'STATE_SYNC') {
              this.onStateSync(msg.state)
            } else if (msg.type === 'EVENT') {
              this.onAction(msg.payload, msg.senderProfile)
            }
          })
          conn.on('close', () => {
            this.onStatus({ connected: false, roomCode: this.roomCode, isHost: false })
          })
        })
        this.peer.on('error', () => {
          this.onStatus({ connected: true, mode: 'local-tab', roomCode: this.roomCode, isHost: false })
        })
      } catch (err) {
        this.onError(err)
      }
    }

    sendToHost(payload) {
      if (this.isHost) {
        this.onAction(payload, this.profile)
        return
      }
      if (this.hostConn && this.hostConn.open) {
        this.hostConn.send({
          type: 'ACTION',
          senderId: this.profile.id,
          senderProfile: this.profile,
          payload,
        })
      }
      if (this.bc) {
        this.bc.postMessage({
          target: 'host',
          senderId: this.profile.id,
          senderProfile: this.profile,
          payload,
        })
      }
    }

    broadcastState(state) {
      if (!this.isHost) return
      const packet = {
        type: 'STATE_SYNC',
        target: 'clients',
        senderId: this.profile.id,
        state,
      }
      for (const conn of this.clientConns.values()) {
        if (conn.open) conn.send(packet)
      }
      if (this.bc) {
        this.bc.postMessage(packet)
      }
    }

    broadcastEvent(payload) {
      if (!this.isHost) return
      const packet = {
        type: 'EVENT',
        target: 'clients',
        senderId: this.profile.id,
        senderProfile: this.profile,
        payload,
      }
      for (const conn of this.clientConns.values()) {
        if (conn.open) conn.send(packet)
      }
      if (this.bc) {
        this.bc.postMessage(packet)
      }
    }
  }

  window.NBPRoom = NBPRoom
})()
