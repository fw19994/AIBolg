
import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';

/** 当前要交给对话处理的正文片段（全文或选区） */
export type AiDialogTextSnapshot = {
  text: string;
  /** 非空表示仅替换正文中的该区间 */
  range: { start: number; end: number } | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  snapshot: AiDialogTextSnapshot | null;
  /** 应用替换时用的当前正文（需与编辑器一致） */
  currentBody: string;
  onApply: (newBody: string) => void;
  /** 编辑已有文章时传入，用于会话落库关联 */
  articleId?: number;
};

type TurnBrief = {
  instruction: string;
  benefits: string;
};

export default function AIAssistantDialog({ open, onClose, snapshot, currentBody, onApply, articleId }: Props) {
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [optimized, setOptimized] = useState('');
  const [benefits, setBenefits] = useState('');
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [pastTurns, setPastTurns] = useState<TurnBrief[]>([]);
  /** 流式生成中的原始输出（打字机） */
  const [streamPreview, setStreamPreview] = useState('');
  const [retryingHint, setRetryingHint] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [optimized, benefits, loading, streamPreview]);

  useEffect(() => {
    if (!open) {
      setInstruction('');
      setLoading(false);
      setError('');
      setOptimized('');
      setBenefits('');
      setSessionId(null);
      setSessionLoading(false);
      setSessionError('');
      setPastTurns([]);
      setStreamPreview('');
      setRetryingHint(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSessionLoading(true);
    setSessionError('');
    setSessionId(null);
    const body = articleId != null && Number.isFinite(articleId) ? { article_id: articleId } : undefined;
    api
      .createAiSession(body)
      .then((r) => {
        if (!cancelled) setSessionId(r.data.id);
      })
      .catch((e) => {
        if (!cancelled) setSessionError(e instanceof Error ? e.message : '无法创建会话');
      })
      .finally(() => {
        if (!cancelled) setSessionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, articleId]);

  if (!open) return null;

  /** 全文模式用当前编辑器正文，选区模式用打开时的选区片段（与 range 替换一致） */
  const previewSource = snapshot?.range ? snapshot.text : currentBody;
  const hasDocText = !!previewSource?.trim();

  const runOptimize = async () => {
    if (!snapshot) return;
    const textForApi = snapshot.range ? snapshot.text : currentBody;
    const ins = instruction.trim();
    const hasText = !!textForApi.trim();
    if (!hasText && !ins) {
      setError('请先写正文、选中一段，或在下方输入你的要求后再生成。');
      return;
    }
    if (sessionLoading) {
      setError('正在建立会话…');
      return;
    }
    if (!sessionId && !sessionError) {
      setError('会话未就绪，请稍后重试');
      return;
    }
    setLoading(true);
    setError('');
    setOptimized('');
    setBenefits('');
    setStreamPreview('');
    setRetryingHint(false);
    try {
      const handlers = {
        onDelta: (delta: string) => setStreamPreview((p) => p + delta),
        onRetrying: () => setRetryingHint(true),
        onComplete: (r: { optimized: string; benefits: string }) => {
          setOptimized(r.optimized);
          setBenefits(r.benefits);
          setStreamPreview('');
          setRetryingHint(false);
          if (sessionId) {
            setPastTurns((prev) => [
              ...prev,
              { instruction: ins || '（通用修改）', benefits: r.benefits || '' },
            ]);
          }
        },
        onError: (msg: string) => setError(msg),
      };
      if (sessionId) {
        await api.aiSessionTurnStream(
          sessionId,
          { text: textForApi ?? '', instruction: ins || undefined },
          handlers
        );
      } else {
        await api.aiOptimizeStream({ text: textForApi ?? '', instruction: ins || undefined }, handlers);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!snapshot || !optimized.trim()) return;
    if (snapshot.range) {
      const { start, end } = snapshot.range;
      onApply(currentBody.slice(0, start) + optimized + currentBody.slice(end));
    } else {
      onApply(optimized);
    }
    onClose();
  };

  const modeHint = snapshot?.range
    ? '根据对话处理选中文本，应用后仅替换该段。'
    : !hasDocText
      ? '当前无正文时可先在下方输入要求与助手对话；写好正文后生成将按当前全文处理，应用后写入编辑器。'
      : '根据对话处理全文，应用后替换整篇正文。';
  const preview = previewSource?.slice(0, 400) ?? '';
  const previewMore = (previewSource?.length ?? 0) > 400;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm dark:bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-2xl bg-white border border-slate-200/90 shadow-2xl flex flex-col max-h-[85vh] dark:bg-slate-900 dark:border-slate-700/80"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/90 dark:border-slate-800/80">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <i className="fa-solid fa-comments text-emerald-600 dark:text-emerald-400" />
              对话编辑正文
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{modeHint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 flex items-center justify-center"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[120px]">
          {sessionLoading && (
            <p className="text-xs text-slate-500 flex items-center gap-2">
              <i className="fa-solid fa-spinner fa-spin" />
              正在建立对话会话…
            </p>
          )}
          {sessionError && (
            <div className="rounded-xl px-3 py-2 text-xs bg-amber-500/15 text-amber-900 border border-amber-500/30 dark:text-amber-200">
              {sessionError}（仍可按单次请求处理正文，对话记录不会写入数据库）
            </div>
          )}
          {pastTurns.length > 0 && (
            <div>
              <p className="text-[11px] text-slate-500 mb-1">已进行的对话</p>
              <ul className="space-y-2 max-h-40 overflow-y-auto">
                {pastTurns.map((t, i) => (
                  <li
                    key={i}
                    className="rounded-lg px-2 py-1.5 text-[11px] bg-slate-100 border border-slate-200/90 text-slate-600 dark:bg-slate-950/50 dark:border-slate-800/60 dark:text-slate-400"
                  >
                    <span className="text-slate-500">第 {i + 1} 次 · </span>
                    <span className="text-slate-800 dark:text-slate-300">{t.instruction}</span>
                    {t.benefits ? (
                      <p className="mt-1 text-slate-500 line-clamp-2 whitespace-pre-wrap dark:text-slate-500">{t.benefits}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {hasDocText ? (
            <div>
              <p className="text-[11px] text-slate-500 mb-1">当前正文</p>
              <div className="rounded-xl px-3 py-2 text-xs text-slate-600 bg-slate-50 border border-slate-200/90 whitespace-pre-wrap break-words max-h-28 overflow-y-auto dark:text-slate-400 dark:bg-slate-950/40 dark:border-slate-800/80">
                {preview}
                {previewMore ? '…' : ''}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-600 rounded-xl px-3 py-2 bg-slate-50 border border-slate-200/90 dark:text-slate-500 dark:bg-slate-950/30 dark:border-slate-800/60">
              当前没有选区或正文为空。你仍可在下方直接说明需求与助手对话；需要依据正文修改时，请先写好或选中正文后再点「生成修改」。
            </p>
          )}

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">在对话中说明要如何修改</label>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              disabled={loading}
              rows={3}
              placeholder={
                hasDocText
                  ? '例如：改得更口语化、缩短到一半、突出观点、补充过渡句…\n不填则做通顺、结构清晰的通用修改。'
                  : '无正文时请先在此输入你的问题或写作需求（必填）\n例如：帮我列一篇关于 Go 协程的大纲、用口语介绍 Rust 所有权…'
              }
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50 disabled:opacity-60 resize-y min-h-[72px] dark:bg-slate-950 dark:border-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={runOptimize}
              disabled={
                loading ||
                sessionLoading ||
                (!sessionId && !sessionError) ||
                (!hasDocText && !instruction.trim())
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-wand-magic-sparkles" />}
              {optimized ? '按当前说明重新生成' : '生成修改'}
            </button>
          </div>

          {loading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <i className="fa-solid fa-spinner fa-spin" />
                <span>{streamPreview ? '正在流式生成…' : '正在生成…'}</span>
              </div>
              {retryingHint && (
                <p className="text-[11px] text-amber-300/90 flex items-center gap-1.5">
                  <i className="fa-solid fa-rotate" />
                  正在按约定格式重试，请稍候…
                </p>
              )}
              {streamPreview ? (
                <div>
                  <p className="text-[11px] text-slate-500 mb-1">实时输出（解析完成后展示修改结果）</p>
                  <div className="rounded-xl px-3 py-2 text-[11px] text-slate-800 bg-slate-100 border border-slate-200/90 whitespace-pre-wrap break-words max-h-56 overflow-y-auto font-mono leading-relaxed dark:text-slate-300 dark:bg-slate-950/90 dark:border-slate-800/80">
                    {streamPreview}
                  </div>
                </div>
              ) : null}
            </div>
          )}
          {error && (
            <div className="rounded-xl px-3 py-2 text-xs bg-red-500/15 text-red-800 border border-red-500/30 dark:text-red-300">{error}</div>
          )}
          {!loading && !error && optimized && (
            <>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">修改后的正文</p>
                <div className="rounded-xl px-3 py-2 text-xs text-slate-800 bg-slate-50 border border-slate-200/90 whitespace-pre-wrap break-words max-h-64 overflow-y-auto dark:text-slate-200 dark:bg-slate-950/80 dark:border-slate-800/80">
                  {optimized}
                </div>
              </div>
              {benefits && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">本次修改说明</p>
                  <div className="rounded-xl px-3 py-2 text-xs text-slate-700 bg-slate-100 border border-slate-200/90 whitespace-pre-wrap dark:text-slate-300 dark:bg-slate-800/60 dark:border-slate-700/60">
                    {benefits}
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="p-3 border-t border-slate-200/90 dark:border-slate-800/80 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-xl text-xs bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            关闭
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={loading || !!error || !optimized.trim()}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            应用到文章
          </button>
        </div>
      </div>
    </div>
  );
}
