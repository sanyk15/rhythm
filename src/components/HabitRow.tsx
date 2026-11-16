import type { Habit } from '../types';

interface Props {
  habit: Habit;
  done: boolean;
  onToggle: () => void;
  /** Если не передан — кнопки правки нет (например, в дневном режиме). */
  onEdit?: () => void;
}

export default function HabitRow({ habit, done, onToggle, onEdit }: Props) {
  return (
    <div className="row">
      <button
        className={`check${done ? ' on' : ''}`}
        style={done ? { background: habit.color, borderColor: habit.color } : { borderColor: `${habit.color}88` }}
        onClick={onToggle}
        aria-pressed={done}
        aria-label={done ? `Снять отметку «${habit.title}»` : `Отметить «${habit.title}»`}
      >
        {done ? '✓' : ''}
      </button>
      <button className="row-main" onClick={onToggle}>
        <span className="habit-dot" style={{ background: habit.color }} />
        <span className={`row-title${done ? ' done' : ''}`}>{habit.title}</span>
      </button>
      {onEdit && (
        <button className="row-edit" onClick={onEdit} aria-label={`Изменить «${habit.title}»`}>
          ✎
        </button>
      )}
    </div>
  );
}
