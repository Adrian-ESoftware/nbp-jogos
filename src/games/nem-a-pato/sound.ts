class SoundSynthesizer {
  private ctx: AudioContext | null = null
  public enabled = true

  constructor() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('nem_a_pato_sound')
      this.enabled = stored !== 'off'
    }
  }

  private initCtx() {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioContextClass) {
        this.ctx = new AudioContextClass()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  toggleSound() {
    this.enabled = !this.enabled
    if (typeof window !== 'undefined') {
      localStorage.setItem('nem_a_pato_sound', this.enabled ? 'on' : 'off')
    }
    if (this.enabled) {
      this.quack()
    }
    return this.enabled
  }

  quack() {
    if (!this.enabled) return
    try {
      const ctx = this.initCtx()
      if (!ctx) return
      const now = ctx.currentTime

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const filter = ctx.createBiquadFilter()

      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(320, now)
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.18)

      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(850, now)
      filter.Q.setValueAtTime(4.2, now)

      gain.gain.setValueAtTime(0.35, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.23)
    } catch {
      // AudioContext unavailable
    }
  }

  bid() {
    if (!this.enabled) return
    try {
      const ctx = this.initCtx()
      if (!ctx) return
      const now = ctx.currentTime

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(440, now)
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12)

      gain.gain.setValueAtTime(0.18, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.15)
    } catch {}
  }

  double() {
    if (!this.enabled) return
    try {
      const ctx = this.initCtx()
      if (!ctx) return
      const now = ctx.currentTime

      const freqs = [523.25, 659.25, 783.99, 1046.5]
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(freq, now + idx * 0.05)
        gain.gain.setValueAtTime(0.12, now + idx * 0.05)
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.18)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + idx * 0.05)
        osc.stop(now + idx * 0.05 + 0.2)
      })
    } catch {}
  }

  nemAPato() {
    if (!this.enabled) return
    this.quack()
    try {
      const ctx = this.initCtx()
      if (!ctx) return
      const now = ctx.currentTime

      // Siren blast
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(800, now + 0.08)
      osc.frequency.linearRampToValueAtTime(400, now + 0.25)
      osc.frequency.linearRampToValueAtTime(750, now + 0.45)

      gain.gain.setValueAtTime(0.2, now + 0.08)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + 0.08)
      osc.stop(now + 0.52)
    } catch {}
  }

  tick() {
    if (!this.enabled) return
    try {
      const ctx = this.initCtx()
      if (!ctx) return
      const now = ctx.currentTime

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(950, now)
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.05)
    } catch {}
  }

  fanfare() {
    if (!this.enabled) return
    try {
      const ctx = this.initCtx()
      if (!ctx) return
      const now = ctx.currentTime

      const notes = [440, 554.37, 659.25, 880]
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, now + idx * 0.1)
        gain.gain.setValueAtTime(0.18, now + idx * 0.1)
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + (idx === 3 ? 0.6 : 0.2))

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + idx * 0.1)
        osc.stop(now + idx * 0.1 + (idx === 3 ? 0.65 : 0.22))
      })
    } catch {}
  }
}

export const sound = new SoundSynthesizer()
