import React, { useState, useRef } from 'react'
import { motion } from 'motion/react'
import { Flame, Siren } from 'lucide-react'
import { RubberDuckToken } from './DuckAvatars'
import { sound } from './sound'

// CSS Linen Paper Pattern as encoded SVG
export const LINEN_TEXTURE = `radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.95), rgba(248, 246, 240, 0.9)), url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%239C92AC' fill-opacity='0.06' fill-rule='evenodd'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E")`

export const DARK_FELT_TEXTURE = `radial-gradient(circle at 50% 30%, #164e52 0%, #0d2e33 75%, #081d20 100%), url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000000' fill-opacity='0.12' fill-rule='evenodd'%3E%3Ccircle cx='30' cy='30' r='1.5'/%3E%3Ccircle cx='10' cy='10' r='1'/%3E%3Ccircle cx='50' cy='50' r='1'/%3E%3C/g%3E%3C/svg%3E")`

interface TactileCardProps {
  label: string
  subLabel?: string
  value?: number | string
  type?: 'add' | 'double' | 'challenge' | 'custom'
  disabled?: boolean
  onClick?: () => void
  onHoverStart?: () => void
  style?: React.CSSProperties
  className?: string
  isActive?: boolean
}

/**
 * 3D Tactile Playing Card with Real 5/7 Ratio, Ornate Borders, Linen Finish,
 * 3D Tilt Cursor Tracking, Specular Sheen & Spring Elevation.
 */
export function TactileCard({
  label,
  subLabel,
  value,
  type = 'add',
  disabled = false,
  onClick,
  onHoverStart,
  style,
  className = '',
  isActive = false
}: TactileCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, px: 50, py: 50, isHover: false })

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (disabled) return
    const rect = cardRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const px = Math.max(0, Math.min(100, (x / rect.width) * 100))
    const py = Math.max(0, Math.min(100, (y / rect.height) * 100))
    const rx = ((y - rect.height / 2) / (rect.height / 2)) * -14
    const ry = ((x - rect.width / 2) / (rect.width / 2)) * 14
    setTilt({ rx, ry, px, py, isHover: true })
  }

  function handleMouseEnter() {
    if (disabled) return
    sound.swoosh()
    onHoverStart?.()
    setTilt((prev) => ({ ...prev, isHover: true }))
  }

  function handleMouseLeave() {
    setTilt({ rx: 0, ry: 0, px: 50, py: 50, isHover: false })
  }

  function handleClick() {
    if (disabled) return
    sound.cardPlay()
    onClick?.()
  }

  // Visual Theme based on action type
  const theme = (() => {
    switch (type) {
      case 'challenge':
        return {
          bg: '#dc2626',
          bgGradient: 'linear-gradient(145deg, #ef4444 0%, #b91c1c 100%)',
          innerBorder: '#fee2e2',
          text: '#ffffff',
          accent: '#fef08a',
          rankColor: '#fef08a',
          badgeBg: '#7f1d1d'
        }
      case 'double':
        return {
          bg: '#f97316',
          bgGradient: 'linear-gradient(145deg, #fb923c 0%, #ea580c 100%)',
          innerBorder: '#ffedd5',
          text: '#ffffff',
          accent: '#ffffff',
          rankColor: '#fef08a',
          badgeBg: '#9a3412'
        }
      case 'custom':
        return {
          bg: '#0284c7',
          bgGradient: 'linear-gradient(145deg, #38bdf8 0%, #0369a1 100%)',
          innerBorder: '#e0f2fe',
          text: '#ffffff',
          accent: '#ffffff',
          rankColor: '#bae6fd',
          badgeBg: '#075985'
        }
      case 'add':
      default:
        return {
          bg: '#fffdfa',
          bgGradient: LINEN_TEXTURE,
          innerBorder: '#d97706',
          text: '#0f172a',
          accent: '#b45309',
          rankColor: '#b45309',
          badgeBg: '#fef3c7'
        }
    }
  })()

  const isDarkCard = type === 'challenge' || type === 'double' || type === 'custom'

  return (
    <div
      ref={cardRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        ...style,
        perspective: '800px',
        zIndex: tilt.isHover ? 30 : style?.zIndex || 1
      }}
      className={`relative select-none cursor-pointer transition-transform duration-100 ease-out ${
        disabled ? 'opacity-40 pointer-events-none grayscale' : ''
      } ${className}`}
    >
      <div
        className="w-full h-full rounded-2xl relative transition-all duration-150"
        style={{
          aspectRatio: '5 / 7',
          transform: tilt.isHover
            ? `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateY(-18px) scale(1.08)`
            : 'rotateX(0deg) rotateY(0deg) translateY(0px) scale(1)',
          background: theme.bgGradient,
          border: '3px solid #0f172a',
          boxShadow: tilt.isHover
            ? '6px 14px 0px #090d16, 0 16px 28px rgba(0,0,0,0.5)'
            : '3.5px 4.5px 0px #090d16, 0 4px 10px rgba(0,0,0,0.35)'
        }}
      >
        {/* Ornate Inner Double Border with Corner Filigree */}
        <div
          className="absolute inset-1.5 rounded-xl pointer-events-none flex flex-col justify-between p-2"
          style={{
            border: `1.5px solid ${theme.innerBorder}`,
            boxShadow: `inset 0 0 0 1px ${isDarkCard ? 'rgba(255,255,255,0.15)' : 'rgba(180,83,9,0.2)'}`
          }}
        >
          {/* Top-Left Corner Index */}
          <div className="flex items-center justify-between text-left">
            <div className="flex flex-col leading-none">
              <span
                className="font-black font-mono text-sm sm:text-base tracking-tighter"
                style={{ color: theme.rankColor }}
              >
                {value ?? label}
              </span>
              <span
                className="text-[9px] font-bold uppercase tracking-wider opacity-85"
                style={{ color: theme.text }}
              >
                {type === 'challenge' ? 'DUVIDA' : type === 'double' ? '2X' : 'CHUTE'}
              </span>
            </div>

            {/* Corner Icon */}
            {type === 'challenge' ? (
              <Siren className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            ) : type === 'double' ? (
              <Flame className="w-3.5 h-3.5 text-yellow-300" />
            ) : (
              <RubberDuckToken className="w-4 h-4" />
            )}
          </div>

          {/* Card Centerpiece Illustration / Value */}
          <div className="flex-1 flex flex-col items-center justify-center text-center my-1">
            {type === 'challenge' ? (
              <div className="flex flex-col items-center gap-1">
                <div className="w-10 h-10 rounded-full bg-slate-950/40 border-2 border-white/50 flex items-center justify-center text-yellow-300 shadow-inner">
                  <Siren className="w-6 h-6 stroke-[2.5]" />
                </div>
                <strong className="text-xs sm:text-sm font-black text-white uppercase tracking-wider leading-tight">
                  NEM A PATO!
                </strong>
                <span className="text-[9px] text-red-100 font-bold tracking-tight">
                  (DUVIDAR!)
                </span>
              </div>
            ) : type === 'double' ? (
              <div className="flex flex-col items-center gap-1">
                <div className="w-10 h-10 rounded-full bg-slate-950/40 border-2 border-yellow-300 flex items-center justify-center text-yellow-300 shadow-inner">
                  <Flame className="w-6 h-6 fill-yellow-400 stroke-yellow-200" />
                </div>
                <strong className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                  DOBROU!
                </strong>
                <span className="text-[9px] text-yellow-100 font-bold font-mono">
                  (2x VALOR)
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-900 leading-none">
                  {value}
                </span>
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mt-0.5">
                  {subLabel || 'Aumentar'}
                </span>
              </div>
            )}
          </div>

          {/* Bottom-Right Corner Index (Inverted) */}
          <div className="flex items-center justify-between rotate-180 text-left">
            <div className="flex flex-col leading-none">
              <span
                className="font-black font-mono text-sm sm:text-base tracking-tighter"
                style={{ color: theme.rankColor }}
              >
                {value ?? label}
              </span>
              <span
                className="text-[9px] font-bold uppercase tracking-wider opacity-85"
                style={{ color: theme.text }}
              >
                {type === 'challenge' ? 'DUVIDA' : type === 'double' ? '2X' : 'CHUTE'}
              </span>
            </div>

            {type === 'challenge' ? (
              <Siren className="w-3.5 h-3.5 text-amber-300" />
            ) : type === 'double' ? (
              <Flame className="w-3.5 h-3.5 text-yellow-300" />
            ) : (
              <RubberDuckToken className="w-4 h-4" />
            )}
          </div>
        </div>

        {/* Specular Sheen Highlight Following Cursor */}
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-150"
          style={{
            opacity: tilt.isHover ? 1 : 0,
            background: `radial-gradient(circle at ${tilt.px}% ${tilt.py}%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 65%)`,
            mixBlendMode: 'overlay'
          }}
        />

        {/* Active Ring if selected */}
        {isActive && (
          <div className="pointer-events-none absolute -inset-1 rounded-2xl border-4 border-amber-400 animate-pulse" />
        )}
      </div>
    </div>
  )
}

