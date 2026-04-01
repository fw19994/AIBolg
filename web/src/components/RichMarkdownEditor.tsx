
import { lazy, Suspense, useMemo, useRef, useCallback, useEffect } from 'react';
import type { ICommand } from '@uiw/react-md-editor';
import { useTheme } from '@/contexts/ThemeContext';

import '@uiw/react-md-editor/markdown-editor.css';

import { htmlToMarkdown, shouldConvertHtmlPaste } from '@/lib/htmlToMarkdown';

const MDEditor = lazy(() => import('@uiw/react-md-editor'));

const ImageUploadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor" className="shrink-0">
    <path d="M15 9c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm4-7H1c-.55 0-1 .45-1 1v14c0 .55.45 1 1 1h18c.55 0 1-.45 1-1V3c0-.55-.45-1-1-1zm-1 13l-6-5-2 2-4-5-4 8V4h16v11z" />
  </svg>
);

function wordCount(text: string) {
  const t = (text || '').trim().replace(/\s+/g, ' ');
  const chars = t.replace(/\s/g, '').length;
  const words = t.length ? t.split(/\s+/).length : 0;
  return { chars, words };
}

type Props = {
  value: string;
  onChange: (value?: string) => void;
  height?: number;
  placeholder?: string;
  /** 上传图片并返回 URL，不传则仅支持粘贴/选择后插入 URL */
  onUploadImage?: (file: File) => Promise<string>;
  /** 获取编辑器左侧 textarea DOM（用于只在编辑区响应选中） */
  onTextareaReady?: (el: HTMLTextAreaElement | null) => void;
};

