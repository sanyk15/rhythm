import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import DayBoard from '../components/DayBoard';
import DaySheet from '../components/DaySheet';
import DayTaskForm from '../components/DayTaskForm';
import GoalForm from '../components/GoalForm';
import HabitForm from '../components/HabitForm';
import ThemeForm from '../components/ThemeForm';
import ThemePage from '../components/ThemePage';
import { useData } from '../context/DataContext';
import { todayHeader, todayKey } from '../lib/dates';

type Editor =
  | { kind: 'theme'; themeId?: string }
  | { kind: 'habit'; themeId: string; habitId?: string }
  | { kind: 'goal'; themeId: string; month: string; goalId?: string }
  | { kind: 'day'; themeId: string; date: string }
  | { kind: 'task'; date: string; taskId?: string }
  | null;

/** Два режима главного экрана: дневной календарь и карусель тем. */
type Mode = 'calendar' | 'themes';

const MODE_KEY = 'rhythm_mode';

function initialMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'themes' ? 'themes' : 'calendar';
  } catch {
    return 'calendar';
  }
}

export default function Home() {
  const { themes, habits, goals, dayTasks, loading, error, refresh } = useData();
  const [index, setIndex] = useState(0);
  const [editor, setEditor] = useState<Editor>(null);
  const [mode, setMode] = useState<Mode>(initialMode);
  // Выбранный в календаре день живёт здесь: «＋» в этом режиме добавляет
  // задачу именно на него.
  const [selectedDate, setSelectedDate] = useState(todayKey);

  // Режим запоминается на устройстве — при следующем запуске откроется он же.
  useEffect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      // приватный режим или переполнение — просто не запомнится
    }
  }, [mode]);

  const ordered = useMemo(
    () => [...themes].sort((a, b) => a.sortOrder - b.sortOrder),
    [themes],
  );

  // Карусель — нативный горизонтальный скролл со снапом: движение идёт
  // физикой платформы, без ручного translateX и его рывков.
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef(0);
  const indexRef = useRef(index);
  // Куда едет программный скролл: пока не доехали, точки не дёргаем.
  const scrollTargetRef = useRef<number | null>(null);

  // Актуальный номер темы для эффекта при возврате в «Темы».
  useLayoutEffect(() => {
    indexRef.current = index;
  }, [index]);

  // После создания темы листаем к ней.
  const [jumpToId, setJumpToId] = useState<string | null>(null);

  useEffect(() => {
    if (!jumpToId) return;
    const idx = ordered.findIndex((t) => t.id === jumpToId);
    if (idx >= 0) {
      setIndex(idx);
      const el = viewportRef.current;
      if (el) {
        scrollTargetRef.current = idx;
        el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' });
      }
      setJumpToId(null);
    }
  }, [jumpToId, ordered]);

  useEffect(() => {
    if (index <= ordered.length - 1) return;
    const next = Math.max(0, ordered.length - 1);
    setIndex(next);
    const el = viewportRef.current;
    if (el) el.scrollLeft = next * el.clientWidth;
  }, [index, ordered.length]);

  // Возвращаемся в «Темы» — лента встаёт туда, где была, ещё до отрисовки.
  useLayoutEffect(() => {
    if (mode !== 'themes') return;
    const el = viewportRef.current;
    if (el) el.scrollLeft = indexRef.current * el.clientWidth;
  }, [mode]);

  useEffect(() => () => cancelAnimationFrame(scrollRafRef.current), []);

  // Текущая тема — по позиции скролла (обновляем не чаще кадра).
  function onScroll() {
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = 0;
      const el = viewportRef.current;
      if (!el) return;
      const width = el.clientWidth || 1;
      const target = scrollTargetRef.current;
      if (target !== null) {
        if (Math.abs(el.scrollLeft - target * width) > 2) return;
        scrollTargetRef.current = null;
      }
      const next = Math.round(el.scrollLeft / width);
      setIndex((cur) => (cur === next ? cur : next));
    });
  }

  function scrollToTheme(i: number) {
    const el = viewportRef.current;
    if (!el) return;
    scrollTargetRef.current = i;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  }

  // Пользователь тронул ленту — программный скролл больше не актуален.
  function cancelScrollTarget() {
    scrollTargetRef.current = null;
  }

  function openNewTheme() {
    setEditor({ kind: 'theme' });
  }

  function openNewTask() {
    setEditor({ kind: 'task', date: selectedDate });
  }

  const editingTheme =
    editor?.kind === 'theme' && editor.themeId
      ? ordered.find((t) => t.id === editor.themeId)
      : undefined;

  const editingHabit =
    editor?.kind === 'habit' && editor.habitId
      ? habits.find((h) => h.id === editor.habitId)
      : undefined;

  const editingGoal =
    editor?.kind === 'goal' && editor.goalId
      ? goals.find((g) => g.id === editor.goalId)
      : undefined;

  const editingTask =
    editor?.kind === 'task' && editor.taskId
      ? dayTasks.find((t) => t.id === editor.taskId)
      : undefined;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-title">Ритм</span>
          <span className="brand-date">{todayHeader()}</span>
        </div>

        <div
          className={`mode-switch${mode === 'themes' ? ' mode-switch--themes' : ''}`}
          role="group"
          aria-label="Режим отображения"
        >
          <span className="mode-thumb" aria-hidden="true" />
          <button
            className={`mode-option${mode === 'calendar' ? ' active' : ''}`}
            onClick={() => setMode('calendar')}
            aria-pressed={mode === 'calendar'}
            aria-label="Календарь"
            title="Календарь"
          >
            <CalendarIcon />
          </button>
          <button
            className={`mode-option${mode === 'themes' ? ' active' : ''}`}
            onClick={() => setMode('themes')}
            aria-pressed={mode === 'themes'}
            aria-label="Темы"
            title="Темы"
          >
            <ThemesIcon />
          </button>
        </div>

        <div className="topbar-actions">
          <button
            className="icon-btn"
            onClick={mode === 'calendar' ? openNewTask : openNewTheme}
            aria-label={mode === 'calendar' ? 'Новая задача' : 'Новая тема'}
            title={mode === 'calendar' ? 'Новая задача' : 'Новая тема'}
          >
            ＋
          </button>
          <Link to="/settings" className="icon-btn" aria-label="Настройки">
            ⚙
          </Link>
        </div>
      </header>

      <main className="content">
        {loading && ordered.length === 0 && dayTasks.length === 0 ? (
          <div className="splash">Загрузка…</div>
        ) : mode === 'themes' && ordered.length === 0 ? (
          <div className="empty-screen">
            <div className="empty-emoji">🌱</div>
            <h1>Начни с темы</h1>
            <p>
              Темы — это экраны, между которыми листаешь свайпом: Семья, Дом, Работа.
              У каждой своё фото, привычки и цели.
            </p>
            <button className="btn-primary" onClick={openNewTheme}>
              Создать первую тему
            </button>
          </div>
        ) : (
          <div className="mode-panel" key={mode}>
            {mode === 'calendar' ? (
              <DayBoard
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                onEditTask={(taskId, date) => setEditor({ kind: 'task', date, taskId })}
              />
            ) : (
              <>
                <div
                  className="carousel-viewport"
                  ref={viewportRef}
                  onScroll={onScroll}
                  onTouchStart={cancelScrollTarget}
                  onWheel={cancelScrollTarget}
                >
                  <div className="carousel">
                    {ordered.map((theme) => (
                      <div className="carousel-page" key={theme.id}>
                        <ThemePage
                          theme={theme}
                          onEditTheme={() => setEditor({ kind: 'theme', themeId: theme.id })}
                          onAddHabit={() => setEditor({ kind: 'habit', themeId: theme.id })}
                          onEditHabit={(habitId) =>
                            setEditor({ kind: 'habit', themeId: theme.id, habitId })
                          }
                          onAddGoal={(month) =>
                            setEditor({ kind: 'goal', themeId: theme.id, month })
                          }
                          onEditGoal={(goalId) =>
                            setEditor({
                              kind: 'goal',
                              themeId: theme.id,
                              month: goals.find((g) => g.id === goalId)?.month ?? '',
                              goalId,
                            })
                          }
                          onOpenDay={(date) => setEditor({ kind: 'day', themeId: theme.id, date })}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {ordered.length > 1 && (
                  <div className="page-dots">
                    {ordered.map((theme, i) => (
                      <button
                        key={theme.id}
                        className={`page-dot${i === index ? ' active' : ''}`}
                        style={i === index ? { background: theme.accent } : undefined}
                        onClick={() => {
                          setIndex(i);
                          scrollToTheme(i);
                        }}
                        aria-label={`Тема «${theme.title}»`}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {error && (
          <div className="error floating" role="alert">
            <span>{error}</span>
            <button onClick={() => void refresh()}>Повторить</button>
          </div>
        )}
      </main>

      {editor?.kind === 'theme' && (
        <ThemeForm
          theme={editingTheme}
          canMoveLeft={!!editingTheme && ordered.findIndex((t) => t.id === editingTheme.id) > 0}
          canMoveRight={
            !!editingTheme && ordered.findIndex((t) => t.id === editingTheme.id) < ordered.length - 1
          }
          onCreated={setJumpToId}
          onClose={() => setEditor(null)}
        />
      )}

      {editor?.kind === 'habit' && (
        <HabitForm
          themeId={editor.themeId}
          habit={editingHabit}
          onClose={() => setEditor(null)}
        />
      )}

      {editor?.kind === 'goal' && (
        <GoalForm
          themeId={editor.themeId}
          month={editingGoal?.month ?? editor.month}
          goal={editingGoal}
          onClose={() => setEditor(null)}
        />
      )}

      {editor?.kind === 'day' && (
        <DaySheet themeId={editor.themeId} date={editor.date} onClose={() => setEditor(null)} />
      )}

      {editor?.kind === 'task' && (
        <DayTaskForm
          date={editingTask?.date ?? editor.date}
          task={editingTask}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="5.5" width="17" height="15" rx="3.5" />
      <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
      <circle cx="8.5" cy="14" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="14" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ThemesIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="7" y="4" width="13" height="16" rx="3" />
      <path d="M4 7.5V18a2.5 2.5 0 0 0 2.5 2.5H16" />
    </svg>
  );
}
