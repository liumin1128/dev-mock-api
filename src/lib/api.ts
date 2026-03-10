/** 代理服务器 API 的基础 URL */
const API_BASE =
  typeof window !== 'undefined' && window.location.port === '3000'
    ? 'http://localhost:4523/__mock-admin/api'
    : '/__mock-admin/api'

// ==================== Types ====================

export interface ProxyRecord {
  method: string
  urlPath: string
  targetHost: string
  requestHeaders: Record<string, string>
  requestBody: unknown
  statusCode: number
  responseHeaders: Record<string, string>
  responseBody: unknown
  source: 'proxy' | 'mock'
  timestamp: string
}

export interface MockResponse {
  statusCode?: number
  headers?: Record<string, string>
  body?: unknown
}

/**
 * 请求匹配条件。所有字段均可缺省，缺省表示通配（*）。
 * 条件值语法：
 *   "value"        — 精确匹配
 *   "prefix*"      — 通配符
 *   "/regex/flags" — 正则
 *   "$exists"      — 字段存在即满足
 */
export interface MatchConditions {
  requestHeaders?: Record<string, string>
  requestBody?: Record<string, unknown>
  queryParams?: Record<string, string>
}

export interface MockRule {
  id: string
  name?: string
  pinned: boolean
  method: string
  urlPath: string
  priority: number
  conditions: MatchConditions
  response: MockResponse
  updatedAt: string
}

// ==================== API Client ====================

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + url, options)
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return res.json()
}

/** 获取所有代理记录 */
export function fetchRecords() {
  return request<ProxyRecord[]>('/records')
}

/** 清空所有代理记录 */
export function clearRecords() {
  return request<{ ok: boolean }>('/records', { method: 'DELETE' })
}

/** 获取所有 mock 规则（返回数组） */
export function fetchMocks() {
  return request<MockRule[]>('/mocks')
}

/** Pin 住某条记录的响应 */
export function pinMock(
  method: string,
  urlPath: string,
  response: MockResponse,
) {
  return request<{ ok: boolean }>('/mocks/pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, urlPath, response }),
  })
}

/** 手动设置 mock 规则（支持 conditions、priority、name） */
export function setMock(
  method: string,
  urlPath: string,
  response: unknown,
  options?: {
    conditions?: MatchConditions
    priority?: number
    name?: string
  },
) {
  return request<{ ok: boolean }>('/mocks/set', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method,
      urlPath,
      response,
      conditions: options?.conditions,
      priority: options?.priority,
      name: options?.name,
    }),
  })
}

/** 更新单条 mock 规则（按 id） */
export function updateMock(id: string, patch: Partial<Omit<MockRule, 'id'>>) {
  return request<{ ok: boolean }>(`/mocks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
}

/** 删除 mock 规则（按 id） */
export function removeMock(id: string) {
  return request<{ ok: boolean }>(`/mocks/${id}`, {
    method: 'DELETE',
  })
}

/** CA 证书下载地址 */
export function getCACertUrl() {
  const base =
    typeof window !== 'undefined' && window.location.port === '3000'
      ? 'http://localhost:4523'
      : ''
  return base + '/__mock-admin/ca.crt'
}
