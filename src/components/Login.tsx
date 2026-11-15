import { useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';

type Mode = 'signin' | 'signup';

const MIN_PASSWORD = 6;

const CARD: CSSProperties = {
  backgroundImage:
    'radial-gradient(120% 90% at 20% 0%, rgba(122,90,248,0.28), transparent 60%),' +
    'radial-gradient(100% 80% at 100% 100%, rgba(239,93,168,0.24), transparent 55%)',
};

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Email, который ждёт подтверждения (аккаунт создан, сессии ещё нет).
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setPassword('');
    setPassword2('');
    setPendingEmail(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();

    if (mode === 'signup') {
      if (password.length < MIN_PASSWORD) {
        setError(`Пароль должен быть не короче ${MIN_PASSWORD} символов.`);
        return;
      }
      if (password !== password2) {
        setError('Пароли не совпадают.');
        return;
      }
      if (!inviteCode.trim()) {
        setError('Введи код приглашения.');
        return;
      }

      setBusy(true);
      const result = await signUp(cleanEmail, password, inviteCode);
      setBusy(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.needsConfirmation) setPendingEmail(cleanEmail);
      // Если подтверждение email отключено, Supabase сразу вернул сессию.
      return;
    }

    setBusy(true);
    const { error: signInError } = await signIn(cleanEmail, password);
    setBusy(false);
    if (signInError) setError(signInError);
  }

  if (pendingEmail) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-logo">📧</div>
          <h1>Подтверди email</h1>
          <p className="login-sub">
            Письмо отправлено на <strong>{pendingEmail}</strong>. Перейди по ссылке из
            письма — и приложение откроется уже под новым аккаунтом.
          </p>
          <p className="login-hint">Письмо не пришло? Загляни в «Спам».</p>
          <button className="btn-primary" type="button" onClick={() => switchMode('signin')}>
            Вернуться ко входу
          </button>
        </div>
      </div>
    );
  }

  const isSignup = mode === 'signup';

  return (
    <div className="login-screen">
      <form className="login-card" style={CARD} onSubmit={handleSubmit}>
        <div className="login-logo">🌿</div>
        <h1>Ритм</h1>
        <p className="login-sub">Привычки и цели по темам</p>

        <div className="login-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!isSignup}
            className={`tab-pill${!isSignup ? ' active' : ''}`}
            onClick={() => switchMode('signin')}
          >
            Вход
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isSignup}
            className={`tab-pill${isSignup ? ' active' : ''}`}
            onClick={() => switchMode('signup')}
          >
            Регистрация
          </button>
        </div>

        {!isSupabaseConfigured && (
          <div className="banner">
            Supabase ещё не подключён. Заполни <code>.env.local</code> (см. README).
          </div>
        )}

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete={isSignup ? 'email' : 'username'}
            autoCapitalize="none"
            spellCheck={false}
          />
        </label>

        <label>
          Пароль
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={isSignup ? MIN_PASSWORD : undefined}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
          />
        </label>

        {isSignup && (
          <>
            <label>
              Пароль ещё раз
              <input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                required
                minLength={MIN_PASSWORD}
                autoComplete="new-password"
              />
            </label>

            <label>
              Код приглашения
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="спроси у того, кто позвал"
              />
            </label>
          </>
        )}

        {error && <div className="error">{error}</div>}

        <button className="btn-primary" type="submit" disabled={busy}>
          {busy
            ? isSignup
              ? 'Создаём аккаунт…'
              : 'Входим…'
            : isSignup
              ? 'Создать аккаунт'
              : 'Войти'}
        </button>

        {isSignup && (
          <p className="login-hint">
            У каждого аккаунта свои данные. Если вы пользуетесь приложением вдвоём —
            войдите оба в один и тот же аккаунт.
          </p>
        )}
      </form>
    </div>
  );
}
