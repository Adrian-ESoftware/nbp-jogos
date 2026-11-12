import React from 'react'
import type { DuckAvatar } from './types'

interface DuckAvatarProps {
  avatar: DuckAvatar
  className?: string
}

/**
 * Base Cartoon Duck Head & Beak geometry with bold ink lines and rich fills.
 */
function BaseDuck({ children }: { children?: React.ReactNode }) {
  return (
    <g>
      {/* Duck head */}
      <circle
        cx="50"
        cy="52"
        r="36"
        fill="#facc15"
        stroke="#1e293b"
        strokeWidth="4"
      />
      {/* Cheek warmth */}
      <ellipse cx="36" cy="62" rx="7" ry="4" fill="#fb923c" opacity="0.4" />
      {/* Duck beak */}
      <path
        d="M20,54 Q8,56 12,66 Q20,74 38,70 Q42,60 38,54 Z"
        fill="#fb923c"
        stroke="#1e293b"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M18,60 Q26,62 36,60"
        stroke="#ea580c"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Duck Eye */}
      <ellipse cx="44" cy="42" rx="7" ry="9" fill="#ffffff" stroke="#1e293b" strokeWidth="3" />
      <circle cx="43" cy="42" r="4.5" fill="#0f172a" />
      <circle cx="41" cy="39" r="1.8" fill="#ffffff" />
      {/* Eyebrow */}
      <path d="M37,30 Q46,26 53,32" stroke="#854d0e" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      {/* Tuft */}
      <path
        d="M48,16 Q45,6 54,10 Q58,16 54,20 Z"
        fill="#eab308"
        stroke="#1e293b"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {children}
    </g>
  )
}

export function DuckAvatarIcon({ avatar, className = 'w-6 h-6' }: DuckAvatarProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={`inline-block flex-shrink-0 drop-shadow-[0_2px_0_rgba(15,23,42,0.8)] ${className}`}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="tokenGlare" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Render based on avatar type */}
      {avatar === '🦆' && (
        <BaseDuck>
          {/* Classic Duck: subtle wing tip / smile */}
          <path d="M68,52 Q82,50 86,64 Q75,76 60,74 Z" fill="#eab308" stroke="#1e293b" strokeWidth="3.5" />
        </BaseDuck>
      )}

      {avatar === '🕶️' && (
        <BaseDuck>
          {/* Sunglasses */}
          <path
            d="M32,36 L62,38 L60,52 Q48,56 34,50 Z"
            fill="#090d16"
            stroke="#1e293b"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          {/* Glasses bridge & temple */}
          <path d="M60,40 L78,38" stroke="#1e293b" strokeWidth="3.5" strokeLinecap="round" />
          {/* White glare slash */}
          <path d="M38,40 L44,48" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
        </BaseDuck>
      )}

      {avatar === '🕵️' && (
        <BaseDuck>
          {/* Detective Cap (Deerstalker) */}
          <path
            d="M26,30 Q50,6 74,30 L80,35 Q50,28 20,35 Z"
            fill="#a16207"
            stroke="#1e293b"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          {/* Bow on hat */}
          <circle cx="50" cy="14" r="4" fill="#713f12" stroke="#1e293b" strokeWidth="2" />
          {/* Magnifying Glass */}
          <circle cx="22" cy="72" r="10" fill="none" stroke="#e2e8f0" strokeWidth="3" />
          <line x1="15" y1="79" x2="6" y2="88" stroke="#78350f" strokeWidth="4" strokeLinecap="round" />
        </BaseDuck>
      )}

      {avatar === '🎩' && (
        <BaseDuck>
          {/* Top Hat */}
          <ellipse cx="50" cy="22" rx="28" ry="6" fill="#18181b" stroke="#1e293b" strokeWidth="3.5" />
          <path
            d="M34,22 L36,-2 L64,-2 L66,22 Z"
            fill="#18181b"
            stroke="#1e293b"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          {/* Red Silk Ribbon */}
          <path d="M35,16 L36,22 L65,22 L64,16 Z" fill="#e11d48" stroke="#1e293b" strokeWidth="2" />
        </BaseDuck>
      )}

      {avatar === '🤿' && (
        <BaseDuck>
          {/* Scuba Mask */}
          <rect
            x="32"
            y="32"
            width="34"
            height="22"
            rx="8"
            fill="#06b6d4"
            fillOpacity="0.45"
            stroke="#0891b2"
            strokeWidth="3.5"
          />
          <path d="M66,42 L80,44" stroke="#0891b2" strokeWidth="3.5" strokeLinecap="round" />
          {/* Snorkel */}
          <path
            d="M72,66 Q82,66 82,46 L82,14"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <ellipse cx="82" cy="14" rx="4" ry="2" fill="#ea580c" />
        </BaseDuck>
      )}

      {avatar === '👑' && (
        <BaseDuck>
          {/* Royal Crown */}
          <path
            d="M30,22 L34,8 L50,16 L66,8 L70,22 Z"
            fill="#f59e0b"
            stroke="#1e293b"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          {/* Gems */}
          <circle cx="34" cy="9" r="2.5" fill="#ef4444" stroke="#1e293b" strokeWidth="1.5" />
          <circle cx="50" cy="17" r="3" fill="#3b82f6" stroke="#1e293b" strokeWidth="1.5" />
          <circle cx="66" cy="9" r="2.5" fill="#ef4444" stroke="#1e293b" strokeWidth="1.5" />
        </BaseDuck>
      )}

      {avatar === '🤖' && (
        <g>
          {/* Robotic Duck Head */}
          <rect
            x="24"
            y="22"
            width="52"
            height="52"
            rx="14"
            fill="#94a3b8"
            stroke="#1e293b"
            strokeWidth="4"
          />
          {/* Antenna */}
          <line x1="50" y1="22" x2="50" y2="8" stroke="#1e293b" strokeWidth="4" />
          <circle cx="50" cy="6" r="4.5" fill="#06b6d4" stroke="#1e293b" strokeWidth="2.5" />
          {/* Robotic Visor Eye */}
          <rect
            x="32"
            y="36"
            width="36"
            height="12"
            rx="5"
            fill="#0f172a"
            stroke="#1e293b"
            strokeWidth="2.5"
          />
          <line x1="36" y1="42" x2="64" y2="42" stroke="#22d3ee" strokeWidth="4" strokeLinecap="round" />
          {/* Metal Beak */}
          <polygon
            points="14,58 32,52 32,66"
            fill="#f97316"
            stroke="#1e293b"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          {/* Bolts */}
          <circle cx="30" cy="28" r="2" fill="#475569" />
          <circle cx="70" cy="28" r="2" fill="#475569" />
        </g>
      )}

      {avatar === '🤠' && (
        <BaseDuck>
          {/* Cowboy Hat */}
          <path
            d="M16,28 Q50,14 84,28 Q78,32 50,26 Q22,32 16,28 Z"
            fill="#92400e"
            stroke="#1e293b"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path
            d="M32,24 Q34,8 50,12 Q66,8 68,24 Z"
            fill="#78350f"
            stroke="#1e293b"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          {/* Sheriff Star */}
          <path
            d="M62,68 L64,64 L68,64 L65,61 L66,57 L62,59 L58,57 L59,61 L56,64 L60,64 Z"
            fill="#facc15"
            stroke="#78350f"
            strokeWidth="1.5"
          />
        </BaseDuck>
      )}
    </svg>
  )
}

