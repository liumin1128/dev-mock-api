const express = require("express");
const store = require("./mock-store");

const router = express.Router();

/** 获取所有代理记录 */
router.get("/records", (_req, res) => {
  res.json(store.getRecords());
});

/** 清空代理记录 */
router.delete("/records", (_req, res) => {
  store.clearRecords();
  res.json({ ok: true });
});

/** 获取所有mock规则 */
router.get("/mocks", (_req, res) => {
  res.json(store.getAllMocks());
});

/** Pin住某个记录（用已捕获的response作为mock） */
router.post("/mocks/pin", express.json(), (req, res) => {
  const { method, urlPath, response } = req.body;
  if (!method || !urlPath || response === undefined) {
    return res.status(400).json({ error: "缺少 method / urlPath / response" });
  }
  store.pinRecord(method, urlPath, response);
  res.json({ ok: true });
});

/** 手动设置mock响应 */
router.post("/mocks/set", express.json({ limit: "10mb" }), (req, res) => {
  const { method, urlPath, response } = req.body;
  if (!method || !urlPath || response === undefined) {
    return res.status(400).json({ error: "缺少 method / urlPath / response" });
  }
  store.setMockResponse(method, urlPath, response);
  res.json({ ok: true });
});

/** 删除某条mock规则 */
router.delete("/mocks", express.json(), (req, res) => {
  const { method, urlPath } = req.body;
  if (!method || !urlPath) {
    return res.status(400).json({ error: "缺少 method / urlPath" });
  }
  store.removeMock(method, urlPath);
  res.json({ ok: true });
});

module.exports = router;
