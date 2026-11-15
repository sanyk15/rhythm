import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { TouchEvent } from 'react';
import { Link } from 'react-router-dom';
import DaySheet from '../components/DaySheet';
import GoalForm from '../components/GoalForm';
import HabitForm from '../components/HabitForm';
import ThemeForm from '../components/ThemeForm';
import ThemePage from '../components/ThemePage';
import { useData } from '../context/DataContext';
import { todayHeader } from '../lib/dates';
import { haptic } from '../lib/haptics';

type Editor =
  | { kind: 'theme'; themeId?: string }
  | { kind: 'habit'; themeId: string; habitId?: string }
  | { kind: 'goal'; themeId: string; month: string; goalId?: string }
  | { kind: 'day'; themeId: string; date: string }
  | null;

export default function Home() {
  const { themes, habits, goals, loading, error, refresh } = useData();
  const [index, setIndex] = useState(0);
  const [editor, setEditor] = useState<Editor>(null);

  const ordered = useMemo(
    () => [...themes].sort((a, b) => a.sortOrder - b.sortOrder),
    [themes],
  );

  const trackRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const axisRef = useRef<'h' | 'v' | null>(null);
  const dragRef = useRef(0);
  // После горизонтального свайпа браузер всё равно может прислать click по дню
  // в календаре — гасим его в захвате, иначе откроется модалка.
  const suppressClickRef = useRef(false);

  // После создания темы листаем к ней.
  const [jumpToId, setJumpToId] = useState<string | null>(null);

  useEffect(() => {
    if (!jumpToId) return;
    const idx = ordered.findIndex((t) => t.id === jumpToId);
    if (idx >= 0) {
      setIndex(idx);
      setJumpToId(null);
    }
  }, [jumpToId, ordered]);

  useEffect(() => {
    if (index > ordered.length - 1) setIndex(Math.max(0, ordered.length - 1));
  }, [index, ordered.length]);

  // Ставим ленту на нужную тему до отрисовки, без мигания.
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.style.transition = 'transform 0.42s cubic-bezier(0.32, 0.72, 0, 1)';
    el.style.transform = `translateX(${-index * 100}%)`;
  }, [index, ordered.length]);

  function snapBack() {
    const el = trackRef.current;
    if (!el) return;
    el.style.transition = 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)';
    el.style.transform = `translateX(${-index * 100}%)`;
  }

  function onTouchStart(e: TouchEvent<HTMLDivElement>) {
    if (editor) return;
    suppressClickRef.current = false;
    const touch = e.touches[0];
    startRef.current = { x: touch.clientX, y: touch.clientY };
    axisRef.current = null;
    dragRef.current = 0;
  }

  function onTouchMove(e: TouchEvent<HTMLDivElement>) {
    if (!startRef.current || editor) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startRef.current.x;
    const dy = touch.clientY - startRef.current.y;

    if (axisRef.current === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      axisRef.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      if (axisRef.current === 'h') suppressClickRef.current = true;
    }
    if (axisRef.current !== 'h') return;

    const maxRight = index > 0 ? window.innerWidth : 0;
    const maxLeft = index < ordered.length - 1 ? window.innerWidth : 0;
    const clamped = Math.max(-maxLeft, Math.min(maxRight, dx));
    dragRef.current = clamped;

    const el = trackRef.current;
    if (el) {
      el.style.transition = 'none';
      el.style.transform = `translateX(calc(${-index * 100}% + ${clamped}px))`;
    }
  }

  function onTouchEnd() {
    if (!startRef.current) return;
    startRef.current = null;
    const horizontal = axisRef.current === 'h';
    axisRef.current = null;
    const dx = dragRef.current;
    dragRef.current = 0;

    if (!horizontal) return;

    const threshold = window.innerWidth * 0.25;
    let next = index;
    if (dx < -threshold && index < ordered.length - 1) next = index + 1;
    else if (dx > threshold && index > 0) next = index - 1;

    if (next !== index) {
      haptic();
      setIndex(next);
    } else {
      snapBack();
    }
  }

  function openNewTheme() {
    setEditor({ kind: 'theme' });
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

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-title">Ритм</span>
          <span className="brand-date">{todayHeader()}</span>
        </div>
        <div className="topbar-actions">
          <button className="icon-btn" onClick={openNewTheme} aria-label="Новая тема">
            ＋
          </button>
          <Link to="/settings" className="icon-btn" aria-label="Настройки">
            ⚙
          </Link>
        </div>
      </header>

      <main className="content">
        {loading && ordered.length === 0 ? (
          <div className="splash">Загрузка…</div>
        ) : ordered.length === 0 ? (
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
          <>
            <div
              className="carousel-viewport"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onTouchCancel={onTouchEnd}
              onClickCapture={(e) => {
                if (!suppressClickRef.current) return;
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <div className="carousel" ref={trackRef}>
                {ordered.map((theme) => (
                  <div className="carousel-page" key={theme.id}>
                    <ThemePage
                      theme={theme}
                      onEditTheme={() => setEditor({ kind: 'theme', themeId: theme.id })}
                      onAddHabit={() => setEditor({ kind: 'habit', themeId: theme.id })}
                      onEditHabit={(habitId) =>
                        setEditor({ kind: 'habit', themeId: theme.id, habitId })
                      }
                      onAddGoal={(month) => setEditor({ kind: 'goal', themeId: theme.id, month })}
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
                    onClick={() => setIndex(i)}
                    aria-label={`Тема «${theme.title}»`}
                  />
                ))}
              </div>
            )}
          </>
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
    </div>
  );
}
