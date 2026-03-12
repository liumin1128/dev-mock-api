/**
 * 独立运行入口文件
 * 合并代理服务器 + UI 静态文件服务为单进程
 * 用于 pkg 打包成独立可执行文件
 */
import http from 'http'
import https from 'https'
import tls from 'tls'
import path from 'path'
import { exec } from 'child_process'
import express from 'express'
import type { Request, Response } from 'express'
import { store, type MockResponse } from '../server/mock-store'
import apiRoutes from '../server/api-routes'
import { getCert, getCACertPath, ensureCA } from '../server/cert-manager'

// ============ 配置 ============
const CONFIG = {
  port: parseInt(process.env.PORT || '') || 4523,
  target: process.env.TARGET || '',
  adminPath: '/__mock-admin',
}

// UI 静态文件目录（esbuild 打包后 __dirname 为 dist/）
const publicDir = path.join(__dirname, 'public')

const app = express()

// ---- UI 静态文件服务（置于代理之前） ----
app.use(express.static(publicDir, { fallthrough: true, maxAge: '1d' }))

// ---- CA 证书下载接口 ----
app.get('/__mock-admin/ca.crt', (_req, res) => {
  const certPath = getCACertPath()
  res.download(certPath, 'dev-mock-api-ca.pem')
})

// ---- 管理面板: API（带 CORS） ----
app.use(CONFIG.adminPath + '/api', apiRoutes)

// ---- 核心代理 + Mock 逻辑 ----
app.use((req: Request, res: Response) => {
  const method = req.method.toUpperCase()
  const target = resolveTarget(req)
  if (!target) {
    // 无代理目标时，尝试返回 index.html（SPA 回退）
    res.sendFile(path.join(publicDir, 'index.html'), (err) => {
      if (err) {
        res
          .status(502)
          .json({ error: 'No proxy target', message: '未配置代理目标' })
      }
    })
    return
  }
  const { targetHost, targetPort, targetProtocol, urlPath } = target

  // 先收集请求体，再进行匹配
  collectRequestBody(req, (reqBody) => {
    const mock = store.findMatchingRule(method, urlPath, targetHost, reqBody)
    if (mock) {
      serveMock(req, res, method, urlPath, targetHost, mock.response, reqBody)
      return
    }
    proxyRequest(
      req,
      res,
      method,
      urlPath,
      targetHost,
      targetPort,
      targetProtocol,
    )
  })
})

// ============ 代理辅助函数 ============

interface ProxyTarget {
  targetHost: string
  targetPort: number
  targetProtocol: string
  urlPath: string
}

function resolveTarget(req: Request): ProxyTarget | null {
  // 模式1: 正向 HTTP 代理
  if (req.url.startsWith('http://') || req.url.startsWith('https://')) {
    const parsed = new URL(req.url)
    return {
      targetHost: parsed.hostname,
      targetPort:
        parseInt(parsed.port) || (parsed.protocol === 'https:' ? 443 : 80),
      targetProtocol: parsed.protocol,
      urlPath: parsed.pathname + parsed.search,
    }
  }

  // 模式2: 正向 HTTPS 代理 (经过 CONNECT MITM)
  const socket = req.socket as typeof req.socket & {
    _proxyTargetHost?: string
    _proxyTargetPort?: string
  }
  if (socket._proxyTargetHost) {
    return {
      targetHost: socket._proxyTargetHost,
      targetPort: parseInt(socket._proxyTargetPort || '') || 443,
      targetProtocol: 'https:',
      urlPath: req.originalUrl,
    }
  }

  // 模式3: 反向代理 (TARGET 环境变量)
  if (CONFIG.target) {
    const parsed = new URL(CONFIG.target)
    return {
      targetHost: parsed.hostname,
      targetPort:
        parseInt(parsed.port) || (parsed.protocol === 'https:' ? 443 : 80),
      targetProtocol: parsed.protocol,
      urlPath: req.originalUrl,
    }
  }

  return null
}

function serveMock(
  req: Request,
  res: Response,
  method: string,
  urlPath: string,
  targetHost: string,
  mockResponse: MockResponse,
  reqBody: unknown,
) {
  const statusCode = (mockResponse.statusCode as number) || 200
  const headers = (mockResponse.headers as Record<string, string>) || {}
  const body =
    mockResponse.body !== undefined ? mockResponse.body : mockResponse

  store.addRecord({
    method,
    urlPath,
    targetHost,
    requestHeaders: filterHeaders(req.headers as Record<string, string>),
    requestBody: reqBody ?? null,
    statusCode,
    responseHeaders: headers,
    responseBody: body,
    source: 'mock',
    timestamp: new Date().toISOString(),
  })

  const contentType =
    headers['content-type'] || 'application/json; charset=utf-8'
  res.set('content-type', contentType)
  Object.entries(headers).forEach(([k, v]) => {
    const lk = k.toLowerCase()
    if (
      lk !== 'content-type' &&
      lk !== 'transfer-encoding' &&
      lk !== 'content-length'
    ) {
      res.set(k, v)
    }
  })

  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
  res.status(statusCode).send(bodyStr)
}

