import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ArticleReactionStats from '@/components/ArticleReactionStats';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { api, type Article } from '@/lib/api';

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return s;
  }
}

export default function FavoritesPage() {
  const { user } = useAuth();
  const [list, setList] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(() => {
    if (!user) return;
    setLoading(true);
    api
      .listFavorites()
      .then((r) => setList(r.data || []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const removeFavorite = (id: number, title: string) => {
    if (!confirm(`确定从收藏中移除「${title || '无标题'}」？`)) return;
    setBusyId(id);
    api
      .unfavoriteArticle(id)
      .then(() => load())
      .catch((e) => alert(e.message || '操作失败'))
      .finally(() => setBusyId(null));
  };

  if (!user) {
    return (
      <div className="min-h-screen w-full flex bg-slate-50 dark:bg-slate-950">
        <Sidebar />
        <main className="flex-1 min-w-0 px-0 flex flex-col items-center justify-center gap-4 text-slate-500 dark:text-slate-400">
          <p>请先登录后查看收藏</p>
          <Link to="/login?redirect=%2Ffavorites" className="text-emerald-600 hover:underline dark:text-emerald-400">
            去登录
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex overflow-hidden bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <Sidebar />
      <main className="flex-1 min-w-0 px-0 flex flex-col overflow-hidden">
        <header className="px-4 md:px-8 py-4 border-b border-slate-200/90 bg-white/70 backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/60">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <i className="fa-solid fa-bookmark text-amber-600 dark:text-amber-400" />
                我的收藏
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">按收藏时间排序，可随时取消收藏</p>
            </div>
            <Link
              to="/home"
              className="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200"
            >
              <i className="fa-solid fa-arrow-left text-[10px]" />
              博客主页
            </Link>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto px-4 md:px-8 py-4">
          {loading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">加载中…</p>
          ) : list.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300/90 bg-white/50 py-16 text-center dark:border-slate-700 dark:bg-slate-900/40">
              <p className="text-sm text-slate-600 dark:text-slate-300">暂无收藏</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">在文章阅读页点击「收藏」即可加入这里</p>
              <Link
                to="/home"
                className="inline-flex mt-4 text-sm text-emerald-600 hover:underline dark:text-emerald-400"
              >
                去逛逛博客
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {list.map((a) => (
                <article
                  key={a.id}
                  className="rounded-2xl bg-white/90 border border-slate-200/90 px-4 py-3 flex flex-col gap-2 min-h-0 dark:bg-slate-900/80 dark:border-slate-800/80"
                >
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/article/${a.id}`}
                      className="font-semibold text-sm line-clamp-2 text-slate-900 hover:text-emerald-700 dark:text-slate-100 dark:hover:text-emerald-300"
                    >
                      {a.title || '无标题'}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {a.status === 'draft' && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300">
                          草稿
                        </span>
                      )}
                      <span>更新 {formatDate(a.updated_at)}</span>
                      <ArticleReactionStats article={a} size="sm" />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-2">
                      {a.body?.trim()
                        ? a.body.trim().length > 100
                          ? `${a.body.trim().slice(0, 100)}…`
                          : a.body.trim()
                        : ''}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <Link
                      to={`/article/${a.id}`}
                      className="text-[11px] text-emerald-600 hover:underline dark:text-emerald-400"
                    >
                      阅读全文
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === a.id}
                      onClick={() => removeFavorite(a.id, a.title)}
                      className="text-[11px] text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 disabled:opacity-50"
                    >
                      {busyId === a.id ? '…' : '取消收藏'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
