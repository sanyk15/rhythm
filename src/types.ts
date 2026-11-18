// Модели данных. В БД поля snake_case, здесь — camelCase (маппинг в lib/api.ts).
// user_id формируется на стороне Supabase (RLS), на клиенте его нет.

export interface Theme {
  id: string;
  title: string;
  photoUrl: string | null;
  accent: string; // HEX
  sortOrder: number;
}

export interface Habit {
  id: string;
  themeId: string;
  title: string;
  color: string; // HEX — цвет точки в календаре
  sortOrder: number;
  archived: boolean;
  /** Дни недели, когда привычка активна: 1 — пн … 7 — вс. */
  weekdays: number[];
}

/** Отметка «привычка выполнена в дату». Одна пара (habitId, date) — максимум одна. */
export interface HabitLog {
  id: string;
  habitId: string;
  date: string; // 'YYYY-MM-DD'
}

export interface Goal {
  id: string;
  themeId: string;
  month: string; // 'YYYY-MM'
  title: string;
  done: boolean;
  sortOrder: number;
}

/** Разовое дело на конкретную дату — не привычка, не повторяется. */
export interface DayTask {
  id: string;
  date: string; // 'YYYY-MM-DD'
  title: string;
  done: boolean;
  sortOrder: number;
}

export interface Snapshot {
  themes: Theme[];
  habits: Habit[];
  logs: HabitLog[];
  goals: Goal[];
  dayTasks: DayTask[];
}

export const EMPTY_SNAPSHOT: Snapshot = {
  themes: [],
  habits: [],
  logs: [],
  goals: [],
  dayTasks: [],
};

/** Кеш мог быть записан прошлой версией приложения — дополняем недостающее. */
export function normalizeSnapshot(value: Partial<Snapshot> | null | undefined): Snapshot {
  return {
    themes: value?.themes ?? [],
    // У привычек из старого кеша нет weekdays — считаем, что каждый день.
    habits: (value?.habits ?? []).map((h) => ({
      ...h,
      weekdays: normalizeWeekdays(h.weekdays),
    })),
    logs: value?.logs ?? [],
    goals: value?.goals ?? [],
    dayTasks: value?.dayTasks ?? [],
  };
}

/** Все дни недели: 1 — понедельник … 7 — воскресенье. */
export const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

/** Приводит дни недели к валидному набору; пустое значение = каждый день. */
export function normalizeWeekdays(value: number[] | null | undefined): number[] {
  if (!value || value.length === 0) return [...ALL_WEEKDAYS];
  const days = [...new Set(value.filter((d) => d >= 1 && d <= 7))].sort((a, b) => a - b);
  return days.length > 0 ? days : [...ALL_WEEKDAYS];
}

// Палитра для тем и привычек — цвета подобраны так, чтобы точки в календаре
// различались и в светлой, и в тёмной теме.
export const PALETTE = [
  '#7a5af8', // фиолетовый
  '#ef5da8', // розовый
  '#f0873a', // оранжевый
  '#2bb673', // зелёный
  '#2f9ee0', // голубой
  '#e0b322', // жёлтый
  '#e05252', // красный
  '#19b3a6', // бирюзовый
];
