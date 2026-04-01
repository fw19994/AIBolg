import { Link } from 'react-router-dom';
import ThemeToggle from '@/components/ThemeToggle';
import Sidebar from '@/components/Sidebar';

export default function HomePage() {
  return (
    <div className="min-h-screen w-full flex overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 px-0 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative">
        <div className="absolute -top-32 -right-32 w-72 h-72 bg-emerald-500/15 dark:bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-8 w-64 h-64 bg-cyan-500/15 dark:bg-cyan-500/10 rounded-full blur-3xl" />

        <div className="absolute top-4 right-4 md:hidden z-10">
          <ThemeToggle />
        </div>

        <div className="relative h-full flex flex-col md:flex-row">
          <section className="flex-1 px-6 md:px-10 py-8 md:py-12 flex flex-col justify-center space-y-6">
            <p className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/40 dark:text-emerald-300 w-max">
              <i className="fa-solid fa-circle-nodes text-[10px]" />
              <span>AI 驱动 · 个人知识花园</span>
            </p>

            <div className="space-y-4">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold leading-tight text-slate-900 dark:text-slate-100">
                写下一切灵感，
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-cyan-600 to-sky-600 dark:from-emerald-400 dark:via-cyan-400 dark:to-sky-400">
                  让 AI 放大你的思考
                </span>
              </h1>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-300/90 max-w-xl leading-relaxed">
                InkMind 是为「爱写作、爱思考」的你设计的个人博客。
                在这里，你可以用 Markdown 专注写作，再用 AI
                帮你扩写、润色、总结；读者在阅读时，也可以随时向 AI
                提问、获取解释与延伸案例。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/home"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500 text-slate-950 text-sm font-medium shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 transition"
              >
                <i className="fa-solid fa-rocket-launch" />
                <span>进入博客主页</span>
              </Link>
              <Link
                to="/editor"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-slate-300 text-slate-800 text-sm hover:border-slate-400 hover:bg-white/80 dark:border-slate-700 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-900/60 transition"
              >
                <i className="fa-solid fa-pen-to-square" />
                <span>立即开始写作</span>
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 max-w-md text-xs text-slate-600 dark:text-slate-300/90">
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                  <i className="fa-solid fa-feather" />
                  <span>AI 扩写</span>
                </p>
                <p>选中任意段落，一键让 AI 帮你继续写下去。</p>
              </div>
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-cyan-700 dark:text-cyan-300">
                  <i className="fa-solid fa-comments" />
                  <span>阅读问答</span>
                </p>
                <p>读者可针对文章内容向 AI 发问、获取解释。</p>
              </div>
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-sky-700 dark:text-sky-300">
                  <i className="fa-solid fa-layer-group" />
                  <span>知识花园</span>
                </p>
                <p>以主题、标签与时间轴管理你的长期笔记。</p>
              </div>
            </div>
          </section>

          <section className="hidden lg:flex flex-1 items-center justify-center pr-10 pl-2">
            <div className="w-full max-w-md rounded-3xl bg-white/90 border border-slate-200/90 shadow-xl dark:bg-slate-900/90 dark:border-slate-700/80 dark:shadow-2xl overflow-hidden flex flex-col">
              <div className="relative">
                <img
                  src="https://images.pexels.com/photos/1181675/pexels-photo-1181675.jpeg?auto=compress&cs=tinysrgb&w=800"
                  alt="写作与思考的桌面场景"
                  className="w-full h-40 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-100/90 via-slate-50/20 to-transparent dark:from-slate-950/80 dark:via-slate-900/20" />
                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-300">正在编辑</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">打造属于你的 AI 写作空间</p>
                  </div>
                  <span className="px-2 py-1 rounded-full bg-emerald-500/90 text-slate-900 font-medium text-xs">AI Draft</span>
                </div>
              </div>
              <div className="flex-1 flex flex-col p-4 gap-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <i className="fa-regular fa-circle-user text-base" />
                    <span>Fengwei</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-200 text-[11px] text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition">
                      <i className="fa-solid fa-wand-magic-sparkles text-emerald-600 dark:text-emerald-300" />
                      <span>AI 扩写</span>
                    </button>
                    <button type="button" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-300 text-[11px] text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 transition">
                      <i className="fa-solid fa-sparkles text-cyan-600 dark:text-cyan-300" />
                      <span>AI 润色</span>
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 border border-slate-200/90 p-3 space-y-2 dark:bg-slate-900/80 dark:border-slate-700/80">
                  <p className="text-[11px] text-slate-500 uppercase tracking-[0.16em] dark:text-slate-400">Draft · 思考碎片</p>
                  <p className="text-sm text-slate-800 dark:text-slate-50">
                    今天，我想重新定义「写博客」这件事。也许，每一篇文章都不只是完成，而是与过去的自己不断对话……
                  </p>
                  <div className="mt-1 rounded-xl bg-gradient-to-r from-emerald-500/15 via-cyan-500/15 to-sky-500/10 border border-emerald-500/30 px-3 py-2 flex items-start gap-2 text-[11px]">
                    <i className="fa-solid fa-sparkles text-emerald-600 dark:text-emerald-300 mt-0.5" />
                    <p className="text-emerald-900 dark:text-emerald-100">AI 建议：可以举一个你写作习惯改变前后的对比场景，让读者更容易共鸣。</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <i className="fa-regular fa-clock" />
                    <span>预计阅读 6 分钟</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="fa-solid fa-hashtag" />
                    <span>写作 · 知识管理 · AI</span>
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
