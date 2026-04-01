
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ArticleReactionStats from '@/components/ArticleReactionStats';
import Sidebar from '@/components/Sidebar';
import ProfileEditModal from '@/components/ProfileEditModal';
import { useAuth } from '@/contexts/AuthContext';
import { api, type Article, type User, type Category, type Tag } from '@/lib/api';

const defaultAvatar = 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=200';

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return s;
  }
}

function hrefOrHttps(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

export default function ProfilePage() {
  const { user: authUser, refreshUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [profileEditOpen, setProfileEditOpen] = useState(false);

  useEffect(() => {
    Promise.all([api.listCategories(), api.listTags()])
      .then(([c, t]) => {
        setCategories(c.data || []);
        setTags(t.data || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!authUser) {
      setUser(null);
      setArticles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .getProfile()
      .then((p) => {
        setUser(p.data ?? null);
        const id = p.data?.id;
        if (id == null) return Promise.resolve({ data: [] as Article[] });
        return api.listArticles({
          status: 'published',
          author_id: id,
          ...(selectedCategoryId != null && { category_id: selectedCategoryId }),
          ...(selectedTagId != null && { tag_id: selectedTagId }),
        });
      })
      .then((r) => setArticles(r.data || []))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [authUser, selectedCategoryId, selectedTagId]);

  const displayName = user?.display_name || '作者';
  const bio = user?.bio || '暂无简介';
  const avatar = user?.avatar_url || defaultAvatar;
  const link = user?.link || '';
  const location = user?.location?.trim() || '';
  const company = user?.company?.trim() || '';
  const githubUrl = user?.github_url?.trim() || '';
  const twitterUrl = user?.twitter_url?.trim() || '';
  const filtered = articles;

  if (!authUser) {
    return (
      <div className="min-h-screen w-full flex bg-slate-50 dark:bg-slate-950">
        <Sidebar />
        <main className="flex-1 min-w-0 px-0 flex flex-col items-center justify-center gap-4 text-slate-500 dark:text-slate-400">
          <p>请先登录后查看作者主页</p>
          <Link to="/login" className="text-emerald-600 hover:underline dark:text-emerald-400">去登录</Link>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full flex bg-slate-50 dark:bg-slate-950">
        <Sidebar />
        <main className="flex-1 min-w-0 px-0 flex items-center justify-center text-slate-500 dark:text-slate-400">加载中…</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex overflow-hidden bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <Sidebar />
      <main className="flex-1 min-w-0 px-0 flex flex-col overflow-hidden">
        <section className="px-4 md:px-8 py-4 md:py-6 border-b border-slate-200/90 bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:border-slate-800/80 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <img src={avatar} alt="作者头像" className="w-16 h-16 md:w-20 md:h-20 rounded-2xl object-cover" />
              <div>
                <p className="text-base md:text-lg font-semibold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  {displayName}
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/50 text-[11px] text-emerald-800 dark:text-emerald-200 flex items-center gap-1">
                    <i className="fa-solid fa-sparkles text-[10px]" />
                    <span>InkMind 创作者</span>
                  </span>
                </p>
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-xl">{bio}</p>
                {(location || company) && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {location && (
                      <span className="inline-flex items-center gap-1">
                        <i className="fa-solid fa-location-dot text-amber-600/90 dark:text-amber-400/90" />
                        {location}
                      </span>
                    )}
                    {company && (
                      <span className="inline-flex items-center gap-1">
                        <i className="fa-solid fa-building text-slate-400" />
                        {company}
                      </span>
                    )}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {link && (
                    <a
                      href={hrefOrHttps(link)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-600 hover:underline dark:text-emerald-400"
                    >
                      <i className="fa-solid fa-globe text-[11px]" />
                      <span className="truncate max-w-[200px]">{link}</span>
                    </a>
                  )}
                  {githubUrl && (
                    <a
                      href={hrefOrHttps(githubUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200/90 text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      title="GitHub"
                    >
                      <i className="fa-brands fa-github" />
                    </a>
                  )}
                  {twitterUrl && (
                    <a
                      href={hrefOrHttps(twitterUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200/90 text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      title="X / Twitter"
                    >
                      <i className="fa-brands fa-x-twitter" />
                    </a>
                  )}
                </div>
              </div>
            </div>
            {user && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setProfileEditOpen(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <i className="fa-regular fa-pen-to-square" />
                  <span>编辑资料</span>
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="rounded-2xl bg-white/90 border border-slate-200/90 px-3 py-2 dark:bg-slate-900/80 dark:border-slate-700/80">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">公开文章</p>
              <p className="text-lg font-semibold mt-1 text-slate-900 dark:text-slate-100">{articles.length}</p>
            </div>
            <div className="rounded-2xl bg-white/90 border border-slate-200/90 px-3 py-2 dark:bg-slate-900/80 dark:border-slate-700/80">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">累计字数</p>
              <p className="text-lg font-semibold mt-1 text-slate-900 dark:text-slate-100">
                {articles.reduce((n, a) => n + (a.body?.length || 0), 0).toLocaleString()}
              </p>
            </div>
          </div>
        </section>

        <section className="flex-1 overflow-y-auto px-4 md:px-8 py-4 space-y-3">
          <div className="space-y-2 mb-3">
            {(categories.length > 0 || tags.length > 0) && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500 shrink-0">分类</span>
                <button
                  type="button"
                  onClick={() => setSelectedCategoryId(null)}
                  className={`px-2.5 py-1 rounded-full transition ${
                    selectedCategoryId === null
                      ? 'bg-emerald-500/90 text-slate-950 font-medium'
                      : 'bg-slate-200/90 text-slate-800 hover:bg-slate-300 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  全部
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(selectedCategoryId === c.id ? null : c.id)}
                    className={`px-2.5 py-1 rounded-full transition ${
                      selectedCategoryId === c.id
                        ? 'bg-emerald-500/90 text-slate-950 font-medium'
                        : 'bg-slate-200/90 text-slate-800 hover:bg-slate-300 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
                {tags.length > 0 && (
                  <>
                    <span className="text-slate-500 shrink-0 ml-1">标签</span>
                    <button
                      type="button"
                      onClick={() => setSelectedTagId(null)}
                      className={`px-2.5 py-1 rounded-full transition ${
                        selectedTagId === null
                          ? 'bg-emerald-500/20 text-emerald-800 border border-emerald-500/50 dark:text-emerald-300'
                          : 'bg-slate-200/80 text-slate-600 hover:bg-slate-300 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700'
                      }`}
                    >
                      全部
                    </button>
                    {tags.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTagId(selectedTagId === t.id ? null : t.id)}
                        className={`px-2.5 py-1 rounded-full transition ${
                          selectedTagId === t.id
                            ? 'bg-emerald-500/20 text-emerald-800 border border-emerald-500/50 dark:text-emerald-300'
                            : 'bg-slate-200/80 text-slate-600 hover:bg-slate-300 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700'
                        }`}
                      >
                        {t.name}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <p>全部文章 {filtered.length > 0 ? `· 共 ${filtered.length} 篇` : ''}</p>
            <Link to="/home" className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200">
              <span>博客主页</span>
              <i className="fa-solid fa-chevron-right text-[9px]" />
            </Link>
          </div>
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">暂无已发布文章</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((a) => (
                <Link
                  key={a.id}
                  to={`/article/${a.id}`}
                  className="rounded-2xl bg-white/90 border border-slate-200/90 hover:border-emerald-500/50 dark:bg-slate-900/80 dark:border-slate-800/80 dark:hover:border-emerald-500/60 transition px-3.5 py-3 flex flex-col gap-1.5 h-full min-h-0 text-xs md:text-sm"
                >
                  <p className="font-semibold line-clamp-2 text-slate-900 dark:text-slate-100">{a.title || '无标题'}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">{formatDate(a.updated_at)}</span>
                    <ArticleReactionStats article={a} size="sm" />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                    {a.body?.trim()
                      ? a.body.trim().length > 80
                        ? `${a.body.trim().slice(0, 80)}…`
                        : a.body.trim()
                      : ''}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        {user && (
          <ProfileEditModal
            open={profileEditOpen}
            onClose={() => setProfileEditOpen(false)}
            user={user}
            onSaved={(u) => {
              setUser(u);
              refreshUser();
            }}
          />
        )}
      </main>
    </div>
  );
}
