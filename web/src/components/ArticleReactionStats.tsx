import type { Article } from '@/lib/api';

type Props = {
  article: Pick<Article, 'like_count' | 'favorite_count'>;
  className?: string;
  size?: 'xs' | 'sm';
};

/** 展示点赞数、收藏数（用于卡片列表） */
export default function ArticleReactionStats({ article, className = '', size = 'xs' }: Props) {
  const likes = article.like_count ?? 0;
  const favs = article.favorite_count ?? 0;
  const text = size === 'sm' ? 'text-[11px]' : 'text-[9px]';
  const icon = size === 'sm' ? 'text-[10px]' : 'text-[8px]';
  return (
    <span
      className={`inline-flex items-center gap-2.5 tabular-nums text-slate-500 dark:text-slate-400 ${text} ${className}`}
    >
      <span className="inline-flex items-center gap-0.5" title="点赞">
        <i className={`fa-regular fa-heart ${icon}`} />
        {likes}
      </span>
      <span className="inline-flex items-center gap-0.5" title="收藏">
        <i className={`fa-regular fa-bookmark ${icon}`} />
        {favs}
      </span>
    </span>
  );
}
