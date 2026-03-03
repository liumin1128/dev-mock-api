# Dev Mock API - 代理 & Mock 服务器

前端开发用的代理服务器，支持请求记录查看、Pin 响应、手动 Mock。**支持微信开发者工具作为代理使用。**

## 快速使用

```bash
# 正向代理模式（推荐，适配微信开发者工具）
npm start

# 反向代理模式（指定目标服务器）
TARGET=http://api.example.com:8080 npm start

# 指定端口
PORT=5000 npm start

# 开发模式（自动重启）
npm run dev
```

## 两种模式

### 模式一：正向代理（推荐用于微信开发者工具）

不设置 `TARGET`，服务器自动为正向代理模式，支持 HTTP + HTTPS（MITM 中间人解密）。

```bash
npm start
```

### 模式二：反向代理

设置 `TARGET`，所有请求转发到指定服务器。适合在小程序代码中将 `baseUrl` 改为 `http://localhost:4523`。

```bash
TARGET=https://api.example.com npm start
```

## 📱 微信开发者工具配置

### 1. 启动代理服务器

```bash
npm start
```

### 2. 安装 CA 证书

首次启动会自动生成 CA 根证书。需要安装并信任此证书来支持 HTTPS 解密：

**方式一：** 浏览器访问 `http://localhost:4523/__mock-admin/ca.crt` 下载  
**方式二：** 管理面板顶栏点击「🔐 CA证书」下载

**macOS 安装信任：**
```bash
# 方式一：双击 .pem 文件添加到钥匙串，然后在"钥匙串访问"中搜索 "Dev Mock API CA" → 双击 → 信任 → 始终信任
# 方式二：命令行
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain .certs/ca.cert.pem
```

### 3. 配置微信开发者工具

1. 打开微信开发者工具 → **设置** → **代理设置**
2. 选择 **手动设置代理**
3. 填入：地址 `127.0.0.1`，端口 `4523`
4. 确定后所有请求都会经过代理

### 4. 使用管理面板

访问 `http://localhost:4523/__mock-admin`

- **查看请求** - 所有经过代理的 HTTP/HTTPS 请求都会被记录
- **📌 Pin 响应** - 点击记录的 Pin 按钮，冻结该接口返回 mock 数据
- **✏️ 编辑响应** - 手动修改任意接口的返回值
- **+ 新增 Mock** - 直接创建 mock 规则

## 功能

| 功能 | 说明 |
|------|-----|
| 透明代理 | 所有请求原封不动转发到目标服务器 |
| HTTPS MITM | 使用自签 CA 证书解密 HTTPS 流量 |
| 请求记录 | 管理面板展示所有代理过的请求和响应 |
| 📌 Pin 响应 | 将某次请求的真实响应"钉住"作为 mock |
| ✏️ 编辑响应 | 手动修改某个 URL 的返回内容 |
| 持久化 | Mock 规则自动保存到 `mock-data.json` |

## 配置

| 环境变量 | 默认值 | 说明 |
|---------|-------|------|
| `PORT` | `4523` | 代理服务器端口 |
| `TARGET` | (空) | 反向代理目标地址。留空则为正向代理模式 |
