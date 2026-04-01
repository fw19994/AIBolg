
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import ThemeToggle from '@/components/ThemeToggle';

const navItems = [
  { href: '/home', label: '博客主页', icon: 'fa-house' },
  { href: '/articles', label: '文章管理', icon: 'fa-folder-open' },
  { href: '/favorites', label: '我的收藏', icon: 'fa-bookmark' },
  { href: '/profile', label: '作者主页', icon: 'fa-user' },
];

export default function Sidebar() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();

  return (
    <aside className="hidden md:flex md:shrink-0 md:flex-col w-60 min-h-screen border-r border-slate-200/90 bg-white/90 dark:border-slate-800/80 dark:bg-slate-900/60 px-4 py-5 gap-6 backdrop-blur-sm">
      <Link to="/" className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl overflow-hidden bg-gradient-to-tr from-emerald-400 via-cyan-400 to-blue-500 flex items-center justify-center">
          <i className="fa-solid fa-pen-nib text-slate-950 text-xl" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100">InkMind</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">用 AI 放大你的表达</p>
        </div>
      </Link>

      <nav className="space-y-1 text-sm">
        {navItems.map(({ href, label, icon }) => {
          const isActive = pathname === href || (href !== '/home' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              to={href}
              className={`flex items-center justify-between px-3 py-2 rounded-xl transition ${
                isActive
                  ? 'bg-slate-200/90 text-slate-900 dark:bg-slate-800/80 dark:text-slate-50'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2">
                <i className={`fa-solid ${icon}`} />
                <span>{label}</span>
              </span>
              {isActive && <i className="fa-solid fa-chevron-right text-[10px]" />}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2">
        <p className="text-[11px] text-slate-500 dark:text-slate-500">外观</p>
        <ThemeToggle />
      </div>

      <div className="mt-auto space-y-3 text-xs">
        {user ? (
          <div className="flex flex-col gap-2">
            <p className="text-slate-500 dark:text-slate-400 truncate" title={user.email}>
              {user.display_name || user.email || '已登录'}
            </p>
            <button
              type="button"
              onClick={() => logout()}
              className="text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300 transition text-left"
            >
              退出登录
            </button>
          </div>
        ) : (
          <Link to="/login" className="text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 transition">
            登录 / 注册
          </Link>
        )}
        <p className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <i className="fa-solid fa-wand-magic-sparkles text-emerald-600 dark:text-emerald-400" />
          <span>写作时可一键 AI 扩写</span>
        </p>
        <p className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <i className="fa-solid fa-comment-dots text-cyan-600 dark:text-cyan-400" />
          <span>阅读时随时向 AI 提问</span>
        </p>
      </div>
    </aside>
  );
}
