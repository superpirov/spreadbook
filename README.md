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

## Модель прибыли (MVP)

Упрощенный cash-flow, а не точный accounting P&L:
`Net = Σ(продажи − комиссия) − Σ(покупки + комиссия)`. Открытые позиции не переоцениваются; FIFO/LIFO — в планах.
