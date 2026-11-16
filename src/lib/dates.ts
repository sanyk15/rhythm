// Даты в локальном времени. Два строковых формата:
//   'YYYY-MM-DD' — конкретный день (habit_logs.date)
//   'YYYY-MM'    — месяц (goals.month, состояние календаря)

const MONTHS = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
];

export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function currentMonth(): string {
  return todayKey().slice(0, 7);
}

export function monthOf(dateKey: string): string {
  return dateKey.slice(0, 7);
}

/** 'YYYY-MM-DD' → 'YYYY-MM-01' (формат колонки goals.month). */
export function monthToDbDate(month: string): string {
  return `${month}-01`;
}

/** 'YYYY-MM-01' из БД → 'YYYY-MM'. */
export function monthFromDbDate(value: string): string {
  return value.slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function addDays(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d + delta);
  return toDateKey(date);
}

/** '2026-11' → 'Ноябрь 2026' */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const name = MONTHS[m - 1] ?? '';
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

/** '2026-11' → 'ноябрь' */
export function monthName(month: string): string {
  const [, m] = month.split('-').map(Number);
  return MONTHS[m - 1] ?? '';
}

/** '2026-11-12' → '12 ноября' */
export function dayTitle(dateKey: string): string {
  const [, m, d] = dateKey.split('-').map(Number);
  return `${d} ${MONTHS[m - 1] ?? ''}`;
}

/** '2026-11-15' → 'суббота, 15 ноября' */
export function dayWithWeekday(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(y, m - 1, d));
}

/** 'суббота, 15 ноября' — подпись в шапке. */
export function todayHeader(): string {
  return dayWithWeekday(todayKey());
}

/**
 * Сетка месяца с понедельника: массив 'YYYY-MM-DD' и null для пустых клеток
 * (до первого числа и после последнего, чтобы неделя была полной).
 */
export function monthGrid(month: string): Array<string | null> {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const lead = (first.getDay() + 6) % 7; // понедельник = 0
  const daysInMonth = new Date(y, m, 0).getDate();

  const cells: Array<string | null> = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(`${month}-${pad(d)}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
