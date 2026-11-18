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
всех данных в кеше + оптимистичные мутации) → `pages/Home` → `components/ThemePage`
или `components/DayBoard`.

- **Два независимых режима главного экрана.** Иконочный свитч в шапке (`Home.tsx`,
  localStorage `rhythm_mode`) переключает «Календарь» и «Темы». Календарь (`DayBoard`) —
  только разовые задачи (`day_tasks`) на выбранный день, привычки тем здесь не видны.
  «Темы» — карусель с привычками, целями и отметками. «＋» в шапке зависит от режима:
  в «Темах» создаёт тему, в «Календаре» — задачу на выбранный день.

- **Один снимок вместо постраничных запросов.** `fetchSnapshot()` грузит `themes`,
  `habits`, `habit_logs`, `goals`, `day_tasks` параллельно; всё лежит в одном кеше под
  ключом `snapshot` (`lib/cache.ts`, префикс `rhythm_cache_<user_id>__`). Данных мало,
  экраны фильтруют локально. Кеш нормализуется (`normalizeSnapshot`) — снимок от старой
  версии приложения без новых полей не ломает экраны.
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
  DayBoard.tsx               # режим «Календарь»: месяц + задачи выбранного дня
  MonthCalendar.tsx          # сетка месяца с понедельника + точки по датам
  HabitRow.tsx               # строка привычки (чекбокс, расписание, правка)
  DaySheet.tsx               # модалка отметок за конкретный день
  DayTaskForm.tsx            # создание/правка/удаление разовой задачи на день
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
| `habits` | `id, theme_id, title, color, sort_order, archived, weekdays` | привычки темы; `weekdays` — дни недели (1=Пн…7=Вс), пусто/старые = каждый день |
| `habit_logs` | `id, habit_id, date` + `unique(habit_id, date)` | отметка «сделано в дату» |
| `goals` | `id, theme_id, month, title, done, sort_order` | цели месяца (`month` = 1-е число) |
| `day_tasks` | `id, date, title, done, sort_order` | разовые задачи на конкретный день |

RLS на всех таблицах (`auth.uid() = user_id`), составные FK `(theme_id, user_id)` и
`(habit_id, user_id)` не дают сослаться на чужую строку. Фото — бакет `theme-photos`:
чтение публичное, запись только в `<user_id>/…`.

## Важные факты / грабли

- **Периодичность привычек.** `habits.weekdays` (1=Пн…7=Вс, `ALL_WEEKDAYS`). В чек-листе
  темы привычки не на сегодня показываются приглушёнными и не отмечаются; `DaySheet` и
  точки календаря фильтруют по дню недели. Старый кеш без `weekdays` нормализуется в
  «каждый день» (`normalizeSnapshot`).
- **Режим главного экрана** по умолчанию — «Календарь»; выбор запоминается в
  `localStorage.rhythm_mode` (ключ не привязан к аккаунту). При листании месяца в
  дневном режиме выбранный день сбрасывается на сегодня / первое число.
- **Карусель тем** (`Home.tsx`) — нативный горизонтальный скролл со снапом
  (`.carousel-viewport` + `scroll-snap-type: x mandatory`), а не ручной translateX:
  движение идёт физикой платформы. Вертикальный скролл — внутри `.carousel-page`.
  Точки и переход к новой теме листают через `scrollTo`; `index` обновляется из
  `onScroll` раз в кадр, программный скролл не дёргает точки (`scrollTargetRef`).
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
