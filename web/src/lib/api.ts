import { apiRoot } from './apiPath';

const TOKEN_KEY = 'inkmind_token';

/**
 * API 根路径见 `apiPath.ts`（`apiRoot`）。
 * 开发时由 Vite `proxy` 转发；生产环境直连 `VITE_API_URL`（含 SSE）。
 */

export interface Category {
  id: number;
  name: string;
  sort?: number;
}

export interface Tag {
  id: number;
  name: string;
  sort?: number;
}

/** 文章接口中的作者摘要（不含邮箱） */
export interface ArticleAuthor {
  id: number;
  display_name: string;
  avatar_url: string;
  link?: string;
}

export interface Article {
  id: number;
  created_at: string;
  updated_at: string;
  author_id: number;
  /** 详情/列表在 Preload 后返回 */
  author?: ArticleAuthor | null;
  title: string;
  slug: string;
  body: string;
  cover_url: string;
  category_id: number | null;
  category?: Category | null;
  tags?: Tag[];
  status: 'draft' | 'published';
  published_at: string | null;
  /** 列表接口附带：点赞总数 */
  like_count?: number;
  /** 列表接口附带：收藏总数 */
  favorite_count?: number;
}

/** GET /articles/:id 附加互动数据 */
export interface ArticleDetailResponse {
  data: Article;
  like_count: number;
  favorite_count: number;
  liked: boolean;
  favorited: boolean;
}

/** 文章评论（纯文本） */
export interface ArticleComment {
  id: number;
  created_at: string;
  updated_at: string;
  article_id: number;
  user_id: number;
  content: string;
  author?: ArticleAuthor | null;
}

