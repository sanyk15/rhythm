import { weekdaysLabel } from '../lib/dates';
import type { Habit } from '../types';

interface Props {
  habit: Habit;
  done: boolean;
  onToggle: () => void;
  /** Если не передан — кнопки правки нет (например, в дневном режиме). */
  onEdit?: () => void;
  /** Привычка не запланирована на этот день — показываем приглушённо. */
  off?: boolean;
}

export default function HabitRow({ habit, done, onToggle, onEdit, off = false }: Props) {
  const schedule = weekdaysLabel(habit.weekdays);

  return (
    <div className="row">
      <button
        className={`check${done ? ' on' : ''}${off ? ' off' : ''}`}
        disabled={off}
        style={done ? { background: habit.color, borderColor: habit.color } : { borderColor: `${habit.color}88` }}
        onClick={onToggle}
        aria-pressed={done}
        aria-label={done ? `Снять отметку «${habit.title}»` : `Отметить «${habit.title}»`}
      >
        {done ? '✓' : ''}
      </button>
      <button className="row-main" onClick={onToggle} disabled={off}>
        <span className="habit-dot" style={{ background: habit.color }} />
        <span className="row-text">
          <span className={`row-title${done ? ' done' : ''}${off ? ' off' : ''}`}>
            {habit.title}
          </span>
          {schedule && <span className="habit-schedule">{schedule}</span>}
        </span>
      </button>
      {onEdit && (
        <button className="row-edit" onClick={onEdit} aria-label={`Изменить «${habit.title}»`}>
          ✎
        </button>
      )}
    </div>
  );
}
