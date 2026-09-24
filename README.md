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

## Котировки и арбитраж (`/app/quotes`)

Без ключей: публичные маркет-данные Bybit / HTX / MEXC (`src/utils/quotes.js`).
- Спот: тикеры (цена, 24ч %, объём) с бейджем биржи, поиск, автообновление 20с, статусы доступности (CORS/блокировки видны).
- Арбитраж: внутрибиржевые треугольники USDT→X→Y→USDT по bid/ask с комиссией тейкера, фильтр мин. профита и объёма. Расчёт индикативный (без глубины стакана).
- P2P-стаканы сюда НЕ входят: Bybit/MEXC/Rapira требуют подпись секретом — только личные ключи пользователя (будущая фаза). Секреты бирж в frontend не вшиваются никогда.

## Реферальная программа

Без бэкенда: код `SB-XXXXXX` (из uid), ссылка `?ref=CODE#/login` (захват в `main.jsx` → localStorage → consume при регистрации).
- `refcodes/{code}` → `{ uid }`, `referrals/{auto}` → `{ code, referrerUid, refereeUid, status: signed_up|paid, claimed }`.
- Награда на выбор за каждого оплатившего: +7 дней PRO (`REF_BONUS_DAYS`) или 25% от его тарифа деньгами (`REF_CASH_PCT`, 19→4.75 / 132→33 USDT). Оплата реферала помечает строку (`markReferralPaid` из `activatePro` + `planId/price`).
- Дни забираются кнопкой (пишет свой документ + `bonusType:'days'`); деньги — заявкой с кошельком (`bonusType:'cash'`, `cashStatus: pending→paid`), владелец платит вручную со своего кошелька и отмечает в админке (раздел «Выплаты рефералам»).
- Страница `/app/referrals`: ссылка-копия, счётчики, список, кнопки клейма. Правила — в блоке rules выше (админ видит все referrals для выплат).

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
    // Community scam reports: anyone logged in can read/file, only admin moderates.
    match /reports/{reportId} {
      allow read, create: if request.auth != null;
      allow update, delete: if request.auth != null && request.auth.token.email == 'pirov.ru@yandex.ru';
    }
    // Referrals: codes are public to logged-in users; referral rows visible
    // only to the referrer; created by the referee; bonus claimed by referrer.
    match /refcodes/{code} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null && request.resource.data.uid == request.auth.uid;
      allow delete: if false;
    }
    match /referrals/{refId} {
      allow read: if request.auth != null && (resource.data.referrerUid == request.auth.uid || request.auth.token.email == 'pirov.ru@yandex.ru');
      allow create: if request.auth != null && request.resource.data.refereeUid == request.auth.uid;
      allow update: if request.auth != null && (resource.data.referrerUid == request.auth.uid || resource.data.refereeUid == request.auth.uid || request.auth.token.email == 'pirov.ru@yandex.ru');
      allow delete: if false;
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
- Tronscan Security (`checkTronSecurity`, нужен `TRONSCAN_API_KEY`): `red_tag` и риск-флаги идут в вердикт; те же флаги опрашиваются у топ-8 прямых контрагентов в KYT.
- Tronscan-профиль без ключа (`checkTronProfile`): `risk`-флаг из `account/list` (+вердикт, малый вес +15 в KYT) и поведенческие теги из `account/tag` (показ в отчёте). Проверено: `risk=false` даже на замороженных адресах — детектором фризов не является.
- Tronscan Security: `api/security/account/data` с ключом владельца (`TRONSCAN_API_KEY` в `aml.js` — публичен по дизайну, read-only, денег через него украсть нельзя; при drain'е квоты ротируется в ЛК Tronscan одной строчкой). Флаги (`red_tag` и др.) идут в вердикт.
- Кэш вердиктов 24 ч (`findRecentCheck`): повторная проверка того же адреса API не опрашивает, в дневной лимит не считается. Константа `CHECK_CACHE_HOURS`.
- Allowlist канонических контрактов (`getCanonical`): официальный USDT TRC-20/ERC-20 и USDC ERC-20 никогда не флагуются — Tronscan отдаёт `is_black_list=true` на сам контракт USDT, т.к. токен администрирует чёрный список, а не заблокирован.
- Static-pack судебных дел (`src/data/seizures.json`, `getStaticIndex`): только верифицированные адреса из открытых документов (кошельки оператора ChipMixer из жалобы DOJ, Huione-депозиты из репорта BlockSec). Bulk-кластеры изъятий вендоры не публикуют; всё дошедшее до OFAC уже покрыто ночными списками. Подмешивается ПОД OFAC-индекс.
- Краудсорсинг: кнопка «Пожаловаться» в результате проверки → коллекция `reports` (pending → модерация в `/app/admin` → approved). Одобренные метки (`saveCommunityIndex`) подмешиваются в каждую проверку и BFS-обход как источник COMMUNITY. Правила для `reports` — в блоке rules выше.
- Вердикты: `bad` (совпадение/фриз), `clean`, `unknown`. Лейблы Etherscan/Tronscan бесплатно по API не отдаются — в результате ссылка для ручной сверки.
- История в `users/{uid}/amlchecks` (realtime, лимит 100), риск-бейдж контакта (`amlStatus`) в документе контакта.
- Лимиты: триал — 3 проверки/день (считается по истории, сквозит между устройствами), PRO — безлимит. Константа `TRIAL_CHECKS_PER_DAY` в `aml.js`.
- Проверка адреса (`/app/aml`): скрининг + для TRON риск-анализ (`src/utils/kyt.js`, BFS-обход 1–5 хопов (лимиты 20/20/12/8 на 2–5-м, visited-множество, пул ×4, прогресс), сверка каждого уровня с OFAC (вес падает: +25/+10/+5/+3/+2 с капами), флаги Tronscan у топ-8 прямых контрагентов, exposure % (доля USDT-объёма от санкционных связей), детект поддельного USDT (чужой контракт токена) и dust-переводов + поведенческий скоринг 0–100. Отчёт с факторами, топом контрагентов и печатью в PDF. Результат хранится в истории (`kyt` поле) и переиспользуется из кэша; старые записи открываются кликом с полными деталями.

## Модель прибыли (MVP)

Упрощенный cash-flow, а не точный accounting P&L:
`Net = Σ(продажи − комиссия) − Σ(покупки + комиссия)`. Открытые позиции не переоцениваются; FIFO/LIFO — в планах.
