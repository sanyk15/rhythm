# CLAUDE.md — Ритм

## Коротко о проекте

PWA-трекер привычек и целей по темам. Сделан для жены и автора: **один общий аккаунт** —
видят одни и те же данные. Экраны-темы (Семья, Дом, Работа…) переключаются свайпом
влево/вправо. На экране темы: заглавное фото, календарь месяца с точками выполненных
привычек, чек-лист привычек на сегодня, цели месяца с тогглами.

Весь UI на русском. Работает как PWA (домашний экран iPhone) и как обычный сайт.

## Технологический стек

- **React 19 + TypeScript + Vite** (`tsc -b && vite build`, линтер `oxlint`)
- **React Router v7 — HashRouter** (не BrowserRouter: на Cloudflare Pages не нужен
  редирект `/* → /index.html`, иначе цикл и ошибка 100324)
- **Supabase** (`@supabase/supabase-js`) — Postgres + Auth + RLS + Storage (фото тем)
- **PWA**: `manifest.webmanifest`, иконки, apple-touch-icon
- Внешних зависимостей больше нет; state-менеджера нет — React-хуки и контексты

## Архитектура

Поток данных: `lib/api.ts` (CRUD к Supabase) → `context/DataContext.tsx` (один снимок
всех данных в кеше + оптимистичные мутации) → `pages/Home` → `components/ThemePage`.

- **Один снимок вместо постраничных запросов.** `fetchSnapshot()` грузит `themes`,
  `habits`, `habit_logs`, `goals` параллельно; всё лежит в одном кеше под ключом
  `snapshot` (`lib/cache.ts`, префикс `rhythm_cache_<user_id>__`). Данных мало, экраны
  фильтруют локально.
- **Оптимистичные мутации.** Контекст сразу обновляет снимок и кеш, затем пишет в БД;
  при ошибке откатывает предыдущий снимок и пробрасывает ошибку (формы её показывают,
  тогглы глушат `.catch(() => {})`).
- **`createTheme` возвращает созданную тему** — `Home` по её id листает карусель к новой
  теме (`jumpToId`).
- **Авторизация** — `context/AuthContext.tsx`: вход по email/паролю, регистрация только
  по коду-приглашению (проверка RPC + триггер на `auth.users`), восстановление сессии
  через `getSession()`.
- **Тема оформления** — `context/ThemeContext.tsx`: `light | dark | system`,
  `localStorage.theme`, атрибут `<html data-theme>` (выставляется и в `index.html` до
  загрузки бандла, чтобы не мигало).

## Структура `src/`

```
App.tsx                      # ThemeProvider > HashRouter > AuthProvider > Root
main.tsx
types.ts                     # Theme, Habit, HabitLog, Goal, Snapshot, PALETTE
index.css                    # вся стилизация (переменные, карусель, календарь, модалки)
components/
  ThemePage.tsx              # экран темы: герой-фото, календарь, привычки, цели
  MonthCalendar.tsx          # сетка месяца с понедельника + точки по датам
  DaySheet.tsx               # модалка отметок за конкретный день
  ThemeForm.tsx              # создание/правка темы, фото, цвет, порядок, удаление
  HabitForm.tsx, GoalForm.tsx
  Modal.tsx                  # createPortal в body, Escape, блокировка скролла
  Login.tsx
context/  AuthContext.tsx, DataContext.tsx, ThemeContext.tsx
lib/
  supabase.ts                # клиент (VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY)
  api.ts                     # CRUD + selectAll() (пагинация по 1000 строк)
  cache.ts                   # localStorage-кеш, привязанный к user_id
  dates.ts                   # 'YYYY-MM-DD' / 'YYYY-MM', сетка месяца, русские подписи
  storage.ts                 # загрузка фото в Storage + сжатие на клиенте (canvas)
  colors.ts                  # shade/alpha для градиентов
  haptics.ts
pages/  Home.tsx (карусель тем), Settings.tsx
```

## Модель данных (и схема в `supabase/schema.sql`)

| Таблица | Поля | Смысл |
|---|---|---|
| `themes` | `id, title, photo_url, accent, sort_order` | экран темы |
| `habits` | `id, theme_id, title, color, sort_order, archived` | привычки темы |
| `habit_logs` | `id, habit_id, date` + `unique(habit_id, date)` | отметка «сделано в дату» |
| `goals` | `id, theme_id, month, title, done, sort_order` | цели месяца (`month` = 1-е число) |

RLS на всех таблицах (`auth.uid() = user_id`), составные FK `(theme_id, user_id)` и
`(habit_id, user_id)` не дают сослаться на чужую строку. Фото — бакет `theme-photos`:
чтение публичное, запись только в `<user_id>/…`.

## Важные факты / грабли

- **Карусель тем** (`Home.tsx`) — лента на `transform: translateX`, ведётся за пальцем
  через прямое управление DOM; `touch-action: pan-y` на вьюпорте отделяет вертикальный
  скролл страницы от горизонтального свайпа. **После горизонтального свайпа клик по
  календарю гасится** (`suppressClickRef` в `onClickCapture`) — иначе открывалась бы
  модалка дня.
- **Страница темы — сама скролл-контейнер** (`.carousel-page`), не `.content`.
- **Модалки — createPortal в document.body** (иначе обрезаются скролл-контейнером на
  iOS); в `index.html` viewport `interactive-widget=resizes-content`, чтобы клавиатура не
  прятала кнопки.
- **PostgREST отдаёт максимум 1000 строк** — `selectAll()` ходит `.range()` постранично.
- **Кеш привязан к аккаунту** (`setCacheScope` при входе/выходе); при смене пользователя
  кеш стирается.
- **Фото сжимается на клиенте** до 1400 px по длинной стороне, JPEG q=0.82. Старое фото
  удаляется из Storage best-effort.
- **День считается по локальной дате** (`todayKey()`), не по UTC.
- **Не использовать `toISOString()`** для дат — сдвиг часового пояса.
- Иконки PWA генерируются скриптом `python3 scripts/gen-icons.py`.

## Env (`.env.local`, gitignored)

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Ключ — **publishable**, не старый JWT anon; `secret` на клиенте не используется.

## Git / деплой

- Репозиторий: `https://github.com/sanyk15/rhythm`, ветка `main`.
- Деплой: Cloudflare Pages (build `npm run build`, out `dist`).
