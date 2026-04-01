import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import ReadAgentPanel from '@/components/ReadAgentPanel';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { api, type Article, type ArticleComment } from '@/lib/api';
import '@uiw/react-markdown-preview/markdown.css';

const MarkdownPreview = lazy(() =>
  import('@uiw/react-markdown-preview').then((m) => ({ default: m.default })),
);

const defaultAuthorAvatar =
  'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=200';

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return s;
  }
}

function formatCommentTime(s: string) {
  try {
    return new Date(s).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return s;
  }
}

export default function ArticleDetailPage() {
  const { resolved } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const colorMode = resolved === 'dark' ? 'dark' : 'light';
  const { id: idParam } = useParams();
  const id = Number(idParam);
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [likeCount, setLikeCount] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [reactionBusy, setReactionBusy] = useState(false);
  /** 阅读助手宽屏浮层：更易读长回复与表格 */
  const [assistantExpanded, setAssistantExpanded] = useState(false);

  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadArticle = useCallback(() => {
    if (!id || Number.isNaN(id)) {
      setLoading(false);
      setError('无效的文章 ID');
      return;
    }
    setLoading(true);
    api
      .getArticle(id)
      .then((r) => {
        setArticle(r.data);
        setLikeCount(r.like_count ?? 0);
        setFavoriteCount(r.favorite_count ?? 0);
        setLiked(!!r.liked);
        setFavorited(!!r.favorited);
        setError('');
      })
      .catch((e) => setError(e.message || '加载失败'))
      .finally(() => setLoading(false));
  }, [id, user?.id]);

  useEffect(() => {
    loadArticle();
  }, [loadArticle]);

  useEffect(() => {
    if (!article || !id || Number.isNaN(id)) return;
    setCommentsLoading(true);
    api
      .listArticleComments(id)
      .then((r) => setComments(r.data || []))
      .catch(() => setComments([]))
      .finally(() => setCommentsLoading(false));
  }, [article?.id, id]);

  const requireLogin = () => {
    navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
  };

  const toggleLike = async () => {
    if (!user) {
      requireLogin();
      return;
    }
    if (reactionBusy || !id) return;
    setReactionBusy(true);
    try {
      const r = liked ? await api.unlikeArticle(id) : await api.likeArticle(id);
      setLikeCount(r.like_count);
      setLiked(r.liked);
    } catch (e) {
      alert(e instanceof Error ? e.message : '操作失败');
    } finally {
      setReactionBusy(false);
    }
  };

  const submitComment = async () => {
    if (!user) {
      requireLogin();
      return;
    }
    const text = commentDraft.trim();
    if (!text || !id) return;
    setPostingComment(true);
    try {
      const r = await api.postArticleComment(id, text);
      if (r.data) setComments((prev) => [...prev, r.data]);
      setCommentDraft('');
    } catch (e) {
      alert(e instanceof Error ? e.message : '发表失败');
    } finally {
      setPostingComment(false);
    }
  };

  const removeComment = async (commentId: number) => {
    if (!id || !user) return;
    setDeletingId(commentId);
    try {
      await api.deleteArticleComment(id, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (e) {
      alert(e instanceof Error ? e.message : '删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleFavorite = async () => {
    if (!user) {
      requireLogin();
      return;
    }
    if (reactionBusy || !id) return;
    setReactionBusy(true);
    try {
      const r = favorited ? await api.unfavoriteArticle(id) : await api.favoriteArticle(id);
      setFavoriteCount(r.favorite_count);
      setFavorited(r.favorited);
    } catch (e) {
      alert(e instanceof Error ? e.message : '操作失败');
    } finally {
      setReactionBusy(false);
    }
  };

  useEffect(() => {
    if (!assistantExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAssistantExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [assistantExpanded]);

  if (loading) {
    return (
      <div className="min-h-screen w-full flex bg-slate-50 dark:bg-slate-950">
        <Sidebar />
        <main className="flex-1 min-w-0 px-0 flex items-center justify-center text-slate-500 dark:text-slate-400">加载中…</main>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen w-full flex bg-slate-50 dark:bg-slate-950">
        <Sidebar />
        <main className="flex-1 min-w-0 px-0 flex flex-col items-center justify-center gap-4 text-slate-500 dark:text-slate-400">
          <p>{error || '文章不存在'}</p>
          <Link to="/home" className="text-emerald-600 hover:underline dark:text-emerald-400">返回博客主页</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen max-h-[100dvh] min-h-0 w-full flex overflow-hidden bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 box-border">
      {assistantExpanded && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] cursor-default"
          aria-label="关闭宽屏阅读助手"
          onClick={() => setAssistantExpanded(false)}
        />
      )}
      <aside className="hidden md:flex md:flex-col w-56 shrink-0 min-h-0 border-r border-slate-200/90 bg-white/80 px-4 py-4 gap-4 text-xs overflow-y-auto dark:border-slate-800/80 dark:bg-slate-900/60">
        <Link
          to="/home"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-200/90 text-slate-900 hover:bg-slate-300 transition dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          <i className="fa-solid fa-arrow-left" />
          <span>返回博客主页</span>
        </Link>
        <div className="mt-auto text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
          <p className="flex items-center gap-2">
            <i className="fa-solid fa-book-open-reader text-cyan-600 dark:text-cyan-400" />
            <span>右侧为阅读助手（与写作 AI 无关）</span>
          </p>
          <p className="text-slate-500 dark:text-slate-500 pl-6 leading-snug">可点「展开」宽屏阅读长回复。</p>
        </div>
      </aside>

      <main className="flex-1 flex min-h-0 min-w-0 overflow-hidden px-0">
        <section className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8 py-4 md:py-6">
          <header className="max-w-2xl mx-auto space-y-4">
            {/* 1 作者与时间 */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2 min-w-0">
                {article.author?.avatar_url?.trim() ? (
                  <img
                    src={article.author.avatar_url}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover border border-slate-200/80 shrink-0 dark:border-slate-600/80"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-700 shrink-0 overflow-hidden ring-1 ring-slate-200/80 dark:ring-slate-600/80">
                    <img src={defaultAuthorAvatar} alt="" className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs text-slate-900 dark:text-slate-100 truncate">
                    {article.author?.display_name?.trim() || '作者'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    发布于 {formatDate(article.created_at)} · 更新于 {formatDate(article.updated_at)}
                  </p>
                  {article.author?.link?.trim() && (
                    <a
                      href={
                        /^https?:\/\//i.test(article.author.link.trim())
                          ? article.author.link.trim()
                          : `https://${article.author.link.trim()}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-emerald-600 hover:underline dark:text-emerald-400 truncate block max-w-[240px] md:max-w-md"
                    >
                      {article.author.link.trim()}
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* 2 标题 */}
            <h1 className="text-2xl md:text-3xl font-semibold leading-snug text-slate-900 dark:text-slate-100">
              {article.title || '无标题'}
            </h1>

            {/* 6 点赞与收藏 */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleLike}
                disabled={reactionBusy}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                  liked
                    ? 'border-red-300/80 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-300'
                    : 'border-slate-200/90 bg-white/70 text-slate-700 hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800'
                } disabled:opacity-50`}
              >
                <i className={liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart'} />
                <span>{likeCount}</span>
              </button>
              <button
                type="button"
                onClick={toggleFavorite}
                disabled={reactionBusy}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                  favorited
                    ? 'border-amber-300/80 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200'
                    : 'border-slate-200/90 bg-white/70 text-slate-700 hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800'
                } disabled:opacity-50`}
              >
                <i className={favorited ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark'} />
                <span>收藏</span>
                <span className="text-slate-500 dark:text-slate-400">({favoriteCount})</span>
              </button>
              {!user && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400">登录后可点赞与收藏</span>
              )}
            </div>
          </header>

          {/* 7 正文 */}
          <article
            className={`max-w-2xl mx-auto mt-6 text-sm md:text-[15px] leading-relaxed markdown-body ${
              resolved === 'dark' ? 'text-slate-200' : 'text-slate-800'
            }`}
            data-color-mode={colorMode}
          >
            {article.body ? (
              <Suspense fallback={<span className="text-slate-500">加载预览…</span>}>
                <MarkdownPreview
                  source={article.body}
                  wrapperElement={{ 'data-color-mode': colorMode }}
                  style={{ background: 'transparent', color: 'inherit' }}
                  className={`!bg-transparent [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg ${
                    resolved === 'dark' ? '!text-slate-200' : '!text-slate-800'
                  }`}
                />
              </Suspense>
            ) : (
              '（暂无正文）'
            )}
          </article>

          {/* 3 分类与标签 · 5 封面（位于正文之后） */}
          <div className="max-w-2xl mx-auto mt-10 space-y-6 pb-8">
            <div className="space-y-2 rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-2.5 dark:border-slate-700/80 dark:bg-slate-900/40">
              <div className="flex flex-wrap items-start gap-x-3 gap-y-2 text-xs">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="shrink-0 text-slate-500 dark:text-slate-400 font-medium">分类</span>
                  {article.category ? (
                    <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                      {article.category.name}
                    </span>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500">未分类</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-start gap-x-3 gap-y-2 text-xs">
                <span className="shrink-0 text-slate-500 dark:text-slate-400 font-medium pt-0.5">标签</span>
                <div className="flex flex-wrap gap-1.5 min-w-0">
                  {article.tags && article.tags.length > 0 ? (
                    article.tags.map((t) => (
                      <span
                        key={t.id}
                        className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 border border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25"
                      >
                        {t.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500">无</span>
                  )}
                </div>
              </div>
            </div>

            {article.cover_url && (
              <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700/80 shadow-sm">
                <img src={article.cover_url} alt="" className="w-full h-52 md:h-64 object-cover" />
              </div>
            )}

            {/* 评论 */}
            <div className="rounded-2xl border border-slate-200/90 bg-white/70 dark:border-slate-700/80 dark:bg-slate-900/50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <i className="fa-regular fa-comments text-emerald-600 dark:text-emerald-400" />
                  评论
                  {!commentsLoading && (
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400">({comments.length})</span>
                  )}
                </h2>
              </div>

              <div className="p-4 space-y-4">
                {commentsLoading ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">加载评论…</p>
                ) : comments.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">暂无评论，来抢沙发吧。</p>
                ) : (
                  <ul className="space-y-4">
                    {comments.map((cm) => {
                      const canDelete =
                        user && (user.id === cm.user_id || user.id === article.author_id);
                      const av = cm.author?.avatar_url?.trim();
                      return (
                        <li
                          key={cm.id}
                          className="flex gap-3 text-xs border-b border-slate-100/90 dark:border-slate-800/80 pb-4 last:border-0 last:pb-0"
                        >
                          <div className="shrink-0">
                            {av ? (
                              <img
                                src={av}
                                alt=""
                                className="w-9 h-9 rounded-full object-cover border border-slate-200/80 dark:border-slate-600/80"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden ring-1 ring-slate-200/80 dark:ring-slate-600/80">
                                <img src={defaultAuthorAvatar} alt="" className="h-full w-full object-cover" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className="font-medium text-slate-900 dark:text-slate-100">
                                {cm.author?.display_name?.trim() || '读者'}
                              </span>
                              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                {formatCommentTime(cm.created_at)}
                              </span>
                              {canDelete && (
                                <button
                                  type="button"
                                  disabled={deletingId === cm.id}
                                  onClick={() => removeComment(cm.id)}
                                  className="text-[11px] text-slate-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
                                >
                                  {deletingId === cm.id ? '删除中…' : '删除'}
                                </button>
                              )}
                            </div>
                            <p className="mt-1.5 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                              {cm.content}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="pt-1">
                  {user ? (
                    <>
                      <textarea
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        maxLength={2000}
                        rows={3}
                        placeholder="写下你的想法…"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 dark:bg-slate-950/80 dark:border-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-500 resize-y min-h-[80px]"
                      />
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          {commentDraft.length}/2000
                        </span>
                        <button
                          type="button"
                          disabled={postingComment || !commentDraft.trim()}
                          onClick={submitComment}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-semibold hover:bg-emerald-400 disabled:opacity-50 disabled:pointer-events-none"
                        >
                          <i className="fa-solid fa-paper-plane text-[11px]" />
                          {postingComment ? '发送中…' : '发表评论'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      <button
                        type="button"
                        onClick={requireLogin}
                        className="text-emerald-600 hover:underline dark:text-emerald-400"
                      >
                        登录
                      </button>
                      后参与讨论
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div
          className={`hidden lg:flex lg:flex-col shrink-0 h-full min-h-0 max-h-full ${
            assistantExpanded ? 'w-0 min-w-0 overflow-visible' : 'w-[min(26rem,32vw)] min-w-[18rem] max-w-md overflow-hidden'
          }`}
        >
          <aside
            className={`flex flex-col h-full min-h-0 max-h-full overflow-hidden bg-white/90 border-slate-200/90 border-l dark:bg-slate-900/70 dark:border-slate-800/80 ${
              assistantExpanded
                ? 'fixed right-0 top-0 bottom-0 z-50 w-[min(92vw,42rem)] max-w-[672px] shadow-2xl shadow-black/20 dark:shadow-black/40'
                : 'relative w-full'
            }`}
          >
            <ReadAgentPanel
              articleId={id}
              expanded={assistantExpanded}
              onToggleExpand={() => setAssistantExpanded((v) => !v)}
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
