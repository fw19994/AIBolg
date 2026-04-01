import { Link } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';

export default function ArticlePage() {
  return (
    <div className="min-h-screen w-full flex overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Sidebar />
      <main className="flex-1 min-w-0 px-0 overflow-auto flex flex-col items-center justify-center gap-4">
        <p className="text-slate-600 dark:text-slate-400">
          请从
          <Link to="/home" className="text-emerald-600 hover:underline mx-1 dark:text-emerald-400">
            博客主页
          </Link>
          或
          <Link to="/articles" className="text-emerald-600 hover:underline mx-1 dark:text-emerald-400">
            文章管理
          </Link>
          进入具体文章阅读。
        </p>
      </main>
    </div>
  );
}
