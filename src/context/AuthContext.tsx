import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { setCacheScope } from '../lib/cache';

export interface SignUpResult {
  error: string | null;
  /** true — аккаунт создан, но Supabase требует подтвердить email. */
  needsConfirmation: boolean;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, inviteCode: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      // Сначала переключаем область кеша, потом пускаем в приложение:
      // иначе экраны успеют прочитать данные предыдущего аккаунта.
      setCacheScope(data.session?.user.id ?? null);
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setCacheScope(nextSession?.user.id ?? null);
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? translateAuthError(error.message) : null };
  };

  // Регистрация только по коду-приглашению. Код проверяется дважды:
  // здесь — ради понятной ошибки, и триггером в БД — как реальная защита.
  const signUp = async (email: string, password: string, inviteCode: string) => {
    const code = inviteCode.trim();
    if (!code) return { error: 'Введи код приглашения.', needsConfirmation: false };

    const { data: valid, error: checkError } = await supabase.rpc('check_invite_code', {
      code,
    });
    if (checkError) {
      return {
        error: 'Регистрация не настроена на сервере. Нужно выполнить SQL-миграцию.',
        needsConfirmation: false,
      };
    }
    if (!valid) return { error: 'Неверный код приглашения.', needsConfirmation: false };

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { invite_code: code } },
    });
    if (error) return { error: translateAuthError(error.message), needsConfirmation: false };

    // При включённом подтверждении email Supabase не сообщает, что адрес занят:
    // возвращает пользователя с пустым списком identities.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      return {
        error: 'Этот email уже зарегистрирован. Попробуй войти.',
        needsConfirmation: false,
      };
    }

    return { error: null, needsConfirmation: !data.session };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Supabase возвращает англоязычные сообщения — переводим самые частые.
function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) return 'Неверный email или пароль.';
  if (lower.includes('email not confirmed')) return 'Email не подтверждён.';
  if (lower.includes('user already registered')) return 'Этот email уже зарегистрирован.';
  if (lower.includes('password should be at least')) {
    return 'Слишком короткий пароль — минимум 6 символов.';
  }
  if (lower.includes('invalid email') || lower.includes('unable to validate email')) {
    return 'Некорректный email.';
  }
  if (lower.includes('signups not allowed') || lower.includes('signup is disabled')) {
    return 'Регистрация отключена в настройках проекта.';
  }
  if (lower.includes('database error saving new user')) {
    return 'Не удалось создать аккаунт: неверный код приглашения или регистрация закрыта.';
  }
  if (lower.includes('rate limit')) return 'Слишком много попыток. Подожди немного.';
  return message;
}
