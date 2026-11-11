/**
 * NBP Games - Hybrid P2P & WSS Multiplayer Room Manager
 * Combines:
 *  1. Multi-Broker MQTT over WSS (HiveMQ + EMQX) — 100% NAT/CGNAT/Incognito proof
 *  2. WebRTC DataChannel via PeerJS — direct low-latency P2P when UDP is open
 *  3. BroadcastChannel — 0ms local multi-tab sync
 *  4. Presence & Heartbeat Monitor — detects player/host disconnects & supports Host Migration
 */
;(() => {
  const PEER_PREFIX = 'nbp-jogos-room-v1-'
  const MQTT_TOPIC_PREFIX = 'nbp-jogos/room-v3'
  const WSS_BROKERS = [
    'wss://broker.hivemq.com:8884/mqtt',
    'wss://broker.emqx.io:8084/mqtt',
  ]

  const HEARTBEAT_INTERVAL_MS = 2800
  const CLIENT_TIMEOUT_MS = 8200
  const HOST_TIMEOUT_MS = 8800

  const RTC_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ],
  }

  const textEncoder = new TextEncoder()
  const textDecoder = new TextDecoder()

  function encodeVarLen(len) {
    const out = []
    do {
      let b = len % 128
      len = Math.floor(len / 128)
      if (len > 0) b |= 128
      out.push(b)
    } while (len > 0)
    return out
  }

  function buildMqttPublish(topic, jsonStr) {
    const tBytes = textEncoder.encode(topic)
    const pBytes = textEncoder.encode(jsonStr)
    const remLen = 2 + tBytes.length + pBytes.length
    const varLen = encodeVarLen(remLen)
    const pkt = new Uint8Array(1 + varLen.length + remLen)
    let i = 0
    pkt[i++] = 0x30
    for (let k = 0; k < varLen.length; k++) pkt[i++] = varLen[k]
    pkt[i++] = (tBytes.length >> 8) & 0xff
    pkt[i++] = tBytes.length & 0xff
    pkt.set(tBytes, i)
    i += tBytes.length
    pkt.set(pBytes, i)
    return pkt
  }

  function parseMqttPackets(u8) {
    const packets = []
    let offset = 0
    while (offset < u8.length) {
      const header = u8[offset++]
      let mult = 1
      let remLen = 0
      let b = 0
      do {
        if (offset >= u8.length) return packets
        b = u8[offset++]
        remLen += (b & 127) * mult
        mult *= 128
      } while ((b & 128) !== 0)
      if (offset + remLen > u8.length) break
      packets.push({
        type: header >> 4,
        flags: header & 0x0f,
        body: u8.subarray(offset, offset + remLen),
      })
      offset += remLen
    }
    return packets
  }

  function normalizeRoomCode(raw, defaultPrefix = 'ELO') {
    const cleaned = String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '-')
      .replace(/[^A-Z0-9-]/g, '')
    if (!cleaned) return ''
    if (/^\d{4}$/.test(cleaned)) {
      return `${defaultPrefix}-${cleaned}`
    }
    if (/^[A-Z]{3}\d{4}$/.test(cleaned)) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
    }
    return cleaned
  }

  function getLocalAccountProfile() {
    let tabId = ''
    try {
      tabId = sessionStorage.getItem('nbp_tab_id') || ''
      if (!tabId) {
        tabId = 'p_' + Math.random().toString(36).slice(2, 9)
        sessionStorage.setItem('nbp_tab_id', tabId)
      }
    } catch {
      tabId = 'p_' + Math.random().toString(36).slice(2, 9)
    }

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
            id: `${user.id}_${tabId}`,
            name: user.name || user.username || 'Jogador',
            color: user.color || '#38bdf8',
          }
        }
      }
    } catch {
      // ignore storage read errors
    }

    let savedName = ''
    try {
      savedName = localStorage.getItem('nbp_guest_name') || ''
    } catch {}
    if (!savedName) {
      savedName = `Jogador ${Math.floor(10 + Math.random() * 89)}`
    }
    const colors = ['#38bdf8', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#f43f5e']
    const color = colors[Math.abs(tabId.charCodeAt(2) || 0) % colors.length]
    return { id: tabId, name: savedName, color }
  }

  class NBPRoom {
    constructor(options = {}) {
      this.gameId = options.gameId || 'game'
      this.defaultPrefix = options.defaultPrefix || 'ELO'
      this.onStateSync = options.onStateSync || (() => {})
      this.onAction = options.onAction || (() => {})
      this.onStatus = options.onStatus || (() => {})
      this.onError = options.onError || (() => {})

      this.profile = getLocalAccountProfile()
      this.roomCode = ''
      this.isHost = false
      this.peer = null
      this.hostConn = null
      this.clientConns = new Map()
      this.peerIdToPlayerId = new Map()
      this.clientLastSeen = new Map() // playerId -> timestamp
      this.bc = null
      this.mqttClients = []
      this.seenPacketIds = new Set()
      this._joinRetryInterval = null
      this._joinTimeout = null
      this._heartbeatTimer = null
      this._hasSyncedFromHost = false
      this._lastHostSeenAt = 0
      this._currentHostId = ''

      this._boundUnload = () => {
        this._sendLeaveSignal()
      }
      if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', this._boundUnload)
        window.addEventListener('beforeunload', this._boundUnload)
      }
    }

    setPlayerName(name) {
      const clean = String(name || '').trim().slice(0, 20)
      if (clean) {
        this.profile.name = clean
        try {
          localStorage.setItem('nbp_guest_name', clean)
        } catch {}
      }
    }

    _sendLeaveSignal() {
      if (!this.roomCode) return
      try {
        if (this.isHost) {
          this.broadcastEvent({
            type: 'HOST_LEFT',
            hostId: this.profile.id,
            hostName: this.profile.name,
          })
        } else {
          this.sendToHost({
            type: 'PLAYER_LEFT',
            playerId: this.profile.id,
            playerName: this.profile.name,
          })
        }
      } catch {}
    }

    cleanup(notifyLeave = true) {
      if (notifyLeave && this.roomCode) {
        this._sendLeaveSignal()
      }
      if (this._heartbeatTimer) {
        clearInterval(this._heartbeatTimer)
        this._heartbeatTimer = null
      }
      if (this._joinRetryInterval) {
        clearInterval(this._joinRetryInterval)
        this._joinRetryInterval = null
      }
      if (this._joinTimeout) {
        clearTimeout(this._joinTimeout)
        this._joinTimeout = null
      }
      for (const client of this.mqttClients) {
        try {
          clearInterval(client.pingTimer)
          client.ws.onclose = null
          client.ws.onerror = null
          client.ws.onmessage = null
          client.ws.close()
        } catch {}
      }
      this.mqttClients = []
      this.clientLastSeen.clear()
      this.peerIdToPlayerId.clear()

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

    _startHeartbeatLoop() {
      if (this._heartbeatTimer) {
        clearInterval(this._heartbeatTimer)
      }
      this._lastHostSeenAt = Date.now()

      this._heartbeatTimer = setInterval(() => {
        const now = Date.now()
        if (this.isHost) {
          // 1. Broadcast host heartbeat so clients know host is alive
          const pingPkt = {
            pktId: this._makePacketId(),
            type: 'HOST_PING',
            target: 'clients',
            senderId: this.profile.id,
          }
          for (const conn of this.clientConns.values()) {
            if (conn.open) {
              try {
                conn.send(pingPkt)
              } catch {}
            }
          }
          this._publishMqtt(pingPkt)
          if (this.bc) {
            try {
              this.bc.postMessage(pingPkt)
            } catch {}
          }

          // 2. Check if any client timed out
          for (const [playerId, lastSeen] of this.clientLastSeen.entries()) {
            if (now - lastSeen > CLIENT_TIMEOUT_MS) {
              this.clientLastSeen.delete(playerId)
              this.onAction({ type: 'PLAYER_LEFT', playerId }, null)
            }
          }
        } else {
          // Client sends heartbeat to Host
          if (this._hasSyncedFromHost) {
            this.sendToHost({ type: 'HEARTBEAT', profile: this.profile })
            if (now - this._lastHostSeenAt > HOST_TIMEOUT_MS) {
              this._lastHostSeenAt = now
              this.onAction({ type: 'HOST_LEFT', hostId: this._currentHostId }, null)
            }
          }
        }
      }, HEARTBEAT_INTERVAL_MS)
    }

    _makePacketId() {
      return `${this.profile.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    }

    _handleIncomingPacket(msg, fromPeerId = null) {
      if (!msg || msg.senderId === this.profile.id) return
      if (msg.pktId) {
        if (this.seenPacketIds.has(msg.pktId)) return
        this.seenPacketIds.add(msg.pktId)
        if (this.seenPacketIds.size > 600) {
          const first = this.seenPacketIds.values().next().value
          this.seenPacketIds.delete(first)
        }
      }

      if (this.isHost && (msg.target === 'host' || msg.type === 'ACTION')) {
        if (msg.senderId) {
          this.clientLastSeen.set(msg.senderId, Date.now())
          if (fromPeerId) {
            this.peerIdToPlayerId.set(fromPeerId, msg.senderId)
          }
        }
        if (msg.payload?.type === 'PLAYER_LEFT') {
          this.clientLastSeen.delete(msg.payload.playerId || msg.senderId)
        }
        if (msg.payload?.type === 'HEARTBEAT') {
          // Update presence only; if Host doesn't know this player yet, treat as JOIN_REQUEST
          this.onAction({ type: 'HEARTBEAT', profile: msg.payload.profile || msg.senderProfile }, msg.senderProfile)
          return
        }
        this.onAction(msg.payload, msg.senderProfile)
      } else if (
        !this.isHost &&
        (msg.target === 'clients' || msg.type === 'STATE_SYNC' || msg.type === 'EVENT' || msg.type === 'HOST_PING')
      ) {
        this._lastHostSeenAt = Date.now()
        if (msg.senderId) {
          this._currentHostId = msg.senderId
        }
        if (msg.type === 'HOST_PING') {
          return
        }
        if (msg.type === 'STATE_SYNC') {
          this._hasSyncedFromHost = true
          if (this._joinTimeout) {
            clearTimeout(this._joinTimeout)
            this._joinTimeout = null
          }
          this.onStatus({
            connected: true,
            mode: 'online',
            roomCode: this.roomCode,
            isHost: false,
          })
          this.onStateSync(msg.state)
        } else if (msg.type === 'EVENT') {
          this.onAction(msg.payload, msg.senderProfile)
        }
      }
    }

    _setupBroadcastChannel(roomCode) {
      if (typeof BroadcastChannel === 'undefined') return
      this.bc = new BroadcastChannel(`nbp:${this.gameId}:${roomCode}`)
      this.bc.onmessage = (ev) => {
        this._handleIncomingPacket(ev.data)
      }
    }

    _setupMqttRelays(roomCode, onFirstReady) {
      const topic = `${MQTT_TOPIC_PREFIX}/${this.gameId}/${roomCode.toLowerCase()}`
      let readyFired = false

      for (const brokerUrl of WSS_BROKERS) {
        try {
          const ws = new WebSocket(brokerUrl, 'mqtt')
          ws.binaryType = 'arraybuffer'
          const clientObj = { ws, ready: false, topic, pingTimer: null }
          this.mqttClients.push(clientObj)

          ws.onopen = () => {
            const clientId = `nbp_${this.profile.id}_${Math.random().toString(36).slice(2, 7)}`
            const idBytes = textEncoder.encode(clientId)
            const connPkt = new Uint8Array(14 + idBytes.length)
            connPkt.set([
              0x10,
              12 + idBytes.length,
              0x00,
              0x04,
              0x4d,
              0x51,
              0x54,
              0x54,
              0x04,
              0x02,
              0x00,
              0x3c,
              0x00,
              idBytes.length,
            ])
            connPkt.set(idBytes, 14)
            ws.send(connPkt)
          }

          ws.onmessage = (ev) => {
            const packets = parseMqttPackets(new Uint8Array(ev.data))
            for (const pkt of packets) {
              if (pkt.type === 2) {
                const tBytes = textEncoder.encode(topic)
                const remLen = 2 + 2 + tBytes.length + 1
                const subPkt = new Uint8Array(2 + remLen)
                subPkt.set([
                  0x82,
                  remLen,
                  0x00,
                  0x01,
                  (tBytes.length >> 8) & 0xff,
                  tBytes.length & 0xff,
                ])
                subPkt.set(tBytes, 6)
                subPkt[6 + tBytes.length] = 0x00
                ws.send(subPkt)

                clientObj.pingTimer = setInterval(() => {
                  if (ws.readyState === WebSocket.OPEN) {
                    try {
                      ws.send(new Uint8Array([0xc0, 0x00]))
                    } catch {}
                  }
                }, 25000)
              } else if (pkt.type === 9) {
                clientObj.ready = true
                if (!readyFired) {
                  readyFired = true
                  if (onFirstReady) onFirstReady()
                }
              } else if (pkt.type === 3) {
                try {
                  const tLen = (pkt.body[0] << 8) | pkt.body[1]
                  const qos = (pkt.flags >> 1) & 0x03
                  const pStart = 2 + tLen + (qos > 0 ? 2 : 0)
                  const jsonStr = textDecoder.decode(pkt.body.subarray(pStart))
                  const msg = JSON.parse(jsonStr)
                  this._handleIncomingPacket(msg)
                } catch {}
              }
            }
          }
        } catch {}
      }
    }

    _publishMqtt(packet) {
      const jsonStr = JSON.stringify(packet)
      for (const c of this.mqttClients) {
        if (c.ready && c.ws.readyState === WebSocket.OPEN) {
          try {
            c.ws.send(buildMqttPublish(c.topic, jsonStr))
          } catch {}
        }
      }
    }

    _initHostPeer(roomCode) {
      if (typeof window.Peer === 'undefined') return
      const hostPeerId = `${PEER_PREFIX}${this.gameId}-${roomCode.toLowerCase()}`
      try {
        const peer = new window.Peer(hostPeerId, {
          debug: 0,
          config: RTC_CONFIG,
        })
        this.peer = peer

        peer.on('open', () => {
          if (this.peer !== peer) return
          this.onStatus({
            connected: true,
            mode: 'online',
            roomCode: this.roomCode,
            isHost: true,
          })
        })

        peer.on('connection', (conn) => {
          if (this.peer !== peer) return
          this.clientConns.set(conn.peer, conn)

          conn.on('open', () => {
            this.clientConns.set(conn.peer, conn)
            this.onAction({ type: 'PEER_CONNECTED', peerId: conn.peer }, null)
          })

          conn.on('data', (data) => {
            this.clientConns.set(conn.peer, conn)
            this._handleIncomingPacket(data, conn.peer)
          })

          conn.on('close', () => {
            this.clientConns.delete(conn.peer)
            const pid = this.peerIdToPlayerId.get(conn.peer)
            if (pid) {
              this.peerIdToPlayerId.delete(conn.peer)
              this.clientLastSeen.delete(pid)
              this.onAction({ type: 'PLAYER_LEFT', playerId: pid }, null)
            }
          })
        })

        peer.on('error', () => {})
      } catch {}
    }

    hostRoom(rawCode) {
      const normalized = normalizeRoomCode(rawCode, this.defaultPrefix)
      if (!normalized) return

      if (this.isHost && this.roomCode === normalized && this.mqttClients.some((c) => c.ready)) {
        this.onStatus({ connected: true, mode: 'online', roomCode: this.roomCode, isHost: true })
        return
      }

      this.cleanup(true)
      this.roomCode = normalized
      this.isHost = true
      this._setupBroadcastChannel(this.roomCode)
      this._startHeartbeatLoop()

      this.onStatus({
        connected: false,
        connecting: true,
        mode: 'connecting',
        roomCode: this.roomCode,
        isHost: true,
      })

      this._setupMqttRelays(this.roomCode, () => {
        this.onStatus({
          connected: true,
          mode: 'online',
          roomCode: this.roomCode,
          isHost: true,
        })
      })

      this._initHostPeer(this.roomCode)
    }

    // Seamlessly promotes an already-connected Client to Host when the previous Host leaves
    promoteToHost(existingPlayers = []) {
      if (this.isHost) return
      if (this._joinRetryInterval) {
        clearInterval(this._joinRetryInterval)
        this._joinRetryInterval = null
      }
      if (this._joinTimeout) {
        clearTimeout(this._joinTimeout)
        this._joinTimeout = null
      }
      if (this.hostConn) {
        try {
          this.hostConn.close()
        } catch {}
        this.hostConn = null
      }
      if (this.peer) {
        try {
          this.peer.destroy()
        } catch {}
        this.peer = null
      }

      this.isHost = true
      this.clientLastSeen.clear()
      const now = Date.now()
      for (const p of existingPlayers) {
        if (!p.isBot && p.id !== this.profile.id) {
          this.clientLastSeen.set(p.id, now)
        }
      }

      this._startHeartbeatLoop()
      this._initHostPeer(this.roomCode)
      this.onStatus({
        connected: true,
        mode: 'online',
        roomCode: this.roomCode,
        isHost: true,
      })
    }

    joinRoom(rawCode) {
      const normalized = normalizeRoomCode(rawCode, this.defaultPrefix)
      if (!normalized) return

      this.cleanup(true)
      this.roomCode = normalized
      this.isHost = false
      this._hasSyncedFromHost = false
      this._setupBroadcastChannel(this.roomCode)
      this._startHeartbeatLoop()

      this.onStatus({
        connected: false,
        connecting: true,
        mode: 'connecting',
        roomCode: this.roomCode,
        isHost: false,
      })

      const sendJoinAnnouncement = () => {
        this.sendToHost({ type: 'JOIN_REQUEST', profile: this.profile })
      }

      sendJoinAnnouncement()

      this._setupMqttRelays(this.roomCode, () => {
        sendJoinAnnouncement()
      })

      let attempts = 0
      this._joinRetryInterval = setInterval(() => {
        attempts++
        if (this._hasSyncedFromHost || attempts >= 10) {
          clearInterval(this._joinRetryInterval)
          this._joinRetryInterval = null
          return
        }
        sendJoinAnnouncement()
      }, 900)

      this._joinTimeout = setTimeout(() => {
        if (!this._hasSyncedFromHost) {
          this.onStatus({
            connected: false,
            error: 'timeout',
            roomCode: this.roomCode,
            isHost: false,
          })
          this.onError(
            new Error(`Sala ${this.roomCode} não respondeu. Verifique se o Host está com a sala aberta.`)
          )
        }
      }, 10000)

      if (typeof window.Peer === 'undefined') return

      const hostPeerId = `${PEER_PREFIX}${this.gameId}-${this.roomCode.toLowerCase()}`
      try {
        const peer = new window.Peer({
          debug: 0,
          config: RTC_CONFIG,
        })
        this.peer = peer

        peer.on('open', () => {
          if (this.peer !== peer) return
          const conn = peer.connect(hostPeerId, {
            reliable: true,
            serialization: 'json',
          })
          this.hostConn = conn

          conn.on('open', () => {
            sendJoinAnnouncement()
          })

          conn.on('data', (msg) => {
            this._handleIncomingPacket(msg)
          })
        })

        peer.on('error', () => {})
      } catch {}
    }

    sendToHost(payload) {
      if (this.isHost) {
        this.onAction(payload, this.profile)
        return
      }
      const packet = {
        pktId: this._makePacketId(),
        type: 'ACTION',
        target: 'host',
        senderId: this.profile.id,
        senderProfile: this.profile,
        payload,
      }
      if (this.hostConn && this.hostConn.open) {
        try {
          this.hostConn.send(packet)
        } catch {}
      }
      this._publishMqtt(packet)
      if (this.bc) {
        try {
          this.bc.postMessage(packet)
        } catch {}
      }
    }

    broadcastState(state) {
      if (!this.isHost) return
      const packet = {
        pktId: this._makePacketId(),
        type: 'STATE_SYNC',
        target: 'clients',
        senderId: this.profile.id,
        state,
      }
      for (const conn of this.clientConns.values()) {
        if (conn.open) {
          try {
            conn.send(packet)
          } catch {}
        }
      }
      this._publishMqtt(packet)
      if (this.bc) {
        try {
          this.bc.postMessage(packet)
        } catch {}
      }
    }

    syncState(state) {
      return this.broadcastState(state)
    }

    broadcastEvent(payload) {
      if (!this.isHost) return
      const packet = {
        pktId: this._makePacketId(),
        type: 'EVENT',
        target: 'clients',
        senderId: this.profile.id,
        senderProfile: this.profile,
        payload,
      }
      for (const conn of this.clientConns.values()) {
        if (conn.open) {
          try {
            conn.send(packet)
          } catch {}
        }
      }
      this._publishMqtt(packet)
      if (this.bc) {
        try {
          this.bc.postMessage(packet)
        } catch {}
      }
    }
  }

  window.NBPRoom = NBPRoom
})()
