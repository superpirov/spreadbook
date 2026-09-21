import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { LogIn, Mail, User } from 'lucide-react'
import { AUTH_MODE, useAuth } from '../store/useAuth.js'

export default function Login() {
  const user = useAuth((s) => s.user)
  const login = useAuth((s) => s.login)
  const nav = useNavigate()
  const loc = useLocation()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  if (user) return <Navigate to={loc.state?.from || '/app'} replace />

  const submit = (e) => {
    e.preventDefault()
    const ok = login(email, name)
    if (!ok) {
      setError('Введите корректную почту, например trader@mail.com')
      return
    }
    nav(loc.state?.from || '/app')
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl items-center gap-6 py-8 md:grid-cols-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-soft">Вход в SpreadBook</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
          Ваш кабинет <span className="bg-gradient-to-r from-brand-soft to-mint-soft bg-clip-text text-transparent">в один клик</span>
        </h1>
        <ul className="mt-4 space-y-2 text-sm text-slate-400">
          {['Сделки и журнал — отдельно от посторонних глаз', 'Дашборд прибыли и equity-кривая', 'CRM контрагентов с рейтингами'].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-mint/20 text-[11px] text-mint-soft">✓</span>
              {t}
            </li>
          ))}
        </ul>
      </div>
      <form onSubmit={submit} className="card p-6">
        <h2 className="text-base font-bold">Войти по почте</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          {AUTH_MODE === 'local'
            ? 'Локальный режим: профиль создается в этом браузере без пароля и сервера. Настоящий вход с паролем появится после подключения Firebase.'
            : 'Вход через Firebase Authentication.'}
        </p>
        <label className="label mt-4">Почта</label>
        <div className="relative">
          <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="email"
            required
            placeholder="trader@mail.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError('') }}
            className={`input pl-9 ${error ? 'input-error' : ''}`}
          />
        </div>
        <label className="label mt-3">Имя (необязательно)</label>
        <div className="relative">
          <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            placeholder="Как к вам обращаться"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input pl-9"
          />
        </div>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        <button type="submit" className="btn-primary mt-4 w-full">
          <LogIn size={16} /> Войти
        </button>
        <p className="mt-3 text-center text-xs text-slate-500">
          <Link to="/" className="hover:text-slate-300">← На главную</Link>
        </p>
      </form>
    </div>
  )
}
