// Локальный кеш в localStorage: приложение открывается мгновенно и показывает
// последние данные, пока в фоне грузятся свежие. Кеш привязан к аккаунту —
// на одном устройстве данные разных пользователей не пересекаются.

const PREFIX = 'rhythm_cache_';
const SCOPE_KEY = 'rhythm_cache_scope';

// In-memory хранилище: держит последний записанный объект по ссылке, чтобы
// подписчики не парсили JSON заново и не перерендеривались зря.
const memory = new Map<string, unknown>();
const listeners = new Map<string, Set<() => void>>();

let scope: string | null = readStoredScope();

function readStoredScope(): string | null {
  try {
    return localStorage.getItem(SCOPE_KEY);
  } catch {
    return null;
  }
}

function storageKey(key: string): string {
  return scope ? `${PREFIX}${scope}__${key}` : PREFIX + key;
}

export function getCacheScope(): string | null {
  return scope;
}

// Вызывается при входе/выходе. Кеш предыдущего аккаунта стирается с устройства.
export function setCacheScope(next: string | null): void {
  if (next === scope) return;
  clearAll();
  scope = next;
  try {
    if (next) localStorage.setItem(SCOPE_KEY, next);
    else localStorage.removeItem(SCOPE_KEY);
  } catch {
    // ignore
  }
}

function clearAll(): void {
  memory.clear();
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function notify(key: string): void {
  const set = listeners.get(key);
  if (!set) return;
  for (const fn of [...set]) fn();
}

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(storageKey(key));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function cacheSet(key: string, value: unknown): void {
  const scoped = storageKey(key);
  memory.set(scoped, value);
  try {
    localStorage.setItem(scoped, JSON.stringify(value));
  } catch {
    // превышение квоты localStorage — кеш некритичен, игнорируем
  }
  notify(scoped);
}

export function cachePeek<T>(key: string): T | null {
  return (memory.get(storageKey(key)) as T | null) ?? null;
}

export function onCacheChange(key: string, fn: () => void): () => void {
  const scoped = storageKey(key);
  let set = listeners.get(scoped);
  if (!set) {
    set = new Set();
    listeners.set(scoped, set);
  }
  set.add(fn);
  return () => {
    set.delete(fn);
  };
}
