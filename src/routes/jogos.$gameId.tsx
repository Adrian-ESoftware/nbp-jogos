import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, Maximize, RotateCcw } from 'lucide-react'
import { useRef, useState } from 'react'
import { getGame, withBase } from '../lib/catalog'

export const Route = createFileRoute('/jogos/$gameId')({ component: GamePage })

function GamePage() {
  const { gameId } = Route.useParams()
  const game = getGame(gameId)
  const frame = useRef<HTMLIFrameElement>(null)
  const [instance, setInstance] = useState(0)
  const [message, setMessage] = useState('')

  if (!game) return <main className="player-empty"><h1>Jogo não encontrado</h1><p>Este jogo não está disponível no catálogo.</p><Link className="play-button" to="/"><ArrowLeft size={16} aria-hidden="true" /> Voltar ao catálogo</Link></main>

  async function fullscreen() {
    try {
      if (!frame.current?.requestFullscreen) throw new Error('indisponível')
      await frame.current.requestFullscreen()
      setMessage('')
    } catch { setMessage('Não foi possível abrir em tela cheia neste navegador.') }
  }
  return <main className="player-page">
    <header className="player-header"><Link className="player-back" to="/"><ArrowLeft size={18} aria-hidden="true" /> Voltar ao catálogo</Link><img src={withBase('/images/nbp-games-logo-dark.svg')} alt="NBP Games" /></header>
    <section className="player-content" aria-labelledby="player-title">
      <div className="player-heading">
        <div className="player-identity">
          {game.assets.icon && <img className="player-icon" src={game.assets.icon} alt="" />}
          <div><h1 id="player-title">{game.title}</h1><p>{game.developer} <span aria-hidden="true">·</span> {game.genres.join(' · ')}</p></div>
        </div>
        <div className="player-actions">
          <button type="button" aria-label="Reiniciar jogo" title="Reiniciar jogo" onClick={() => { setInstance((current) => current + 1); setMessage('') }}><RotateCcw size={16} aria-hidden="true" /><span>Reiniciar</span></button>
          <button type="button" aria-label="Tela cheia" title="Tela cheia" onClick={fullscreen}><Maximize size={16} aria-hidden="true" /><span>Tela cheia</span></button>
        </div>
      </div>
      <iframe key={instance} ref={frame} className="player-frame" src={game.entry} title={`Jogar ${game.title}`} allow="fullscreen; autoplay; gamepad" />
      {message && <p className="player-message" role="status">{message}</p>}
      <div className="player-footer">
        <details className="player-description"><summary>Sobre o jogo</summary><p>{game.description}</p></details>
        <div className="player-tags">{game.modes.map((mode) => <span key={mode}>{mode === 'singleplayer' ? 'Singleplayer' : 'Multiplayer'}</span>)}</div>
      </div>
    </section>
  </main>
}
