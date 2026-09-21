# SpreadBook — учет P2P-сделок с криптовалютой

SPA на React + Vite + Tailwind + Zustand + Recharts. Без бэкенда: все данные в `localStorage` браузера. Деплой — GitHub Pages (HashRouter + `base: './'`).

## Запуск локально

```bash
npm install
npm run dev
```

## Сборка

```bash
npm run build
npm run preview
```

## Деплой на GitHub Pages

Вариант 1 — Actions (рекомендуется): workflow `.github/workflows/deploy.yml` собирает `dist` и публикует на Pages при пуше в `master`/`main`.

Включите в репозитории: Settings → Pages → Source: **GitHub Actions**.

Вариант 2 — вручную:

```bash
npm run deploy
```

## Маршруты

| Путь | Что |
|---|---|
| `/` | Презентационный лендинг |
| `/login` | Вход по почте (сейчас — локальный режим) |
| `/app` | Кабинет: дашборд (за гейтом `ProtectedRoute`) |
| `/app/deals`, `/app/contacts`, `/app/settings` | Журнал, контрагенты, бэкап |

## Вход по почте: что нужно (AUTH_PLAN)

Статический сайт не может сам проверять пароли — нужен внешний auth-провайдер. Рекомендация: **Firebase Authentication** (бесплатный тариф, email+пароль и Google-вход, дружит с GitHub Pages).

1. Создать проект в [Firebase Console](https://console.firebase.google.com), включить Sign-in method → Email/Password (и опционально Google).
2. Взять веб-конфиг (`apiKey`, `authDomain`, `projectId`...) — это публичные ключи, их можно коммитить.
3. В коде: `npm i firebase`, в `src/store/useAuth.js` переключить `AUTH_MODE` на `'firebase'`, заменить `login/logout` на `signInWithEmailAndPassword / createUserWithEmailAndPassword / signOut`, в `Login.jsx` добавить регистрацию и сброс пароля. Роуты и `ProtectedRoute` менять не нужно.
4. Альтернативы: Supabase Auth, Clerk, Auth0 — схема та же, меняется только `useAuth.js`.
5. Данные сделок при этом остаются в `localStorage` (per-browser). Чтобы они ездили за пользователем между устройствами — следующий шаг: Firestore/Supabase вместо стора (отдельная задача).

## Модель прибыли (MVP)

Упрощенный cash-flow, а не точный accounting P&L:
`Net = Σ(продажи − комиссия) − Σ(покупки + комиссия)`. Открытые позиции не переоцениваются; FIFO/LIFO — в планах.
