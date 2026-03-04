# 项目预设 — start-app

## 技术栈概览

| 层级         | 技术                                                   | 版本     |
| ------------ | ------------------------------------------------------ | -------- |
| **框架**     | TanStack Start（基于 TanStack Router 的 SSR 全栈框架） | ^1.132.0 |
| **UI 库**    | shadcn/ui（radix-nova 风格，基于 Radix UI + Base UI）  | ^3.8.5   |
| **样式**     | Tailwind CSS v4 + tw-animate-css                       | ^4.0.6   |
| **构建工具** | Vite 7 + Nitro（服务端）                               | ^7.1.7   |
| **语言**     | TypeScript (strict mode)                               | ^5.7.2   |
| **包管理器** | pnpm                                                   | —        |
| **运行时**   | React 19                                               | ^19.2.0  |
| **字体**     | Inter Variable（通过 @fontsource-variable/inter）      | —        |
| **图标**     | lucide-react                                           | ^0.576.0 |
| **测试**     | Vitest + Testing Library                               | —        |
| **代码规范** | ESLint（@tanstack/eslint-config）+ Prettier            | —        |

---

## 目录结构约定

```
src/
├── components/          # 业务组件
│   └── ui/              # shadcn/ui 组件（由 shadcn CLI 生成，勿手动修改）
├── lib/                 # 工具函数（如 cn()）
├── hooks/               # 自定义 hooks（别名 @/hooks）
├── routes/              # TanStack Router 文件路由
│   ├── __root.tsx       # 根布局（HTML shell、全局样式、DevTools）
│   └── index.tsx        # 首页路由 "/"
├── router.tsx           # Router 实例创建
├── routeTree.gen.ts     # 自动生成的路由树（勿手动编辑）
└── styles.css           # 全局样式 + CSS 变量（oklch 色彩系统）
```

---

## 路径别名

在 `tsconfig.json` 中配置，通过 `vite-tsconfig-paths` 插件生效：

```
@/* → ./src/*
```

使用示例：

```ts
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
```

---

## shadcn/ui 配置

- **风格**: `radix-nova`
- **RSC**: 关闭（`rsc: false`）
- **图标库**: `lucide`
- **基础色**: `neutral`（oklch 色彩空间）
- **CSS 变量**: 启用
- **已安装组件**: alert-dialog, badge, button, card, combobox, dropdown-menu, field, input-group, input, label, select, separator, textarea

### 添加新组件

```bash
pnpm dlx shadcn@latest add <component-name>
```

---

## 路由开发（TanStack Router）

- 使用**文件路由**模式，路由文件放在 `src/routes/` 下
- `routeTree.gen.ts` 由 TanStack Router 插件自动生成，**禁止手动编辑**
- 路由通过 `createFileRoute` 创建

### 新建路由示例

```tsx
// src/routes/about.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: AboutPage,
})

function AboutPage() {
  return <div>About</div>
}
```

### 嵌套路由

在 `src/routes/` 下创建文件夹即可，例如：

- `src/routes/dashboard/index.tsx` → `/dashboard`
- `src/routes/dashboard/settings.tsx` → `/dashboard/settings`

---

## Vite 插件顺序

```ts
plugins: [
  devtools(), // TanStack DevTools
  nitro(), // 服务端引擎
  viteTsConfigPaths(), // 路径别名
  tailwindcss(), // Tailwind CSS v4
  tanstackStart(), // TanStack Start
  viteReact(), // React 支持
]
```

---

## 代码风格

### Prettier 配置

- 无分号 (`semi: false`)
- 单引号 (`singleQuote: true`)
- 尾逗号 (`trailingComma: "all"`)

### ESLint 配置

- 使用 `@tanstack/eslint-config` 预设

### 命令

```bash
pnpm run check    # 自动格式化 + lint 修复
pnpm run lint     # 仅 lint
pnpm run format   # 仅格式化
```

---

## 开发命令

```bash
pnpm run dev        # 启动 UI 开发服务器 (端口 3000)
pnpm run proxy      # 启动代理服务器 (端口 4523)
pnpm run proxy:dev  # 启动代理服务器（自动重启模式）
pnpm run build      # 生产构建
pnpm run preview    # 预览生产构建
pnpm run test       # 运行测试
```

### 开发模式双进程

开发时需同时运行两个进程：

1. `pnpm proxy:dev` — 启动代理服务器（端口 4523），处理 HTTP/HTTPS 代理和 Mock
2. `pnpm dev` — 启动 Vite 开发服务器（端口 3000），管理面板 UI

### 微信开发者工具配置

1. 启动代理服务器：`pnpm proxy`
2. 微信开发者工具 → 设置 → 代理设置 → 手动设置代理
3. 代理地址 `127.0.0.1`，端口 `4523`

---

## 项目架构

### 双进程架构

```
┌─────────────────────────┐     ┌───────────────────────────┐
│   TanStack Start (3000) │────►│  Proxy Server (4523)      │
│   管理面板 UI            │ API │  HTTP/HTTPS 代理 + Mock   │
│   shadcn/ui + Router    │     │  Express + MITM           │
└─────────────────────────┘     └───────────────────────────┘
```

- **server/** — 代理服务器（独立 Node.js 进程，tsx 运行）
  - `index.ts` — 入口，HTTP 代理 + HTTPS MITM + Mock 逻辑
  - `mock-store.ts` — Mock 数据管理（持久化到 mock-data.json）
  - `cert-manager.ts` — CA 证书和域名证书管理
  - `api-routes.ts` — 管理 API 端点（带 CORS）
- **src/** — 管理面板 UI（TanStack Start）
  - `lib/api.ts` — API 客户端（自动适配开发/生产环境）
  - `hooks/use-proxy-data.ts` — 数据轮询 hooks
  - `components/` — UI 组件（badges, record-list, mock-editor 等）
  - `routes/index.tsx` — 主页面（Tabs: 请求记录 / Mock 规则）

---

## 主题系统

- 使用 **oklch** 色彩空间定义 CSS 变量
- 支持 **亮色/暗色** 双主题（通过 `.dark` 类切换）
- 圆角基准值：`--radius: 0.625rem`
- 完整变量定义在 `src/styles.css`

---

## 开发注意事项

1. **不要手动编辑** `routeTree.gen.ts`，它由构建工具自动生成
2. **不要手动修改** `src/components/ui/` 下的组件，使用 shadcn CLI 管理
3. 新增工具函数放在 `src/lib/`，自定义 hooks 放在 `src/hooks/`
4. 使用 `cn()` 函数合并 Tailwind 类名（来自 `@/lib/utils`）
5. 样式优先使用 Tailwind CSS 工具类，避免自定义 CSS
6. 组件开发遵循 shadcn/ui 的模式：Compound Components + Slot 模式
7. 此项目为 SSR 全栈框架，注意区分服务端/客户端代码