/**
 * Hand Fan Layout (Mão em Leque)
 * Distributes player cards in a gentle ergonomic arc that expands smoothly on hover.
 */
interface HandFanProps {
  cards: Array<{
    id: string
    label: string
    subLabel?: string
    value?: number | string
    type?: 'add' | 'double' | 'challenge' | 'custom'
    disabled?: boolean
    onClick?: () => void
  }>
  disabledAll?: boolean
}

export function HandFan({ cards, disabledAll = false }: HandFanProps) {
  const [isFanHovered, setIsFanHovered] = useState(false)
  const total = cards.length
  const midIndex = (total - 1) / 2

  return (
    <div
      onMouseEnter={() => setIsFanHovered(true)}
      onMouseLeave={() => setIsFanHovered(false)}
      className="relative flex items-end justify-center w-full pt-4 pb-2 px-2"
      style={{ minHeight: '160px' }}
    >
      <div className="relative flex items-end justify-center" style={{ width: '100%', maxWidth: '580px' }}>
        {cards.map((card, i) => {
          const offset = i - midIndex
          // Rotation angle: -12deg to +12deg resting, fans slightly wider on hover
          const rotationAngle = isFanHovered ? offset * 5.5 : offset * 3.5
          // Horizontal spacing: expands on hover so cards separate
          const xOffset = isFanHovered ? offset * 72 : offset * 54
          // Vertical arch curve (parabolic drop on the sides)
          const yOffset = Math.abs(offset) * (isFanHovered ? 4 : 5)

          return (
            <motion.div
              key={card.id}
              layout
              initial={{ opacity: 0, y: 50, scale: 0.8 }}
              animate={{
                opacity: 1,
                y: yOffset,
                x: xOffset,
                rotate: rotationAngle,
                scale: 1
              }}
              transition={{
                type: 'spring',
                stiffness: 350,
                damping: 24
              }}
              style={{
                position: 'absolute',
                bottom: 0,
                zIndex: i + 1
              }}
            >
              <TactileCard
                label={card.label}
                subLabel={card.subLabel}
                value={card.value}
                type={card.type}
                disabled={disabledAll || card.disabled}
                onClick={card.onClick}
                className="w-24 sm:w-28 md:w-32"
              />
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
