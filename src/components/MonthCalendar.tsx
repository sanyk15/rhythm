import { useMemo } from 'react';
import { currentMonth, monthGrid, monthLabel, shiftMonth, WEEKDAYS_SHORT } from '../lib/dates';

interface Props {
  month: string;
  today: string;
  /** Выбранный день — подсвечивается, только если передан. */
  selected?: string;
  onMonthChange: (month: string) => void;
  /** Цвета привычек, выполненных в этот день (пустой массив — ничего). */
  dotsForDate: (date: string) => string[];
  onDayClick: (date: string) => void;
}

const MAX_DOTS = 4;

export default function MonthCalendar({
  month,
  today,
  selected,
  onMonthChange,
  dotsForDate,
  onDayClick,
}: Props) {
  const cells = useMemo(() => monthGrid(month), [month]);
  const isCurrent = month === currentMonth();

  return (
    <section className="card calendar-card">
      <div className="month-nav">
        <button
          className="month-arrow"
          onClick={() => onMonthChange(shiftMonth(month, -1))}
          aria-label="Предыдущий месяц"
        >
          ‹
        </button>
        <button
          className={`month-title${isCurrent ? '' : ' offset'}`}
          onClick={() => onMonthChange(currentMonth())}
          title="Вернуться к текущему месяцу"
        >
          {monthLabel(month)}
        </button>
        <button
          className="month-arrow"
          onClick={() => onMonthChange(shiftMonth(month, 1))}
          aria-label="Следующий месяц"
        >
          ›
        </button>
      </div>

      <div className="weekdays" aria-hidden="true">
        {WEEKDAYS_SHORT.map((w) => (
          <span key={w} className="weekday">
            {w}
          </span>
        ))}
      </div>

      <div className="days">
        {cells.map((date, i) => {
          if (!date) return <span key={`empty-${i}`} className="day empty" />;
          const dots = dotsForDate(date);
          const isToday = date === today;
          const isSelected = date === selected;
          const dayNumber = Number(date.slice(8, 10));
          return (
            <button
              key={date}
              className={`day${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}${dots.length ? ' marked' : ''}`}
              onClick={() => onDayClick(date)}
              aria-label={`${dayNumber}, отметок: ${dots.length}`}
            >
              <span className="day-num">{dayNumber}</span>
              <span className="day-dots">
                {dots.slice(0, MAX_DOTS).map((color, j) => (
                  <span key={j} className="day-dot" style={{ background: color }} />
                ))}
                {dots.length > MAX_DOTS && (
                  <span className="day-dot more">+{dots.length - MAX_DOTS}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
