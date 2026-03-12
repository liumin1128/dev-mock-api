import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function getAppWritableDir() {
  const pkgProcess = process as NodeJS.Process & { pkg?: unknown }
  if (typeof pkgProcess.pkg !== 'undefined') {
    return path.dirname(process.execPath)
  }
  return path.join(__dirname, '..')
}

/** 获取存储文件路径（支持环境变量覆盖，用于 pkg 打包） */
function getStoreFile() {
  return (
    process.env.MOCK_DATA_FILE ||
    path.join(getAppWritableDir(), 'mock-data.json')
  )
}

export interface MockResponse {
  statusCode?: number
  headers?: Record<string, string>
  body?: unknown
}

export interface MockRule {
  id: string
  name?: string
  pinned: boolean
  method: string
  /** 精确匹配（path + query，query 参数按 key 排序后比较） */
  urlPath: string
  priority: number
  /** 请求体子集匹配：request body 包含此 JSON 的全部字段则命中 */
  matchBody?: Record<string, unknown>
  response: MockResponse
  updatedAt: string
}

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

// ─── 匹配工具函数 ────────────────────────────────────────────────

/** 标准化 URL：path + query（query 参数按 key 排序） */
function normalizeUrl(urlPath: string): string {
  const qIndex = urlPath.indexOf('?')
  if (qIndex === -1) return urlPath
  const pathPart = urlPath.slice(0, qIndex)
  const params = new URLSearchParams(urlPath.slice(qIndex + 1))
  params.sort()
  const qs = params.toString()
  return qs ? `${pathPart}?${qs}` : pathPart
}

/** 匹配规则 URL：支持完整 URL（含域名）和仅路径两种格式 */
function matchUrl(
  ruleUrl: string,
  requestPath: string,
  requestHost: string,
): boolean {
  if (ruleUrl.startsWith('http://') || ruleUrl.startsWith('https://')) {
    try {
      const parsed = new URL(ruleUrl)
      if (parsed.hostname !== requestHost) return false
      const rulePath = parsed.pathname + parsed.search
      return normalizeUrl(rulePath) === normalizeUrl(requestPath)
    } catch {
      return false
    }
  }
  return normalizeUrl(ruleUrl) === normalizeUrl(requestPath)
}

/** 判断 obj 是否包含 subset 的全部字段（递归深度比较） */
function isBodySubset(subset: Record<string, unknown>, obj: unknown): boolean {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false
  const record = obj as Record<string, unknown>
  for (const [key, value] of Object.entries(subset)) {
    if (!(key in record)) return false
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      if (!isBodySubset(value as Record<string, unknown>, record[key]))
        return false
    } else {
      if (JSON.stringify(record[key]) !== JSON.stringify(value)) return false
    }
  }
  return true
}

/** 旧格式（Record<string, MockRule>）迁移到新格式（MockRule[]） */
function migrateOldFormat(oldMocks: Record<string, unknown>): MockRule[] {
  return Object.entries(oldMocks).map(([key, v]) => {
    const old = v as Partial<MockRule> & {
      conditions?: {
        requestBody?: Record<string, unknown>
      }
    }
    const spaceIdx = key.indexOf(' ')
    const method = key.slice(0, spaceIdx) || 'GET'
    const urlPath = key.slice(spaceIdx + 1) || '/'
    // 将旧 conditions.requestBody 迁移为 matchBody
    const matchBody =
      old.matchBody ??
      (old.conditions?.requestBody &&
      Object.keys(old.conditions.requestBody).length > 0
        ? old.conditions.requestBody
        : undefined)
    return {
      id: randomUUID(),
      pinned: old.pinned ?? false,
      method: old.method ?? method,
      urlPath: old.urlPath ?? urlPath,
      priority: 0,
      matchBody,
      response: old.response ?? {},
      updatedAt: old.updatedAt ?? new Date().toISOString(),
    }
  })
}

// ─── MockStore ───────────────────────────────────────────────────

class MockStore {
  records: ProxyRecord[] = []
  mocks: MockRule[] = []
  maxRecords = 500

  constructor() {
    this._load()
  }

  _load() {
    try {
      if (fs.existsSync(getStoreFile())) {
        const data = JSON.parse(fs.readFileSync(getStoreFile(), 'utf-8'))
        if (Array.isArray(data.mocks)) {
          this.mocks = (data.mocks as unknown[]).map((raw) => {
            // 自动迁移旧 conditions.requestBody → matchBody
            const rule = raw as Record<string, unknown>
            const conditions = rule.conditions as
              | { requestBody?: Record<string, unknown> }
              | undefined
            if (!rule.matchBody && conditions?.requestBody) {
              const body = conditions.requestBody
              if (Object.keys(body).length > 0) {
                rule.matchBody = body
              }
            }
            delete rule.conditions
            return rule as unknown as MockRule
          })
        } else if (data.mocks && typeof data.mocks === 'object') {
          // 自动迁移旧格式
          this.mocks = migrateOldFormat(data.mocks as Record<string, unknown>)
          this._save()
        }
      }
    } catch {
      // 文件损坏则忽略
    }
  }

