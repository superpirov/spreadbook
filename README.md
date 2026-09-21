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
| `/login` | Вход и регистрация по почте (Firebase Auth) |
| `/app` | Кабинет: дашборд (за гейтом `ProtectedRoute` + пейволл подписки) |
| `/app/deals`, `/app/contacts`, `/app/settings`, `/app/billing` | Журнал, контрагенты, бэкап, тариф и оплата |

## Вход по почте (Firebase) — ✅ подключено

Вход работает через **Firebase Authentication** (проект `spreadbook-5452d`, провайдер Email/Password).
Код: `src/utils/firebase.js` (конфиг), `src/store/useAuth.js` (`AUTH_MODE='firebase'`, login/register/reset + `onAuthStateChanged`), `src/pages/Login.jsx`, гейт `ProtectedRoute` ждёт восстановления сессии.

Чеклист в консоли (если что-то не работает):
1. Build → Authentication → Sign-in method → **Email/Password включён**.
2. Authentication → Settings → **Authorized domains** → добавлен `superpirov.github.io` (иначе вход с сайта отклоняется с `auth/unauthorized-domain`).
3. Данные сделок по-прежнему в `localStorage` (per-browser). Синхронизация между устройствами — следующий шаг: Firestore.

## Оплата (BILLING)

Модель: 3 дня триала с момента первого входа, далее PRO — 19 USDT / 30 дней или 132 USDT / 365 дней (≈11 USDT/мес).

- Настройки в `src/utils/billing.js`: `BILLING.wallet` (TRC-20 адрес), `PLANS` (цены/сроки), `BILLING.trialDays`.
- Пользователь отправляет USDT (TRC-20) на кошелёк и вставляет TXID на странице `/app/billing`.
- Проверка ончейн: `verifyUsdtPayment()` опрашивает Tronscan public API (`transaction-info`), сверяет получателя, USDT-контракт `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`, сумму ≥ цены и подтверждение сети.
- Состояние подписки (`trialStart / plan / expiresAt`) — в `useAuth`, гейт — в `CabinetLayout` (App.jsx). Просрочка закрывает разделы кабинета пейволлом, страница оплаты остаётся доступна.
- Ограничение: enforcement клиентский (localStorage). Строгая защита — бэкенд-воркер с проверкой Trongrid (бэклог).

## Админка и Firestore (реестр пользователей)

Подписки зеркалируются в Firestore (`users/{uid}`), админка — `/app/admin` (доступ только для email из `ADMIN_EMAILS` в `src/utils/admin.js`).

Включение (в Firebase Console):
1. Build → Firestore Database → Create database → Production mode → Enable.
2. Вкладка Rules → вставить ниже → Publish (email владельца уже подставлен).
3. В `src/utils/admin.js` вписать тот же email в `ADMIN_EMAILS`, запушить.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      allow read, write: if request.auth != null && request.auth.token.email == 'pirov.ru@yandex.ru';
    }
  }
}
```

Без включённого Firestore приложение работает в локальном режиме (подписки только в браузере), админка покажет подсказку.

## Модель прибыли (MVP)

Упрощенный cash-flow, а не точный accounting P&L:
`Net = Σ(продажи − комиссия) − Σ(покупки + комиссия)`. Открытые позиции не переоцениваются; FIFO/LIFO — в планах.
