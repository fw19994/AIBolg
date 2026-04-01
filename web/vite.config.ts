import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/** 与 OSS/静态托管上的站点路径一致，如站点为 https://a.com/blog/ 则设为 /blog/；根路径部署可省略 */
function deployBase(mode: string): string {
  const env = loadEnv(mode, process.cwd(), '');
  const raw = env.VITE_DEPLOY_BASE?.trim();
  if (!raw || raw === '/') return '/';
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return withSlash.endsWith('/') ? withSlash : `${withSlash}/`;
}

export default defineConfig(({ mode }) => ({
  base: deployBase(mode),
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': { target: 'http://localhost:10001', changeOrigin: true },
      '/inkmind/api': { target: 'http://localhost:10001', changeOrigin: true },
    },
  },
}));