  _save() {
    fs.writeFileSync(
      getStoreFile(),
      JSON.stringify({ mocks: this.mocks }, null, 2),
      'utf-8',
    )
  }

  addRecord(record: ProxyRecord) {
    this.records.unshift(record)
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(0, this.maxRecords)
    }
  }

  getRecords() {
    return this.records
  }

  clearRecords() {
    this.records = []
  }

  /**
   * 匹配规则：method + urlPath(精确) + matchBody(子集)。
   * 优先级：matchBody 字段数 > priority > 最近更新
   */
  findMatchingRule(
    method: string,
    urlPath: string,
    targetHost: string,
    reqBody: unknown,
  ): MockRule | null {
    const candidates: Array<{ rule: MockRule; score: number }> = []
    for (const rule of this.mocks) {
      if (rule.method.toUpperCase() !== method.toUpperCase()) continue
      if (!matchUrl(rule.urlPath, urlPath, targetHost)) continue
      // body 匹配：有 body 请求匹配含 matchBody 的规则；无 body 请求只匹配无 matchBody 的规则
      const mb = rule.matchBody
      const hasReqBody =
        reqBody !== null && reqBody !== undefined && reqBody !== ''
      const hasRuleBody = mb && Object.keys(mb).length > 0
      if (hasReqBody && hasRuleBody) {
        if (!isBodySubset(mb, reqBody)) continue
        candidates.push({ rule, score: Object.keys(mb).length })
      } else if (!hasReqBody && !hasRuleBody) {
        candidates.push({ rule, score: 0 })
      } else {
        // 有 body 请求 + 无 matchBody 规则 → 也匹配（兜底）
        // 无 body 请求 + 有 matchBody 规则 → 跳过
        if (hasReqBody && !hasRuleBody) {
          candidates.push({ rule, score: 0 })
        } else {
          continue
        }
      }
    }
    if (candidates.length === 0) return null
    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const pa = a.rule.priority ?? 0
      const pb = b.rule.priority ?? 0
      if (pb !== pa) return pb - pa
      return (
        new Date(b.rule.updatedAt).getTime() -
        new Date(a.rule.updatedAt).getTime()
      )
    })
    return candidates[0].rule
  }

  getMockById(id: string) {
    return this.mocks.find((r) => r.id === id) ?? null
  }

  getAllMocks(): MockRule[] {
    return [...this.mocks].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
  }

  pinRecord(
    method: string,
    urlPath: string,
    response: MockResponse,
    matchBody?: Record<string, unknown>,
  ) {
    // 查找相同 method + urlPath + matchBody 的已有规则
    const existing = this.mocks.find(
      (r) =>
        r.method.toUpperCase() === method.toUpperCase() &&
        r.urlPath === urlPath &&
        JSON.stringify(r.matchBody) === JSON.stringify(matchBody),
    )
    if (existing) {
      existing.pinned = true
      existing.response = response
      existing.updatedAt = new Date().toISOString()
    } else {
      this.mocks.unshift({
        id: randomUUID(),
        pinned: true,
        method: method.toUpperCase(),
        urlPath,
        priority: 0,
        matchBody,
        response,
        updatedAt: new Date().toISOString(),
      })
    }
    this._save()
  }

  setMockResponse(
    method: string,
    urlPath: string,
    response: MockResponse,
    matchBody?: Record<string, unknown>,
    priority?: number,
    name?: string,
  ) {
    // 仅当 matchBody 均为空时才复用已有规则
    const existing = this.mocks.find(
      (r) =>
        r.method.toUpperCase() === method.toUpperCase() &&
        r.urlPath === urlPath &&
        !r.matchBody &&
        !matchBody,
    )
    if (existing) {
      existing.response = response
      if (priority !== undefined) existing.priority = priority
      if (name !== undefined) existing.name = name
      existing.updatedAt = new Date().toISOString()
    } else {
      this.mocks.unshift({
        id: randomUUID(),
        name,
        pinned: false,
        method: method.toUpperCase(),
        urlPath,
        priority: priority ?? 0,
        matchBody,
        response,
        updatedAt: new Date().toISOString(),
      })
    }
    this._save()
  }

  updateMockById(id: string, patch: Partial<Omit<MockRule, 'id'>>) {
    const rule = this.mocks.find((r) => r.id === id)
    if (!rule) return false
    Object.assign(rule, patch, { updatedAt: new Date().toISOString() })
    this._save()
    return true
  }

  removeMockById(id: string) {
    const before = this.mocks.length
    this.mocks = this.mocks.filter((r) => r.id !== id)
    if (this.mocks.length !== before) {
      this._save()
      return true
    }
    return false
  }
}

export const store = new MockStore()
