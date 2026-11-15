import { supabase } from './supabase';
import { monthFromDbDate, monthToDbDate } from './dates';
import type { Goal, Habit, HabitLog, Snapshot, Theme } from '../types';

// ── Строки БД (snake_case) ──────────────────────────────────────

interface ThemeRow {
  id: string;
  title: string;
  photo_url: string | null;
  accent: string;
  sort_order: number;
}

interface HabitRow {
  id: string;
  theme_id: string;
  title: string;
  color: string;
  sort_order: number;
  archived: boolean;
}

interface HabitLogRow {
  id: string;
  habit_id: string;
  date: string;
}

interface GoalRow {
  id: string;
  theme_id: string;
  month: string;
  title: string;
  done: boolean;
  sort_order: number;
}

const mapTheme = (r: ThemeRow): Theme => ({
  id: r.id,
  title: r.title,
  photoUrl: r.photo_url,
  accent: r.accent,
  sortOrder: r.sort_order,
});

const mapHabit = (r: HabitRow): Habit => ({
  id: r.id,
  themeId: r.theme_id,
  title: r.title,
  color: r.color,
  sortOrder: r.sort_order,
  archived: r.archived,
});

const mapLog = (r: HabitLogRow): HabitLog => ({
  id: r.id,
  habitId: r.habit_id,
  date: r.date,
});

const mapGoal = (r: GoalRow): Goal => ({
  id: r.id,
  themeId: r.theme_id,
  month: monthFromDbDate(r.month),
  title: r.title,
  done: r.done,
  sortOrder: r.sort_order,
});

// PostgREST отдаёт максимум 1000 строк за запрос — идём постранично.
async function selectAll<T>(
  table: string,
  orders: Array<{ column: string; ascending: boolean }> = [],
): Promise<T[]> {
  const pageSize = 1000;
  const result: T[] = [];
  let from = 0;
  for (;;) {
    let query = supabase.from(table).select('*');
    for (const o of orders) query = query.order(o.column, { ascending: o.ascending });
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    result.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return result;
}

// ── Загрузка всего состояния ───────────────────────────────────
// Данных мало (темы, привычки, отметки, цели), поэтому грузим одним заходом
// и держим в одном кеше — экраны не ходят за кусочками.

export async function fetchSnapshot(): Promise<Snapshot> {
  const [themes, habits, logs, goals] = await Promise.all([
    selectAll<ThemeRow>('themes', [
      { column: 'sort_order', ascending: true },
      { column: 'id', ascending: true },
    ]),
    selectAll<HabitRow>('habits', [
      { column: 'sort_order', ascending: true },
      { column: 'id', ascending: true },
    ]),
    selectAll<HabitLogRow>('habit_logs', [{ column: 'id', ascending: true }]),
    selectAll<GoalRow>('goals', [
      { column: 'month', ascending: true },
      { column: 'sort_order', ascending: true },
    ]),
  ]);

  return {
    themes: themes.map(mapTheme),
    habits: habits.map(mapHabit),
    logs: logs.map(mapLog),
    goals: goals.map(mapGoal),
  };
}

// ── Темы ───────────────────────────────────────────────────────

export async function insertTheme(theme: Theme): Promise<void> {
  const { error } = await supabase.from('themes').insert({
    id: theme.id,
    title: theme.title,
    photo_url: theme.photoUrl,
    accent: theme.accent,
    sort_order: theme.sortOrder,
  });
  if (error) throw error;
}

export async function patchTheme(
  id: string,
  patch: Partial<{ title: string; photo_url: string | null; accent: string; sort_order: number }>,
): Promise<void> {
  const { error } = await supabase.from('themes').update(patch).eq('id', id);
  if (error) throw error;
}

export async function removeTheme(id: string): Promise<void> {
  const { error } = await supabase.from('themes').delete().eq('id', id);
  if (error) throw error;
}

// ── Привычки ───────────────────────────────────────────────────

export async function insertHabit(habit: Habit): Promise<void> {
  const { error } = await supabase.from('habits').insert({
    id: habit.id,
    theme_id: habit.themeId,
    title: habit.title,
    color: habit.color,
    sort_order: habit.sortOrder,
    archived: habit.archived,
  });
  if (error) throw error;
}

export async function patchHabit(
  id: string,
  patch: Partial<{ title: string; color: string; sort_order: number; archived: boolean }>,
): Promise<void> {
  const { error } = await supabase.from('habits').update(patch).eq('id', id);
  if (error) throw error;
}

export async function removeHabit(id: string): Promise<void> {
  const { error } = await supabase.from('habits').delete().eq('id', id);
  if (error) throw error;
}

// ── Отметки ────────────────────────────────────────────────────

export async function insertLog(log: HabitLog): Promise<void> {
  const { error } = await supabase.from('habit_logs').insert({
    id: log.id,
    habit_id: log.habitId,
    date: log.date,
  });
  if (error) throw error;
}

export async function removeLog(id: string): Promise<void> {
  const { error } = await supabase.from('habit_logs').delete().eq('id', id);
  if (error) throw error;
}

// ── Цели ───────────────────────────────────────────────────────

export async function insertGoal(goal: Goal): Promise<void> {
  const { error } = await supabase.from('goals').insert({
    id: goal.id,
    theme_id: goal.themeId,
    month: monthToDbDate(goal.month),
    title: goal.title,
    done: goal.done,
    sort_order: goal.sortOrder,
  });
  if (error) throw error;
}

export async function patchGoal(
  id: string,
  patch: Partial<{ title: string; done: boolean; sort_order: number }>,
): Promise<void> {
  const { error } = await supabase.from('goals').update(patch).eq('id', id);
  if (error) throw error;
}

export async function removeGoal(id: string): Promise<void> {
  const { error } = await supabase.from('goals').delete().eq('id', id);
  if (error) throw error;
}
