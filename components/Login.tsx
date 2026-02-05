import React, { useState } from 'react';
import { Lock, AlertCircle } from 'lucide-react';

interface Props {
  onLogin: (apiSecret: string) => void;
}

// Хеш пароля (SHA-256): "label2025"
// Пароль НЕ хранится в коде, только его хеш
const PASSWORD_HASH = '95add883fe95ef2fc40a9979f0a3347fe20c0264ff962e80dd2b85f25c1e89fe';

// Простая функция хеширования
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const Login: React.FC<Props> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsChecking(true);

    try {
      const hash = await hashPassword(password);

      if (hash === PASSWORD_HASH) {
        // Правильный пароль - даем API ключ
        const API_SECRET = '349ee1731ace959c75691bbb4bcd023be21e288d234cbe0facf09e0b1b83c8ab';
        onLogin(API_SECRET);
      } else {
        setError('Неверный пароль');
      }
    } catch (err) {
      setError('Ошибка проверки');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8 glass-card px-4 py-2 rounded-2xl w-fit mx-auto">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-white">
            <Lock size={18} />
          </div>
          <span className="text-sm font-bold tracking-tight dark:text-white">
            Этикетка <span className="text-brand-500">AI</span>
          </span>
        </div>

        {/* Login Card */}
        <div className="glass-card p-8 rounded-3xl shadow-xl">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 text-center">
            Вход в систему
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 text-center">
            Введите пароль для доступа к приложению
          </p>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Пароль
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                disabled={isChecking}
                autoFocus
              />
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center gap-2">
                <AlertCircle size={18} className="text-red-600 dark:text-red-400 flex-shrink-0" />
                <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!password || isChecking}
              className="w-full bg-gradient-to-r from-brand-500 to-purple-600 text-white py-3 px-6 rounded-xl font-medium hover:shadow-lg hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all"
            >
              {isChecking ? 'Проверка...' : 'Войти'}
            </button>
          </form>

          <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <p className="text-xs text-slate-600 dark:text-slate-400 text-center">
              Пароль нужно ввести только один раз.<br />
              После входа он сохранится в браузере.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
