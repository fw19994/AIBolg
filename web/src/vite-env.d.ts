/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_ROUTER_PREFIX?: string;
  /** 构建时写入，来自 vite.config `base` */
  readonly BASE_URL: string;
  /** 与 OSS 站点子路径一致，如 /inkmind/；根部署不写 */
  readonly VITE_DEPLOY_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
