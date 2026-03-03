const fs = require("fs");
const path = require("path");

const STORE_FILE = path.join(__dirname, "..", "mock-data.json");

/**
 * Mock 数据管理器
 * - records: 记录所有经过代理的请求/响应
 * - mocks: pin住或手动修改的mock规则 { [urlKey]: { pinned, response, method } }
 */
class MockStore {
  constructor() {
    this.records = []; // 代理记录列表
    this.mocks = new Map(); // urlKey -> mock规则
    this.maxRecords = 500; // 最大记录数
    this._load();
  }

  /** 生成唯一key: METHOD + PATH */
  _key(method, urlPath) {
    return `${method.toUpperCase()} ${urlPath}`;
  }

  /** 从文件加载持久化的mock规则 */
  _load() {
    try {
      if (fs.existsSync(STORE_FILE)) {
        const data = JSON.parse(fs.readFileSync(STORE_FILE, "utf-8"));
        if (data.mocks) {
          Object.entries(data.mocks).forEach(([k, v]) => this.mocks.set(k, v));
        }
      }
    } catch {
      // 文件损坏则忽略
    }
  }

  /** 持久化mock规则到文件 */
  _save() {
    const data = { mocks: Object.fromEntries(this.mocks) };
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), "utf-8");
  }

  /** 添加一条代理记录 */
  addRecord(record) {
    this.records.unshift(record);
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(0, this.maxRecords);
    }
  }

  /** 获取所有记录 */
  getRecords() {
    return this.records;
  }

  /** 清空记录 */
  clearRecords() {
    this.records = [];
  }

  /** 检查某个请求是否有mock规则 */
  getMock(method, urlPath) {
    return this.mocks.get(this._key(method, urlPath)) || null;
  }

  /** Pin住某条记录的响应 */
  pinRecord(method, urlPath, responseData) {
    const key = this._key(method, urlPath);
    this.mocks.set(key, {
      pinned: true,
      method: method.toUpperCase(),
      urlPath,
      response: responseData,
      updatedAt: new Date().toISOString(),
    });
    this._save();
  }

  /** 手动设置某个url的mock响应 */
  setMockResponse(method, urlPath, responseData) {
    const key = this._key(method, urlPath);
    this.mocks.set(key, {
      pinned: false,
      method: method.toUpperCase(),
      urlPath,
      response: responseData,
      updatedAt: new Date().toISOString(),
    });
    this._save();
  }

  /** 移除mock规则（取消pin / 取消mock） */
  removeMock(method, urlPath) {
    const key = this._key(method, urlPath);
    this.mocks.delete(key);
    this._save();
  }

  /** 获取所有mock规则 */
  getAllMocks() {
    return Object.fromEntries(this.mocks);
  }
}

module.exports = new MockStore();
