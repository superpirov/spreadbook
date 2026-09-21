import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { LogIn, UserPlus, Mail, User, Lock, Loader2, KeyRound } from 'lucide-react'
import { useAuth } from '../store/useAuth.js'

const ERRORS = {
  'auth/invalid-email': 'Некорректная почта.',
  'auth/user-not-found': 'Пользователь не найден. Зарегистрируйтесь ниже.',
  'auth/wrong-password': 'Неверный пароль.',
  'auth/invalid-credential': 'Неверная почта или пароль.',
  'auth/email-already-in-use': 'Эта почта уже зарегистрирована. Войдите.',
  'auth/weak-password': 'Пароль слишком простой — минимум 6 символов.',
  'auth/missing-password': 'Введите пароль.',
  'auth/network-request-failed': 'Нет соединения. Проверьте интернет.',
  'auth/unauthorized-domain': 'Домен не добавлен в Firebase → Authorized domains.',
  'auth/operation-not-allowed': 'В Firebase не включён вход по Email/Password (Sign-in method).',
  'auth/too-many-requests': 'Слишком много попыток. Подождите и попробуйте позже.',
}

const friendly = (e) => ERRORS[e?.code] || e?.message || 'Что-то пошло не так. Попробуйте ещё раз.'

export default function Login() {
  const user = useAuth((s) => s.user)
  const login = useAuth((s) => s.login)
  const register = useAuth((s) => s.register)
  const resetPassword = useAuth((s) => s.resetPassword)
  const nav = useNavigate()
  const loc = useLocation()

  const [mode, setMode] = useState('login') // login | register | reset
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  if (user) return <Navigate to={loc.state?.from || '/app'} replace />

  const go = () => nav(loc.state?.from || '/app')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setInfo('')
    try {
      if (mode === 'register') {
        await register(email, name, password)
      } else if (mode === 'reset') {
        await resetPassword(email)
        setInfo('Письмо для сброса пароля отправлено. Проверьте почту (и спам).')
        return
      } else {
        await login(email, password)
      }
      go()
    } catch (err) {
      setError(friendly(err))
    } finally {
      setBusy(false)
    }
  }

  const switchMode = (m) => {
    setMode(m)
    setError('')
    setInfo('')
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl items-start gap-6 py-8 md:grid-cols-2">
      <div className="md:pt-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-soft">Вход в SpreadBook</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
          Ваш кабинет <span className="bg-gradient-to-r from-brand-soft to-mint-soft bg-clip-text text-transparent">под защитой</span>
        </h1>
        <ul className="mt-4 space-y-2 text-sm text-slate-400">
          {['Первые 3 дня — полный доступ без оплаты', 'Далее PRO — 29 USDT в месяц (TRC-20)', 'Сделки, аналитика и CRM контрагентов'].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-mint/20 text-[11px] text-mint-soft">✓</span>
              {t}
            </li>
          ))}
        </ul>
      </div>
      <div className="card p-6">
        <div className="mb-4 flex rounded-xl bg-ink-950 p-1 text-sm font-semibold">
          {[
            ['login', 'Вход'],
            ['register', 'Регистрация'],
          ].map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`flex-1 rounded-lg px-3 py-1.5 transition ${mode === m ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <form onSubmit={submit}>
          <label className="label">Почта</label>
          <div className="relative">
            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="email" required placeholder="trader@mail.com"
              value={email} onChange={(e) => { setEmail(e.target.value); setError('') }}
              className="input pl-9"
            />
          </div>
          {mode === 'register' && (
            <>
              <label className="label mt-3">Имя (необязательно)</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  placeholder="Как к вам обращаться"
                  value={name} onChange={(e) => setName(e.target.value)}
                  className="input pl-9"
                />
              </div>
            </>
          )}
          {mode !== 'reset' && (
            <>
              <label className="label mt-3">Пароль</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password" required={mode !== 'reset'} minLength={6}
                  placeholder={mode === 'register' ? 'Минимум 6 символов' : 'Ваш пароль'}
                  value={password} onChange={(e) => { setPassword(e.target.value); setError('') }}
                  className="input pl-9"
                />
              </div>
            </>
          )}
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          {info && <p className="mt-2 text-xs text-emerald-300">{info}</p>}
          <button type="submit" disabled={busy} className="btn-primary mt-4 w-full">
            {busy ? <Loader2 size={16} className="animate-spin" /> : mode === 'register' ? <UserPlus size={16} /> : mode === 'reset' ? <KeyRound size={16} /> : <LogIn size={16} />}
            {busy ? 'Секунду…' : mode === 'register' ? 'Создать аккаунт' : mode === 'reset' ? 'Отправить письмо' : 'Войти'}
          </button>
        </form>
        <div className="mt-3 flex items-center justify-between text-xs">
          {mode === 'login' ? (
            <button className="text-slate-500 hover:text-slate-300" onClick={() => switchMode('reset')}>Забыли пароль?</button>
          ) : (
            <button className="text-slate-500 hover:text-slate-300" onClick={() => switchMode('login')}>← Назад ко входу</button>
          )}
          <Link to="/" className="text-slate-500 hover:text-slate-300">На главную</Link>
        </div>
      </div>
    </div>
  )
}
