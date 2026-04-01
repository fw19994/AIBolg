import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ThemeToggle from '@/components/ThemeToggle';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/home';
  const { login, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate(redirect);
    } catch (e) {
      setError(e instanceof Error ? e.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) navigate(redirect, { replace: true });
  }, [user, navigate, redirect]);

  if (user) return null;

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8 text-slate-900 dark:text-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-400 via-cyan-400 to-blue-500 flex items-center justify-center">
            <i className="fa-solid fa-pen-nib text-slate-950 text-xl" />
          </div>
          <span className="text-lg font-semibold">InkMind</span>
        </Link>
        <div className="rounded-2xl bg-white/95 border border-slate-200/90 p-6 shadow-xl dark:bg-slate-900/90 dark:border-slate-700/80">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">登录</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">登录后即可创建与管理文章</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
                {error}
              </div>
            )}
            <label className="block">
              <span className="text-xs text-slate-500 dark:text-slate-400">邮箱</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 dark:bg-slate-950/80 dark:border-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-500"
                placeholder="you@example.com"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500 dark:text-slate-400">密码</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 dark:bg-slate-950/80 dark:border-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-500"
                placeholder="至少 6 位"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 disabled:opacity-50 transition"
            >
              {loading ? '登录中…' : '登录'}
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
            还没有账号？{' '}
            <Link to="/register" className="text-emerald-600 hover:underline dark:text-emerald-400">
              注册
            </Link>
          </p>
        </div>
        <p className="mt-6 text-center">
          <Link to="/" className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-300">
            返回首页
          </Link>
        </p>
      </div>
    </div>
  );
}