/**
 * High-quality Rubber Duck Token for penalty counts and scoreboards.
 */
export function RubberDuckToken({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={`inline-block drop-shadow-[0_2px_0_rgba(15,23,42,0.85)] ${className}`}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="duckBodyLight" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="60%" stopColor="#facc15" />
          <stop offset="100%" stopColor="#eab308" />
        </radialGradient>
      </defs>
      {/* Body */}
      <path
        d="M25,62 C25,48 40,42 60,42 C72,42 85,46 90,56 C94,65 88,80 62,82 C38,82 25,75 25,62 Z"
        fill="url(#duckBodyLight)"
        stroke="#1e293b"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {/* Wing */}
      <path
        d="M45,56 C45,50 62,48 70,54 C74,58 72,66 64,68 C52,70 45,64 45,56 Z"
        fill="#fde047"
        stroke="#1e293b"
        strokeWidth="3"
      />
      {/* Head */}
      <circle cx="34" cy="36" r="20" fill="url(#duckBodyLight)" stroke="#1e293b" strokeWidth="4" />
      {/* Beak */}
      <path
        d="M16,36 Q6,38 8,46 Q16,50 24,46 Z"
        fill="#fb923c"
        stroke="#1e293b"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      {/* Eye */}
      <circle cx="30" cy="30" r="3.5" fill="#0f172a" />
      <circle cx="29" cy="29" r="1.2" fill="#ffffff" />
      {/* Top Feather */}
      <path d="M34,16 Q32,8 38,12 Q40,16 36,18 Z" fill="#eab308" stroke="#1e293b" strokeWidth="2.5" />
    </svg>
  )
}

/**
 * Cartoon Feather Particle for explosion and penalty impacts.
 */
export function FeatherSVG({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 60" className={`inline-block ${className}`} aria-hidden="true">
      <path
        d="M10,50 Q18,32 35,18 Q46,8 52,10 Q50,22 38,36 Q25,48 10,50 Z"
        fill="#facc15"
        stroke="#1e293b"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M12,48 Q32,30 48,12" stroke="#ca8a04" strokeWidth="2" strokeLinecap="round" />
      <path d="M26,38 L32,36" stroke="#ca8a04" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M34,30 L40,28" stroke="#ca8a04" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Cartoon Star Sparkle for victories and critical hits.
 */
export function CartoonStarSVG({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={`inline-block ${className}`} aria-hidden="true">
      <polygon
        points="20,2 25,14 38,15 28,24 31,37 20,30 9,37 12,24 2,15 15,14"
        fill="#fef08a"
        stroke="#1e293b"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="20" r="4" fill="#facc15" />
    </svg>
  )
}
