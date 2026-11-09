import { useCallback, useEffect, useState } from 'react'

const DATABASE = 'playground.accounts.v1'
const SESSION = 'playground.session.v1'
const EVENT = 'playground:account-change'
export const avatarColors = ['#9670ec', '#456fbd', '#318675', '#b35c83', '#ae733a', '#6362bd']
type LocalUser = {
  id: string; name: string; username: string; email: string; bio: string; color: string
  createdAt: string; favorites: string[]; password?: unknown; recovery?: unknown; revision: number
}
export type Account = Omit<LocalUser, 'password' | 'recovery' | 'revision'>
type Database = { version: 1; users: LocalUser[] }
type Session = { userId: string; revision: number; expiresAt: number }

function readDatabase(): Database {
  const raw = localStorage.getItem(DATABASE)
  if (!raw) return { version: 1, users: [] }
  const db = JSON.parse(raw) as Database
  if (db.version !== 1 || !Array.isArray(db.users)) throw new Error('Não foi possível ler as contas locais. Os dados existentes foram preservados.')
  return db
}

function saveDatabase(db: Database, notify = true) {
  try { localStorage.setItem(DATABASE, JSON.stringify(db)) }
  catch { throw new Error('Não foi possível salvar. Verifique o espaço e a permissão de armazenamento do navegador.') }
  if (notify) window.dispatchEvent(new Event(EVENT))
}

function publicAccount(user: LocalUser): Account {
  const { password: _password, recovery: _recovery, revision: _revision, ...account } = user
  return account
}

function currentUser() {
  const raw = localStorage.getItem(SESSION) ?? sessionStorage.getItem(SESSION)
  if (!raw) return null
  let session: Session
  try { session = JSON.parse(raw) } catch { return null }
  const user = readDatabase().users.find((item) => item.id === session.userId)
  if (!user || session.revision !== user.revision || !(session.expiresAt > Date.now())) return null
  return user
}

function clearSession() {
  localStorage.removeItem(SESSION)
  sessionStorage.removeItem(SESSION)
}

function startSession(user: LocalUser, remember: boolean) {
  clearSession()
  const session: Session = { userId: user.id, revision: user.revision, expiresAt: Date.now() + (remember ? 30 : 1) * 86400000 }
  ;(remember ? localStorage : sessionStorage).setItem(SESSION, JSON.stringify(session))
  window.dispatchEvent(new Event(EVENT))
}

function requireUser() {
  const user = currentUser()
  if (!user) throw new Error('Entre na sua conta para continuar.')
  return user
}

const normalize = (value: string) => value.trim().toLowerCase()
function validateProfile(input: Pick<Account, 'name' | 'username' | 'email' | 'bio' | 'color'>) {
  const profile = { ...input, name: input.name.trim(), username: normalize(input.username), email: normalize(input.email), bio: input.bio.trim() }
  if (profile.name.length < 2 || profile.name.length > 40) throw new Error('O nome deve ter entre 2 e 40 caracteres.')
  if (!/^[a-z0-9_]{3,20}$/.test(profile.username)) throw new Error('Use de 3 a 20 letras, números ou sublinhados no nome de usuário.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email) || profile.email.length > 120) throw new Error('Informe um e-mail válido.')
  if (profile.bio.length > 160) throw new Error('A descrição deve ter até 160 caracteres.')
  if (!avatarColors.includes(profile.color)) throw new Error('Escolha uma das cores disponíveis.')
  return profile
}

function unique(db: Database, email: string, username: string, id?: string) {
  if (db.users.some((user) => user.id !== id && user.email === email)) throw new Error('Este e-mail já possui uma conta neste navegador.')
  if (db.users.some((user) => user.id !== id && user.username === username)) throw new Error('Este nome de usuário já está em uso.')
}
export function useLocalAccounts() {
  const [account, setAccount] = useState<Account | null>(null)
  const [ready, setReady] = useState(false)
  const [storageError, setStorageError] = useState('')
  const refresh = useCallback(() => {
    try { const user = currentUser(); setAccount(user ? publicAccount(user) : null); setStorageError('') }
    catch { setAccount(null); setStorageError('Não foi possível acessar as contas locais. Verifique as permissões de armazenamento; os dados foram preservados.') }
    setReady(true)
  }, [])
  useEffect(() => {
    refresh()
    window.addEventListener(EVENT, refresh)
    window.addEventListener('storage', refresh)
    window.addEventListener('focus', refresh)
    const timer = window.setInterval(refresh, 60_000)
    return () => { window.removeEventListener(EVENT, refresh); window.removeEventListener('storage', refresh); window.removeEventListener('focus', refresh); clearInterval(timer) }
  }, [refresh])

  function register(input: { name: string; username: string; email: string }) {
    const profile = validateProfile({ ...input, bio: '', color: avatarColors[0] })
    const db = readDatabase()
    unique(db, profile.email, profile.username)
    const user: LocalUser = { id: crypto.randomUUID(), ...profile, revision: 1, createdAt: new Date().toISOString(), favorites: [] }
    db.users.push(user)
    saveDatabase(db)
    startSession(user, true)
    refresh()
  }
  function login(identifier: string, remember: boolean) {
    const value = normalize(identifier)
    const user = readDatabase().users.find((item) => item.email === value || item.username === value)
    if (!user) throw new Error('Conta não encontrada neste navegador.')
    startSession(user, remember)
    refresh()
  }
  function logout() { clearSession(); refresh(); window.dispatchEvent(new Event(EVENT)) }
  function updateProfile(input: Pick<Account, 'name' | 'username' | 'email' | 'bio' | 'color'>) {
    const user = requireUser()
    const profile = validateProfile(input)
    const db = readDatabase()
    unique(db, profile.email, profile.username, user.id)
    db.users = db.users.map((item) => item.id === user.id ? { ...item, ...profile } : item)
    saveDatabase(db)
  }
  function deleteAccount() {
    const user = requireUser()
    const db = readDatabase()
    db.users = db.users.filter((item) => item.id !== user.id)
    saveDatabase(db)
    logout()
  }
  function toggleFavorite(gameId: string) {
    const user = requireUser()
    const db = readDatabase()
    db.users = db.users.map((item) => item.id === user.id ? { ...item, favorites: item.favorites.includes(gameId) ? item.favorites.filter((favorite) => favorite !== gameId) : [...item.favorites, gameId] } : item)
    saveDatabase(db)
  }
  return { account, ready, storageError, register, login, logout, updateProfile, deleteAccount, toggleFavorite }
}
export type AccountController = ReturnType<typeof useLocalAccounts>
