import { motion } from 'motion/react'
import { Clock, Bot, Crown } from 'lucide-react'
import type { Player } from './types'
import { DuckAvatarIcon, RubberDuckToken } from './DuckAvatars'

interface TurnHUDProps {
  currentPlayer: Player
  isMyTurn: boolean
  botThinking: boolean
  timeLeft: number
  turnDuration: number
  currentBidValue: number
  unit: string
}

/**
 * Tactile Turn Badge with solid cartoon ink border, hard drop shadow,
 * and smooth pulse glow on the active player.
 */
export function TactileTurnBadge({
  currentPlayer,
  isMyTurn,
  botThinking,
  timeLeft,
  turnDuration,
  currentBidValue,
  unit
}: TurnHUDProps) {
  const isUrgent = timeLeft <= 5 && turnDuration > 0

  return (
    <div
      className={`relative flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border-[3px] border-slate-950 transition-all select-none ${
        isMyTurn
          ? 'bg-amber-400 text-slate-950 shadow-[5px_5px_0px_#090d16]'
          : 'bg-slate-900 text-white shadow-[4px_4px_0px_#090d16]'
      }`}
    >
      {/* Active Player Info */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative flex-shrink-0">
          <div
            className={`w-12 h-12 rounded-2xl border-2 border-slate-950 flex items-center justify-center shadow-[2px_2px_0px_#090d16] ${
              isMyTurn ? 'bg-amber-100' : 'bg-slate-800'
            }`}
          >
            <DuckAvatarIcon avatar={currentPlayer.avatar} className="w-8 h-8" />
          </div>

          {/* Active Turn Pulsing Jewel */}
          <motion.span
            animate={{ scale: [1, 1.25, 1] }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
            className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-slate-950 shadow-[1px_1px_0px_#090d16]"
          />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border border-slate-950 shadow-[1px_1px_0px_#090d16] ${
                isMyTurn ? 'bg-slate-950 text-amber-300' : 'bg-amber-400 text-slate-950'
              }`}
            >
              {isMyTurn ? '★ SUA VEZ!' : 'VEZ DO PATO:'}
            </span>
          </div>

          <strong className="text-base sm:text-lg font-black truncate block mt-0.5">
            {currentPlayer.name}
            {botThinking && (
              <span className="text-xs font-bold text-amber-800 ml-1.5 animate-pulse">
                (pensando no blefe...)
              </span>
            )}
          </strong>
        </div>
      </div>

      {/* Target to beat & Chess-like mechanical timer */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-right">
          <span
            className={`text-[9px] font-black uppercase tracking-wider block ${
              isMyTurn ? 'text-slate-800' : 'text-slate-400'
            }`}
          >
            A SUPERAR
          </span>
          <strong
            className={`text-lg sm:text-xl font-black font-mono leading-none block ${
              isMyTurn ? 'text-slate-950' : 'text-amber-300'
            }`}
          >
            {currentBidValue > 0 ? `${currentBidValue.toLocaleString('pt-BR')} ${unit}` : '1º Chute'}
          </strong>
        </div>

        {turnDuration > 0 && (
          <div
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border-2 border-slate-950 font-black font-mono text-xs sm:text-sm shadow-[2px_2px_0px_#090d16] ${
              isUrgent
                ? 'bg-rose-500 text-white animate-bounce'
                : timeLeft <= 10
                ? 'bg-amber-300 text-slate-950'
                : 'bg-slate-800 text-slate-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{timeLeft}s</span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Individual Player Token in the Table Roster.
 */
interface PlayerTokenCardProps {
  player: Player
  isCurrentTurn: boolean
  isMe: boolean
  onRemove?: () => void
  canRemove?: boolean
}

export function PlayerTokenCard({
  player,
  isCurrentTurn,
  isMe,
  onRemove,
  canRemove = false
}: PlayerTokenCardProps) {
  return (
    <div
      className={`relative flex items-center justify-between p-2.5 rounded-2xl border-2 border-slate-950 transition-all select-none ${
        isCurrentTurn
          ? 'bg-amber-300 text-slate-950 shadow-[3px_3px_0px_#090d16] scale-[1.02]'
          : 'bg-slate-800 text-slate-200 shadow-[2px_2px_0px_#090d16]'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-slate-900/20 border border-slate-950 flex items-center justify-center flex-shrink-0">
          <DuckAvatarIcon avatar={player.avatar} className="w-6 h-6" />
        </div>

        <div className="min-w-0 leading-tight">
          <div className="flex items-center gap-1 font-black text-xs truncate">
            <span className="truncate">{player.name}</span>
            {isMe && <span className="text-[9px] font-black uppercase text-amber-900 bg-amber-400 px-1 py-0.2 rounded border border-slate-950">(Você)</span>}
            {player.isHost && <Crown className="w-3 h-3 text-amber-500 fill-amber-400 flex-shrink-0" />}
            {player.isBot && <Bot className="w-3 h-3 text-cyan-400 flex-shrink-0" />}
          </div>
          <span className="text-[10px] font-bold opacity-70">
            {player.cardsCount} carta(s)
          </span>
        </div>
      </div>

      {/* Penalty Ducks Pill */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 border border-slate-950 text-slate-950 font-black font-mono text-xs shadow-[1px_1px_0px_#090d16]">
          <span>{player.ducksCount}</span>
          <RubberDuckToken className="w-3.5 h-3.5" />
        </div>

        {canRemove && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="w-5 h-5 rounded-md bg-rose-500 text-white font-black text-[10px] flex items-center justify-center border border-slate-950 hover:bg-rose-600 transition-colors ml-1"
            title="Remover pato"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
