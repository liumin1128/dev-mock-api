import express from 'express'
import { store } from './mock-store.js'

const router = express.Router()

/** CORS 中间件 */
router.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  if (_req.method === 'OPTIONS') {
    res.sendStatus(204)
    return
  }
  next()
})

/** 获取所有代理记录 */
router.get('/records', (_req, res) => {
  res.json(store.getRecords())
})

/** 清空代理记录 */
router.delete('/records', (_req, res) => {
  store.clearRecords()
  res.json({ ok: true })
})

/** 获取所有 mock 规则（返回数组，按 updatedAt 降序） */
router.get('/mocks', (_req, res) => {
  res.json(store.getAllMocks())
})

/** Pin 住某个记录 */
router.post('/mocks/pin', express.json(), (req, res) => {
  const { method, urlPath, response } = req.body
  if (!method || !urlPath || response === undefined) {
    res.status(400).json({ error: '缺少 method / urlPath / response' })
    return
  }
  store.pinRecord(method, urlPath, response)
  res.json({ ok: true })
})

/** 手动设置 mock 响应（支持 conditions、priority、name） */
router.post('/mocks/set', express.json({ limit: '10mb' }), (req, res) => {
  const { method, urlPath, response, conditions, priority, name } = req.body
  if (!method || !urlPath || response === undefined) {
    res.status(400).json({ error: '缺少 method / urlPath / response' })
    return
  }
  store.setMockResponse(method, urlPath, response, conditions, priority, name)
  res.json({ ok: true })
})

/** 更新单条 mock 规则（按 id） */
router.put('/mocks/:id', express.json({ limit: '10mb' }), (req, res) => {
  const { id } = req.params
  const ok = store.updateMockById(id, req.body)
  if (!ok) {
    res.status(404).json({ error: '规则不存在' })
    return
  }
  res.json({ ok: true })
})

/** 删除某条 mock 规则（按 id） */
router.delete('/mocks/:id', (req, res) => {
  const { id } = req.params
  const ok = store.removeMockById(id)
  if (!ok) {
    res.status(404).json({ error: '规则不存在' })
    return
  }
  res.json({ ok: true })
})

export default router
