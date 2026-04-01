
import { useState } from 'react';

type Props = {
  body: string;
  activeTab?: 'ai' | 'preview';
  onTabChange?: (tab: 'ai' | 'preview') => void;
};

export default function EditorRightPanel({ body, activeTab: controlledTab, onTabChange }: Props) {
  const [localTab, setLocalTab] = useState<'ai' | 'preview'>('ai');
  const tab = controlledTab !== undefined ? controlledTab : localTab;
  const setTab = (t: 'ai' | 'preview') => {
    if (controlledTab === undefined) setLocalTab(t);
    onTabChange?.(t);
  };

  const tabIdle = 'bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

  return (
    <aside className="hidden lg:flex lg:flex-col w-80 bg-white/90 border-l border-slate-200/90 dark:bg-slate-900/70 dark:border-slate-800/80">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200/90 dark:border-slate-800/80 text-[11px]">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTab('ai')}
            className={`px-3 py-1.5 rounded-full flex items-center gap-1 transition ${
              tab === 'ai' ? 'bg-emerald-500 text-slate-950 font-medium' : tabIdle
            }`}
          >
            <i className="fa-solid fa-wand-magic-sparkles" />
            <span>AI 助手</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('preview')}
            className={`px-3 py-1.5 rounded-full flex items-center gap-1 transition ${
              tab === 'preview' ? 'bg-emerald-500 text-slate-950 font-medium' : tabIdle
            }`}
          >
            预览
          </button>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <i className="fa-solid fa-gear" />
        </button>
      </div>

      <div className="flex-1 flex flex-col px-3 py-3 gap-3 overflow-hidden">
        {tab === 'ai' && (
          <>
            <div className="text-[11px] text-slate-700 bg-slate-100 border border-slate-200/90 rounded-2xl px-3 py-2 shrink-0 dark:text-slate-300 dark:bg-slate-950/60 dark:border-slate-800/80">
              <p className="flex items-center gap-2 mb-1">
                <i className="fa-solid fa-circle-nodes text-emerald-600 dark:text-emerald-300" />
                <span>当前上下文</span>
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                AI 会基于当前文档内容与你选中的段落，给出扩写 / 改写 / 总结建议。（功能后续接入）
              </p>
            </div>

            <div className="flex-1 rounded-2xl bg-white border border-slate-200/90 p-3 overflow-y-auto space-y-3 min-h-0 dark:bg-slate-950/70 dark:border-slate-800/80">
              <div className="space-y-1 text-[11px] text-slate-900 dark:text-slate-100">
                <p className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                  <i className="fa-solid fa-wand-magic-sparkles text-xs" />
                  <span>扩写建议</span>
                </p>
                <p className="bg-slate-100 rounded-xl px-3 py-2 leading-relaxed text-slate-700 dark:bg-slate-900/80 dark:text-slate-300" data-copy-source>
                  选中段落后点击「扩写」或在此输入指令，AI 将给出扩写建议。接入 AI 服务后可在此展示并支持复制、应用到正文。
                </p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.querySelector('[data-copy-source]');
                      if (el && navigator.clipboard) navigator.clipboard.writeText(el.textContent || '');
                    }}
                    className="px-2 py-0.5 rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-slate-900 dark:hover:bg-slate-800 flex items-center gap-1"
                  >
                    <i className="fa-solid fa-copy text-slate-600 dark:text-slate-300" />
                    <span>复制</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-100 border border-slate-200/90 px-3 py-2 flex items-center gap-2 text-[11px] shrink-0 dark:bg-slate-950/80 dark:border-slate-800/80">
              <textarea
                rows={1}
                className="flex-1 bg-transparent focus:outline-none resize-none text-slate-900 placeholder:text-slate-400 min-h-[32px] dark:text-slate-100 dark:placeholder:text-slate-500"
                placeholder="向 AI 提问：例如「帮我把上一个自然段改写得更简洁一点」"
                readOnly
              />
              <button
                type="button"
                className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition"
              >
                <i className="fa-solid fa-paper-plane text-xs" />
              </button>
            </div>
          </>
        )}

        {tab === 'preview' && (
          <div className="flex-1 overflow-y-auto rounded-2xl bg-white border border-slate-200/90 p-4 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap dark:bg-slate-950/70 dark:border-slate-800/80 dark:text-slate-200">
            {body || '（暂无内容）'}
          </div>
        )}
      </div>
    </aside>
  );
}
