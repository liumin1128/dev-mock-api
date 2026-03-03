const http = require("http");
const https = require("https");
const tls = require("tls");
const express = require("express");
const path = require("path");
const { URL } = require("url");
const store = require("./src/mock-store");
const apiRoutes = require("./src/api-routes");
const certManager = require("./src/cert-manager");

// ============ 配置 ============
const CONFIG = {
  port: parseInt(process.env.PORT) || 4523,
  target: process.env.TARGET || "",
  adminPath: "/__mock-admin",
};

const app = express();

// ---- 管理面板: 静态页面 ----
app.use(CONFIG.adminPath, express.static(path.join(__dirname, "public")));

// ---- 管理面板: API ----
app.use(CONFIG.adminPath + "/api", apiRoutes);

// ---- CA 证书下载接口 ----
app.get("/__mock-admin/ca.crt", (_req, res) => {
  const certPath = certManager.getCACertPath();
  res.download(certPath, "dev-mock-api-ca.pem");
});

// ---- 核心代理 + Mock 逻辑 ----
app.use((req, res) => {
  const method = req.method.toUpperCase();
  const target = resolveTarget(req);
  if (!target) {
    return res
      .status(502)
      .json({ error: "No proxy target", message: "未配置代理目标" });
  }
  const { targetHost, targetPort, targetProtocol, urlPath } = target;

  // 1. 检查是否有 mock 规则
  const mock = store.getMock(method, urlPath);
  if (mock && mock.response) {
    return serveMock(req, res, method, urlPath, targetHost, mock.response);
  }

  // 2. 无 mock，转发到目标服务器
  proxyRequest(
    req, res, method, urlPath, targetHost, targetPort, targetProtocol,
  );
});

/**
 * 解析代理目标（支持三种模式）
 * 1. 正向HTTP代理: req.url 以 http:// 开头
 * 2. 正向HTTPS代理 (MITM): socket._proxyTargetHost 存在
 * 3. 反向代理: TARGET 环境变量
 */
function resolveTarget(req) {
  // 模式1: 正向HTTP代理
  if (req.url.startsWith("http://") || req.url.startsWith("https://")) {
    const parsed = new URL(req.url);
    return {
      targetHost: parsed.hostname,
      targetPort:
        parseInt(parsed.port) ||
        (parsed.protocol === "https:" ? 443 : 80),
      targetProtocol: parsed.protocol,
      urlPath: parsed.pathname + parsed.search,
    };
  }

  // 模式2: 正向HTTPS代理 (经过 CONNECT MITM)
  if (req.socket && req.socket._proxyTargetHost) {
    return {
      targetHost: req.socket._proxyTargetHost,
      targetPort: parseInt(req.socket._proxyTargetPort) || 443,
      targetProtocol: "https:",
      urlPath: req.originalUrl,
    };
  }

  // 模式3: 反向代理 (TARGET 环境变量)
  if (CONFIG.target) {
    const parsed = new URL(CONFIG.target);
    return {
      targetHost: parsed.hostname,
      targetPort:
        parseInt(parsed.port) ||
        (parsed.protocol === "https:" ? 443 : 80),
      targetProtocol: parsed.protocol,
      urlPath: req.originalUrl,
    };
  }

  return null;
}

/** 返回 mock 数据 */
function serveMock(req, res, method, urlPath, targetHost, mockResponse) {
  const statusCode = mockResponse.statusCode || 200;
  const headers = mockResponse.headers || {};
  const body =
    mockResponse.body !== undefined ? mockResponse.body : mockResponse;

  collectRequestBody(req, (reqBody) => {
    store.addRecord({
      method,
      urlPath,
      targetHost,
      requestHeaders: filterHeaders(req.headers),
      requestBody: reqBody,
      statusCode,
      responseHeaders: headers,
      responseBody: body,
      source: "mock",
      timestamp: new Date().toISOString(),
    });
  });

  const contentType =
    headers["content-type"] || "application/json; charset=utf-8";
  res.set("content-type", contentType);
  Object.entries(headers).forEach(([k, v]) => {
    const lk = k.toLowerCase();
    if (
      lk !== "content-type" &&
      lk !== "transfer-encoding" &&
      lk !== "content-length"
    ) {
      res.set(k, v);
    }
  });

  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  res.status(statusCode).send(bodyStr);
}

