
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ArticleReactionStats from '@/components/ArticleReactionStats';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { api, type Article } from '@/lib/api';

type Filter = 'all' | 'published' | 'draft';

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return s;
  }
}

export default function ArticlesManagePage() {
  const { user, loading: authLoading } = useAuth();
  const [list, setList] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    api
      .listArticles()
      .then((r) => setList(r.data || []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    load();
  }, [user, authLoading]);

  const filtered = list.filter((a) => {
    if (filter === 'published' && a.status !== 'published') return false;
    if (filter === 'draft' && a.status !== 'draft') return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!a.title.toLowerCase().includes(q) && !(a.body && a.body.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const handleDelete = (id: number, title: string) => {
    if (!confirm(`确定删除「${title || '无标题'}」？`)) return;
    api
      .deleteArticle(id)
      .then(() => load())
      .catch((e) => alert(e.message || '删除失败'));
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen w-full flex bg-slate-50 dark:bg-slate-950">
        <Sidebar />
        <main className="flex-1 min-w-0 px-0 flex flex-col items-center justify-center gap-4 text-slate-500 dark:text-slate-400">
          {authLoading ? <p>加载中…</p> : (
            <>
              <p>请先登录后管理文章</p>
              <Link to="/login?redirect=%2Farticles" className="text-emerald-600 hover:underline dark:text-emerald-400">去登录</Link>
            </>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex overflow-hidden bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <Sidebar />
      <main className="flex-1 min-w-0 px-0 flex flex-col overflow-hidden">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 md:px-6 py-4 border-b border-slate-200/90 bg-white/70 backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/60">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">文章管理</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">管理全部文章与草稿，支持筛选、搜索</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 sm:max-w-xs px-3 py-2 rounded-xl bg-slate-100 border border-slate-200/90 text-xs flex items-center gap-2 dark:bg-slate-900/80 dark:border-slate-700/80">
              <i className="fa-solid fa-magnifying-glass text-slate-400" />
              <input
                type="text"
                placeholder="搜索标题、内容…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent focus:outline-none placeholder:text-slate-400 text-slate-800 dark:placeholder:text-slate-500 dark:text-slate-200"
              />
            </div>
            <Link
              to="/editor"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-medium hover:bg-emerald-400 transition"
            >
              <i className="fa-solid fa-plus" />
              <span>写新文章</span>
            </Link>
          </div>
        </header>

        <div className="px-4 md:px-6 py-3 border-b border-slate-200/90 dark:border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
          {(['all', 'published', 'draft'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full transition ${
                filter === f
                  ? 'bg-emerald-500/90 text-slate-950 font-medium'
                  : 'bg-slate-200/90 text-slate-800 hover:bg-slate-300 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {f === 'all' ? '全部' : f === 'published' ? '已发布' : '草稿'}
            </button>
          ))}
        </div>

        <section className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
          {loading ? (
            <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm">加载中…</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
              {list.length === 0 ? '暂无文章。' : '没有符合筛选条件的文章。'}
              {list.length === 0 && (
                <Link to="/editor" className="text-emerald-600 hover:underline ml-1 dark:text-emerald-400">去写一篇</Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((a) => (
                <article
                  key={a.id}
                  className="rounded-2xl bg-white/90 border border-slate-200/90 px-4 py-3 flex flex-col gap-3 min-h-0 dark:bg-slate-900/80 dark:border-slate-800/80"
                >
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-sm line-clamp-2 text-slate-900 dark:text-slate-100">{a.title || '无标题'}</h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <span
                        className={`px-2 py-0.5 rounded-full shrink-0 ${
                          a.status === 'published'
                            ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                            : 'bg-amber-500/20 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {a.status === 'published' ? '已发布' : '草稿'}
                      </span>
                      <span className="min-w-0">{a.status === 'published' ? formatDate(a.created_at) : `最后编辑 ${formatDate(a.updated_at)}`}</span>
                    </div>
                    <ArticleReactionStats article={a} size="sm" className="mt-2" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-0.5 border-t border-slate-100 dark:border-slate-800/80">
                    {a.status === 'published' && (
                      <Link
                        to={`/article/${a.id}`}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 text-[11px]"
                      >
                        查看
                      </Link>
                    )}
                    <Link
                      to={`/editor/${a.id}`}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 text-[11px]"
                    >
                      {a.status === 'draft' ? '继续编辑' : '编辑'}
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(a.id, a.title)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-200 text-red-700 hover:bg-red-100 dark:bg-slate-800 dark:text-red-300 dark:hover:bg-red-500/20 text-[11px]"
                    >
                      删除
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
