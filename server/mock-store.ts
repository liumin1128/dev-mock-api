import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

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
  pinned: boolean
  method: string
  urlPath: string
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

class MockStore {
  records: ProxyRecord[] = []
  mocks: Map<string, MockRule> = new Map()
  maxRecords = 500

  constructor() {
    this._load()
  }

  /** 生成唯一 key: METHOD + PATH */
  _key(method: string, urlPath: string) {
    return `${method.toUpperCase()} ${urlPath}`
  }

  /** 从文件加载持久化的 mock 规则 */
  _load() {
    try {
      if (fs.existsSync(getStoreFile())) {
        const data = JSON.parse(fs.readFileSync(getStoreFile(), 'utf-8'))
        if (data.mocks) {
          Object.entries(data.mocks).forEach(([k, v]) =>
            this.mocks.set(k, v as MockRule),
          )
        }
      }
    } catch {
      // 文件损坏则忽略
    }
  }

  /** 持久化 mock 规则到文件 */
  _save() {
    const data = { mocks: Object.fromEntries(this.mocks) }
    fs.writeFileSync(getStoreFile(), JSON.stringify(data, null, 2), 'utf-8')
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

  getMock(method: string, urlPath: string) {
    return this.mocks.get(this._key(method, urlPath)) || null
  }

  pinRecord(method: string, urlPath: string, response: MockResponse) {
    const key = this._key(method, urlPath)
    this.mocks.set(key, {
      pinned: true,
      method: method.toUpperCase(),
      urlPath,
      response,
      updatedAt: new Date().toISOString(),
    })
    this._save()
  }

  setMockResponse(method: string, urlPath: string, response: MockResponse) {
    const key = this._key(method, urlPath)
    this.mocks.set(key, {
      pinned: false,
      method: method.toUpperCase(),
      urlPath,
      response,
      updatedAt: new Date().toISOString(),
    })
    this._save()
  }

  removeMock(method: string, urlPath: string) {
    const key = this._key(method, urlPath)
    this.mocks.delete(key)
    this._save()
  }

  getAllMocks() {
    return Object.fromEntries(this.mocks)
  }
}

export const store = new MockStore()
