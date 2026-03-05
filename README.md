# Dev Mock API

一个本地开发用的 HTTP/HTTPS 代理 + Mock 工具，自带可视化管理面板。

开发者将其设为系统/浏览器/微信开发者工具的代理后，即可：

- **实时查看**所有经过代理的 HTTP/HTTPS 请求及响应
- **一键 Mock**：从请求记录中直接 Pin 为 Mock 规则，或手动编辑自定义响应
- **HTTPS 中间人**：自动签发域名证书，解密 HTTPS 流量（需安装 CA 证书）
- **持久化 Mock 规则**：规则保存在 `mock-data.json`，重启不丢失
- **独立可执行文件**：可打包为单文件分发，无需 Node.js 环境

## 架构

```
┌──────────────────────────┐     ┌────────────────────────────┐
│  管理面板 UI (port 3000) │────►│  代理服务器 (port 4523)     │
│  TanStack Start          │ API │  HTTP/HTTPS 代理 + Mock     │
│  shadcn/ui + React 19    │     │  Express + MITM             │
└──────────────────────────┘     └────────────────────────────┘
```

**代理服务器支持三种模式：**

| 模式 | 说明 |
|------|------|
| 正向 HTTP 代理 | 客户端将代理指向 `127.0.0.1:4523` |
| 正向 HTTPS 代理 (MITM) | 自动签发证书解密 HTTPS 流量 |
| 反向代理 | 通过 `TARGET` 环境变量指定后端地址 |

## 快速开始

### 前置要求

- Node.js >= 20
- pnpm

### 安装依赖

```bash
pnpm install
```

### 开发模式

需要同时运行两个进程：

```bash
# 终端 1：启动代理服务器（端口 4523，文件修改自动重启）
pnpm proxy:dev

# 终端 2：启动管理面板 UI（端口 3000）
pnpm dev
```

然后打开 http://localhost:3000 进入管理面板。

### 配置代理

将浏览器或工具的 HTTP 代理设置为：

```
代理地址: 127.0.0.1
端口: 4523
```

#### 微信开发者工具

设置 → 代理设置 → 手动设置代理 → `127.0.0.1:4523`

#### HTTPS 支持

首次启动会自动生成 CA 证书，下载并安装到系统信任列表：

```
http://127.0.0.1:4523/__mock-admin/ca.crt
```

### 反向代理模式

```bash
TARGET=https://api.example.com pnpm proxy
```

## 构建独立可执行文件

打包为单文件，无需 Node.js 即可运行：

```bash
pnpm build:standalone
```

产物在 `dist/dev-mock-api`，使用方式：

```bash
./dist/dev-mock-api                                    # 默认端口 4523
PORT=8080 ./dist/dev-mock-api                          # 自定义端口
TARGET=https://api.example.com ./dist/dev-mock-api     # 反向代理模式
```

## CI/CD

项目配置了 GitHub Actions，每次 push 到 `main` 分支自动构建三平台可执行文件：

| 平台 | 架构 | 产物 |
|------|------|------|
| Linux | x64 | `dev-mock-api-linux-x64.tar.gz` |
| macOS | arm64 | `dev-mock-api-macos-arm64.tar.gz` |
| Windows | x64 | `dev-mock-api-win-x64.zip` |

- **每次 push** → GitHub Actions Artifacts 中下载
- **打 tag**（如 `git tag v1.0.0 && git push origin v1.0.0`）→ 自动发布到 GitHub Releases

## 所有命令

```bash
pnpm dev            # 启动 UI 开发服务器 (端口 3000)
pnpm proxy          # 启动代理服务器 (端口 4523)
pnpm proxy:dev      # 启动代理服务器（文件修改自动重启）
pnpm build          # 生产构建 UI
pnpm build:standalone  # 打包独立可执行文件
pnpm preview        # 预览生产构建
pnpm test           # 运行测试
pnpm check          # 格式化 + lint 修复
```

## 技术栈

- **UI**：TanStack Start + React 19 + shadcn/ui + Tailwind CSS v4
- **代理服务器**：Express + Node.js 原生 HTTP/HTTPS + MITM
- **证书管理**：node-forge（自动生成 CA + 域名证书）
- **构建**：Vite 7 + esbuild + @yao-pkg/pkg
- **语言**：TypeScript (strict mode)
