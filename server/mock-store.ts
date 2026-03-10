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

/**
 * 请求匹配条件。所有字段均可缺省，缺省表示通配（*）。
 * 条件值支持以下语法：
 *   "value"        — 精确匹配
 *   "prefix*"      — 通配符（* 匹配任意字符序列）
 *   "/regex/flags" — 正则匹配
 *   "$exists"      — 字段存在且非空即满足
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

/** 匹配单个条件值 */
function matchValue(actual: string | undefined, pattern: string): boolean {
  if (pattern === '$exists') return actual !== undefined && actual !== ''
  if (actual === undefined || actual === null) return false
  const regexMatch = pattern.match(/^\/(.+)\/([gimsuy]*)$/)
  if (regexMatch) {
    try {
      return new RegExp(regexMatch[1], regexMatch[2]).test(actual)
    } catch {
      return false
    }
  }
  if (pattern.includes('*')) {
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
    return new RegExp('^' + escaped + '$').test(actual)
  }
  return actual === pattern
}

/** 按点路径获取嵌套值（如 "user.role"） */
function getNestedValue(obj: unknown, dotPath: string): unknown {
  return dotPath.split('.').reduce((curr: unknown, key) => {
    if (curr && typeof curr === 'object')
      return (curr as Record<string, unknown>)[key]
    return undefined
  }, obj)
}

/** URL path 通配符匹配（忽略 query string） */
function matchUrlPath(pattern: string, urlPath: string): boolean {
  const cleanPath = urlPath.split('?')[0]
  const cleanPattern = pattern.split('?')[0]
  if (!cleanPattern.includes('*')) return cleanPath === cleanPattern
  const escaped = cleanPattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
  return new RegExp('^' + escaped + '$').test(cleanPath)
}

/**
 * 评估条件匹配得分。
 * 返回命中条件数（≥0），返回 -1 表示存在条件不满足。
 */
function scoreConditions(
  conditions: MatchConditions,
  reqHeaders: Record<string, string>,
  reqBody: unknown,
  queryParams: Record<string, string>,
): number {
  let score = 0
  if (conditions.requestHeaders) {
    for (const [k, v] of Object.entries(conditions.requestHeaders)) {
      if (!matchValue(reqHeaders[k.toLowerCase()], v)) return -1
      score++
    }
  }
  if (conditions.requestBody) {
    for (const [dotPath, v] of Object.entries(conditions.requestBody)) {
      const actual = getNestedValue(reqBody, dotPath)
      if (
        !matchValue(
          actual !== undefined ? String(actual) : undefined,
          String(v),
        )
      )
        return -1
      score++
    }
  }
  if (conditions.queryParams) {
    for (const [k, v] of Object.entries(conditions.queryParams)) {
      if (!matchValue(queryParams[k], v)) return -1
      score++
    }
  }
  return score
}

/** 旧格式（Record<string, MockRule>）迁移到新格式（MockRule[]） */
function migrateOldFormat(oldMocks: Record<string, unknown>): MockRule[] {
  return Object.entries(oldMocks).map(([key, v]) => {
    const old = v as Partial<MockRule>
    const spaceIdx = key.indexOf(' ')
    const method = key.slice(0, spaceIdx) || 'GET'
    const urlPath = key.slice(spaceIdx + 1) || '/'
    return {
      id: randomUUID(),
      pinned: old.pinned ?? false,
      method: old.method ?? method,
      urlPath: old.urlPath ?? urlPath,
      priority: 0,
      conditions: {},
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
          this.mocks = data.mocks as MockRule[]
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
   * 多维度匹配：返回最优 MockRule 或 null。
   * 优先级：条件命中数 > priority > 最近更新
   */
  findMatchingRule(
    method: string,
    urlPath: string,
    reqHeaders: Record<string, string>,
    reqBody: unknown,
    queryParams: Record<string, string>,
  ): MockRule | null {
    const candidates: Array<{ rule: MockRule; score: number }> = []
    for (const rule of this.mocks) {
      if (rule.method.toUpperCase() !== method.toUpperCase()) continue
      if (!matchUrlPath(rule.urlPath, urlPath)) continue
      const score = scoreConditions(
        rule.conditions ?? {},
        reqHeaders,
        reqBody,
        queryParams,
      )
      if (score < 0) continue
      candidates.push({ rule, score })
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

  pinRecord(method: string, urlPath: string, response: MockResponse) {
    // 更新已有空条件规则，否则插入新规则
    const existing = this.mocks.find(
      (r) =>
        r.method.toUpperCase() === method.toUpperCase() &&
        r.urlPath === urlPath &&
        Object.keys(r.conditions ?? {}).length === 0,
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
        conditions: {},
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
    conditions?: MatchConditions,
    priority?: number,
    name?: string,
  ) {
    const conds = conditions ?? {}
    // 仅当 conditions 完全相同（均为空对象）时才复用已有规则
    const existing = this.mocks.find(
      (r) =>
        r.method.toUpperCase() === method.toUpperCase() &&
        r.urlPath === urlPath &&
        Object.keys(r.conditions ?? {}).length === 0 &&
        Object.keys(conds).length === 0,
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
        conditions: conds,
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
