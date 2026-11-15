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

export interface Snapshot {
  themes: Theme[];
  habits: Habit[];
  logs: HabitLog[];
  goals: Goal[];
}

export const EMPTY_SNAPSHOT: Snapshot = {
  themes: [],
  habits: [],
  logs: [],
  goals: [],
};

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
