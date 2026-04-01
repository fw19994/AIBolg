import { useEffect, useRef, useState } from 'react';
import { api, type User } from '@/lib/api';

const defaultAvatar = 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=200';

type Props = {
  open: boolean;
  onClose: () => void;
  user: User | null;
  onSaved: (u: User) => void;
};

export default function ProfileEditModal({ open, onClose, user, onSaved }: Props) {
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    display_name: '',
    bio: '',
    avatar_url: '',
    link: '',
    location: '',
    company: '',
    github_url: '',
    twitter_url: '',
  });

  useEffect(() => {
    if (!open || !user) return;
    setForm({
      display_name: user.display_name ?? '',
      bio: user.bio ?? '',
      avatar_url: user.avatar_url ?? '',
      link: user.link ?? '',
      location: user.location ?? '',
      company: user.company ?? '',
      github_url: user.github_url ?? '',
      twitter_url: user.twitter_url ?? '',
    });
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarUploading(true);
    api
      .uploadImage(file)
      .then((url) => setForm((f) => ({ ...f, avatar_url: url })))
      .catch((err) => alert(err instanceof Error ? err.message : '上传失败'))
      .finally(() => setAvatarUploading(false));
  };

  const handleSave = () => {
    setSaving(true);
    api
      .updateProfile(form)
      .then((r) => {
        if (r.data) onSaved(r.data);
        onClose();
      })
      .catch((e) => alert(e.message || '保存失败'))
      .finally(() => setSaving(false));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="关闭"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-black/60"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-edit-title"
        className="relative z-10 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200/90 bg-white shadow-xl dark:border-slate-700/80 dark:bg-slate-900"
      >
        <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-slate-200/90 bg-white/95 px-4 py-3 backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/95">
          <h2 id="profile-edit-title" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            编辑个人资料
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="space-y-4 p-4 text-xs">
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/90 px-3 py-3 space-y-3 dark:border-slate-800/80 dark:bg-slate-950/50">
            <p className="text-sm font-medium flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <i className="fa-regular fa-id-card text-cyan-600 dark:text-cyan-300" />
              <span>个人资料</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex flex-col items-start gap-2">
                <span className="text-[11px] text-slate-600 dark:text-slate-300">头像</span>
                <img
                  src={form.avatar_url || defaultAvatar}
                  alt=""
                  className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700/80"
                />
                <input
                  ref={avatarFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="sr-only"
                  onChange={handleAvatarFile}
                />
                <button
                  type="button"
                  disabled={avatarUploading || saving}
                  onClick={() => avatarFileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-900 text-[11px] font-medium hover:bg-slate-50 disabled:opacity-50 dark:bg-slate-950/80 dark:border-slate-700/80 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  <i className="fa-solid fa-cloud-arrow-up text-[11px]" />
                  {avatarUploading ? '上传中…' : '上传头像'}
                </button>
              </div>
              <div className="flex-1 space-y-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-slate-600 dark:text-slate-300">显示名称</span>
                  <input
                    type="text"
                    value={form.display_name}
                    onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                    placeholder="读者看到的名称"
                    className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-400/70 dark:bg-slate-950/80 dark:border-slate-700/80 dark:text-slate-100"
                  />
                </label>
              </div>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-slate-600 dark:text-slate-300">个人简介</span>
              <textarea
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                rows={4}
                placeholder="介绍你自己，会展示在作者主页"
                className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-400/70 resize-none dark:bg-slate-950/80 dark:border-slate-700/80 dark:text-slate-100"
              />
            </label>
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-slate-50/90 px-3 py-3 space-y-3 dark:border-slate-800/80 dark:bg-slate-950/50">
            <p className="text-sm font-medium flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <i className="fa-solid fa-link text-sky-600 dark:text-sky-300" />
              <span>个人链接</span>
            </p>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-slate-600 dark:text-slate-300">网站 / 博客</span>
              <input
                type="url"
                value={form.link}
                onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
                placeholder="https://..."
                className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-400/70 dark:bg-slate-950/80 dark:border-slate-700/80 dark:text-slate-100"
              />
            </label>
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-slate-50/90 px-3 py-3 space-y-3 dark:border-slate-800/80 dark:bg-slate-950/50">
            <p className="text-sm font-medium flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <i className="fa-solid fa-location-dot text-amber-600 dark:text-amber-400" />
              <span>更多资料</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-slate-600 dark:text-slate-300">城市 / 地区</span>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="例如：上海"
                  className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-400/70 dark:bg-slate-950/80 dark:border-slate-700/80 dark:text-slate-100"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-slate-600 dark:text-slate-300">公司 / 组织</span>
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="选填"
                  className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-400/70 dark:bg-slate-950/80 dark:border-slate-700/80 dark:text-slate-100"
                />
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <i className="fa-brands fa-github text-[13px]" />
                  GitHub
                </span>
                <input
                  type="url"
                  value={form.github_url}
                  onChange={(e) => setForm((f) => ({ ...f, github_url: e.target.value }))}
                  placeholder="https://github.com/用户名"
                  className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-400/70 dark:bg-slate-950/80 dark:border-slate-700/80 dark:text-slate-100"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <i className="fa-brands fa-x-twitter text-[13px]" />
                  X (Twitter)
                </span>
                <input
                  type="url"
                  value={form.twitter_url}
                  onChange={(e) => setForm((f) => ({ ...f, twitter_url: e.target.value }))}
                  placeholder="https://x.com/…"
                  className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-400/70 dark:bg-slate-950/80 dark:border-slate-700/80 dark:text-slate-100"
                />
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 text-slate-800 text-sm font-medium hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || avatarUploading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-sm font-medium hover:bg-emerald-400 disabled:opacity-50"
            >
              <i className="fa-solid fa-floppy-disk" />
              <span>{saving ? '保存中…' : '保存'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
