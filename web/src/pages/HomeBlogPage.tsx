
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ArticleReactionStats from '@/components/ArticleReactionStats';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { api, type Article, type Category, type Tag } from '@/lib/api';

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return s;
  }
}

function excerpt(text: string, max = 80) {
  if (!text) return '';
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : t.slice(0, max) + '…';
}

/** 有有效封面 URL 时用海报式卡片，否则用文稿式卡片 */
function articleHasCover(a: Article): boolean {
  return Boolean(a.cover_url && String(a.cover_url).trim());
}

const chipBase =
  'rounded-full text-[11px] font-medium transition-all duration-200 active:scale-[0.98]';
const chipIdle =
  'bg-slate-100/90 text-slate-700 shadow-sm hover:bg-slate-200/90 hover:shadow dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-700/95';
const chipActive = 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/25';

export default function HomeBlogPage() {
  const { user } = useAuth();
  const [avatarImgErr, setAvatarImgErr] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);

  const avatarSrc = user?.avatar_url?.trim();
  const showAvatarImg = Boolean(avatarSrc) && !avatarImgErr;

  useEffect(() => {
    setAvatarImgErr(false);
  }, [avatarSrc]);

  useEffect(() => {
    Promise.all([api.listCategories(), api.listTags()])
      .then(([c, t]) => {
        setCategories(c.data || []);
        setTags(t.data || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .listArticles({
        status: 'published',
        ...(selectedCategoryId != null && { category_id: selectedCategoryId }),
        ...(selectedTagId != null && { tag_id: selectedTagId }),
      })
      .then((r) => setArticles(r.data || []))
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, [selectedCategoryId, selectedTagId]);

  const filtered = articles.filter((a) => {
    if (
      search.trim() &&
      !a.title.toLowerCase().includes(search.toLowerCase()) &&
      !(a.body && a.body.toLowerCase().includes(search.toLowerCase()))
    )
      return false;
    return true;
  });

  return (
    <div className="min-h-screen w-full flex overflow-hidden bg-gradient-to-br from-slate-50 via-slate-100 to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <Sidebar />
      <main className="flex-1 min-w-0 px-0 flex flex-col overflow-hidden relative">
        {/* 背景氛围 */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 top-0 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl dark:bg-emerald-500/5" />
          <div className="absolute -left-20 bottom-20 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl dark:bg-cyan-500/5" />
        </div>

        <header className="relative z-10 flex items-center justify-between gap-3 px-4 md:px-6 py-3.5 border-b border-slate-200/80 bg-white/80 shadow-sm shadow-slate-900/5 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/75 dark:shadow-black/20">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">欢迎回来</p>
            <p className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              <span className="font-medium text-slate-500 dark:text-slate-400">InkMind</span>{' '}
              <span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 bg-clip-text text-transparent dark:from-emerald-400 dark:via-teal-400 dark:to-cyan-400">
                知识花园
              </span>
            </p>
          </div>
          <div className="flex-1 max-w-lg mx-2 md:mx-4 hidden md:flex justify-center">
            <div className="flex w-full items-center gap-2 rounded-full border border-slate-200/90 bg-slate-50/90 px-3.5 py-2 text-xs text-slate-700 shadow-inner dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-200 focus-within:border-emerald-400/50 focus-within:ring-2 focus-within:ring-emerald-500/15 dark:focus-within:border-emerald-500/40 transition-shadow">
              <i className="fa-solid fa-magnifying-glass shrink-0 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="搜索标题或正文…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-w-0 flex-1 bg-transparent focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              <kbd className="hidden sm:inline rounded-md border border-slate-200/90 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-500">
                Ctrl+K
              </kbd>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            <Link
              to="/editor"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-500/25 transition hover:brightness-110 hover:shadow-lg active:scale-[0.98]"
            >
              <i className="fa-solid fa-pen-to-square text-[11px]" />
              <span>写新文章</span>
            </Link>
            <Link
              to="/profile"
              className="flex items-center rounded-xl p-1 transition hover:bg-slate-200/80 dark:hover:bg-slate-800/70"
              title={user?.display_name || '个人资料'}
            >
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 text-slate-600 shadow-inner dark:from-slate-700 dark:to-slate-800 dark:text-slate-300">
                {showAvatarImg ? (
                  <img
                    src={avatarSrc}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={() => setAvatarImgErr(true)}
                  />
                ) : (
                  <i className="fa-regular fa-user text-sm" />
                )}
              </div>
            </Link>
          </div>
        </header>

        <section className="relative z-0 flex-1 overflow-y-auto px-3 pb-6 pt-4 md:px-6 md:pt-5 selection:bg-emerald-500/20 selection:text-slate-900 dark:selection:text-slate-100">
          <div className="mx-auto max-w-[1600px] space-y-3">
            {/* 窄屏搜索：与顶栏互补，避免小屏无法筛选 */}
            <div className="md:hidden rounded-2xl border border-slate-200/80 bg-white/70 p-3 shadow-sm backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/55">
              <div className="flex items-center gap-2 rounded-full border border-slate-200/90 bg-slate-50/90 px-3.5 py-2.5 text-xs text-slate-700 shadow-inner dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-200 focus-within:border-emerald-400/50 focus-within:ring-2 focus-within:ring-emerald-500/15 dark:focus-within:border-emerald-500/40 transition-shadow">
                <i className="fa-solid fa-magnifying-glass shrink-0 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="搜索标题或正文…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/60 p-3 shadow-sm backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">分类</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryId(null)}
                      className={`${chipBase} px-3 py-1.5 ${
                        selectedCategoryId === null ? chipActive : chipIdle
                      }`}
                    >
                      全部
                    </button>
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCategoryId(selectedCategoryId === c.id ? null : c.id)}
                        className={`${chipBase} px-3 py-1.5 ${
                          selectedCategoryId === c.id ? chipActive : chipIdle
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-slate-100/90 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
                  <i className="fa-solid fa-layer-group text-emerald-500/90 text-[11px]" />
                  <span>共 {filtered.length} 篇</span>
                </div>
              </div>
              {tags.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200/70 pt-3 dark:border-slate-700/60">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">标签</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedTagId(null)}
                      className={`${chipBase} px-2.5 py-1 ${
                        selectedTagId === null
                          ? 'border border-emerald-400/50 bg-emerald-500/15 text-emerald-800 shadow-sm dark:bg-emerald-500/10 dark:text-emerald-300'
                          : `${chipIdle} border border-transparent`
                      }`}
                    >
                      全部
                    </button>
                    {tags.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTagId(selectedTagId === t.id ? null : t.id)}
                        className={`${chipBase} px-2.5 py-1 ${
                          selectedTagId === t.id
                            ? 'border border-emerald-400/50 bg-emerald-500/15 text-emerald-800 shadow-sm dark:bg-emerald-500/10 dark:text-emerald-300'
                            : `${chipIdle} border border-transparent`
                        }`}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-20">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">加载文章列表…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300/90 bg-white/40 py-16 dark:border-slate-700 dark:bg-slate-900/30">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 text-2xl text-slate-400 dark:from-slate-800 dark:to-slate-900 dark:text-slate-500">
                  <i className="fa-solid fa-seedling" />
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">还没有文章</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">写第一篇，让知识花园长出新叶</p>
                <Link
                  to="/editor"
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 transition hover:brightness-110"
                >
                  <i className="fa-solid fa-pen-nib" />
                  去写作
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((a, index) => {
                  const hasCover = articleHasCover(a);
                  const highlight = index === 0;
                  const ringHighlight =
                    highlight
                      ? 'border-emerald-400/40 ring-2 ring-emerald-500/20 dark:border-emerald-500/30 dark:ring-emerald-400/15'
                      : 'border-slate-200/90 hover:border-emerald-300/60 dark:border-slate-800/90 dark:hover:border-emerald-600/40';

                  if (hasCover) {
                    return (
                      <Link
                        key={a.id}
                        to={`/article/${a.id}`}
                        className={`group relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-white/90 shadow-sm ring-0 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:bg-slate-900/85 dark:hover:shadow-emerald-950/30 ${ringHighlight}`}
                      >
                        {/* 海报区：略扁，节省纵向空间 */}
                        <div className="relative aspect-[2/1] w-full shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-800">
                          <img
                            src={a.cover_url}
                            alt=""
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/65 via-slate-900/10 to-transparent dark:from-slate-950/70" />
                          <div className="absolute inset-x-0 bottom-0 p-2 pt-6">
                            <h2 className="line-clamp-2 text-xs font-semibold leading-snug text-white drop-shadow-sm transition group-hover:text-emerald-100">
                              {a.title || '无标题'}
                            </h2>
                          </div>
                          <div className="absolute left-1.5 top-1.5 flex flex-wrap gap-1">
                            {highlight && (
                              <span className="inline-flex items-center gap-0.5 rounded-md bg-white/95 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 shadow-sm backdrop-blur-sm dark:bg-emerald-950/90 dark:text-emerald-300">
                                <i className="fa-solid fa-sparkles text-[8px]" />
                                最新
                              </span>
                            )}
                          </div>
                          <time
                            dateTime={a.updated_at}
                            className="absolute right-1.5 top-1.5 rounded bg-black/45 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm"
                          >
                            {formatDate(a.updated_at)}
                          </time>
                        </div>
                        <div className="flex min-h-0 flex-1 flex-col p-2 pt-1.5">
                          <p className="line-clamp-2 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                            {excerpt(a.body, 64)}
                          </p>
                          <ArticleReactionStats article={a} className="mt-1 shrink-0" />
                          <div className="min-h-0 flex-1" aria-hidden />
                          <p className="mt-1 inline-flex shrink-0 items-center gap-0.5 text-[9px] font-medium text-emerald-600/90 dark:text-emerald-400/90">
                            阅读全文
                            <i className="fa-solid fa-arrow-right translate-y-px text-[7px] transition group-hover:translate-x-0.5" />
                          </p>
                        </div>
                      </Link>
                    );
                  }

                  return (
                    <Link
                      key={a.id}
                      to={`/article/${a.id}`}
                      className={`group relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/90 border-l-[3px] border-l-emerald-500/55 bg-gradient-to-br from-white via-slate-50/95 to-emerald-50/25 shadow-sm ring-0 transition-all duration-300 hover:-translate-y-0.5 hover:border-l-emerald-500 hover:shadow-lg hover:shadow-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:border-slate-800/90 dark:border-l-emerald-500/50 dark:from-slate-900/95 dark:via-slate-900 dark:to-slate-950/90 dark:hover:border-l-emerald-400 dark:hover:shadow-emerald-950/30 ${
                        highlight ? 'ring-2 ring-emerald-500/20 dark:ring-emerald-400/15' : ''
                      }`}
                    >
                      <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-emerald-500/[0.06] blur-xl dark:bg-emerald-400/[0.05]" />
                      <i className="fa-solid fa-quote-right pointer-events-none absolute bottom-10 right-2 text-3xl text-emerald-600/[0.07] dark:text-emerald-400/[0.08]" aria-hidden />

                      <div className="relative z-0 flex h-full min-h-0 flex-col px-3 pb-2 pt-2.5">
                        <div className="mb-1 flex shrink-0 items-start justify-between gap-1.5">
                          <div className="flex flex-wrap items-center gap-1">
                            {highlight && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                                <i className="fa-solid fa-sparkles text-[8px]" />
                                最新
                              </span>
                            )}
                            <span className="inline-flex items-center gap-0.5 rounded bg-slate-100/90 px-1.5 py-0.5 text-[9px] font-medium text-slate-500 dark:bg-slate-800/90 dark:text-slate-400">
                              <i className="fa-solid fa-align-left text-[8px] opacity-70" />
                              纯文
                            </span>
                          </div>
                          <time
                            dateTime={a.updated_at}
                            className="shrink-0 text-[9px] font-medium tabular-nums text-slate-400 dark:text-slate-500"
                          >
                            {formatDate(a.updated_at)}
                          </time>
                        </div>

                        <h2 className="mb-1 line-clamp-2 shrink-0 text-sm font-semibold leading-snug tracking-tight text-slate-900 transition group-hover:text-emerald-700 dark:text-slate-50 dark:group-hover:text-emerald-300">
                          {a.title || '无标题'}
                        </h2>
                        <p className="line-clamp-5 shrink-0 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                          {excerpt(a.body, 280)}
                        </p>

                        <ArticleReactionStats article={a} className="mt-1.5 shrink-0" />
                        <div className="min-h-0 flex-1" aria-hidden />
                        <p className="mt-1 inline-flex shrink-0 items-center gap-0.5 text-[9px] font-medium text-emerald-600/90 dark:text-emerald-400/90">
                          阅读全文
                          <i className="fa-solid fa-arrow-right translate-y-px text-[7px] transition group-hover:translate-x-0.5" />
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
