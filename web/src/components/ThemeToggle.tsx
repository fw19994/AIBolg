import { useTheme, type ThemeChoice } from '@/contexts/ThemeContext';

const choices: { value: ThemeChoice; label: string; icon: string }[] = [
  { value: 'light', label: '浅色', icon: 'fa-sun' },
  { value: 'dark', label: '深色', icon: 'fa-moon' },
  { value: 'system', label: '跟随系统', icon: 'fa-display' },
];

type Props = {
  /** 紧凑：侧栏一行图标；展开：设置页分段按钮 */
  variant?: 'compact' | 'segmented';
  className?: string;
};

export default function ThemeToggle({ variant = 'compact', className = '' }: Props) {
  const { theme, setTheme } = useTheme();

  if (variant === 'segmented') {
    return (
      <div className={`flex flex-wrap gap-2 ${className}`}>
        {choices.map(({ value, label, icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition border ${
              theme === value
                ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-sm'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700'
            }`}
          >
            <i className={`fa-solid ${icon}`} />
            {label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 rounded-xl border border-slate-200/90 bg-slate-100/80 p-0.5 dark:border-slate-700/80 dark:bg-slate-800/60 ${className}`}>
      {choices.map(({ value, icon }) => (
        <button
          key={value}
          type="button"
          title={
            value === 'light' ? '浅色' : value === 'dark' ? '深色' : '跟随系统'
          }
          onClick={() => setTheme(value)}
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs transition ${
            theme === value
              ? 'bg-white text-emerald-600 shadow dark:bg-slate-700 dark:text-emerald-300'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <i className={`fa-solid ${icon}`} />
        </button>
      ))}
    </div>
  );
}