/** 转发请求到目标服务器 */
function proxyRequest(
  req, res, method, urlPath, targetHost, targetPort, targetProtocol,
) {
  const isHttps = targetProtocol === "https:";
  const requester = isHttps ? https : http;

  const proxyHeaders = { ...req.headers };
  const defaultPort = isHttps ? 443 : 80;
  proxyHeaders.host =
    targetHost + (targetPort !== defaultPort ? ":" + targetPort : "");
  delete proxyHeaders["accept-encoding"];
  delete proxyHeaders["proxy-connection"];
  delete proxyHeaders["proxy-authorization"];

  const options = {
    hostname: targetHost,
    port: targetPort,
    path: urlPath,
    method,
    headers: proxyHeaders,
    rejectUnauthorized: false,
  };

  const proxyReq = requester.request(options, (proxyRes) => {
    const responseChunks = [];
    proxyRes.on("data", (chunk) => responseChunks.push(chunk));
    proxyRes.on("end", () => {
      const responseBuffer = Buffer.concat(responseChunks);
      let responseBody;
      try {
        responseBody = JSON.parse(responseBuffer.toString("utf-8"));
      } catch {
        responseBody = responseBuffer.toString("utf-8");
      }

      collectRequestBody(req, (reqBody) => {
        store.addRecord({
          method,
          urlPath,
          targetHost,
          requestHeaders: filterHeaders(req.headers),
          requestBody: reqBody,
          statusCode: proxyRes.statusCode,
          responseHeaders: filterHeaders(proxyRes.headers),
          responseBody,
          source: "proxy",
          timestamp: new Date().toISOString(),
        });
      });

      const resHeaders = { ...proxyRes.headers };
      delete resHeaders["transfer-encoding"];
      delete resHeaders["content-length"];
      delete resHeaders["content-encoding"];
      res.writeHead(proxyRes.statusCode, resHeaders);
      res.end(responseBuffer);
    });
  });

  proxyReq.on("error", (err) => {
    const msg = "[Proxy Error] " + method + " " + targetHost + urlPath;
    console.error(msg, "->", err.message);
    store.addRecord({
      method,
      urlPath,
      targetHost,
      requestHeaders: filterHeaders(req.headers),
      requestBody: null,
      statusCode: 502,
      responseHeaders: {},
      responseBody: { error: err.message },
      source: "proxy",
      timestamp: new Date().toISOString(),
    });
    res.status(502).json({ error: "Proxy Error", message: err.message });
  });

  req.pipe(proxyReq);
}

/** 收集请求体 */
function collectRequestBody(req, callback) {
  if (req._bodyCollected) {
    callback(req._collectedBody);
    return;
  }

  if (req.body !== undefined) {
    req._bodyCollected = true;
    req._collectedBody = req.body;
    callback(req.body);
    return;
  }

  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    let body = Buffer.concat(chunks).toString("utf-8");
    try {
      body = JSON.parse(body);
    } catch {}
    req._bodyCollected = true;
    req._collectedBody = body || null;
    callback(body || null);
  });

  if (req.readable === false) {
    req._bodyCollected = true;
    req._collectedBody = null;
    callback(null);
  }
}

function filterHeaders(headers) {
  if (!headers) return {};
  return { ...headers };
}

// ============ 创建服务器 ============
const server = http.createServer(app);

// ---- HTTPS CONNECT 处理（MITM 中间人代理） ----
server.on("connect", (req, clientSocket, _head) => {
  const parts = req.url.split(":");
  const hostname = parts[0];
  const port = parts[1] || "443";

  try {
    const { key, cert } = certManager.getCert(hostname);

    // 告知客户端隧道已建立
    clientSocket.write(
      "HTTP/1.1 200 Connection Established\r\n\r\n",
    );

    // TLS 终止：用伪造的域名证书与客户端握手
    const tlsSocket = new tls.TLSSocket(clientSocket, {
      isServer: true,
      key,
      cert,
    });

    // 标记目标信息，供 Express 中间件读取
    tlsSocket._proxyTargetHost = hostname;
    tlsSocket._proxyTargetPort = port;

    // 将解密后的连接交给 HTTP 服务器处理
    server.emit("connection", tlsSocket);
  } catch (err) {
    console.error("[CONNECT Error]", hostname, err.message);
    clientSocket.write("HTTP/1.1 502 Bad Gateway\r\n\r\n");
    clientSocket.end();
  }
});

// ---- 启动 ----
certManager.ensureCA();
const mode = CONFIG.target
  ? "反向代理"
  : "正向代理 (HTTP/HTTPS MITM)";

server.listen(CONFIG.port, () => {
  console.log("");
  console.log("  =====================================================");
  console.log("            Dev Mock API Proxy Server");
  console.log("  =====================================================");
  console.log("  代理地址:  http://localhost:" + CONFIG.port);
  console.log("  运行模式:  " + mode);
  if (CONFIG.target) {
    console.log("  目标服务:  " + CONFIG.target);
  }
  console.log(
    "  管理面板:  http://localhost:" + CONFIG.port + "/__mock-admin",
  );
  console.log(
    "  CA证书:    http://localhost:" + CONFIG.port + "/__mock-admin/ca.crt",
  );
  console.log("  =====================================================");
  console.log("  微信开发者工具: 设置 > 代理设置 > 手动设置代理");
  console.log("  代理地址: 127.0.0.1  端口: " + CONFIG.port);
  console.log("  =====================================================");
  console.log("");
});
