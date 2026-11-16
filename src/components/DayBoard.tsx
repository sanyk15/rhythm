import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { currentMonth, dayWithWeekday, monthOf, todayKey } from '../lib/dates';
import { haptic } from '../lib/haptics';
import HabitRow from './HabitRow';
import MonthCalendar from './MonthCalendar';

interface Props {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onEditTask: (taskId: string, date: string) => void;
}

// Дневной режим: календарь месяца целиком, а под ним — задачи выбранного дня
// и все привычки из всех тем. Отметки ставятся прямо здесь, без модалки.
export default function DayBoard({ selectedDate, onSelectDate, onEditTask }: Props) {
  const { themes, habits, logs, dayTasks, toggleLog, updateDayTask } = useData();
  const today = todayKey();
  const [month, setMonth] = useState(() => monthOf(selectedDate));

  // Все активные привычки в порядке тем, затем — порядке внутри темы.
  const activeHabits = useMemo(() => {
    const themeOrder = new Map(themes.map((t) => [t.id, t.sortOrder]));
    return habits
      .filter((h) => !h.archived)
      .sort(
        (a, b) =>
          (themeOrder.get(a.themeId) ?? 0) - (themeOrder.get(b.themeId) ?? 0) ||
          a.sortOrder - b.sortOrder,
      );
  }, [habits, themes]);

  const habitById = useMemo(
    () => new Map(activeHabits.map((h) => [h.id, h])),
    [activeHabits],
  );

  // Дата → набор выполненных привычек (только активные).
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

  const groups = useMemo(
    () =>
      [...themes]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((theme) => ({
          theme,
          habits: activeHabits.filter((h) => h.themeId === theme.id),
        }))
        .filter((g) => g.habits.length > 0),
    [themes, activeHabits],
  );

  const tasks = useMemo(
    () =>
      dayTasks
        .filter((t) => t.date === selectedDate)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [dayTasks, selectedDate],
  );

  const selectedDone = doneByDate.get(selectedDate) ?? new Set<string>();
  const tasksDone = tasks.filter((t) => t.done).length;
  const habitsDone = activeHabits.filter((h) => selectedDone.has(h.id)).length;
  const total = tasks.length + activeHabits.length;
  const doneCount = tasksDone + habitsDone;
  const isToday = selectedDate === today;

  function dotsForDate(date: string): string[] {
    const done = doneByDate.get(date);
    if (!done) return [];
    return activeHabits.filter((h) => done.has(h.id)).map((h) => h.color);
  }

  // При листании месяца выбранным становится сегодня (если вернулись в
  // текущий месяц) или первое число — чтобы список дел не «отставал».
  function changeMonth(next: string) {
    setMonth(next);
    onSelectDate(next === currentMonth() ? today : `${next}-01`);
  }

  function goToday() {
    setMonth(currentMonth());
    onSelectDate(today);
  }

  function toggleHabit(habitId: string) {
    haptic();
    void toggleLog(habitId, selectedDate).catch(() => {});
  }

  function toggleTask(taskId: string, done: boolean) {
    haptic();
    void updateDayTask(taskId, { done: !done }).catch(() => {});
  }

  return (
    <div className="day-page">
      <MonthCalendar
        month={month}
        today={today}
        selected={selectedDate}
        onMonthChange={changeMonth}
        dotsForDate={dotsForDate}
        onDayClick={onSelectDate}
      />

      <section className="card">
        <div className="section-head">
          <div className="day-head-text">
            <h2>{isToday ? 'Сегодня' : 'Дела на день'}</h2>
            <span className="day-date">{dayWithWeekday(selectedDate)}</span>
          </div>
          <div className="day-head-actions">
            {total > 0 && (
              <span className="section-count">
                {doneCount} из {total}
              </span>
            )}
            {!isToday && (
              <button className="day-today-btn" onClick={goToday}>
                Сегодня
              </button>
            )}
          </div>
        </div>

        {tasks.length > 0 && (
          <div className="day-group">
            <div className="day-group-head">
              <span className="day-group-dot" style={{ background: 'var(--accent)' }} />
              <span className="day-group-title">Задачи</span>
              <span className="day-group-count">
                {tasksDone}/{tasks.length}
              </span>
            </div>
            {tasks.map((task) => (
              <div className="row" key={task.id}>
                <button
                  className={`check${task.done ? ' on' : ''}`}
                  style={
                    task.done
                      ? { background: 'var(--accent)', borderColor: 'var(--accent)' }
                      : undefined
                  }
                  onClick={() => toggleTask(task.id, task.done)}
                  aria-pressed={task.done}
                  aria-label={
                    task.done ? `Снять отметку «${task.title}»` : `Отметить «${task.title}»`
                  }
                >
                  {task.done ? '✓' : ''}
                </button>
                <button className="row-main" onClick={() => toggleTask(task.id, task.done)}>
                  <span className={`row-title${task.done ? ' done' : ''}`}>{task.title}</span>
                </button>
                <button
                  className="row-edit"
                  onClick={() => onEditTask(task.id, task.date)}
                  aria-label={`Изменить «${task.title}»`}
                >
                  ✎
                </button>
              </div>
            ))}
          </div>
        )}

        {groups.length === 0 && tasks.length === 0 && (
          <p className="empty-line">
            На этот день пока ничего нет. Добавь задачу кнопкой ＋ сверху или привычки в
            режиме «Темы».
          </p>
        )}

        {groups.map(({ theme, habits: themeHabits }) => {
          const groupDone = themeHabits.filter((h) => selectedDone.has(h.id)).length;
          return (
            <div className="day-group" key={theme.id}>
              <div className="day-group-head">
                <span className="day-group-dot" style={{ background: theme.accent }} />
                <span className="day-group-title">{theme.title}</span>
                <span className="day-group-count">
                  {groupDone}/{themeHabits.length}
                </span>
              </div>
              {themeHabits.map((habit) => (
                <HabitRow
                  key={habit.id}
                  habit={habit}
                  done={selectedDone.has(habit.id)}
                  onToggle={() => toggleHabit(habit.id)}
                />
              ))}
            </div>
          );
        })}
      </section>
    </div>
  );
}
