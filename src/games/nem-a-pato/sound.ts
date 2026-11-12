// Procedural Web Audio API Synthesizer for "Nem a Pato"
// Zero external files, 100% synthetic tactile sound effects

class SoundSynthesizer {
  private ctx: AudioContext | null = null
  public enabled = true

  constructor() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('nem_a_pato_sound')
      this.enabled = stored !== 'off'
    }
  }

  private initCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioContextClass) {
        this.ctx = new AudioContextClass()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  toggleSound(): boolean {
    this.enabled = !this.enabled
    if (typeof window !== 'undefined') {
      localStorage.setItem('nem_a_pato_sound', this.enabled ? 'on' : 'off')
    }
    if (this.enabled) {
      this.quack()
    }
    return this.enabled
  }

  /**
   * Tactile button click (dry plastic/wood snap)
   */
  click(): void {
    if (!this.enabled) return
    try {
      const ctx = this.initCtx()
      if (!ctx) return
      const now = ctx.currentTime

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(700, now)
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.02)

      gain.gain.setValueAtTime(0.2, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.03)
    } catch {
      // AudioContext unavailable
    }
  }

  /**
   * Card slide / paper swoosh (filtered noise burst)
   */
  swoosh(): void {
    if (!this.enabled) return
    try {
      const ctx = this.initCtx()
      if (!ctx) return
      const now = ctx.currentTime

      const bufferSize = Math.floor(ctx.sampleRate * 0.08) // 80ms
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1
      }

      const noise = ctx.createBufferSource()
      noise.buffer = buffer

      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(1400, now)
      filter.frequency.exponentialRampToValueAtTime(450, now + 0.08)
      filter.Q.setValueAtTime(1.8, now)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)

      noise.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)

      noise.start(now)
    } catch {
      // AudioContext unavailable
    }
  }

  /**
   * Card snap / play onto the physical table (swoosh + snap thump)
   */
  cardPlay(): void {
    if (!this.enabled) return
    this.swoosh()
    try {
      const ctx = this.initCtx()
      if (!ctx) return
      const now = ctx.currentTime + 0.03

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(260, now)
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.06)

      gain.gain.setValueAtTime(0.25, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.07)
    } catch {}
  }

  /**
   * Comic synthesized duck "quack" (dual oscillator + modulated bandpass filter)
   */
  quack(pitchMultiplier = 1.0): void {
    if (!this.enabled) return
    try {
      const ctx = this.initCtx()
      if (!ctx) return
      const now = ctx.currentTime

      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const filter = ctx.createBiquadFilter()
      const gain = ctx.createGain()

      osc1.type = 'sawtooth'
      osc1.frequency.setValueAtTime(330 * pitchMultiplier, now)
      osc1.frequency.exponentialRampToValueAtTime(140 * pitchMultiplier, now + 0.2)

      osc2.type = 'triangle'
      osc2.frequency.setValueAtTime(480 * pitchMultiplier, now)
      osc2.frequency.exponentialRampToValueAtTime(200 * pitchMultiplier, now + 0.2)

      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(950 * pitchMultiplier, now)
      filter.frequency.linearRampToValueAtTime(500 * pitchMultiplier, now + 0.18)
      filter.Q.setValueAtTime(4.5, now)

      gain.gain.setValueAtTime(0.38, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)

      osc1.connect(filter)
      osc2.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)

      osc1.start(now)
      osc2.start(now)
      osc1.stop(now + 0.23)
      osc2.stop(now + 0.23)
    } catch {
      // AudioContext unavailable
    }
  }

  /**
   * Sound played when placing a bid
   */
  bid(): void {
    if (!this.enabled) return
    try {
      const ctx = this.initCtx()
      if (!ctx) return
      const now = ctx.currentTime

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(460, now)
      osc.frequency.exponentialRampToValueAtTime(720, now + 0.11)

      gain.gain.setValueAtTime(0.18, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.14)
    } catch {}
  }

  /**
   * Sound played on Double (2x)
   */
  double(): void {
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
        osc.frequency.setValueAtTime(freq, now + idx * 0.045)
        gain.gain.setValueAtTime(0.12, now + idx * 0.045)
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.045 + 0.18)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + idx * 0.045)
        osc.stop(now + idx * 0.045 + 0.19)
      })
    } catch {}
  }

  /**
   * The Big "NEM A PATO!" challenge event:
   * Comic cartoon siren + loud quack + table slam
   */
  nemAPato(): void {
    if (!this.enabled) return
    this.quack(1.1)
    this.tableSlam()
    try {
      const ctx = this.initCtx()
      if (!ctx) return
      const now = ctx.currentTime

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(840, now + 0.07)
      osc.frequency.linearRampToValueAtTime(420, now + 0.22)
      osc.frequency.linearRampToValueAtTime(800, now + 0.42)

      gain.gain.setValueAtTime(0.22, now + 0.07)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + 0.07)
      osc.stop(now + 0.5)
    } catch {}
  }

  /**
   * Deep table slam thump (when someone doubts or a penalty hits)
   */
  tableSlam(): void {
    if (!this.enabled) return
    try {
      const ctx = this.initCtx()
      if (!ctx) return
      const now = ctx.currentTime

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(140, now)
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.15)

      gain.gain.setValueAtTime(0.35, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.17)
    } catch {}
  }

  /**
   * Penalty sound: comic descending cartoon squawk
   */
  penalty(): void {
    if (!this.enabled) return
    this.quack(0.85)
    try {
      const ctx = this.initCtx()
      if (!ctx) return
      const now = ctx.currentTime + 0.1

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(220, now)
      osc.frequency.linearRampToValueAtTime(90, now + 0.3)

      gain.gain.setValueAtTime(0.2, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.33)
    } catch {}
  }

  /**
   * Timer tick sound
   */
  tick(): void {
    if (!this.enabled) return
    try {
      const ctx = this.initCtx()
      if (!ctx) return
      const now = ctx.currentTime

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(1020, now)
      gain.gain.setValueAtTime(0.07, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.04)
    } catch {}
  }

  /**
   * Fanfare for winner / game over
   */
  fanfare(): void {
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