function proxyRequest(
  req: Request,
  res: Response,
  method: string,
  urlPath: string,
  targetHost: string,
  targetPort: number,
  targetProtocol: string,
) {
  const isHttps = targetProtocol === 'https:'
  const requester = isHttps ? https : http

  const proxyHeaders = { ...req.headers } as Record<string, string>
  const defaultPort = isHttps ? 443 : 80
  proxyHeaders.host =
    targetHost + (targetPort !== defaultPort ? ':' + targetPort : '')
  delete proxyHeaders['accept-encoding']
  delete proxyHeaders['proxy-connection']
  delete proxyHeaders['proxy-authorization']

  const options = {
    hostname: targetHost,
    port: targetPort,
    path: urlPath,
    method,
    headers: proxyHeaders,
    rejectUnauthorized: false,
  }

  const proxyReq = requester.request(options, (proxyRes) => {
    const responseChunks: Buffer[] = []
    proxyRes.on('data', (chunk: Buffer) => responseChunks.push(chunk))
    proxyRes.on('end', () => {
      const responseBuffer = Buffer.concat(responseChunks)
      let responseBody: unknown
      try {
        responseBody = JSON.parse(responseBuffer.toString('utf-8'))
      } catch {
        responseBody = responseBuffer.toString('utf-8')
      }

      collectRequestBody(req, (reqBody) => {
        store.addRecord({
          method,
          urlPath,
          targetHost,
          requestHeaders: filterHeaders(req.headers as Record<string, string>),
          requestBody: reqBody,
          statusCode: proxyRes.statusCode || 502,
          responseHeaders: filterHeaders(
            proxyRes.headers as Record<string, string>,
          ),
          responseBody,
          source: 'proxy',
          timestamp: new Date().toISOString(),
        })
      })

      const resHeaders = { ...proxyRes.headers } as Record<string, string>
      delete resHeaders['transfer-encoding']
      delete resHeaders['content-length']
      delete resHeaders['content-encoding']
      res.writeHead(proxyRes.statusCode || 502, resHeaders)
      res.end(responseBuffer)
    })
  })

  proxyReq.on('error', (err) => {
    const msg = '[Proxy Error] ' + method + ' ' + targetHost + urlPath
    console.error(msg, '->', err.message)
    store.addRecord({
      method,
      urlPath,
      targetHost,
      requestHeaders: filterHeaders(req.headers as Record<string, string>),
      requestBody: null,
      statusCode: 502,
      responseHeaders: {},
      responseBody: { error: err.message },
      source: 'proxy',
      timestamp: new Date().toISOString(),
    })
    res.status(502).json({ error: 'Proxy Error', message: err.message })
  })

  req.pipe(proxyReq)
}

function collectRequestBody(
  req: Request & { _bodyCollected?: boolean; _collectedBody?: unknown },
  callback: (body: unknown) => void,
) {
  if (req._bodyCollected) {
    callback(req._collectedBody)
    return
  }
  if (req.body !== undefined) {
    req._bodyCollected = true
    req._collectedBody = req.body
    callback(req.body)
    return
  }
  const chunks: Buffer[] = []
  req.on('data', (chunk: Buffer) => chunks.push(chunk))
  req.on('end', () => {
    let body: unknown = Buffer.concat(chunks).toString('utf-8')
    try {
      body = JSON.parse(body as string)
    } catch {
      /* keep as string */
    }
    req._bodyCollected = true
    req._collectedBody = body || null
    callback(body || null)
  })
  if (req.readable === false) {
    req._bodyCollected = true
    req._collectedBody = null
    callback(null)
  }
}

function filterHeaders(headers: Record<string, string>) {
  if (!headers) return {}
  return { ...headers }
}

// ============ 创建服务器 ============
const server = http.createServer(app)

// ---- HTTPS CONNECT 处理（MITM 中间人代理） ----
server.on('connect', (req, clientSocket) => {
  const parts = req.url!.split(':')
  const hostname = parts[0]
  const port = parts[1] || '443'

  try {
    const { key, cert } = getCert(hostname)
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')

    const tlsSocket = new tls.TLSSocket(clientSocket, {
      isServer: true,
      key,
      cert,
    })

    ;(
      tlsSocket as typeof tlsSocket & Record<string, unknown>
    )._proxyTargetHost = hostname
    ;(
      tlsSocket as typeof tlsSocket & Record<string, unknown>
    )._proxyTargetPort = port

    server.emit('connection', tlsSocket)
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[CONNECT Error]', hostname, errMsg)
    clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n')
    clientSocket.end()
  }
})

// ============ 自动打开浏览器 ============
function openBrowser(url: string) {
  const cmd =
    process.platform === 'darwin'
      ? `open "${url}"`
      : process.platform === 'win32'
        ? `start "" "${url}"`
        : `xdg-open "${url}"`
  exec(cmd, () => {})
}

// ============ 启动 ============
ensureCA()
const mode = CONFIG.target ? '反向代理' : '正向代理 (HTTP/HTTPS MITM)'

server.listen(CONFIG.port, () => {
  const url = 'http://localhost:' + CONFIG.port
  console.log('')
  console.log('  =====================================================')
  console.log('       Dev Mock API — Standalone')
  console.log('  =====================================================')
  console.log('  管理面板:  ' + url)
  console.log('  代理地址:  ' + url)
  console.log('  运行模式:  ' + mode)
  if (CONFIG.target) {
    console.log('  目标服务:  ' + CONFIG.target)
  }
  console.log('  管理 API:  ' + url + '/__mock-admin/api')
  console.log('  CA 证书:   ' + url + '/__mock-admin/ca.crt')
  console.log('  =====================================================')
  console.log('  微信开发者工具: 设置 > 代理设置 > 手动设置代理')
  console.log('  代理地址: 127.0.0.1  端口: ' + CONFIG.port)
  console.log('  =====================================================')
  console.log('')

  // 自动打开浏览器
  openBrowser(url)
})
