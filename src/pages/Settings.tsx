import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { isSupabaseConfigured } from '../lib/supabase';

const APPEARANCE: Array<{ value: 'system' | 'light' | 'dark'; label: string; icon: string }> = [
  { value: 'system', label: 'Как в системе', icon: '◐' },
  { value: 'light', label: 'Светлая', icon: '☀' },
  { value: 'dark', label: 'Тёмная', icon: '☾' },
];

export default function Settings() {
  const { preference, setPreference } = useTheme();
  const { user, signOut } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <Link to="/" className="back-btn" aria-label="Назад">
            ‹
          </Link>
          <span className="brand-title">Настройки</span>
        </div>
      </header>

      <main className="detail-content">
        <section className="card">
          <div className="section-head">
            <h2>Оформление</h2>
          </div>
          <div className="segmented">
            {APPEARANCE.map((item) => (
              <button
                key={item.value}
                className={`segmented-item${preference === item.value ? ' active' : ''}`}
                onClick={() => setPreference(item.value)}
              >
                <span className="segmented-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="section-head">
            <h2>Аккаунт</h2>
          </div>
          <p className="settings-email">{user?.email ?? '—'}</p>
          <p className="form-hint">
            Данные хранятся в Supabase. Войди этим же аккаунтом на другом устройстве —
            темы, привычки и цели будут те же.
          </p>
          <button className="btn-ghost wide" onClick={() => void signOut()}>
            Выйти
          </button>
        </section>

        <section className="card">
          <div className="section-head">
            <h2>О приложении</h2>
          </div>
          <p className="form-hint">
            Ритм — трекер привычек и целей по темам. Добавляется на домашний экран iPhone:
            «Поделиться» → «На экран „Домой“».
          </p>
          {!isSupabaseConfigured && (
            <div className="banner">Supabase не настроен — задай переменные окружения.</div>
          )}
        </section>
      </main>
    </div>
  );
}
