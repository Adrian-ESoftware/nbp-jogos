import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Bell, ChevronDown, Grid2X2, Heart, Home, Library, MoreHorizontal, Pause, Play, Search, Sparkles, Star, UserRound, UsersRound } from 'lucide-react'
import AccountPanel from '../components/AccountPanel'
import { useLocalAccounts } from '../lib/local-accounts'
import { featuredGames, games, genres, withBase } from '../lib/catalog'

export const Route = createFileRoute('/')({ component: App })

const carouselGames = featuredGames.length ? featuredGames : games.slice(0, 6)

function App() {
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        if (document.querySelector('dialog[open], [aria-modal="true"]')) return
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])
  const [category, setCategory] = useState('Todos')
  const [activeNav, setActiveNav] = useState('Explorar')
  const accounts = useLocalAccounts()
  const [accountOpen, setAccountOpen] = useState(false)
  const [accountError, setAccountError] = useState('')
  const saved = accounts.account?.favorites ?? []
  const accountName = accounts.account?.name ?? 'Visitante'
  const avatar = accounts.account?.name.slice(0, 1).toUpperCase() ?? '?'
  const avatarStyle = accounts.account ? { background: accounts.account.color } : undefined
  function toggleFavorite(gameId: string) {
    if (!accounts.account) { setAccountOpen(true); return }
    try { accounts.toggleFavorite(gameId); setAccountError('') }
    catch (cause) { setAccountError(cause instanceof Error ? cause.message : 'Não foi possível salvar o favorito.') }
  }
  const [featured, setFeatured] = useState(0)
  const [autoplay, setAutoplay] = useState(true)
  const [carouselEngaged, setCarouselEngaged] = useState(false)
  const [pageVisible, setPageVisible] = useState(true)
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = () => { if (motion.matches) setAutoplay(false) }
    const updateVisibility = () => setPageVisible(!document.hidden)
    updateMotion(); updateVisibility()
    motion.addEventListener('change', updateMotion)
    document.addEventListener('visibilitychange', updateVisibility)
    return () => { motion.removeEventListener('change', updateMotion); document.removeEventListener('visibilitychange', updateVisibility) }
  }, [])
  useEffect(() => {
    if (!autoplay || carouselEngaged || !pageVisible || accountOpen || carouselGames.length < 2) return
    const timer = window.setTimeout(() => setFeatured((current) => (current + 1) % carouselGames.length), 6000)
    return () => window.clearTimeout(timer)
  }, [autoplay, carouselEngaged, pageVisible, accountOpen, featured])
  const filtered = useMemo(() => games.filter((game) => (category === 'Todos' || game.genres.includes(category) || (category === 'Favoritos' && saved.includes(game.id))) && game.title.toLowerCase().includes(query.toLowerCase())), [category, query, saved])
  const categories = ['Todos', ...genres]
  function navigate(label: 'Explorar' | 'Categorias' | 'Minha biblioteca') {
    setActiveNav(label)
    setQuery('')
    setCategory(label === 'Minha biblioteca' ? 'Favoritos' : 'Todos')
    if (label === 'Explorar') window.scrollTo({ top: 0, behavior: 'smooth' })
    else document.getElementById('categorias')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <main className="hub-shell">
      <aside className="hub-sidebar">
        <a className="hub-brand" href="#inicio" aria-label="NBP Games início"><img className="hub-logo" src={withBase('/images/nbp-games-logo-dark.svg')} alt="NBP Games" /></a>
        <div className="side-label">MENU</div>
        <nav className="side-nav" aria-label="Menu principal">
          {([[Home, 'Explorar'], [Grid2X2, 'Categorias'], [Library, 'Minha biblioteca']] as const).map(([Icon, label]) => <button key={label} className={activeNav === label ? 'side-link active' : 'side-link'} onClick={() => navigate(label)}><span><Icon size={20} aria-hidden="true" /></span>{label}</button>)}
        </nav>
        <div className="side-label quick-label">JOGOS DISPONÍVEIS</div>
        <div className="recent-list">{games.length ? games.slice(0, 4).map((game) => <Link key={game.id} to="/jogos/$gameId" params={{ gameId: game.id }} className="recent-game"><span className="recent-cover" style={{ backgroundImage: `url("${game.assets.icon ?? game.assets.cover}")` }} /> <span>{game.title}<small>Jogar agora</small></span></Link>) : <p className="sidebar-empty">Os jogos cadastrados aparecerão aqui.</p>}</div>
        <div className="sidebar-note"><span className="note-icon"><Sparkles size={27} aria-hidden="true" /></span><strong>Seu universo de jogos.</strong><p>Descubra. Jogue. Repita.</p><span className="browser-ready"><i /> Direto no navegador</span></div><button className="sidebar-bottom account-sidebar-button" onClick={() => setAccountOpen(true)} disabled={!accounts.ready}><div className="profile-avatar" style={avatarStyle}>{avatar}</div><div><strong>{accountName}</strong><small>{accounts.account ? `@${accounts.account.username}` : 'Entre ou crie sua conta'}</small></div><span className="more-button"><MoreHorizontal size={20} aria-hidden="true" /></span></button>
      </aside>

      <section className="hub-main" id="inicio">
        <header className="hub-topbar"><a className="mobile-brand" href="#inicio" aria-label="NBP Games início"><img src={withBase('/images/nbp-games-logo-dark.svg')} alt="NBP Games" /></a><label className="search-box"><Search size={20} aria-hidden="true" /><input ref={searchRef} aria-label="Buscar jogos" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar jogos..." /><kbd>Ctrl / ⌘ K</kbd></label><div className="top-actions"><button aria-label="Notificações" className="icon-button"><Bell size={20} aria-hidden="true" /><i /></button><button aria-label="Favoritos" className="icon-button" onClick={() => navigate(category === 'Favoritos' ? 'Explorar' : 'Minha biblioteca')}><Heart size={20} aria-hidden="true" /></button><button className="top-profile account-trigger" aria-label={accounts.account ? 'Abrir minha conta' : 'Entrar ou criar conta'} onClick={() => setAccountOpen(true)} disabled={!accounts.ready}><span className="profile-avatar" style={avatarStyle}>{avatar}</span><span>{accounts.account ? accountName : 'Entrar'}<small>{accounts.account ? 'Minha conta' : 'Criar conta'}</small></span><span className="chevron"><ChevronDown size={15} aria-hidden="true" /></span></button></div></header>

        <div className="hub-content">
          <h1 className="sr-only">NBP Games — catálogo de jogos</h1>
          {(accountError || accounts.storageError) && <div className="hub-account-error" role="alert">{accountError || accounts.storageError}<button onClick={() => { setAccountError(''); setAccountOpen(true) }}>Minha conta</button></div>}
          {category === 'Favoritos' && !accounts.account && <div className="library-signin"><div><strong>Sua biblioteca começa com uma conta.</strong><p>Entre para guardar seus jogos favoritos neste navegador.</p></div><button className="play-button" onClick={() => setAccountOpen(true)}>Entrar ou criar conta</button></div>}
          {carouselGames.length > 0 && <div className="carousel-area" onMouseEnter={() => setCarouselEngaged(true)} onMouseLeave={() => setCarouselEngaged(false)} onFocus={() => setCarouselEngaged(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setCarouselEngaged(false) }}>
          <section className="cover-carousel" aria-label="Jogos em destaque">
            {carouselGames.map((game, index) => {
              const relative = (index - featured + carouselGames.length) % carouselGames.length
              const offset = relative > Math.floor(carouselGames.length / 2) ? relative - carouselGames.length : relative
              return <article key={game.id} className={`feature-cover cover-position-${Math.abs(offset) > 2 ? 5 : offset + 2}`} style={{ backgroundImage: `url("${game.assets.banner}")` }}>
                {offset === 0 ? <><button className={`feature-favorite ${saved.includes(game.id) ? 'saved' : ''}`} aria-label="Favoritar destaque" onClick={() => toggleFavorite(game.id)}><Heart size={20} fill={saved.includes(game.id) ? 'currentColor' : 'none'} aria-hidden="true" /></button><div className="cover-copy"><span className="cover-kicker">EM DESTAQUE</span><h2>{game.title}</h2><p>{game.description}</p><div className="cover-actions"><Link className="play-button" to="/jogos/$gameId" params={{ gameId: game.id }}><Play size={14} fill="currentColor" aria-hidden="true" /> Jogar agora</Link></div></div></> : <button className="cover-select" aria-label={`Destacar ${game.title}`} onClick={() => setFeatured(index)} tabIndex={Math.abs(offset) > 2 ? -1 : undefined} aria-hidden={Math.abs(offset) > 2 ? true : undefined} />}
              </article>
            })}
          </section>
          <div className="carousel-controls"><div className="carousel-dots">{carouselGames.map((game, index) => <button key={game.id} className={featured === index ? 'selected' : ''} aria-label={`Destacar ${game.title}`} onClick={() => setFeatured(index)} />)}</div><span>SEU PRÓXIMO FAVORITO ESTÁ AQUI</span><div className="carousel-arrows">{carouselGames.length > 1 && <><button type="button" aria-label={autoplay ? 'Pausar rotação automática' : 'Retomar rotação automática'} aria-pressed={!autoplay} onClick={() => setAutoplay((current) => !current)}>{autoplay ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}</button><button aria-label="Destaque anterior" onClick={() => setFeatured((featured + carouselGames.length - 1) % carouselGames.length)}><ArrowLeft size={16} aria-hidden="true" /></button><button aria-label="Próximo destaque" onClick={() => setFeatured((featured + 1) % carouselGames.length)}><ArrowRight size={16} aria-hidden="true" /></button></>}</div></div>
          </div>}

          <section className="catalog-section" id="categorias"><div className="section-heading"><div><h2>{category === 'Favoritos' ? 'Sua biblioteca' : 'Jogos para descobrir'}</h2></div><button className="view-all" onClick={() => { setCategory('Todos'); setActiveNav('Explorar'); setQuery('') }}>Ver todos <span><ArrowRight size={14} aria-hidden="true" /></span></button></div>
            <div className="category-row">{categories.map((item) => <button key={item} onClick={() => { setCategory(item); setActiveNav(item === 'Todos' ? 'Explorar' : 'Categorias') }} className={category === item ? 'category-chip selected' : 'category-chip'}>{item === 'Todos' && <span><Sparkles size={12} aria-hidden="true" /></span>}{item}</button>)}</div>
            {filtered.length ? <div className="game-grid">{filtered.map((game, index) => <article className="game-card" key={game.id} style={{ animationDelay: `${index * 60}ms` }}><Link className="game-art" style={{ backgroundImage: `url("${game.assets.cover}")` }} to="/jogos/$gameId" params={{ gameId: game.id }} aria-label={`Jogar ${game.title}`}><span className="game-tag">{game.genres[0]}</span><span className="card-play"><Play size={18} fill="currentColor" aria-hidden="true" /></span><span className="game-mode">{game.modes.includes('multiplayer') ? <UsersRound size={13} aria-hidden="true" /> : <UserRound size={13} aria-hidden="true" />} {game.modes.length === 2 ? 'Solo e multiplayer' : game.modes[0] === 'multiplayer' ? 'Multiplayer' : 'Singleplayer'}</span></Link><div className="game-info"><div><h3>{game.title}</h3><p>{game.genres[0]} <span>·</span> <b>{game.developer}</b></p><span className="free-label">JOGUE NO NAVEGADOR</span></div><button className={saved.includes(game.id) ? 'save-game saved' : 'save-game'} onClick={() => toggleFavorite(game.id)} aria-label={saved.includes(game.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}><Heart size={20} fill={saved.includes(game.id) ? 'currentColor' : 'none'} aria-hidden="true" /></button></div></article>)}</div> : <div className="empty-state"><span><Search size={27} aria-hidden="true" /></span><strong>{games.length === 0 ? 'Os jogos estão chegando' : category === 'Favoritos' && !query ? 'Sua biblioteca está vazia' : 'Nenhum jogo encontrado'}</strong><p>{games.length === 0 ? 'Em breve você poderá descobrir e jogar aqui.' : category === 'Favoritos' && !query ? 'Adicione jogos aos favoritos para encontrá-los aqui.' : 'Tente outra busca ou escolha uma categoria diferente.'}</p>{games.length > 0 && <button onClick={() => { setCategory('Todos'); setActiveNav('Explorar'); setQuery('') }}>Ver jogos</button>}</div>}
          </section>
          <footer className="hub-footer"><a className="footer-repository" href="https://github.com/Adrian-ESoftware/nbp-jogos" target="_blank" rel="noopener noreferrer" aria-label="Repositório NBP Games no GitHub (abre em nova aba)">GitHub <Star size={14} aria-hidden="true" /></a><span>Feito para quem nunca para de jogar.</span><span>© 2026 NBP Games</span></footer>
        </div>
      </section>
      <nav className="mobile-nav" aria-label="Navegação móvel">
        {([[Home, 'Explorar', 'Início'], [Grid2X2, 'Categorias', 'Categorias'], [Library, 'Minha biblioteca', 'Biblioteca']] as const).map(([Icon, label, shortLabel]) => <button key={label} type="button" className={activeNav === label ? 'mobile-nav-item active' : 'mobile-nav-item'} aria-current={activeNav === label ? 'page' : undefined} onClick={() => navigate(label)}><Icon size={21} aria-hidden="true" /><span>{shortLabel}</span></button>)}
        <button type="button" className="mobile-nav-item" aria-label={accounts.account ? 'Abrir minha conta' : 'Entrar ou criar conta'} disabled={!accounts.ready} onClick={() => setAccountOpen(true)}><UserRound size={21} aria-hidden="true" /><span>Conta</span></button>
      </nav>
      {accountOpen && <AccountPanel controller={accounts} onClose={() => setAccountOpen(false)} />}

    </main>
  )
}