export interface User {
  id: number;
  email?: string;
  created_at: string;
  updated_at: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  link: string;
  /** 城市 / 地区 */
  location?: string;
  /** 公司或组织 */
  company?: string;
  /** GitHub 主页 URL */
  github_url?: string;
  /** X (Twitter) 主页 URL */
  twitter_url?: string;
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  if (typeof window !== 'undefined') localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: HeadersInit = { 'Content-Type': 'application/json', ...options?.headers };
  const token = getToken();
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${apiRoot()}${path}`, { ...options, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || res.statusText);
  return json as T;
}

/** 对话编辑 optimize 流式：delta + 最终 done 带 optimized/benefits（经 Next Route 透传） */
async function fetchEditorOptimizeStream(
  path: string,
  body: object,
  handlers: {
    onDelta: (delta: string) => void;
    onRetrying?: () => void;
    onComplete: (r: { optimized: string; benefits: string }) => void;
    onError?: (message: string) => void;
  }
): Promise<void> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${apiRoot()}${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    const msg = (json as { error?: string }).error || res.statusText;
    handlers.onError?.(msg);
    throw new Error(msg);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    const err = new Error('无法读取响应流');
    handlers.onError?.(err.message);
    throw err;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  const processBlock = (block: string) => {
    for (const line of block.split('\n')) {
      const trimmed = line.trimEnd();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload) continue;
      let data: {
        delta?: string;
        done?: boolean;
        error?: string;
        status?: string;
        optimized?: string;
        benefits?: string;
      };
      try {
        data = JSON.parse(payload);
      } catch {
        continue;
      }
      if (data.error) {
        handlers.onError?.(data.error);
        throw new Error(data.error);
      }
      if (data.status === 'retrying') {
        handlers.onRetrying?.();
        continue;
      }
      if (data.done === true && typeof data.optimized === 'string') {
        handlers.onComplete({
          optimized: data.optimized,
          benefits: typeof data.benefits === 'string' ? data.benefits : '',
        });
        return true;
      }
      if (data.delta) handlers.onDelta(data.delta);
    }
    return false;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      if (processBlock(chunk)) return;
    }
  }
  if (buffer.trim()) {
    if (processBlock(buffer)) return;
  }
  throw new Error('流式响应未返回完成结果');
}

export const api = {
  health: () => request<{ ok: boolean }>('/health'),

  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, display_name?: string) =>
    request<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, display_name }),
    }),

  getMe: () => request<{ data: User }>('/auth/me'),

  listCategories: () => request<{ data: Category[] }>('/categories'),
  listTags: () => request<{ data: Tag[] }>('/tags'),

  listArticles: (params?: { status?: string; category_id?: number; tag_id?: number; author_id?: number }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set('status', params.status);
    if (params?.category_id != null) sp.set('category_id', String(params.category_id));
    if (params?.tag_id != null) sp.set('tag_id', String(params.tag_id));
    if (params?.author_id != null) sp.set('author_id', String(params.author_id));
    const q = sp.toString();
    return request<{ data: Article[] }>(q ? `/articles?${q}` : '/articles');
  },

  getArticle: (id: number) => request<ArticleDetailResponse>(`/articles/${id}`),

  listArticleComments: (articleId: number) =>
    request<{ data: ArticleComment[] }>(`/articles/${articleId}/comments`),

  postArticleComment: (articleId: number, content: string) =>
    request<{ data: ArticleComment }>(`/articles/${articleId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  deleteArticleComment: (articleId: number, commentId: number) =>
    request<{ ok: boolean }>(`/articles/${articleId}/comments/${commentId}`, { method: 'DELETE' }),

  likeArticle: (id: number) =>
    request<{ like_count: number; liked: boolean }>(`/articles/${id}/like`, { method: 'POST' }),

  unlikeArticle: (id: number) =>
    request<{ like_count: number; liked: boolean }>(`/articles/${id}/like`, { method: 'DELETE' }),

  favoriteArticle: (id: number) =>
    request<{ favorite_count: number; favorited: boolean }>(`/articles/${id}/favorite`, { method: 'POST' }),

  unfavoriteArticle: (id: number) =>
    request<{ favorite_count: number; favorited: boolean }>(`/articles/${id}/favorite`, { method: 'DELETE' }),

  /** 当前登录用户收藏的文章列表（需登录） */
  listFavorites: () => request<{ data: Article[] }>('/favorites'),

  createArticle: (body: { title?: string; body?: string; slug?: string; cover_url?: string; category_id?: number | null; tag_ids?: number[] }) =>
    request<{ data: Article }>('/articles', { method: 'POST', body: JSON.stringify(body) }),

  updateArticle: (id: number, body: Partial<{ title: string; body: string; slug: string; cover_url: string; category_id: number | null; tag_ids: number[]; status: string }>) =>
    request<{ data: Article }>(`/articles/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  deleteArticle: (id: number) =>
    request<{ ok: boolean }>(`/articles/${id}`, { method: 'DELETE' }),

  getProfile: () => request<{ data: User | null }>('/profile'),

  getUser: (id: number) => request<{ data: Partial<User> }>(`/users/${id}`),

  updateProfile: (
    body: Partial<{
      display_name: string;
      bio: string;
      avatar_url: string;
      link: string;
      location: string;
      company: string;
      github_url: string;
      twitter_url: string;
    }>,
  ) =>
    request<{ data: User }>('/profile', { method: 'PUT', body: JSON.stringify(body) }),

  /** AI 对话（需登录；可选保留） */
  aiChat: (body: { messages: { role: string; content: string }[]; selected_excerpt?: string }) =>
    request<{ reply: string }>('/ai/chat', { method: 'POST', body: JSON.stringify(body) }),

  /**
   * 阅读页专用：Eino ChatModelAgent（/api/read-agent/chat），与写作 /api/ai/* 完全隔离
   */
  readAgentChat: (body: { article_id: number; messages: { role: string; content: string }[] }) =>
    request<{ reply: string }>('/read-agent/chat', { method: 'POST', body: JSON.stringify(body) }),

  /**
   * 阅读助手 SSE 流式回复（/api/read-agent/chat/stream），边收边回调 delta，结束时 resolve。
   */
  readAgentChatStream: async (
    body: { article_id: number; messages: { role: string; content: string }[] },
    handlers: {
      onDelta: (delta: string) => void;
      onDone?: () => void;
      onError?: (message: string) => void;
    }
  ): Promise<void> => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${apiRoot()}/read-agent/chat/stream`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers,
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      const msg = (json as { error?: string }).error || res.statusText;
      handlers.onError?.(msg);
      throw new Error(msg);
    }

    const reader = res.body?.getReader();
    if (!reader) {
      const err = new Error('无法读取响应流');
      handlers.onError?.(err.message);
      throw err;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    const processBlock = (block: string) => {
      for (const line of block.split('\n')) {
        const trimmed = line.trimEnd();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload) continue;
        let data: { delta?: string; done?: boolean; error?: string };
        try {
          data = JSON.parse(payload) as { delta?: string; done?: boolean; error?: string };
        } catch {
          continue;
        }
        if (data.error) {
          handlers.onError?.(data.error);
          throw new Error(data.error);
        }
        if (data.done) {
          handlers.onDone?.();
          return true;
        }
        if (data.delta) handlers.onDelta(data.delta);
      }
      return false;
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) >= 0) {
        const chunk = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        if (processBlock(chunk)) return;
      }
    }
    if (buffer.trim()) {
      if (processBlock(buffer)) return;
    }
    handlers.onDone?.();
  },

  /** 按对话处理正文（单轮；instruction 为对话中的具体要求，可空则通用修改） */
  aiOptimize: (body: { text: string; instruction?: string }) =>
    request<{ optimized: string; benefits: string }>('/ai/optimize', { method: 'POST', body: JSON.stringify(body) }),

  /** 创建多轮对话会话（可选 article_id 关联当前编辑文章） */
  createAiSession: (body?: { article_id?: number }) =>
    request<{ data: { id: number; article_id: number | null } }>('/ai/sessions', {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),

  getAiSession: (sessionId: number) =>
    request<{
      data: {
        id: number;
        article_id: number | null;
        messages: Array<
          | { id: number; seq: number; role: 'user'; content: string }
          | { id: number; seq: number; role: 'assistant'; optimized: string; benefits: string; content?: string }
        >;
      };
    }>(`/ai/sessions/${sessionId}`),

  /** 多轮对话中的一轮：后端从数据库拼上下文 */
  aiSessionTurn: (sessionId: number, body: { text: string; instruction?: string }) =>
    request<{ optimized: string; benefits: string }>(`/ai/sessions/${sessionId}/turn`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /** 对话编辑单轮流式（Eino Agent SSE，delta + done 含 optimized/benefits） */
  aiOptimizeStream: (
    body: { text: string; instruction?: string },
    handlers: {
      onDelta: (delta: string) => void;
      onRetrying?: () => void;
      onComplete: (r: { optimized: string; benefits: string }) => void;
      onError?: (message: string) => void;
    }
  ) => fetchEditorOptimizeStream('/ai/optimize/stream', body, handlers),

  /** 多轮对话一轮流式（同上，成功后落库） */
  aiSessionTurnStream: (
    sessionId: number,
    body: { text: string; instruction?: string },
    handlers: {
      onDelta: (delta: string) => void;
      onRetrying?: () => void;
      onComplete: (r: { optimized: string; benefits: string }) => void;
      onError?: (message: string) => void;
    }
  ) => fetchEditorOptimizeStream(`/ai/sessions/${sessionId}/turn/stream`, body, handlers),

  /** 上传图片，返回可访问的 URL */
  uploadImage: async (file: File): Promise<string> => {
    const token = getToken();
    if (!token) throw new Error('请先登录');
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${apiRoot()}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as { error?: string }).error || res.statusText);
    return (json as { url: string }).url;
  },
};
