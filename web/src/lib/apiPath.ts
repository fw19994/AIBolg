/**
 * 与后端 `server.routerPrefix`（Go `config.APIBasePath()`）及 Vite `server.proxy` 对齐。
 * 环境变量：`VITE_API_URL`、`VITE_ROUTER_PREFIX`。
 */

/** 项目路由前缀（不含斜杠），如 inkmind */
export function routerPrefix(): string {
  return (import.meta.env.VITE_ROUTER_PREFIX || '').trim().replace(/^\/+|\/+$/g, '');
}

/** 浏览器侧 API 根路径，如 `/api` 或 `/inkmind/api` */
export function publicApiBasePath(): string {
  const rp = routerPrefix();
  return rp ? `/${rp}/api` : '/api';
}

/**
 * 完整 API 根（含可选直连域名）。
 * - 未设 VITE_API_URL：相对路径，由 Vite dev `proxy` 转发到 Go。
 */
export function apiRoot(): string {
  const base = import.meta.env.VITE_API_URL?.trim();
  const path = publicApiBasePath();
  if (!base) return path;
  return `${base.replace(/\/$/, '')}${path}`;
}
