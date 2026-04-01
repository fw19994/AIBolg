# InkMind

个人知识博客与创作工作台：**Markdown 写作**、**分类与标签**、**点赞 / 收藏 / 评论**，并集成 **AI 辅助写作**与**阅读页 AI 助手**（基于 [CloudWeGo Eino](https://github.com/cloudwego/eino)）。前后端分离，可自建部署。

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Go](https://img.shields.io/badge/Go-1.25+-00ADD8?logo=go)](https://go.dev/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)

## 界面预览

图片来自仓库 [fw19994/AIBolg](https://github.com/fw19994/AIBolg)（`raw.githubusercontent.com` 直链，便于在 GitHub 上渲染）。

![InkMind 界面预览 1](https://raw.githubusercontent.com/fw19994/AIBolg/main/image.png)

![InkMind 界面预览 2](https://raw.githubusercontent.com/fw19994/AIBolg/main/image%20copy.png)

---

## 功能概览

| 模块 | 说明 |
|------|------|
| **博客与文章** | 文章列表（分类 / 标签筛选、搜索）、详情页 Markdown 渲染、封面图 |
| **创作** | 新建 / 编辑文章，富文本与 Markdown 编辑、图片上传（本地或阿里云 OSS） |
| **互动** | 点赞、收藏、文章评论（登录用户） |
| **用户** | 注册 / 登录（JWT）、个人资料、作者主页 |
| **AI** | 写作侧对话式优化、流式输出；阅读侧独立「阅读助手」对话（SSE） |
| **体验** | 明暗主题、响应式布局、静态资源可部署至 OSS/CDN |

`ui/` 目录含早期静态 HTML 原型，可作对照参考。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vite 5、React 18、React Router 6、TypeScript、Tailwind CSS |
| 后端 | Go 1.25+、Gin、GORM、MySQL |
| 鉴权 | JWT（`Authorization: Bearer`） |
| 可选 | 阿里云 OSS 图片存储；OpenAI 兼容 API 用于 AI 能力 |

---

## 环境要求

- **Go** 1.25+
- **Node.js** 18+（推荐 LTS）
- **MySQL** 5.7+ / 8.x

---

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/<你的用户名>/blog.git
cd blog
```

### 2. 后端 API

数据库使用 **MySQL**，配置为 **YAML**。

1. 创建数据库（开发环境示例库名 `inkmind`）。
2. **本地配置**：将 `api/config/config.dev.yaml.example` 复制为 `api/config/config.dev.yaml`，按环境修改数据库与密钥（`config.test.yaml` / `config.prod.yaml` 同理，对应 `APP_ENV`）。  
   **开源仓库只提交 `*.yaml.example` 示例**；真实的 `config.*.yaml` 已列入 `.gitignore`，不会被提交，你本地的配置文件可一直保留、自行维护。
3. 启动：

```bash
cd api
go mod tidy
go run .
```

服务默认监听配置中的端口（示例为 `10001`）。首次启动会执行 GORM **AutoMigrate** 建表。

**环境**：通过环境变量 `APP_ENV` 选择配置文件。

| 环境 | `APP_ENV` | 本地配置文件（需自行从 .example 复制） |
|------|-----------|------------------------------------------|
| 开发 | `dev`（默认） | `api/config/config.dev.yaml` |
| 测试 | `test` | `api/config/config.test.yaml` |
| 生产 | `prod` | `api/config/config.prod.yaml` |

配置片段示例（与 `config.dev.yaml.example` 一致，密码等请用环境变量或本地值替换）：

```yaml
app:
  name: "InkMind-开发版"
  debug: true
  env: "dev"
  logLevel: "debug"
server:
  port: "10001"
  timeout: 30s
  # 可选：routerPrefix: "inkmind"   # API 挂在 /inkmind/api，需与前端 VITE_ROUTER_PREFIX 一致
database:
  driver: "mysql"
  host: "127.0.0.1"
  port: "3306"
  username: "root"
  password: "your_password"
  database: "inkmind"
  options: "charset=utf8mb4&parseTime=True&loc=Local"
  maxOpenConns: 25
  maxIdleConns: 5
  connMaxLifetime: 5m
```

JWT、OSS、AI 等可在同目录配置文件中补充（参见仓库内示例 YAML 注释）。

### 3. 前端

```bash
cd web
npm install
npm run dev
```

浏览器访问 `http://localhost:3000`。开发环境下 Vite 将 `/api` 与 `/inkmind/api` **代理**到本机 Go（默认 `http://localhost:10001` 同路径）。

**常用环境变量**（可参照 `web/.env.development.example`、`web/.env.test.example`）：

| 变量 | 说明 |
|------|------|
| `VITE_API_URL` | 留空则用相对路径 + 代理；生产可填后端完整 origin |
| `VITE_ROUTER_PREFIX` | 与后端 `server.routerPrefix` 一致，子路径部署时必填 |
| `VITE_DEPLOY_BASE` | 前端静态资源 `base`，见 `web/vite.config.ts` |

生产构建产物在 `web/dist/`，可部署到任意静态托管；API 与 SSE 由浏览器直连 Go（需配置 CORS；当前后端示例为 `Access-Control-Allow-Origin: *` 时一般无需额外改前端）。

---

## 目录结构

```
blog/
├── api/                 # Go 后端
│   ├── config/          # YAML：仓库内为 *.yaml.example；本地 config.*.yaml 不入库
│   ├── handlers/        # HTTP 处理（文章、用户、AI、上传等）
│   ├── internal/        # database、seed 等
│   ├── models/          # 数据模型
│   ├── routes/
│   └── main.go
├── web/                 # Vite + React 前端
│   ├── src/
│   └── dist/            # npm run build 产出
├── ui/                  # 静态 HTML 原型（可选）
└── README.md
```

---

## API 概览

基础路径前缀由 `config` 中 `APIBasePath()` 决定，默认可理解为 **`/api`**（若配置了 `routerPrefix` 则为 `/inkmind/api` 等）。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `.../health` | 健康检查 |
| POST | `.../auth/register` | 注册 |
| POST | `.../auth/login` | 登录，返回 JWT |
| GET | `.../auth/me` | 当前用户（需登录） |
| GET | `.../articles` | 文章列表（`status`、`category_id`、`tag_id`、`author_id` 等 query） |
| GET | `.../articles/:id` | 文章详情（含点赞/收藏元数据） |
| POST | `.../articles` | 创建文章（需登录） |
| PATCH | `.../articles/:id` | 更新（需登录且本人） |
| DELETE | `.../articles/:id` | 删除（需登录且本人） |
| POST/DELETE | `.../articles/:id/like` | 点赞 / 取消 |
| POST/DELETE | `.../articles/:id/favorite` | 收藏 / 取消 |
| GET | `.../articles/:id/comments` | 评论列表 |
| POST | `.../articles/:id/comments` | 发表评论（需登录） |
| DELETE | `.../articles/:id/comments/:cid` | 删除评论（本人或文章作者） |
| GET | `.../articles`（草稿）等 | 见路由与鉴权逻辑 |
| GET | `.../profile` | 当前用户资料 |
| PUT | `.../profile` | 更新资料（需登录） |
| GET | `.../users/:id` | 公开作者信息 |
| GET | `.../categories`、`.../tags` | 分类与标签 |
| POST | `.../upload` | 图片上传（需登录） |
| GET | `.../favorites` | 我的收藏（需登录） |
| POST | `.../ai/*`、`.../read-agent/*` 等 | AI 相关（需登录，详见 `routes/routes.go`） |

完整路由以 **`api/routes/routes.go`** 为准。

---

## 测试环境打包与 OSS 部署（示例）

1. 将 `web/.env.test.example` 复制为 **`web/.env.test`**（勿提交密钥），填写 `VITE_API_URL`、`VITE_ROUTER_PREFIX`。
2. 构建：`cd web && npm ci && npm run build:test`，产物在 `web/dist/`。
3. **OSS 静态网站（SPA）**：在 Bucket 中将默认首页与 **404 子路径** 均指向 `index.html`，否则刷新 `/home`、`/article/:id` 会 404。
4. 若站点挂在子路径，先在 `vite.config.ts` 设置 `base` 再构建。
5. 上传 `dist/` 到 OSS；绑定域名并开启 HTTPS（建议 CDN）。

---

## 用户与鉴权

- **注册**：前端 `/register` 或 `POST /api/auth/register`（邮箱 + 密码至少 6 位 + 可选显示名）。
- **登录**：前端 `/login` 或 `POST /api/auth/login`，JWT 存于前端 `localStorage`（键名见 `web/src/lib/api.ts`）。
- **鉴权**：创建/编辑/删除文章、更新资料、上传、AI、评论发表等需携带 `Authorization: Bearer <token>`。

---

## 参与贡献

欢迎 Issue / PR。建议：

1. 先开 Issue 描述场景或 Bug 复现步骤。
2. 提交 PR 时保持改动范围清晰，并说明动机与测试方式。
3. 代码风格与现有项目保持一致（Go：`gofmt`；前端：`npm run lint`）。

---

## 开源许可

本项目采用 **MIT License**（见仓库根目录 [`LICENSE`](LICENSE)）。若尚未添加 `LICENSE` 文件，可自行添加标准 MIT 全文。

---

## 致谢

感谢 [Gin](https://github.com/gin-gonic/gin)、[GORM](https://gorm.io/)、[Vite](https://vitejs.dev/)、[React](https://react.dev/)、[Tailwind CSS](https://tailwindcss.com/) 以及 [CloudWeGo Eino](https://github.com/cloudwego/eino) 等开源项目。

---

<p align="center">
  <b>InkMind</b> — 知识花园 · 用 AI 放大你的表达
</p>
