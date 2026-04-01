import { lazy, Suspense, useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

import '@uiw/react-markdown-preview/markdown.css';

const MarkdownPreview = lazy(() =>
  import('@uiw/react-markdown-preview').then((m) => ({ default: m.default })),
);

/** 侧栏内 Markdown：暗色 */
const assistantMarkdownClass =
  '!bg-transparent !text-slate-300 text-[11px] leading-relaxed max-w-none ' +
  '[&_.wmde-markdown]:!text-[11px] [&_.wmde-markdown]:!leading-relaxed ' +
  '[&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 ' +
  '[&_h1]:text-sm [&_h2]:text-[13px] [&_h3]:text-[12px] [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_h1]:mt-3 [&_h1]:mb-2 ' +
  '[&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-[10px] sm:[&_table]:text-[11px] ' +
  '[&_th]:border [&_th]:border-slate-600/90 [&_th]:px-1.5 [&_th]:py-1 [&_th]:font-semibold [&_th]:bg-slate-800/70 [&_th]:whitespace-nowrap ' +
  '[&_td]:border [&_td]:border-slate-700/70 [&_td]:px-1.5 [&_td]:py-1 [&_td]:align-top [&_td]:break-words ' +
  '[&_tr:nth-child(even)_td]:bg-slate-900/35 ' +
  '[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-950/90 [&_pre]:p-2 [&_pre]:text-[10px] ' +
  '[&_code]:rounded [&_code]:bg-slate-800/80 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[10px] ' +
  '[&_blockquote]:border-l-2 [&_blockquote]:border-slate-600 [&_blockquote]:pl-2 [&_blockquote]:text-slate-400 ' +
  '[&_strong]:text-slate-100 [&_a]:text-emerald-400 [&_a]:underline [&_a]:break-all ' +
  '[&_hr]:border-slate-700';

const assistantMarkdownClassLight =
  '!bg-transparent !text-slate-700 text-[11px] leading-relaxed max-w-none ' +
  '[&_.wmde-markdown]:!text-[11px] [&_.wmde-markdown]:!leading-relaxed ' +
  '[&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 ' +
  '[&_h1]:text-sm [&_h2]:text-[13px] [&_h3]:text-[12px] [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_h1]:mt-3 [&_h1]:mb-2 ' +
  '[&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-[10px] sm:[&_table]:text-[11px] ' +
  '[&_th]:border [&_th]:border-slate-300 [&_th]:px-1.5 [&_th]:py-1 [&_th]:font-semibold [&_th]:bg-slate-100 [&_th]:whitespace-nowrap ' +
  '[&_td]:border [&_td]:border-slate-200 [&_td]:px-1.5 [&_td]:py-1 [&_td]:align-top [&_td]:break-words ' +
  '[&_tr:nth-child(even)_td]:bg-slate-50 ' +
  '[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-100 [&_pre]:p-2 [&_pre]:text-[10px] ' +
  '[&_code]:rounded [&_code]:bg-slate-200 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[10px] ' +
  '[&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-2 [&_blockquote]:text-slate-600 ' +
  '[&_strong]:text-slate-900 [&_a]:text-emerald-700 [&_a]:underline [&_a]:break-all ' +
  '[&_hr]:border-slate-200';

const assistantMarkdownClassExpanded =
  '!bg-transparent !text-slate-300 text-[12px] leading-relaxed max-w-none ' +
  '[&_.wmde-markdown]:!text-[12px] [&_.wmde-markdown]:!leading-relaxed ' +
  '[&_p]:mb-2.5 [&_p:last-child]:mb-0 [&_ul]:my-2.5 [&_ol]:my-2.5 [&_li]:my-1 ' +
  '[&_h1]:text-base [&_h2]:text-[15px] [&_h3]:text-sm [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2 ' +
  '[&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-[11px] sm:[&_table]:text-[12px] ' +
  '[&_th]:border [&_th]:border-slate-600/90 [&_th]:px-2 [&_th]:py-1.5 [&_th]:font-semibold [&_th]:bg-slate-800/70 [&_th]:whitespace-nowrap ' +
  '[&_td]:border [&_td]:border-slate-700/70 [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top [&_td]:break-words ' +
  '[&_tr:nth-child(even)_td]:bg-slate-900/35 ' +
  '[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-950/90 [&_pre]:p-2.5 [&_pre]:text-[11px] ' +
  '[&_code]:rounded [&_code]:bg-slate-800/80 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[11px] ' +
  '[&_blockquote]:border-l-2 [&_blockquote]:border-slate-600 [&_blockquote]:pl-2 [&_blockquote]:text-slate-400 ' +
  '[&_strong]:text-slate-100 [&_a]:text-emerald-400 [&_a]:underline [&_a]:break-all ' +
  '[&_hr]:border-slate-700';

const assistantMarkdownClassExpandedLight =
  '!bg-transparent !text-slate-700 text-[12px] leading-relaxed max-w-none ' +
  '[&_.wmde-markdown]:!text-[12px] [&_.wmde-markdown]:!leading-relaxed ' +
  '[&_p]:mb-2.5 [&_p:last-child]:mb-0 [&_ul]:my-2.5 [&_ol]:my-2.5 [&_li]:my-1 ' +
  '[&_h1]:text-base [&_h2]:text-[15px] [&_h3]:text-sm [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2 ' +
  '[&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-[11px] sm:[&_table]:text-[12px] ' +
  '[&_th]:border [&_th]:border-slate-300 [&_th]:px-2 [&_th]:py-1.5 [&_th]:font-semibold [&_th]:bg-slate-100 [&_th]:whitespace-nowrap ' +
  '[&_td]:border [&_td]:border-slate-200 [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top [&_td]:break-words ' +
  '[&_tr:nth-child(even)_td]:bg-slate-50 ' +
  '[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-100 [&_pre]:p-2.5 [&_pre]:text-[11px] ' +
  '[&_code]:rounded [&_code]:bg-slate-200 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[11px] ' +
  '[&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-2 [&_blockquote]:text-slate-600 ' +
  '[&_strong]:text-slate-900 [&_a]:text-emerald-700 [&_a]:underline [&_a]:break-all ' +
  '[&_hr]:border-slate-200';

type Msg = { role: 'user' | 'assistant'; content: string };

type Props = {
  articleId: number;
  expanded?: boolean;
  onToggleExpand?: () => void;
};

export default function ReadAgentPanel({ articleId, expanded = false, onToggleExpand }: Props) {
  const { resolved } = useTheme();
  const colorMode = resolved === 'dark' ? 'dark' : 'light';
  const mdClass = expanded
    ? resolved === 'dark'
      ? assistantMarkdownClassExpanded
      : assistantMarkdownClassExpandedLight
    : resolved === 'dark'
      ? assistantMarkdownClass
      : assistantMarkdownClassLight;

  const { user, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, loading]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setError('');
    setInput('');
    const payload: Msg[] = [...messages, { role: 'user', content: q }];
    setMessages([...payload, { role: 'assistant', content: '' }]);
    setLoading(true);
    try {
      await api.readAgentChatStream(
        {
          article_id: articleId,
          messages: payload.map((m) => ({ role: m.role, content: m.content })),
        },
        {
          onDelta: (delta) => {
            setMessages((prev) => {
              const copy = [...prev];
              const i = copy.length - 1;
              const last = copy[i];
              if (last?.role === 'assistant') {
                copy[i] = { ...last, content: last.content + delta };
              }
              return copy;
            });
          },
        }
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
      setMessages((prev) => prev.slice(0, -2));
      setInput(q);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center px-3 py-6 text-[11px] text-slate-500">
        <i className="fa-solid fa-spinner fa-spin mr-2" />
        加载中…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-y-auto px-3 py-3 gap-3">
        <div className="flex items-center justify-between border-b border-slate-200/90 dark:border-slate-800/80 pb-2 text-[11px] shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
            <i className="fa-solid fa-book-open-reader" />
            <span>阅读助手</span>
          </div>
        </div>
        <div className="text-[11px] text-slate-700 bg-slate-100 border border-slate-200/90 rounded-2xl px-3 py-2 dark:text-slate-300 dark:bg-slate-950/60 dark:border-slate-800/80">
          <p className="flex items-center gap-2 mb-1 text-slate-500 dark:text-slate-400">
            <i className="fa-solid fa-lock text-amber-600 dark:text-amber-400/90" />
            <span>需要登录</span>
          </p>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">登录后可基于当前文章提问（与写作页 AI 无关）。</p>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 mt-2 text-emerald-700 hover:underline text-[11px] dark:text-emerald-400"
          >
            去登录 <i className="fa-solid fa-arrow-right text-[10px]" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200/90 dark:border-slate-800/80 text-[11px] shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="px-3 py-1.5 rounded-full flex items-center gap-1.5 bg-emerald-500 text-slate-950 font-medium shrink-0">
            <i className="fa-solid fa-book-open-reader" />
            <span>阅读助手</span>
          </span>
        </div>
        {onToggleExpand && (
          <button
            type="button"
            onClick={onToggleExpand}
            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-200 text-slate-800 hover:bg-slate-300 border border-slate-300/80 transition dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-700 dark:border-slate-700/80"
            aria-label={expanded ? '收起为侧栏宽度' : '展开宽屏阅读'}
            title={expanded ? '收起' : '展开宽屏阅读'}
          >
            <i className={`fa-solid ${expanded ? 'fa-compress' : 'fa-expand'} text-[10px]`} />
            <span className="hidden sm:inline">{expanded ? '收起' : '展开'}</span>
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col px-3 py-3 gap-3 overflow-hidden min-h-0">
        <div className="text-[11px] text-slate-700 bg-slate-100 border border-slate-200/90 rounded-2xl px-3 py-2 shrink-0 dark:text-slate-300 dark:bg-slate-950/60 dark:border-slate-800/80">
          <p className="flex items-center gap-2 mb-1">
            <i className="fa-solid fa-circle-nodes text-emerald-600 dark:text-emerald-300" />
            <span>当前文章</span>
          </p>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">基于正文答疑、摘要与概念解释，与编辑器「对话编辑」不是同一套能力。</p>
        </div>

        <div
          ref={messagesScrollRef}
          className="flex-1 rounded-2xl bg-white border border-slate-200/90 p-3 overflow-y-auto overflow-x-auto space-y-3 min-h-0 overscroll-contain dark:bg-slate-950/70 dark:border-slate-800/80"
        >
          {messages.length === 0 && (
            <p className="text-[11px] text-slate-500 leading-relaxed">
              例如：这篇文章的核心观点是什么？某段提到的概念指什么？
            </p>
          )}
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[92%] bg-slate-200 rounded-xl px-3 py-2 text-[11px] leading-relaxed text-slate-800 whitespace-pre-wrap break-words dark:bg-slate-800/90 dark:text-slate-200">
                  {m.content}
                </p>
              </div>
            ) : (
              <div key={i} className="space-y-1 text-[11px] text-slate-900 min-w-0 dark:text-slate-100">
                <p className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                  <i className="fa-solid fa-book-open-reader text-xs" />
                  <span>阅读助手</span>
                </p>
                <div
                  className="bg-slate-50 rounded-xl px-3 py-2 min-w-0 max-w-full overflow-x-auto dark:bg-slate-900/80"
                  data-color-mode={colorMode}
                >
                  <Suspense fallback={<span className="text-slate-500">…</span>}>
                    <MarkdownPreview
                      source={m.content}
                      wrapperElement={{ 'data-color-mode': colorMode }}
                      style={{ background: 'transparent', color: 'inherit' }}
                      className={mdClass}
                    />
                  </Suspense>
                </div>
              </div>
            )
          )}
          {loading && (
            <p className="text-[11px] text-slate-500 flex items-center gap-2">
              <i className="fa-solid fa-spinner fa-spin" />
              思考中…
            </p>
          )}
        </div>

        {error && (
          <div className="text-[11px] text-red-700 dark:text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2 shrink-0">
            {error}
          </div>
        )}

        <div className="rounded-2xl bg-slate-100 border border-slate-200/90 px-3 py-2 flex items-end gap-2 text-[11px] shrink-0 dark:bg-slate-950/80 dark:border-slate-800/80">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={loading}
            rows={2}
            className="flex-1 bg-transparent focus:outline-none resize-none text-slate-900 placeholder:text-slate-400 text-[11px] min-h-[40px] max-h-28 leading-relaxed dark:text-slate-100 dark:placeholder:text-slate-500"
            placeholder="向阅读助手提问：例如「总结第二段大意」"
          />
          <button
            type="button"
            onClick={send}
            disabled={loading || !input.trim()}
            className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="发送"
          >
            <i className="fa-solid fa-paper-plane text-xs" />
          </button>
        </div>
      </div>
    </div>
  );
}
