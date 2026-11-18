import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { currentMonth, dayWithWeekday, monthOf, todayKey } from '../lib/dates';
import { haptic } from '../lib/haptics';
import MonthCalendar from './MonthCalendar';

interface Props {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onEditTask: (taskId: string, date: string) => void;
}

// Дневной режим — полностью отдельный от «Тем»: календарь и разовые задачи
// на выбранный день. Привычки из тем здесь не показываются.
export default function DayBoard({ selectedDate, onSelectDate, onEditTask }: Props) {
  const { dayTasks, updateDayTask } = useData();
  const today = todayKey();
  const [month, setMonth] = useState(() => monthOf(selectedDate));

  const tasks = useMemo(
    () =>
      dayTasks
        .filter((t) => t.date === selectedDate)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [dayTasks, selectedDate],
  );

  const tasksDone = tasks.filter((t) => t.done).length;
  const isToday = selectedDate === today;

  // Точка в календаре — день, на который заведены задачи.
  const datesWithTasks = useMemo(
    () => new Set(dayTasks.map((t) => t.date)),
    [dayTasks],
  );

  function dotsForDate(date: string): string[] {
    return datesWithTasks.has(date) ? ['var(--accent)'] : [];
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
            {tasks.length > 0 && (
              <span className="section-count">
                {tasksDone} из {tasks.length}
              </span>
            )}
            {!isToday && (
              <button className="day-today-btn" onClick={goToday}>
                Сегодня
              </button>
            )}
          </div>
        </div>

        {tasks.length === 0 && (
          <p className="empty-line">На этот день задач нет. Добавь кнопкой ＋ сверху.</p>
        )}

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
              aria-label={task.done ? `Снять отметку «${task.title}»` : `Отметить «${task.title}»`}
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
      </section>
    </div>
  );
}
