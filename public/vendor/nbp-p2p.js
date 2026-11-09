/**
 * NBP Games - P2P Multiplayer Room Manager (WebRTC via PeerJS + BroadcastChannel)
 * Allows browser-to-browser real-time rooms with zero backend cost.
 */
;(() => {
  const PEER_PREFIX = 'nbp-jogos-room-v2-'

  // Fast STUN servers + public OpenRelay TURN fallback (UDP/TCP/TLS) for CGNAT/firewalls
  const RTC_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      {
        urls: [
          'turn:openrelay.metered.ca:80',
          'turn:openrelay.metered.ca:443',
          'turn:openrelay.metered.ca:443?transport=tcp',
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
    ],
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
    const savedName =
      localStorage.getItem('nbp_guest_name') || `Jogador ${Math.floor(10 + Math.random() * 89)}`
    const colors = ['#38bdf8', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#f43f5e']
    const color = colors[Math.abs(guestId.charCodeAt(2) || 0) % colors.length]
    return { id: guestId, name: savedName, color }
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
      this.clientConns = new Map() // peerId -> DataConnection
      this.bc = null
      this._retryTimer = null
      this._joinRetryInterval = null
      this._joinTimeout = null
      this._hasSyncedFromHost = false
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
      if (this._retryTimer) {
        clearTimeout(this._retryTimer)
        this._retryTimer = null
      }
      if (this._joinRetryInterval) {
        clearInterval(this._joinRetryInterval)
        this._joinRetryInterval = null
      }
      if (this._joinTimeout) {
        clearTimeout(this._joinTimeout)
        this._joinTimeout = null
      }
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
            this._hasSyncedFromHost = true
            this.onStateSync(msg.state)
          } else if (msg.type === 'EVENT') {
            this.onAction(msg.payload, msg.senderProfile)
          }
        }
      }
    }

    hostRoom(rawCode, retryAttempt = 0) {
      const normalized = normalizeRoomCode(rawCode, this.defaultPrefix)
      if (!normalized) return

      // If already actively hosting this exact room on WebRTC, keep the connection alive!
      if (
        retryAttempt === 0 &&
        this.isHost &&
        this.roomCode === normalized &&
        this.peer &&
        !this.peer.destroyed &&
        !this.peer.disconnected &&
        this.peer.open
      ) {
        this.onStatus({ connected: true, mode: 'webrtc', roomCode: this.roomCode, isHost: true })
        return
      }

      const wasSameRoom = this.roomCode === normalized && this.peer !== null
      this.cleanup()
      this.roomCode = normalized
      this.isHost = true
      this._setupBroadcastChannel(this.roomCode)

      if (typeof window.Peer === 'undefined') {
        this.onStatus({ connected: true, mode: 'local', roomCode: this.roomCode, isHost: true })
        return
      }

      this.onStatus({
        connected: false,
        connecting: true,
        mode: 'connecting',
        roomCode: this.roomCode,
        isHost: true,
      })

      const startPeer = () => {
        const hostPeerId = `${PEER_PREFIX}${this.gameId}-${this.roomCode.toLowerCase()}`
        try {
          const peer = new window.Peer(hostPeerId, {
            debug: 1,
            config: RTC_CONFIG,
          })
          this.peer = peer

          peer.on('open', () => {
            if (this.peer !== peer) return
            this.onStatus({
              connected: true,
              mode: 'webrtc',
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
              if (data && data.type === 'ACTION') {
                this.onAction(data.payload, data.senderProfile)
              }
            })

            conn.on('close', () => {
              this.clientConns.delete(conn.peer)
              this.onAction({ type: 'PEER_LEFT', peerId: conn.peer }, null)
            })

            conn.on('error', () => {
              this.clientConns.delete(conn.peer)
            })
          })

          peer.on('disconnected', () => {
            if (this.peer === peer && !peer.destroyed) {
              try {
                peer.reconnect()
              } catch {}
            }
          })

          peer.on('error', (err) => {
            if (this.peer !== peer) return
            if (err && err.type === 'unavailable-id' && retryAttempt < 4) {
              try {
                peer.destroy()
              } catch {}
              this._retryTimer = setTimeout(() => {
                this.hostRoom(this.roomCode, retryAttempt + 1)
              }, 900)
              return
            }

            this.onStatus({
              connected: false,
              mode: 'local-fallback',
              roomCode: this.roomCode,
              isHost: true,
              warning: err?.type || 'erro-rede',
            })
            this.onError(err)
          })
        } catch (err) {
          this.onError(err)
        }
      }

      if (wasSameRoom && retryAttempt === 0) {
        this._retryTimer = setTimeout(startPeer, 350)
      } else {
        startPeer()
      }
    }

    joinRoom(rawCode) {
      const normalized = normalizeRoomCode(rawCode, this.defaultPrefix)
      if (!normalized) return

      this.cleanup()
      this.roomCode = normalized
      this.isHost = false
      this._hasSyncedFromHost = false
      this._setupBroadcastChannel(this.roomCode)

      this.onStatus({
        connected: false,
        connecting: true,
        mode: 'connecting',
        roomCode: this.roomCode,
        isHost: false,
      })

      // Announce via BroadcastChannel immediately (instant same-device multi-tab support)
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
        const peer = new window.Peer({
          debug: 1,
          config: RTC_CONFIG,
        })
        this.peer = peer

        this._joinTimeout = setTimeout(() => {
          if (!this._hasSyncedFromHost && (!this.hostConn || !this.hostConn.open)) {
            this.onStatus({
              connected: false,
              error: 'timeout',
              roomCode: this.roomCode,
              isHost: false,
            })
            this.onError(new Error(`Não foi possível conectar à sala ${this.roomCode}. Verifique se o Host criou a sala.`))
          }
        }, 12000)

        peer.on('open', () => {
          if (this.peer !== peer) return
          const conn = peer.connect(hostPeerId, {
            reliable: true,
            serialization: 'json',
          })
          this.hostConn = conn

          const sendJoinRequest = () => {
            if (conn.open) {
              conn.send({
                type: 'ACTION',
                senderId: this.profile.id,
                senderProfile: this.profile,
                payload: { type: 'JOIN_REQUEST', profile: this.profile },
              })
            }
          }

          conn.on('open', () => {
            if (this._joinTimeout) {
              clearTimeout(this._joinTimeout)
              this._joinTimeout = null
            }
            this.onStatus({
              connected: true,
              mode: 'webrtc',
              roomCode: this.roomCode,
              isHost: false,
            })
            sendJoinRequest()

            let attempts = 0
            this._joinRetryInterval = setInterval(() => {
              attempts++
              if (this._hasSyncedFromHost || attempts >= 5 || !conn.open) {
                clearInterval(this._joinRetryInterval)
                this._joinRetryInterval = null
                return
              }
              sendJoinRequest()
            }, 1000)
          })

          conn.on('data', (msg) => {
            if (!msg) return
            if (msg.type === 'STATE_SYNC') {
              this._hasSyncedFromHost = true
              if (this._joinTimeout) {
                clearTimeout(this._joinTimeout)
                this._joinTimeout = null
              }
              this.onStatus({
                connected: true,
                mode: 'webrtc',
                roomCode: this.roomCode,
                isHost: false,
              })
              this.onStateSync(msg.state)
            } else if (msg.type === 'EVENT') {
              this.onAction(msg.payload, msg.senderProfile)
            }
          })

          conn.on('close', () => {
            this.onStatus({ connected: false, roomCode: this.roomCode, isHost: false })
          })
        })

        peer.on('error', (err) => {
          if (this.peer !== peer) return
          if (this._hasSyncedFromHost) return
          if (this._joinTimeout) {
            clearTimeout(this._joinTimeout)
            this._joinTimeout = null
          }
          const msg =
            err?.type === 'peer-unavailable'
              ? `Sala ${this.roomCode} não encontrada! Confira o código com o Host.`
              : `Erro ao conectar na sala ${this.roomCode} (${err?.type || 'rede'}).`
          this.onStatus({
            connected: false,
            error: err?.type || 'error',
            roomCode: this.roomCode,
            isHost: false,
          })
          this.onError(new Error(msg))
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
        if (conn.open) {
          try {
            conn.send(packet)
          } catch {}
        }
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
        if (conn.open) {
          try {
            conn.send(packet)
          } catch {}
        }
      }
      if (this.bc) {
        this.bc.postMessage(packet)
      }
    }
  }

  window.NBPRoom = NBPRoom
})()