export default function RichMarkdownEditor({ value, onChange, height = 400, placeholder, onUploadImage, onTextareaReady }: Props) {
  const { resolved } = useTheme();
  const colorMode = resolved === 'dark' ? 'dark' : 'light';
  const { chars, words } = useMemo(() => wordCount(value || ''), [value]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textApiRef = useRef<{ textArea: HTMLTextAreaElement } | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const insertImageMarkdown = useCallback(
    (url: string, start: number, end: number, currentValue: string) => {
      const snippet = `![](${url})\n`;
      onChange(currentValue.slice(0, start) + snippet + currentValue.slice(end));
    },
    [onChange],
  );

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const cd = e.clipboardData;
      if (!cd) return;

      if (onUploadImage) {
        const items = cd.items;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            e.preventDefault();
            const file = items[i].getAsFile();
            if (!file) return;
            try {
              const url = await onUploadImage(file);
              const ta = e.currentTarget;
              insertImageMarkdown(url, ta.selectionStart, ta.selectionEnd, ta.value);
            } catch (err) {
              console.error('粘贴图片上传失败', err);
            }
            return;
          }
        }
      }

      const html = cd.getData('text/html');
      const plain = cd.getData('text/plain') ?? '';
      if (html && shouldConvertHtmlPaste(html, plain)) {
        try {
          const md = htmlToMarkdown(html);
          if (md.trim().length === 0) return;
          e.preventDefault();
          const ta = e.currentTarget;
          const start = ta.selectionStart;
          const end = ta.selectionEnd;
          const cur = ta.value;
          const insert = md.endsWith('\n') ? `${md}\n` : `${md}\n\n`;
          onChange(cur.slice(0, start) + insert + cur.slice(end));
          const pos = start + insert.length;
          window.setTimeout(() => {
            ta.focus();
            try {
              ta.setSelectionRange(pos, pos);
            } catch {
              /* 受控组件重绘后偶发失败，忽略 */
            }
          }, 0);
        } catch (err) {
          console.error('粘贴 HTML 转 Markdown 失败', err);
        }
      }
    },
    [onUploadImage, insertImageMarkdown, onChange],
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file || !onUploadImage) return;
      const api = textApiRef.current;
      if (!api?.textArea) return;
      try {
        const url = await onUploadImage(file);
        const ta = api.textArea;
        insertImageMarkdown(url, ta.selectionStart, ta.selectionEnd, ta.value);
      } catch (err) {
        console.error('图片上传失败', err);
      }
    },
    [onUploadImage, insertImageMarkdown],
  );

  const imageUploadCommand: ICommand = useMemo(
    () => ({
      name: 'uploadImage',
      keyCommand: 'uploadImage',
      buttonProps: { 'aria-label': '上传图片', title: '上传图片' },
      icon: <ImageUploadIcon />,
      execute: (_state, api) => {
        textApiRef.current = api as unknown as { textArea: HTMLTextAreaElement };
        fileInputRef.current?.click();
      },
    }),
    [],
  );

  const extraCommands = useMemo(
    () => (onUploadImage ? [imageUploadCommand] : []),
    [onUploadImage, imageUploadCommand],
  );

  // @uiw/react-md-editor 内部 textarea 使用自建 ref，不会透传 textareaProps.ref，
  // 因此这里改为通过 DOM 查询来拿到左侧编辑区 textarea。
  useEffect(() => {
    if (!onTextareaReady) return;
    let raf = 0;
    let tries = 0;

    const pick = () => {
      tries += 1;
      const root = editorContainerRef.current;
      const el =
        root?.querySelector<HTMLTextAreaElement>('textarea.w-md-editor-text-input') ||
        root?.querySelector<HTMLTextAreaElement>('textarea[class*="text-input"]') ||
        root?.querySelector<HTMLTextAreaElement>('textarea');
      if (el) {
        onTextareaReady(el);
        return;
      }
      if (tries < 20) raf = window.requestAnimationFrame(pick);
    };

    raf = window.requestAnimationFrame(pick);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [onTextareaReady]);

  return (
    <div className="flex flex-col flex-1 min-h-0 rounded-2xl overflow-hidden border border-slate-200/90 bg-slate-50/80 dark:border-slate-800/80 dark:bg-slate-950/40">
      {onUploadImage && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleFileSelect}
        />
      )}
      <div
        ref={editorContainerRef}
        data-color-mode={colorMode}
        className="flex-1 flex flex-col min-h-0 [&_.w-md-editor]:!bg-white [&_.w-md-editor]:!text-slate-800 dark:[&_.w-md-editor]:!bg-slate-950/60 dark:[&_.w-md-editor]:!text-slate-200 [&_.w-md-editor-toolbar]:!bg-slate-100 [&_.w-md-editor-toolbar]:!border-slate-200/90 dark:[&_.w-md-editor-toolbar]:!bg-slate-900/80 dark:[&_.w-md-editor-toolbar]:!border-slate-800/80 [&_.w-md-editor-area]:!bg-slate-50 dark:[&_.w-md-editor-area]:!bg-slate-950/40 [&_.w-md-editor-preview]:!bg-slate-50 [&_.w-md-editor-preview]:!text-slate-800 dark:[&_.w-md-editor-preview]:!bg-slate-950/60 dark:[&_.w-md-editor-preview]:!text-slate-200 [&_.wmde-markdown]:!bg-transparent"
      >
        <Suspense
          fallback={
            <div className="flex items-center justify-center min-h-[200px] text-slate-400 dark:text-slate-500 text-sm">加载编辑器…</div>
          }
        >
          <MDEditor
            value={value}
            onChange={onChange}
            height={height}
            preview="live"
            visibleDragbar={false}
            enableScroll={true}
            hideToolbar={false}
            extraCommands={extraCommands}
            textareaProps={{
              placeholder: placeholder || '开始写作… 支持 Markdown 语法，左侧编辑、右侧实时预览',
              onPaste: handlePaste,
            }}
          />
        </Suspense>
      </div>
      <div className="flex items-center justify-end gap-2 px-3 py-1.5 border-t border-slate-200/90 bg-white/90 text-[10px] text-slate-500 dark:border-slate-800/80 dark:bg-slate-900/70 dark:text-slate-400">
        <span className="hidden sm:inline-flex items-center gap-1">
          <i className="fa-solid fa-spell-check" />
          <span>AI 语法检查开启</span>
        </span>
        <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-600" />
        <span>字数：{chars} · 词数：{words}</span>
        <>
          <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-600" />
          <span>从网页/文档粘贴可自动转为 Markdown</span>
        </>
        {onUploadImage && (
          <>
            <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-600" />
            <span>支持粘贴或工具栏上传图片</span>
          </>
        )}
      </div>
    </div>
  );
}
