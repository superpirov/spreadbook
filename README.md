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

## Админка и Firestore (реестр + синхронизация)

Подписки зеркалируются в Firestore (`users/{uid}`), админка — `/app/admin` (доступ только для email из `ADMIN_EMAILS` в `src/utils/admin.js`).
Все данные пользователя синхронизируются между устройствами в реальном времени:
- `users/{uid}/deals/{dealId}` — сделки (id документа = id сделки),
- `users/{uid}/contacts/{urlencoded-name}` — рейтинг, заметка и реквизиты,
- `users/{uid}` — `knownCounterparties[]`, `period` + профиль/подписка.

Правила (Rules → Publish, email владельца уже подставлен):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function ownerOrAdmin(uid) {
      return request.auth != null
        && (request.auth.uid == uid || request.auth.token.email == 'pirov.ru@yandex.ru');
    }
    match /users/{uid} {
      allow read, write: if ownerOrAdmin(uid);
      match /deals/{dealId} {
        allow read, write: if ownerOrAdmin(uid);
      }
      match /contacts/{contactId} {
        allow read, write: if ownerOrAdmin(uid);
      }
      match /amlchecks/{checkId} {
        allow read, write: if ownerOrAdmin(uid);
      }
    }
  }
}
```

Как устроен стор (`src/store/useStore.js`): при входе `bindUser(uid)` поднимает 3 realtime-подписки (`onSnapshot`), localStorage остаётся мгновенным кэшем (`spreadbook-cache-v1-{uid}`) и офлайн-фallback; запись — оптимистично локально, затем во Firestore. Включён persistent offline cache Firestore: без интернета всё работает, при появлении сети досинхронизируется само. Старая локальная база (`spreadbook-storage-v2`) один раз автоматически переезжает в облако, если облако пусто. Выход (`unbindUser`) очищает данные из памяти — важно на чужих устройствах.

## AML-скрининг

Страница `/app/aml` + кнопка «Проверить кошельки» в карточке контрагента.
- Движок `src/utils/aml.js`: OFAC SDN списки (репо 0xB10C, ветка `lists`, TXT по сетям TRX/ETH/USDT/USDC/BSC/XBT/LTC/SOL) тянутся с raw.githubusercontent и кэшируются в localStorage (`spreadbook-aml-v1`), кнопка «Обновить базы».
- Нормализация: EVM → lowercase; TRON base58 ↔ hex (`bs58`), кросс-проверка EVM-представления Tron-адреса.
- Живой статус заморозки USDT: Ethereum `isBlackListed` (`0xe47d6060`) через public RPC, TRON — `triggerconstantcontract` в Trongrid. Недоступность RPC = «не проверено», не ошибка.
- Tronscan Security: `api/security/account/data` с ключом владельца (`TRONSCAN_API_KEY` в `aml.js` — публичен по дизайну, read-only, денег через него украсть нельзя; при drain'е квоты ротируется в ЛК Tronscan одной строчкой). Флаги (`red_tag` и др.) идут в вердикт.
- Кэш вердиктов 24 ч (`findRecentCheck`): повторная проверка того же адреса API не опрашивает, в дневной лимит не считается. Константа `CHECK_CACHE_HOURS`.
- Вердикты: `bad` (совпадение/фриз), `clean`, `unknown`. Лейблы Etherscan/Tronscan бесплатно по API не отдаются — в результате ссылка для ручной сверки.
- История в `users/{uid}/amlchecks` (realtime, лимит 100), риск-бейдж контакта (`amlStatus`) в документе контакта.
- Лимиты: триал — 3 проверки/день (считается по истории, сквозит между устройствами), PRO — безлимит. Константа `TRIAL_CHECKS_PER_DAY` в `aml.js`.
- KYT-лайт (`src/utils/kyt.js`, вкладка «Глубокая» на `/app/aml`, пока только TRON): прямые контрагенты (1 хоп) сверяются с OFAC + поведенческий скоринг 0–100 (заморозка, санкции, флаги, возраст, тонкая история, скорость, транзит). Отчёт с факторами, топом контрагентов и печатью в PDF. Результат хранится в истории (`kyt` поле) и переиспользуется из кэша.

## Модель прибыли (MVP)

Упрощенный cash-flow, а не точный accounting P&L:
`Net = Σ(продажи − комиссия) − Σ(покупки + комиссия)`. Открытые позиции не переоцениваются; FIFO/LIFO — в планах.
