import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  fetchSnapshot,
  insertDayTask,
  insertGoal,
  insertHabit,
  insertLog,
  insertTheme,
  patchDayTask,
  patchGoal,
  patchHabit,
  patchTheme,
  removeDayTask,
  removeGoal,
  removeHabit,
  removeLog,
  removeTheme,
} from '../lib/api';
import { cacheGet, cachePeek, cacheSet, onCacheChange } from '../lib/cache';
import { normalizeSnapshot, normalizeWeekdays } from '../types';
import type { DayTask, Goal, Habit, HabitLog, Snapshot, Theme } from '../types';

const CACHE_KEY = 'snapshot';

interface DataContextValue {
  themes: Theme[];
  habits: Habit[];
  logs: HabitLog[];
  goals: Goal[];
  dayTasks: DayTask[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createTheme: (input: {
    title: string;
    photoUrl: string | null;
    accent: string;
  }) => Promise<Theme>;
  updateTheme: (
    id: string,
    patch: Partial<Pick<Theme, 'title' | 'photoUrl' | 'accent'>>,
  ) => Promise<void>;
  moveTheme: (id: string, direction: -1 | 1) => Promise<void>;
  deleteTheme: (id: string) => Promise<void>;
  createHabit: (
    themeId: string,
    input: { title: string; color: string; weekdays: number[] },
  ) => Promise<void>;
  updateHabit: (
    id: string,
    patch: Partial<Pick<Habit, 'title' | 'color' | 'weekdays'>>,
  ) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  toggleLog: (habitId: string, date: string) => Promise<void>;
  createGoal: (themeId: string, month: string, title: string) => Promise<void>;
  updateGoal: (id: string, patch: Partial<Pick<Goal, 'title' | 'done'>>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  createDayTask: (date: string, title: string) => Promise<void>;
  updateDayTask: (id: string, patch: Partial<Pick<DayTask, 'title' | 'done'>>) => Promise<void>;
  deleteDayTask: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

function newId(): string {
  return crypto.randomUUID();
}

// Понятные сообщения для самых частых ошибок настройки.
function humanizeError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  const lower = message.toLowerCase();
  if (lower.includes('does not exist') && lower.includes('relation')) {
    return 'Таблиц нет в базе — выполни supabase/schema.sql в Supabase.';
  }
  if (lower.includes('failed to fetch') || lower.includes('networkerror')) {
    return 'Нет связи с сервером. Проверь интернет и настройки Supabase.';
  }
  return message;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<Snapshot>(() =>
    normalizeSnapshot(cacheGet<Partial<Snapshot>>(CACHE_KEY)),
  );
  const [loading, setLoading] = useState(() => cacheGet<Partial<Snapshot>>(CACHE_KEY) === null);
  const [error, setError] = useState<string | null>(null);

  const snapRef = useRef(snap);
  const aliveRef = useRef(true);

  const commit = useCallback((next: Snapshot) => {
    // Держим инвариант: в состоянии и кеше всегда нормализованный снимок
    // (например, у привычек из старого кеша появляется weekdays).
    const normalized = normalizeSnapshot(next);
    snapRef.current = normalized;
    setSnap(normalized);
    cacheSet(CACHE_KEY, normalized);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const fresh = await fetchSnapshot();
      if (!aliveRef.current) return;
      commit(fresh);
      setError(null);
    } catch (e) {
      if (!aliveRef.current) return;
      setError(humanizeError(e));
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [commit]);

  useEffect(() => {
    aliveRef.current = true;
    void refresh();
    return () => {
      aliveRef.current = false;
    };
  }, [refresh]);

  // Другая вкладка обновила данные — подхватываем.
  useEffect(() => {
    return onCacheChange(CACHE_KEY, () => {
      const raw = cachePeek<Partial<Snapshot>>(CACHE_KEY);
      if (!raw || raw === snapRef.current) return;
      const next = normalizeSnapshot(raw);
      snapRef.current = next;
      setSnap(next);
    });
  }, []);

  // Оптимистичное изменение: экран обновляется сразу, при ошибке — откат.
  const optimistic = useCallback(
    async (build: (current: Snapshot) => Snapshot, persist: () => Promise<void>) => {
      const prev = snapRef.current;
      commit(build(prev));
      try {
        await persist();
      } catch (e) {
        commit(prev);
        throw e;
      }
    },
    [commit],
  );

  // ── Темы ────────────────────────────────────────────────────

  async function createTheme(input: { title: string; photoUrl: string | null; accent: string }) {
    const current = snapRef.current;
    const max = current.themes.reduce((m, t) => Math.max(m, t.sortOrder), -1);
    const theme: Theme = {
      id: newId(),
      title: input.title,
      photoUrl: input.photoUrl,
      accent: input.accent,
      sortOrder: max + 1,
    };
    await optimistic(
      (s) => ({ ...s, themes: [...s.themes, theme] }),
      () => insertTheme(theme),
    );
    return theme;
  }

  async function updateTheme(
    id: string,
    patch: Partial<Pick<Theme, 'title' | 'photoUrl' | 'accent'>>,
  ) {
    await optimistic(
      (s) => ({
        ...s,
        themes: s.themes.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }),
      () => {
        const db: Parameters<typeof patchTheme>[1] = {};
        if (patch.title !== undefined) db.title = patch.title;
        if (patch.photoUrl !== undefined) db.photo_url = patch.photoUrl;
        if (patch.accent !== undefined) db.accent = patch.accent;
        return patchTheme(id, db);
      },
    );
  }

  async function moveTheme(id: string, direction: -1 | 1) {
    const list = [...snapRef.current.themes].sort((a, b) => a.sortOrder - b.sortOrder);
    const from = list.findIndex((t) => t.id === id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= list.length) return;

    const swapped = [...list];
    [swapped[from], swapped[to]] = [swapped[to], swapped[from]];
    // Нормализуем порядок в 0..n-1 — так не остаётся «дыр» и дублей sort_order.
    const numbered = swapped.map((t, i) => ({ ...t, sortOrder: i }));

    const sortById = new Map(numbered.map((t) => [t.id, t.sortOrder]));
    const nextThemes = snapRef.current.themes.map((t) => ({
      ...t,
      sortOrder: sortById.get(t.id) ?? t.sortOrder,
    }));
    const changed = numbered.filter((t) => {
      const before = list.find((x) => x.id === t.id);
      return !before || before.sortOrder !== t.sortOrder;
    });

    await optimistic(
      (s) => ({ ...s, themes: nextThemes }),
      () =>
        Promise.all(
          changed.map((t) => patchTheme(t.id, { sort_order: t.sortOrder })),
        ).then(() => undefined),
    );
  }

  async function deleteTheme(id: string) {
    await optimistic(
      (s) => {
        const habitIds = new Set(s.habits.filter((h) => h.themeId === id).map((h) => h.id));
        return {
          themes: s.themes.filter((t) => t.id !== id),
          habits: s.habits.filter((h) => h.themeId !== id),
          logs: s.logs.filter((l) => !habitIds.has(l.habitId)),
          goals: s.goals.filter((g) => g.themeId !== id),
          dayTasks: s.dayTasks,
        };
      },
      () => removeTheme(id),
    );
  }

  // ── Привычки ────────────────────────────────────────────────

  async function createHabit(
    themeId: string,
    input: { title: string; color: string; weekdays: number[] },
  ) {
    const current = snapRef.current;
    const max = current.habits
      .filter((h) => h.themeId === themeId)
      .reduce((m, h) => Math.max(m, h.sortOrder), -1);
    const habit: Habit = {
      id: newId(),
      themeId,
      title: input.title,
      color: input.color,
      sortOrder: max + 1,
      archived: false,
      weekdays: normalizeWeekdays(input.weekdays),
    };
    await optimistic(
      (s) => ({ ...s, habits: [...s.habits, habit] }),
      () => insertHabit(habit),
    );
  }

  async function updateHabit(
    id: string,
    patch: Partial<Pick<Habit, 'title' | 'color' | 'weekdays'>>,
  ) {
    await optimistic(
      (s) => ({
        ...s,
        habits: s.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)),
      }),
      () => {
        const db: Parameters<typeof patchHabit>[1] = {};
        if (patch.title !== undefined) db.title = patch.title;
        if (patch.color !== undefined) db.color = patch.color;
        if (patch.weekdays !== undefined) db.weekdays = normalizeWeekdays(patch.weekdays);
        return patchHabit(id, db);
      },
    );
  }

  async function deleteHabit(id: string) {
    await optimistic(
      (s) => ({
        ...s,
        habits: s.habits.filter((h) => h.id !== id),
        logs: s.logs.filter((l) => l.habitId !== id),
      }),
      () => removeHabit(id),
    );
  }

  // ── Отметки ─────────────────────────────────────────────────

  async function toggleLog(habitId: string, date: string) {
    const existing = snapRef.current.logs.find(
      (l) => l.habitId === habitId && l.date === date,
    );
    if (existing) {
      await optimistic(
        (s) => ({ ...s, logs: s.logs.filter((l) => l.id !== existing.id) }),
        () => removeLog(existing.id),
      );
      return;
    }
    const log: HabitLog = { id: newId(), habitId, date };
    await optimistic(
      (s) => ({ ...s, logs: [...s.logs, log] }),
      () => insertLog(log),
    );
  }

  // ── Цели ────────────────────────────────────────────────────

  async function createGoal(themeId: string, month: string, title: string) {
    const current = snapRef.current;
    const max = current.goals
      .filter((g) => g.themeId === themeId && g.month === month)
      .reduce((m, g) => Math.max(m, g.sortOrder), -1);
    const goal: Goal = {
      id: newId(),
      themeId,
      month,
      title,
      done: false,
      sortOrder: max + 1,
    };
    await optimistic(
      (s) => ({ ...s, goals: [...s.goals, goal] }),
      () => insertGoal(goal),
    );
  }

  async function updateGoal(id: string, patch: Partial<Pick<Goal, 'title' | 'done'>>) {
    await optimistic(
      (s) => ({
        ...s,
        goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
      }),
      () => {
        const db: Parameters<typeof patchGoal>[1] = {};
        if (patch.title !== undefined) db.title = patch.title;
        if (patch.done !== undefined) db.done = patch.done;
        return patchGoal(id, db);
      },
    );
  }

  async function deleteGoal(id: string) {
    await optimistic(
      (s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) }),
      () => removeGoal(id),
    );
  }

  // ── Задачи на день ──────────────────────────────────────────

  async function createDayTask(date: string, title: string) {
    const current = snapRef.current;
    const max = current.dayTasks
      .filter((t) => t.date === date)
      .reduce((m, t) => Math.max(m, t.sortOrder), -1);
    const task: DayTask = {
      id: newId(),
      date,
      title,
      done: false,
      sortOrder: max + 1,
    };
    await optimistic(
      (s) => ({ ...s, dayTasks: [...s.dayTasks, task] }),
      () => insertDayTask(task),
    );
  }

  async function updateDayTask(id: string, patch: Partial<Pick<DayTask, 'title' | 'done'>>) {
    await optimistic(
      (s) => ({
        ...s,
        dayTasks: s.dayTasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }),
      () => {
        const db: Parameters<typeof patchDayTask>[1] = {};
        if (patch.title !== undefined) db.title = patch.title;
        if (patch.done !== undefined) db.done = patch.done;
        return patchDayTask(id, db);
      },
    );
  }

  async function deleteDayTask(id: string) {
    await optimistic(
      (s) => ({ ...s, dayTasks: s.dayTasks.filter((t) => t.id !== id) }),
      () => removeDayTask(id),
    );
  }

  const value: DataContextValue = {
    themes: snap.themes,
    habits: snap.habits,
    logs: snap.logs,
    goals: snap.goals,
    dayTasks: snap.dayTasks,
    loading,
    error,
    refresh,
    createTheme,
    updateTheme,
    moveTheme,
    deleteTheme,
    createHabit,
    updateHabit,
    deleteHabit,
    toggleLog,
    createGoal,
    updateGoal,
    deleteGoal,
    createDayTask,
    updateDayTask,
    deleteDayTask,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
