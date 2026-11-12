import { motion, AnimatePresence } from 'motion/react'

export interface FloatingAlertItem {
  id: string
  text: string
  type: 'bid' | 'double' | 'challenge' | 'penalty' | 'info'
  rotation?: number
}

interface FloatingAlertsProps {
  alerts: FloatingAlertItem[]
}

export function FloatingAlerts({ alerts }: FloatingAlertsProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/4 z-50 flex flex-col items-center gap-2">
      <AnimatePresence>
        {alerts.map((alert) => {
          const rot = alert.rotation ?? (Math.random() * 8 - 4)

          const colorClasses =
            alert.type === 'challenge'
              ? 'bg-rose-500 text-white border-slate-950 shadow-[4px_4px_0px_#020617]'
              : alert.type === 'double'
              ? 'bg-amber-400 text-slate-950 border-slate-950 shadow-[4px_4px_0px_#020617]'
              : alert.type === 'penalty'
              ? 'bg-orange-500 text-white border-slate-950 shadow-[4px_4px_0px_#020617]'
              : 'bg-emerald-400 text-slate-950 border-slate-950 shadow-[4px_4px_0px_#020617]'

          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 30, scale: 0.6, rotate: rot }}
              animate={{ opacity: 1, y: -24, scale: 1.15, rotate: rot }}
              exit={{ opacity: 0, y: -60, scale: 0.9 }}
              transition={{
                type: 'spring',
                stiffness: 450,
                damping: 20
              }}
              className={`px-4 py-2 rounded-2xl border-[3px] font-black tracking-wider text-sm sm:text-base uppercase flex items-center gap-2 select-none ${colorClasses}`}
            >
              <span>{alert.text}</span>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
