import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { currentMonth, monthLabel, monthName, todayKey } from '../lib/dates';
import { shade } from '../lib/colors';
import { haptic } from '../lib/haptics';
import type { Goal, Habit, Theme } from '../types';
import HabitRow from './HabitRow';
import MonthCalendar from './MonthCalendar';

interface Props {
  theme: Theme;
  onEditTheme: () => void;
  onAddHabit: () => void;
  onEditHabit: (habitId: string) => void;
  onAddGoal: (month: string) => void;
  onEditGoal: (goalId: string) => void;
  onOpenDay: (date: string) => void;
}

export default function ThemePage({
  theme,
  onEditTheme,
  onAddHabit,
  onEditHabit,
  onAddGoal,
  onEditGoal,
  onOpenDay,
}: Props) {
  const { habits, logs, goals, toggleLog, updateGoal } = useData();
  const [month, setMonth] = useState(currentMonth);
  const today = todayKey();

  const themeHabits = useMemo(
    () =>
      habits
        .filter((h) => h.themeId === theme.id && !h.archived)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [habits, theme.id],
  );

  const habitById = useMemo(() => new Map(themeHabits.map((h) => [h.id, h])), [themeHabits]);

  // Отметки только по активным привычкам этой темы: дата → набор habit_id.
  const doneByDate = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const log of logs) {
      if (!habitById.has(log.habitId)) continue;
      const set = map.get(log.date);
      if (set) set.add(log.habitId);
      else map.set(log.date, new Set([log.habitId]));
    }
    return map;
  }, [logs, habitById]);

  // Порядок точек — как порядок привычек в списке, а не как пришли отметки.
  const dotsForDate = (date: string): string[] => {
    const done = doneByDate.get(date);
    if (!done) return [];
    return themeHabits.filter((h) => done.has(h.id)).map((h) => h.color);
  };

  const doneTodaySet = doneByDate.get(today) ?? new Set<string>();
  const doneToday = doneTodaySet.size;

  const monthGoals = useMemo(
    () =>
      goals
        .filter((g) => g.themeId === theme.id && g.month === month)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [goals, theme.id, month],
  );

  function handleToggle(habit: Habit) {
    haptic();
    void toggleLog(habit.id, today).catch(() => {});
  }

  function handleGoalToggle(goal: Goal) {
    haptic();
    void updateGoal(goal.id, { done: !goal.done }).catch(() => {});
  }

  return (
    <div className="theme-page">
      <div
        className="theme-hero"
        style={{
          background: theme.photoUrl
            ? undefined
            : `linear-gradient(150deg, ${theme.accent}, ${shade(theme.accent, 0.5)})`,
        }}
      >
        {theme.photoUrl && (
          <img className="theme-hero-img" src={theme.photoUrl} alt="" loading="lazy" />
        )}
        <div className="theme-hero-shade" />
        <button className="hero-btn" onClick={onEditTheme} aria-label="Изменить тему">
          ⋯
        </button>
        <div className="theme-hero-bottom">
          <h1 className="theme-hero-title">{theme.title}</h1>
          {themeHabits.length > 0 && (
            <span className="theme-hero-count">
              {doneToday} из {themeHabits.length} сегодня
            </span>
          )}
        </div>
      </div>

      <div className="theme-body">
        <MonthCalendar
          month={month}
          today={today}
          onMonthChange={setMonth}
          dotsForDate={dotsForDate}
          onDayClick={onOpenDay}
        />

        <section className="card">
          <div className="section-head">
            <h2>Привычки</h2>
            <span className="section-count">
              {themeHabits.length ? `сегодня ${doneToday} из ${themeHabits.length}` : 'пока нет'}
            </span>
          </div>

          {themeHabits.length === 0 && (
            <p className="empty-line">
              Добавь первую привычку — её точки появятся в календаре.
            </p>
          )}

          {themeHabits.map((habit) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              done={doneTodaySet.has(habit.id)}
              onToggle={() => handleToggle(habit)}
              onEdit={() => onEditHabit(habit.id)}
            />
          ))}

          <button className="add-row" onClick={onAddHabit}>
            <span className="add-row-plus">＋</span> Привычка
          </button>
        </section>

        <section className="card">
          <div className="section-head">
            <h2>
              Цели <span className="section-muted">{monthName(month)}</span>
            </h2>
            <button
              className="section-add"
              onClick={() => onAddGoal(month)}
              aria-label="Добавить цель"
            >
              ＋
            </button>
          </div>

          {monthGoals.length === 0 && (
            <p className="empty-line">На {monthLabel(month).toLowerCase()} целей пока нет.</p>
          )}

          {monthGoals.map((goal) => (
            <GoalRow
              key={goal.id}
              goal={goal}
              onToggle={() => handleGoalToggle(goal)}
              onEdit={() => onEditGoal(goal.id)}
            />
          ))}
        </section>
      </div>
    </div>
  );
}

function GoalRow({
  goal,
  onToggle,
  onEdit,
}: {
  goal: Goal;
  onToggle: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="row">
      <button
        className={`goal-check${goal.done ? ' on' : ''}`}
        onClick={onToggle}
        aria-pressed={goal.done}
        aria-label={goal.done ? `Отменить «${goal.title}»` : `Выполнить «${goal.title}»`}
      >
        {goal.done ? '✓' : ''}
      </button>
      <button className="row-main" onClick={onToggle}>
        <span className={`row-title${goal.done ? ' done' : ''}`}>{goal.title}</span>
      </button>
      <button className="row-edit" onClick={onEdit} aria-label={`Изменить цель «${goal.title}»`}>
        ✎
      </button>
    </div>
  );
}
