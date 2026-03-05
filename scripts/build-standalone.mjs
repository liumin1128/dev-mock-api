/**
 * 独立可执行文件构建脚本
 *
 * 流程:
 *   1. pnpm build → 构建 TanStack Start UI
 *   2. 准备 dist/ 目录，复制静态资源
 *   3. 启动 Nitro 生成 index.html
 *   4. esbuild 打包 standalone-entry → dist/standalone.cjs
 *   5. @yao-pkg/pkg 打包为可执行文件
 */
import { execSync, spawn as nodeSpawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')

// 颜色输出
const cyan = (s) => `\x1b[36m${s}\x1b[0m`
const green = (s) => `\x1b[32m${s}\x1b[0m`
const red = (s) => `\x1b[31m${s}\x1b[0m`

function step(n, msg) {
  console.log(`\n${cyan(`[${n}/5]`)} ${msg}`)
}

async function build() {
  const startTime = Date.now()

  // ---- Step 1: 构建 TanStack Start UI ----
  step(1, '构建 UI (TanStack Start)...')
  execSync('pnpm build', { cwd: rootDir, stdio: 'inherit' })

  // ---- Step 2: 准备 dist 目录 ----
  step(2, '准备 dist 目录...')
  fs.rmSync(distDir, { recursive: true, force: true })
  fs.mkdirSync(distDir, { recursive: true })

  // 复制静态资源
  const publicSrc = path.join(rootDir, '.output', 'public')
  const publicDst = path.join(distDir, 'public')
  fs.cpSync(publicSrc, publicDst, { recursive: true })
  console.log('  复制静态资源 → dist/public/')

  // ---- Step 3: 生成 index.html ----
  step(3, '生成 index.html (SSR 预渲染)...')
  await generateIndexHtml()

  // ---- Step 4: esbuild 打包 ----
  step(4, 'esbuild 打包服务端代码...')

  // Banner: 在所有模块代码之前设置环境变量
  const banner = [
    'var __pkg_path=require("path");',
    'var __pkg_isPkg=typeof process.pkg!=="undefined";',
    'var __pkg_appDir=__pkg_isPkg?__pkg_path.dirname(process.execPath):process.cwd();',
    'if(!process.env.MOCK_DATA_FILE)process.env.MOCK_DATA_FILE=__pkg_path.join(__pkg_appDir,"mock-data.json");',
    'if(!process.env.CERT_DIR)process.env.CERT_DIR=__pkg_path.join(__pkg_appDir,".certs");',
  ].join('')

  execSync(
    [
      'npx esbuild scripts/standalone-entry.ts',
      '--bundle',
      '--platform=node',
      '--format=cjs',
      '--target=node20',
      `--banner:js='${banner}'`,
      '--outfile=dist/standalone.cjs',
    ].join(' '),
    { cwd: rootDir, stdio: 'inherit' },
  )

  // Fix: esbuild CJS 输出将 import.meta 替换为空对象 {}
  // 需要修复为正确的 URL，否则 fileURLToPath(import.meta.url) 会报错
  let code = fs.readFileSync(path.join(distDir, 'standalone.cjs'), 'utf-8')
  code = code.replace(
    /var (import_meta\d*)\s*=\s*\{\s*\}/g,
    'var $1 = { url: require("url").pathToFileURL(__filename).href }',
  )
  fs.writeFileSync(path.join(distDir, 'standalone.cjs'), code, 'utf-8')
  console.log('  修复 import.meta.url polyfill')

  // ---- Step 5: pkg 打包 ----
  step(5, 'pkg 打包为可执行文件...')

  // 创建 pkg 专用配置（避免 pkg 扫描整个 node_modules）
  const pkgConfig = {
    name: 'dev-mock-api',
    version: '1.0.0',
    pkg: { assets: ['public/**/*'] },
  }
  fs.writeFileSync(
    path.join(distDir, 'package.json'),
    JSON.stringify(pkgConfig, null, 2),
  )

  // 检测当前平台
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  const platform =
    process.platform === 'darwin'
      ? 'macos'
      : process.platform === 'win32'
        ? 'win'
        : 'linux'
  const target = `node20-${platform}-${arch}`

  execSync(
    `npx @yao-pkg/pkg dist/standalone.cjs --targets ${target} --output dist/dev-mock-api --compress GZip --config dist/package.json`,
    { cwd: rootDir, stdio: 'inherit' },
  )

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('')
  console.log(green('✓ 构建完成!'))
  console.log(`  输出: dist/dev-mock-api`)
  console.log(`  耗时: ${elapsed}s`)
  console.log('')
  console.log('  使用方式:')
  console.log('    ./dist/dev-mock-api')
  console.log('    PORT=8080 ./dist/dev-mock-api')
  console.log('    TARGET=https://api.example.com ./dist/dev-mock-api')
  console.log('')
}

/**
 * 启动 Nitro 服务器，抓取渲染后的 HTML 作为 index.html
 */
async function generateIndexHtml() {
  const nitroEntry = path.join(rootDir, '.output', 'server', 'index.mjs')
  const port = 13579 // 使用不常见端口避免冲突

  const nitro = nodeSpawn('node', [nitroEntry], {
    cwd: rootDir,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  try {
    // 等待服务器就绪（最多 10 秒）
    await waitForServer(`http://localhost:${port}/`, 10000)

    const res = await fetch(`http://localhost:${port}/`)
    if (!res.ok) throw new Error(`Nitro 返回 ${res.status}`)

    let html = await res.text()

    // 修复 API 路径：独立模式下 UI 和 API 在同一端口
    // 移除可能硬编码的 localhost:3000 引用
    html = html.replace(/http:\/\/localhost:3000/g, '')

    const indexPath = path.join(distDir, 'public', 'index.html')
    fs.writeFileSync(indexPath, html, 'utf-8')
    console.log('  index.html 已生成')
  } catch (err) {
    console.error(red('  ✗ 无法从 Nitro 获取 HTML，使用备用模板'))
    generateFallbackHtml()
  } finally {
    nitro.kill()
    // 确保端口释放
    await new Promise((r) => setTimeout(r, 500))
  }
}

/**
 * 等待服务器就绪
 */
async function waitForServer(url, timeout) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(1000) })
      return
    } catch {
      await new Promise((r) => setTimeout(r, 300))
    }
  }
  throw new Error('服务器启动超时')
}

/**
 * 备用 HTML 模板（当 Nitro 抓取失败时使用）
 */
function generateFallbackHtml() {
  const assetsDir = path.join(distDir, 'public', 'assets')
  const files = fs.readdirSync(assetsDir)
  const cssFile = files.find((f) => f.endsWith('.css'))
  const mainJs = files.find((f) => f.startsWith('main-') && f.endsWith('.js'))

  const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})()`

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Dev Mock API</title>
${cssFile ? `<link rel="stylesheet" href="/assets/${cssFile}"/>` : ''}
<script>${themeScript}</script>
</head>
<body>
<div id="root"></div>
${mainJs ? `<script type="module" src="/assets/${mainJs}"></script>` : ''}
</body>
</html>`

  fs.writeFileSync(path.join(distDir, 'public', 'index.html'), html, 'utf-8')
  console.log('  使用备用 HTML 模板')
}

// ---- 执行 ----
build().catch((err) => {
  console.error(red('构建失败:'), err.message)
  process.exit(1)
})
