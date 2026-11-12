import { useEffect, useState } from 'react'
import { FeatherSVG, CartoonStarSVG } from './DuckAvatars'

export interface ParticleItem {
  id: number
  type: 'feather' | 'star'
  x: number
  y: number
  vx: number
  vy: number
  rotation: number
  vRot: number
  scale: number
  opacity: number
}

interface ParticleEmitterProps {
  triggerKey: number | string | null
  type?: 'feather' | 'star' | 'mixed'
}

export function ParticleBurst({ triggerKey, type = 'mixed' }: ParticleEmitterProps) {
  const [particles, setParticles] = useState<ParticleItem[]>([])

  useEffect(() => {
    if (!triggerKey) return

    // Spawn 18 particles centered on the arena
    const count = 18
    const newParticles: ParticleItem[] = []

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() * 0.4 - 0.2)
      const speed = 4 + Math.random() * 8
      const pType: 'feather' | 'star' =
        type === 'mixed'
          ? Math.random() > 0.45
            ? 'feather'
            : 'star'
          : type === 'feather'
          ? 'feather'
          : 'star'

      newParticles.push({
        id: Date.now() + i,
        type: pType,
        x: 50 + (Math.random() * 6 - 3), // center percentage
        y: 45 + (Math.random() * 6 - 3),
        vx: Math.cos(angle) * speed * 0.6,
        vy: -Math.abs(Math.sin(angle)) * speed - 3.5, // upward burst
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 18,
        scale: 0.8 + Math.random() * 0.5,
        opacity: 1
      })
    }

    setParticles(newParticles)

    let animId: number
    let lastTime = performance.now()

    const step = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.05)
      lastTime = time

      setParticles((prev) => {
        if (prev.length === 0) return []
        const gravity = 18 // downward gravity acceleration
        const updated = prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx * dt * 8,
            y: p.y + p.vy * dt * 8,
            vy: p.vy + gravity * dt,
            rotation: p.rotation + p.vRot,
            opacity: p.opacity - dt * 0.9
          }))
          .filter((p) => p.opacity > 0.05 && p.y < 115)

        return updated
      })

      animId = requestAnimationFrame(step)
    }

    animId = requestAnimationFrame(step)

    const timer = setTimeout(() => {
      cancelAnimationFrame(animId)
      setParticles([])
    }, 1800)

    return () => {
      cancelAnimationFrame(animId)
      clearTimeout(timer)
    }
  }, [triggerKey, type])

  if (particles.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            transform: `translate(-50%, -50%) rotate(${p.rotation}deg) scale(${p.scale})`,
            opacity: p.opacity,
            transition: 'opacity 0.05s linear'
          }}
        >
          {p.type === 'feather' ? (
            <FeatherSVG className="w-8 h-8 drop-shadow-[0_3px_0_rgba(15,23,42,0.9)]" />
          ) : (
            <CartoonStarSVG className="w-7 h-7 drop-shadow-[0_3px_0_rgba(15,23,42,0.9)]" />
          )}
        </div>
      ))}
    </div>
  )
}
