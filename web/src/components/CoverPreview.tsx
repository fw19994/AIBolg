
import { useEffect, useState } from 'react';

/** 根据封面 URL 展示缩略图（加载失败时提示） */
export default function CoverPreview({ url }: { url: string }) {
  const trimmed = url.trim();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [trimmed]);

  if (!trimmed) return null;

  if (failed) {
    return (
      <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0" title="图片无法加载">
        预览失败
      </span>
    );
  }

  return (
    <div
      className="shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 dark:border-slate-700/80 dark:bg-slate-950 shadow-inner"
      title="封面预览"
    >
      {/* 任意站外/本地上传 URL */}
      <img
        src={trimmed}
        alt=""
        className="w-full h-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
