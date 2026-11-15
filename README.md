# Ритм

PWA-трекер привычек и целей по темам. Каждая тема (Семья, Дом, Работа…) — отдельный
экран с заглавным фото; экраны переключаются свайпом. На экране: календарь месяца с
цветными точками выполненных привычек, чек-лист привычек на сегодня и цели месяца с
тогглами.

Ставится на домашний экран iPhone как обычное приложение (без App Store и без
7‑дневной переустановки), открывается и как обычный сайт.

## Возможности

- **Темы** — свои названия, заглавное фото (загружается с телефона и сжимается),
  цвет, порядок; свайп влево/вправо между темами
- **Привычки** — у каждой темы свой набор; отметка «сделано» в один тап за сегодня
- **Календарь** — переключение месяцев, точки по каждой выполненной привычке;
  тап по дате открывает отметки за этот день
- **Цели месяца** — отдельный список на каждый месяц, тоггл сделано/нет
- **Мгновенный запуск** — данные из локального кеша, свежие докачиваются в фоне
- Светлая/тёмная тема (как в системе или вручную)

## Стек

**React 19 + TypeScript + Vite**, бэкенд и БД — **Supabase** (Postgres + Auth +
Row Level Security + Storage). Внешних зависимостей, кроме `@supabase/supabase-js` и
`react-router-dom`, нет.

## Как развернуть для себя

Нужны: [Node.js](https://nodejs.org) и бесплатный аккаунт [Supabase](https://supabase.com).

### 1. Supabase

1. Создай проект на [supabase.com](https://supabase.com).
2. В **SQL Editor** выполни целиком [`supabase/schema.sql`](./supabase/schema.sql) —
   он создаст таблицы, индексы, RLS, бакет `theme-photos` для фото тем и
   инфраструктуру регистрации. Файл идемпотентен.
3. **Authentication → Sign In / Providers** — «Allow new users to sign up» должен быть
   **включён**: приложение регистрирует пользователей само. Подтверждение email
   (*Email → Confirm email*) — по желанию (у встроенного SMTP лимит ~2 письма в час).
4. Узнай код приглашения: **SQL Editor** → `select code from private.signup_invites;`
5. Скопируй ключи: *Project Settings → API* → `Project URL` и `publishable` key.

> Регистрация закрыта кодом-приглашения: без валидного кода аккаунт не создастся даже
> в обход приложения (проверка — триггер в БД).

### 2. Запуск локально

```bash
npm install
cp .env.example .env.local
```

Заполни `.env.local`:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

```bash
npm run dev
```

Приложение откроется на `http://localhost:5173`.

### 3. Деплой

Фронт статический:

- **Cloudflare Pages**: build command `npm run build`, output dir `dist`.
- **Vercel** / **Netlify** — аналогично.

Переменные окружения (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) задаются
в настройках хостинга. На iPhone: открыть URL в Safari → «Поделиться» →
«На экран „Домой“».

## Безопасность

- Все таблицы под **Row Level Security** (`auth.uid() = user_id`) — каждый запрос
  возвращает только данные авторизованного пользователя.
- Составные внешние ключи не дают сослаться на чужую тему/привычку.
- Фото в Storage: чтение публичное, запись — только в свою папку `<user_id>/…`.
- `publishable` ключ безопасно хранить на клиенте; `secret` не используется.

## Структура

```
src/
├── components/   # ThemePage (экран темы), MonthCalendar, DaySheet,
│                 # ThemeForm, HabitForm, GoalForm, Modal, Login
├── context/      # AuthContext, DataContext (данные + оптимистичные мутации), ThemeContext
├── lib/          # supabase, api (CRUD), cache, dates, colors, storage (загрузка фото), haptics
├── pages/        # Home (карусель тем), Settings
├── types.ts      # модели данных и палитра
├── App.tsx
└── main.tsx
supabase/schema.sql          # таблицы + RLS + Storage + код-приглашение
scripts/gen-icons.py         # генерация PNG-иконок (python3 scripts/gen-icons.py)
```

## Данные

| Таблица | Что хранит |
|---|---|
| `themes` | тема: название, фото, акцентный цвет, порядок |
| `habits` | привычка темы: название, цвет, порядок |
| `habit_logs` | отметка «привычка выполнена в дату» (уникально по паре) |
| `goals` | цель на месяц: название, сделано/нет |
