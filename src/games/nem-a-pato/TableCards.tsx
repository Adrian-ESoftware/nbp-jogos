import React from 'react'
import { motion } from 'motion/react'
import { Flame, ArrowUp } from 'lucide-react'
import type { TriviaCard, Bid } from './types'
import { DuckAvatarIcon, RubberDuckToken } from './DuckAvatars'
import { LINEN_TEXTURE } from './PhysicalCard'

interface TriviaTableCardProps {
  card: TriviaCard
  round: number
  totalRounds: number
  penaltyMode: 'ducks' | 'cards'
  isShaking?: boolean
  isSquashing?: boolean
}

/**
 * Main Question Trivia Card sitting on the felt gaming table.
 * Tactile linen card with ornate filigree, real rubber duck tokens,
 * solid sticker drop-shadow and physical paper texture.
 */
export function TriviaTableCard({
  card,
  round,
  totalRounds,
  penaltyMode,
  isSquashing = false
}: TriviaTableCardProps) {
  const penaltyCount = penaltyMode === 'ducks' ? card.ducks : 1

  return (
    <motion.div
      key={card.id}
      initial={{ opacity: 0, y: -40, scale: 0.85, rotate: -3 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: isSquashing ? [1, 1.15, 0.9, 1.04, 1] : 1,
        rotate: isSquashing ? [0, -3, 3, -1, 0] : 0
      }}
      transition={{
        ease: [0.34, 1.56, 0.64, 1], // back.out(1.5)
        duration: 0.55
      }}
      className="relative w-full max-w-2xl mx-auto rounded-3xl p-4 sm:p-5 select-none"
      style={{
        background: LINEN_TEXTURE,
        border: '3.5px solid #0f172a',
        boxShadow: '5px 6px 0px #090d16, 0 12px 24px rgba(0,0,0,0.35)'
      }}
    >
      {/* Decorative filigree corners */}
      <div className="absolute inset-2 rounded-2xl pointer-events-none border-[1.5px] border-amber-600/40" />

      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-2 mb-3 relative z-10">
        <div className="flex items-center gap-2">
          {/* Category Badge */}
          <span className="px-3 py-1 rounded-xl text-xs font-black tracking-wider uppercase bg-amber-400 text-slate-950 border-2 border-slate-900 shadow-[2px_2px_0px_#090d16]">
            {card.category}
          </span>
          <span className="text-xs font-bold text-amber-900 font-mono hidden sm:inline">
            RODADA {round}/{totalRounds}
          </span>
        </div>

        {/* Penalty Ducks Tokens */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-100 border-2 border-slate-900 text-xs font-black text-slate-900 shadow-[2px_2px_0px_#090d16]">
            <span className="text-[10px] uppercase text-amber-800">PENALIDADE:</span>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: penaltyCount }).map((_, i) => (
                <RubberDuckToken key={i} className="w-4 h-4" />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900 border-2 border-slate-900 text-xs text-white shadow-[2px_2px_0px_#090d16]">
            <span className="text-[10px] text-slate-400 uppercase font-bold">EM:</span>
            <strong className="text-amber-300 font-mono uppercase">{card.unit}</strong>
          </div>
        </div>
      </div>

      {/* Main Question Text */}
      <div className="py-2 sm:py-3 relative z-10 text-center">
        <h3 className="text-base sm:text-xl md:text-2xl font-black text-slate-950 tracking-tight leading-snug">
          "{card.question}"
        </h3>
      </div>
    </motion.div>
  )
}

/**
 * Animated Central Pile of Bids on the Table:
 * Renders the top bid card landing in an arc with back.out(1.5), mid-air scale growth (1.15x)
 * and random subtle tilt landing (-4deg to +4deg).
 */
interface TableBidPileProps {
  bids: Bid[]
  activeCardUnit: string
  isSquashing?: boolean
}

export function TableBidPile({
  bids,
  activeCardUnit,
  isSquashing = false
}: TableBidPileProps) {
  const currentBid = bids.length > 0 ? bids[bids.length - 1] : null
  const randomRot = React.useMemo(() => (Math.random() * 6 - 3), [bids.length])

  return (
    <div className="relative flex flex-col items-center justify-center p-3 w-full">
      {/* Background card silhouettes indicating a physical stacked deck */}
      {bids.length > 1 && (
        <div
          className="absolute w-44 sm:w-56 h-28 sm:h-32 rounded-2xl bg-amber-950/40 border-2 border-slate-900/60 pointer-events-none"
          style={{ transform: 'rotate(-4deg) translateY(6px)' }}
        />
      )}
      {bids.length > 2 && (
        <div
          className="absolute w-44 sm:w-56 h-28 sm:h-32 rounded-2xl bg-amber-950/30 border-2 border-slate-900/50 pointer-events-none"
          style={{ transform: 'rotate(5deg) translateY(4px)' }}
        />
      )}

      {currentBid ? (
        <motion.div
          key={currentBid.id}
          initial={{
            opacity: 0,
            y: 90,
            scale: 0.85,
            rotate: 0
          }}
          animate={{
            opacity: 1,
            y: [90, -22, 0],
            scale: isSquashing ? [1, 1.2, 0.88, 1.05, 1] : [0.9, 1.15, 1],
            rotate: [0, randomRot * 1.5, randomRot]
          }}
          transition={{
            ease: [0.34, 1.56, 0.64, 1], // back.out(1.5) curve
            duration: 0.5
          }}
          className={`relative w-48 sm:w-60 rounded-2xl p-3.5 sm:p-4 select-none border-[3px] border-slate-950 ${
            currentBid.isDouble
              ? 'bg-gradient-to-br from-orange-500 via-rose-500 to-red-600 text-white shadow-[5px_6px_0px_#090d16]'
              : 'bg-amber-400 text-slate-950 shadow-[5px_6px_0px_#090d16]'
          }`}
        >
          {/* Card Stamp / Corner Badge */}
          <div className="flex items-center justify-between gap-1 mb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="p-1 rounded-lg bg-slate-950/20 border border-slate-950/40 flex-shrink-0">
                <DuckAvatarIcon avatar={currentBid.playerAvatar} className="w-4 h-4" />
              </span>
              <span className="text-xs font-black truncate">{currentBid.playerName}</span>
            </div>

            {currentBid.isDouble && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-yellow-300 text-slate-950 border border-slate-950 flex items-center gap-0.5 shadow-[1.5px_1.5px_0px_#090d16]">
                <Flame className="w-3 h-3 text-red-600" /> 2X
              </span>
            )}
          </div>

          {/* Big Tactile Number */}
          <div className="text-center my-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider opacity-80 block">
              CHUTE ATUAL NA MESA
            </span>
            <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight leading-none drop-shadow-[0_2px_0_rgba(15,23,42,0.3)]">
              {currentBid.value.toLocaleString('pt-BR')}
            </div>
            <span className="text-xs font-bold uppercase tracking-wider opacity-90 mt-0.5 block">
              {activeCardUnit}
            </span>
          </div>

          <div className="text-center text-[10px] font-bold opacity-75">
            +{currentBid.delta.toLocaleString('pt-BR')} acima do anterior
          </div>
        </motion.div>
      ) : (
        /* Empty Table Slot: Felt Placement Target */
        <div
          className="w-48 sm:w-60 h-28 sm:h-32 rounded-2xl border-2 border-dashed border-teal-300/40 flex flex-col items-center justify-center p-3 text-center"
          style={{ background: 'rgba(255,255,255,0.03)' }}
        >
          <div className="w-10 h-10 rounded-full bg-teal-500/10 border border-teal-400/30 flex items-center justify-center text-teal-300 mb-1">
            <ArrowUp className="w-5 h-5 stroke-[2.5]" />
          </div>
          <span className="text-xs font-black text-teal-200 uppercase tracking-wider">
            MESA LIMPA
          </span>
          <span className="text-[10px] text-teal-300/70 font-semibold mt-0.5">
            Aguardando o 1º chute da rodada...
          </span>
        </div>
      )}
    </div>
  )
}
