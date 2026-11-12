;(function (root) {
  class EKAudio {
    constructor() {
      this.ctx = null
      this.muted = false
      try {
        this.muted = localStorage.getItem('ek_muted') === '1'
      } catch {}
    }

    _ensureCtx() {
      if (this.muted || typeof window === 'undefined') return null
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext
        if (AudioCtx) this.ctx = new AudioCtx()
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {})
      }
      return this.ctx
    }

    toggleMute() {
      this.muted = !this.muted
      try {
        localStorage.setItem('ek_muted', this.muted ? '1' : '0')
      } catch {}
      return this.muted
    }

    playSlap() {
      const ctx = this._ensureCtx()
      if (!ctx) return
      const t = ctx.currentTime

      const snap = ctx.createOscillator()
      const snapGain = ctx.createGain()
      snap.type = 'triangle'
      snap.frequency.setValueAtTime(390, t)
      snap.frequency.exponentialRampToValueAtTime(75, t + 0.045)
      snapGain.gain.setValueAtTime(0.35, t)
      snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
      snap.connect(snapGain)
      snapGain.connect(ctx.destination)
      snap.start(t)
      snap.stop(t + 0.05)

      const bufSize = Math.floor(ctx.sampleRate * 0.045)
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
      const noise = ctx.createBufferSource()
      noise.buffer = buf
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(1400, t)
      const noiseGain = ctx.createGain()
      noiseGain.gain.setValueAtTime(0.22, t)
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.045)
      noise.connect(filter)
      filter.connect(noiseGain)
      noiseGain.connect(ctx.destination)
      noise.start(t)

      const thud = ctx.createOscillator()
      const thudGain = ctx.createGain()
      thud.type = 'sine'
      thud.frequency.setValueAtTime(125, t)
      thud.frequency.exponentialRampToValueAtTime(38, t + 0.13)
      thudGain.gain.setValueAtTime(0.4, t)
      thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14)
      thud.connect(thudGain)
      thudGain.connect(ctx.destination)
      thud.start(t)
      thud.stop(t + 0.14)
    }

    playDraw() {
      const ctx = this._ensureCtx()
      if (!ctx) return
      const t = ctx.currentTime
      const bufSize = Math.floor(ctx.sampleRate * 0.09)
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
      const noise = ctx.createBufferSource()
      noise.buffer = buf
      const filter = ctx.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.setValueAtTime(1800, t)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.02, t)
      gain.gain.linearRampToValueAtTime(0.18, t + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09)
      noise.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)
      noise.start(t)
    }

    playShuffle() {
      const ctx = this._ensureCtx()
      if (!ctx) return
      for (let i = 0; i < 6; i++) {
        setTimeout(() => this.playDraw(), i * 48)
      }
    }

    playNope() {
      const ctx = this._ensureCtx()
      if (!ctx) return
      const t = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(320, t)
      osc.frequency.exponentialRampToValueAtTime(110, t + 0.22)
      gain.gain.setValueAtTime(0.28, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.24)
    }

    playDefuse() {
      const ctx = this._ensureCtx()
      if (!ctx) return
      const t = ctx.currentTime
      ;[523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, t + idx * 0.07)
        gain.gain.setValueAtTime(0.22, t + idx * 0.07)
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.07 + 0.25)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(t + idx * 0.07)
        osc.stop(t + idx * 0.07 + 0.26)
      })
    }

    playExplosion() {
      const ctx = this._ensureCtx()
      if (!ctx) return
      const t = ctx.currentTime

      const sub = ctx.createOscillator()
      const subGain = ctx.createGain()
      sub.type = 'sine'
      sub.frequency.setValueAtTime(110, t)
      sub.frequency.exponentialRampToValueAtTime(24, t + 0.7)
      subGain.gain.setValueAtTime(0.65, t)
      subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.75)
      sub.connect(subGain)
      subGain.connect(ctx.destination)
      sub.start(t)
      sub.stop(t + 0.75)

      const bufSize = Math.floor(ctx.sampleRate * 0.65)
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
      const noise = ctx.createBufferSource()
      noise.buffer = buf
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(950, t)
      filter.frequency.exponentialRampToValueAtTime(160, t + 0.65)
      const noiseGain = ctx.createGain()
      noiseGain.gain.setValueAtTime(0.5, t)
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.65)
      noise.connect(filter)
      filter.connect(noiseGain)
      noiseGain.connect(ctx.destination)
      noise.start(t)
    }

    playVictory() {
      const ctx = this._ensureCtx()
      if (!ctx) return
      const t = ctx.currentTime
      ;[523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, t + idx * 0.09)
        gain.gain.setValueAtTime(0.24, t + idx * 0.09)
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.09 + 0.4)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(t + idx * 0.09)
        osc.stop(t + idx * 0.09 + 0.42)
      })
    }
  }

  root.EKAudio = new EKAudio()
})(typeof globalThis !== 'undefined' ? globalThis : this)
