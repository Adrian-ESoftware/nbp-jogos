import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Diamond, Sparkles, X } from 'lucide-react'
import type { FormEvent } from 'react'
import { avatarColors } from '../lib/local-accounts'
import type { AccountController } from '../lib/local-accounts'

type Screen = 'login' | 'register' | 'profile' | 'delete'
export default function AccountPanel({ controller: c, onClose }: { controller: AccountController; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [screen, setScreen] = useState<Screen>(c.account ? 'profile' : 'login')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [color, setColor] = useState(c.account?.color ?? avatarColors[0])
  const [confirmed, setConfirmed] = useState(false)
  const previousAccount = useRef(c.account?.id)
  useEffect(() => {
    const element = dialog.current!
    const priorOverflow = document.body.style.overflow
    element.showModal(); document.body.style.overflow = 'hidden'
    return () => { element.close(); document.body.style.overflow = priorOverflow }
  }, [])
  useEffect(() => {
    if (previousAccount.current && !c.account) { setScreen('login'); setError(''); setMessage('Sua sessão foi encerrada.') }
    if (c.account && previousAccount.current !== c.account.id) { setScreen('profile'); setColor(c.account.color); setError(''); setMessage('') }
    previousAccount.current = c.account?.id
  }, [c.account])
  function navigate(next: Screen) { setScreen(next); setError(''); setMessage(''); setConfirmed(false) }
  function submit(event: FormEvent<HTMLFormElement>, action: (data: FormData) => void) {
    event.preventDefault(); setError(''); setMessage('')
    try { action(new FormData(event.currentTarget)) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível concluir. Tente novamente.') }
  }
  const value = (data: FormData, key: string) => String(data.get(key) ?? '')
  const account = c.account
  const titles: Record<Screen, string> = { login: 'Bom ter você por aqui.', register: 'Sua próxima aventura.', profile: 'Seu espaço no NBP Games.', delete: 'Excluir sua conta?' }
  return <dialog ref={dialog} className="account-dialog" aria-labelledby="account-title" onCancel={(event) => { event.preventDefault(); onClose() }} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="account-panel">
      <button className="account-close" type="button" aria-label="Fechar conta" onClick={onClose}><X size={20} aria-hidden="true" /></button>
      <div className="account-emblem">{account ? <span className="account-avatar-large" style={{ background: account.color }}>{account.name.slice(0, 1).toUpperCase()}</span> : <Sparkles size={26} aria-hidden="true" />}</div>
      <p className="eyebrow">{account ? `@${account.username}` : 'SUA CONTA · SEU UNIVERSO'}</p>
      <h2 id="account-title">{titles[screen]}</h2>
      {!account && <p className="account-intro">Salve seus favoritos e deixe o hub com a sua cara.</p>}
      {(error || c.storageError) && <p className="account-alert error" role="alert">{error || c.storageError}</p>}
      {message && <p className="account-alert success" role="status">{message}</p>}
      {screen === 'login' && <form onSubmit={(event) => submit(event, (data) => { c.login(value(data, 'identifier'), data.has('remember')); onClose() })}>
        <fieldset disabled={!c.ready || !!c.storageError}>
          <label className="account-field"><span>E-mail ou nome de usuário</span><span className="account-input-wrap"><input name="identifier" autoComplete="username" maxLength={120} required autoFocus /></span></label>
          <label className="account-check"><input type="checkbox" name="remember" defaultChecked />Lembrar por 30 dias</label>
          <button className="account-primary" type="submit">Entrar na conta <span><ArrowRight size={16} aria-hidden="true" /></span></button>
        </fieldset><p className="account-switch">Ainda não tem conta? <button type="button" onClick={() => navigate('register')}>Criar conta</button></p>
      </form>}
      {screen === 'register' && <form onSubmit={(event) => submit(event, (data) => { c.register({ name: value(data, 'name'), username: value(data, 'username'), email: value(data, 'email') }); onClose() })}>
        <fieldset disabled={!!c.storageError}>
          <label className="account-field"><span>Como podemos chamar você?</span><input name="name" minLength={2} maxLength={40} autoComplete="name" required autoFocus /></label>
          <label className="account-field"><span>Nome de usuário</span><input name="username" pattern="[a-zA-Z0-9_]{3,20}" minLength={3} maxLength={20} autoComplete="username" required /><small>3 a 20 letras, números ou _.</small></label>
          <label className="account-field"><span>E-mail</span><input name="email" type="email" maxLength={120} autoComplete="email" required /></label>
          <button className="account-primary" type="submit">Criar minha conta <span><ArrowRight size={16} aria-hidden="true" /></span></button>
        </fieldset><p className="account-switch">Já tem conta? <button type="button" onClick={() => navigate('login')}>Entrar</button></p>
      </form>}
      {screen === 'profile' && account && <form key={account.id} onSubmit={(event) => submit(event, (data) => { c.updateProfile({ name: value(data, 'name'), username: value(data, 'username'), email: value(data, 'email'), bio: value(data, 'bio'), color }); setMessage('Perfil atualizado.') })}>
        <fieldset>
          <div className="avatar-picker"><span>Cor do avatar</span><div>{avatarColors.map((item, index) => <button type="button" key={item} aria-label={`Cor do avatar ${index + 1}`} aria-pressed={color === item} style={{ background: item }} onClick={() => setColor(item)}>{color === item && <Check size={18} aria-hidden="true" />}</button>)}</div></div>
          <label className="account-field"><span>Nome de exibição</span><input name="name" defaultValue={account.name} minLength={2} maxLength={40} required /></label>
          <label className="account-field"><span>Nome de usuário</span><input name="username" defaultValue={account.username} pattern="[a-zA-Z0-9_]{3,20}" maxLength={20} required /></label>
          <label className="account-field"><span>E-mail</span><input name="email" type="email" defaultValue={account.email} maxLength={120} required /></label>
          <label className="account-field"><span>Sobre você <small>opcional</small></span><textarea name="bio" defaultValue={account.bio} maxLength={160} placeholder="Que tipo de aventura é a sua cara?" /><small>Até 160 caracteres.</small></label>
          <div className="account-stats"><span><strong>{account.favorites.length}</strong> favoritos</span><span>Membro desde <strong>{new Date(account.createdAt).toLocaleDateString('pt-BR')}</strong></span></div>
          <button className="account-primary" type="submit">Salvar alterações</button>
        </fieldset><button className="account-secondary logout-button" type="button" onClick={() => { c.logout(); onClose() }}>Sair da conta</button><div className="account-danger"><button type="button" onClick={() => navigate('delete')}>Excluir minha conta</button></div>
      </form>}
      {screen === 'delete' && account && <form onSubmit={(event) => submit(event, () => { if (!confirmed) throw new Error('Confirme a exclusão para continuar.'); c.deleteAccount(); onClose() })}>
        <p className="account-intro">Sua conta <strong>@{account.username}</strong> e seus favoritos serão removidos permanentemente deste navegador.</p><fieldset>
          <label className="account-check"><input type="checkbox" required checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />Entendo que esta ação não pode ser desfeita.</label>
          <button className="account-primary danger" type="submit" disabled={!confirmed}>Excluir conta permanentemente</button><button className="account-secondary" type="button" onClick={() => navigate('profile')}>Cancelar</button>
        </fieldset>
      </form>}
      <p className="account-local-note"><span><Diamond size={14} aria-hidden="true" /></span> Contas ficam apenas neste navegador. Quem usar este navegador pode acessar os perfis. Limpar os dados do site remove contas e favoritos.</p>
    </div>
  </dialog>
}
