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

export interface MockRule {
  pinned: boolean
  method: string
  urlPath: string
  response: MockResponse
  updatedAt: string
}

export type MocksMap = Record<string, MockRule>

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

/** 获取所有 mock 规则 */
export function fetchMocks() {
  return request<MocksMap>('/mocks')
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

/** 手动设置 mock 规则 */
export function setMock(method: string, urlPath: string, response: unknown) {
  return request<{ ok: boolean }>('/mocks/set', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, urlPath, response }),
  })
}

/** 删除 mock 规则 */
export function removeMock(method: string, urlPath: string) {
  return request<{ ok: boolean }>('/mocks', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, urlPath }),
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
