
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import RichMarkdownEditor from '@/components/RichMarkdownEditor';
import CoverPreview from '@/components/CoverPreview';
import AIAssistantDialog, { type AiDialogTextSnapshot } from '@/components/AIAssistantDialog';
import { useAuth } from '@/contexts/AuthContext';
import { api, type Article, type Category, type Tag } from '@/lib/api';

function excerpt(text: string, max = 50) {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : t.slice(0, max) + '…';
}

export default function EditorNewPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<Article[]>([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSnap, setAiSnap] = useState<AiDialogTextSnapshot | null>(null);
  const [selectionPopup, setSelectionPopup] = useState<{ top: number; left: number } | null>(null);
  const editorWrapRef = useRef<HTMLDivElement>(null);
  const editorTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleEditorMouseUp = useCallback(() => {
    // textarea 内选区在部分浏览器里要晚一帧才写入 selectionStart/End；且不要用 document.getSelection 的 Range 定位（会落在右侧预览上）。
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const ta =
          editorTextareaRef.current ||
          editorWrapRef.current?.querySelector<HTMLTextAreaElement>('textarea.w-md-editor-text-input') ||
          editorWrapRef.current?.querySelector<HTMLTextAreaElement>('textarea[class*="text-input"]') ||
          editorWrapRef.current?.querySelector<HTMLTextAreaElement>('textarea');
        if (ta && !editorTextareaRef.current) editorTextareaRef.current = ta;
        if (!ta) {
          setSelectionPopup(null);
          return;
        }

        const start = ta.selectionStart ?? 0;
        const end = ta.selectionEnd ?? 0;
        if (start === end) {
          setSelectionPopup(null);
          return;
        }

        const s = ta.value.slice(Math.min(start, end), Math.max(start, end)).trim();
        if (!s) {
          setSelectionPopup(null);
          return;
        }

        const r = ta.getBoundingClientRect();
        setSelectionPopup({ left: r.left + r.width / 2 - 52, top: Math.max(8, r.top - 36) });
      });
    });
  }, []);

  const openAiWithSelection = useCallback(() => {
    const ta =
      editorTextareaRef.current ||
      editorWrapRef.current?.querySelector<HTMLTextAreaElement>('textarea.w-md-editor-text-input') ||
      editorWrapRef.current?.querySelector<HTMLTextAreaElement>('textarea[class*="text-input"]') ||
      editorWrapRef.current?.querySelector<HTMLTextAreaElement>('textarea');
    if (ta && !editorTextareaRef.current) editorTextareaRef.current = ta;
    let range: { start: number; end: number } | null = null;
    if (ta) {
      const s = ta.selectionStart ?? 0;
      const e = ta.selectionEnd ?? 0;
      if (s !== e) range = { start: Math.min(s, e), end: Math.max(s, e) };
    }
    if (range) {
      setAiSnap({ text: body.slice(range.start, range.end), range });
    } else {
      setAiSnap({ text: body, range: null });
    }
    setSelectionPopup(null);
    setAiOpen(true);
  }, [body]);

  useEffect(() => {
    const onSelectionChange = () => {
      // 在 textarea 中选中文本时，document.getSelection() 往往为空，不能用它判断「无选区」否则会立刻清掉工具条。
      const ta =
        editorTextareaRef.current ||
        editorWrapRef.current?.querySelector<HTMLTextAreaElement>('textarea.w-md-editor-text-input') ||
        editorWrapRef.current?.querySelector<HTMLTextAreaElement>('textarea[class*="text-input"]') ||
        editorWrapRef.current?.querySelector<HTMLTextAreaElement>('textarea');
      if (ta) {
        const start = ta.selectionStart ?? 0;
        const end = ta.selectionEnd ?? 0;
        if (start !== end) {
          const frag = ta.value.slice(Math.min(start, end), Math.max(start, end)).trim();
          if (frag) return;
        }
      }
      setSelectionPopup(null);
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent('/editor')}`, { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    api.listArticles({ status: 'draft' }).then((r) => setDrafts(r.data || [])).catch(() => {});
  }, [user]);

  useEffect(() => {
    Promise.all([api.listCategories(), api.listTags()])
      .then(([c, t]) => {
        setCategories(c.data || []);
        setTags(t.data || []);
      })
      .catch(() => {});
  }, []);

  const toggleTag = (tagId: number) => {
    setTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  };

  const handleSave = () => {
    if (!title.trim()) {
      alert('请填写标题');
      return;
    }
    setSaving(true);
    api
      .createArticle({
        title: title.trim(),
        body: body.trim(),
        cover_url: coverUrl.trim() || undefined,
        category_id: categoryId ?? undefined,
        tag_ids: tagIds.length ? tagIds : undefined,
      })
      .then((r) => navigate(`/editor/${r.data.id}`))
      .catch((e) => alert(e.message || '保存失败'))
      .finally(() => setSaving(false));
  };

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (title.trim()) handleSaveRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [title, body]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
        加载中…
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex overflow-hidden bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <aside className="hidden md:flex md:flex-col w-60 border-r border-slate-200/90 bg-white/85 px-4 py-4 gap-4 text-xs dark:border-slate-800/80 dark:bg-slate-900/70">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/home'))}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-200/90 text-slate-900 hover:bg-slate-300 w-full text-left dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          <i className="fa-solid fa-arrow-left" />
          <span>返回上一步</span>
        </button>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">你的草稿</p>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">本地 & 云端同步</p>
          </div>
          <Link
            to="/editor"
            className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-slate-300 text-slate-800 hover:bg-slate-400 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <i className="fa-solid fa-plus" />
          </Link>
        </div>

        <div className="space-y-2 overflow-y-auto pr-1 flex-1 min-h-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <Link
            to="/articles"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-200/80 text-left dark:text-slate-300 dark:hover:bg-slate-800/70"
          >
            <i className="fa-solid fa-folder-open" />
            <span>文章管理</span>
          </Link>
          {drafts.map((d) => (
            <Link
              key={d.id}
              to={`/editor/${d.id}`}
              className="w-full flex flex-col items-start gap-1 px-3 py-2 rounded-xl hover:bg-slate-200/80 text-slate-800 text-left block dark:hover:bg-slate-800/70 dark:text-slate-200"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-medium line-clamp-1">{d.title || '无标题'}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0">草稿</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{excerpt(d.body)}</p>
            </Link>
          ))}
        </div>

        <div className="mt-auto space-y-3 text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
          <p className="flex items-center gap-2">
            <i className="fa-solid fa-comments text-emerald-600 dark:text-emerald-400" />
            <span>顶部「对话编辑」可随时打开；选中文本后出现快捷入口</span>
          </p>
          <p className="flex items-center gap-2">
            <i className="fa-solid fa-keyboard text-cyan-600 dark:text-cyan-400" />
            <span>支持 Markdown 语法 · Ctrl+S 保存</span>
          </p>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 px-0">
        <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-slate-200/90 bg-white/80 backdrop-blur-sm shrink-0 dark:border-slate-800/80 dark:bg-slate-900/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="输入标题"
                className="bg-transparent focus:outline-none text-sm md:text-base font-medium text-slate-900 placeholder:text-slate-400 w-full max-w-md dark:text-slate-50 dark:placeholder:text-slate-500"
              />
              <p className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                <span>新文章 · 保存后可在文章管理中继续编辑</span>
                <span className="w-1 h-1 rounded-full bg-slate-600 shrink-0" />
                <span className="flex items-center gap-1 shrink-0">
                  <i className="fa-solid fa-hashtag text-emerald-600 dark:text-emerald-300" />
                  <span>写作</span>
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 text-xs shrink-0">
            <button
              type="button"
              onClick={() => {
                setAiSnap({ text: body, range: null });
                setAiOpen(true);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <i className="fa-solid fa-wand-magic-sparkles" />
              <span>对话编辑</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              <i className="fa-solid fa-floppy-disk" />
              <span>{saving ? '保存中…' : '保存'}</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!title.trim()) return;
                setSaving(true);
                try {
                  const r = await api.createArticle({
                    title: title.trim(),
                    body: body.trim(),
                    cover_url: coverUrl.trim() || undefined,
                    category_id: categoryId ?? undefined,
                    tag_ids: tagIds.length ? tagIds : undefined,
                  });
                  await api.updateArticle(r.data.id, {
                    status: 'published',
                    cover_url: coverUrl.trim() || undefined,
                    category_id: categoryId ?? undefined,
                    tag_ids: tagIds.length ? tagIds : undefined,
                  });
                  navigate(`/article/${r.data.id}`);
                } catch (e) {
                  alert(e instanceof Error ? e.message : '发布失败');
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving || !title.trim()}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 disabled:opacity-50"
            >
              <i className="fa-solid fa-paper-plane" />
              <span>发布</span>
            </button>
          </div>
        </header>

        <div className="px-4 md:px-6 py-2 border-b border-slate-200/90 bg-slate-50/90 flex flex-wrap items-center gap-3 text-xs dark:border-slate-800/80 dark:bg-slate-900/40">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-slate-500 shrink-0">封面</span>
            <CoverPreview url={coverUrl} />
            <button
              type="button"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = async () => {
                  const f = input.files?.[0];
                  if (!f) return;
                  try {
                    const url = await api.uploadImage(f);
                    setCoverUrl(url);
                  } catch (e) {
                    alert(e instanceof Error ? e.message : '上传失败');
                  }
                };
                input.click();
              }}
              className="shrink-0 px-2.5 py-1.5 rounded-lg bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {coverUrl.trim() ? '更换' : '上传'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 shrink-0">分类</span>
            <select
              value={categoryId ?? ''}
              onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-xs dark:bg-slate-950 dark:border-slate-700/80 dark:text-slate-200"
            >
              <option value="">选填</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500 shrink-0">标签</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {tags.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTag(t.id)}
                  className={`px-2.5 py-1 rounded-full text-xs transition ${
                    tagIds.includes(t.id)
                      ? 'bg-emerald-500/20 text-emerald-800 border border-emerald-500/50 dark:text-emerald-300'
                      : 'bg-slate-200/80 text-slate-600 hover:bg-slate-300 border border-transparent dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <section className="flex-1 flex overflow-hidden min-h-0" ref={editorWrapRef} onMouseUp={handleEditorMouseUp}>
          <div className="flex-1 flex flex-col min-w-0 px-3 md:px-6 py-3 md:py-4 min-h-0">
            <RichMarkdownEditor
              value={body}
              onChange={(v) => setBody(v ?? '')}
              height={520}
              placeholder="开始写作… 支持 Markdown：标题、列表、粗体、代码块、链接、图片等"
              onUploadImage={api.uploadImage}
              onTextareaReady={(el) => {
                editorTextareaRef.current = el;
              }}
            />
          </div>
        </section>

        {selectionPopup && (
          <div
            className="fixed z-40 px-3 py-1.5 rounded-xl bg-slate-200 border border-slate-400/80 text-slate-800 text-xs shadow-lg flex items-center gap-2 cursor-pointer hover:bg-slate-300 dark:bg-slate-800 dark:border-slate-600/80 dark:text-slate-200 dark:hover:bg-slate-700"
            style={{ left: selectionPopup.left, top: selectionPopup.top }}
            onClick={openAiWithSelection}
          >
            <i className="fa-solid fa-wand-magic-sparkles text-emerald-600 dark:text-emerald-400" />
            <span>对话编辑</span>
          </div>
        )}

        <AIAssistantDialog
          open={aiOpen}
          onClose={() => {
            setAiOpen(false);
            setAiSnap(null);
          }}
          snapshot={aiSnap}
          currentBody={body}
          onApply={(newBody) => setBody(newBody)}
        />
      </main>
    </div>
  );
}
