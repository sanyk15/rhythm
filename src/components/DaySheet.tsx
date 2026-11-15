import { useMemo } from 'react';
import Modal from './Modal';
import { useData } from '../context/DataContext';
import { dayTitle } from '../lib/dates';
import { haptic } from '../lib/haptics';

interface Props {
  themeId: string;
  date: string;
  onClose: () => void;
}

// Отметки за конкретный день: тап по дате в календаре.
export default function DaySheet({ themeId, date, onClose }: Props) {
  const { habits, logs, toggleLog } = useData();

  const themeHabits = useMemo(
    () =>
      habits
        .filter((h) => h.themeId === themeId && !h.archived)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [habits, themeId],
  );

  const doneSet = useMemo(
    () => new Set(logs.filter((l) => l.date === date).map((l) => l.habitId)),
    [logs, date],
  );

  return (
    <Modal title={dayTitle(date)} onClose={onClose}>
      <div className="form">
        {themeHabits.length === 0 && (
          <p className="empty-line">В этой теме пока нет привычек.</p>
        )}

        {themeHabits.map((habit) => {
          const done = doneSet.has(habit.id);
          return (
            <div className="row" key={habit.id}>
              <button
                className={`check${done ? ' on' : ''}`}
                style={
                  done
                    ? { background: habit.color, borderColor: habit.color }
                    : { borderColor: `${habit.color}88` }
                }
                onClick={() => {
                  haptic();
                  void toggleLog(habit.id, date).catch(() => {});
                }}
                aria-pressed={done}
                aria-label={done ? `Снять отметку «${habit.title}»` : `Отметить «${habit.title}»`}
              >
                {done ? '✓' : ''}
              </button>
              <button className="row-main" onClick={() => void toggleLog(habit.id, date).catch(() => {})}>
                <span className="habit-dot" style={{ background: habit.color }} />
                <span className={`row-title${done ? ' done' : ''}`}>{habit.title}</span>
              </button>
            </div>
          );
        })}

        <button className="btn-ghost wide" onClick={onClose}>
          Готово
        </button>
      </div>
    </Modal>
  );
}
