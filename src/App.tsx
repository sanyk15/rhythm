import { HashRouter, Route, Routes } from 'react-router-dom';
import Login from './components/Login';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';
import Home from './pages/Home';
import Settings from './pages/Settings';

function Root() {
  const { session, loading } = useAuth();

  if (loading) {
    return <div className="splash">Загрузка…</div>;
  }

  if (!session) {
    return <Login />;
  }

  return (
    <DataProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </DataProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      {/* HashRouter, а не BrowserRouter: на Cloudflare Pages не нужен редирект
          /* → /index.html (иначе получается цикл, ошибка 100324). */}
      <HashRouter>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </HashRouter>
    </ThemeProvider>
  );
}
