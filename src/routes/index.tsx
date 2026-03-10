import { useState, useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

import { RecordList } from '@/components/record-list'
import { RecordDetailSheet } from '@/components/record-detail-sheet'
import { MockList } from '@/components/mock-list'
import {
  MockEditorDialog,
  type MockEditorData,
} from '@/components/mock-editor-dialog'

import { useRecords, useMocks } from '@/hooks/use-proxy-data'
import {
  clearRecords,
  pinMock,
  removeMock,
  setMock,
  updateMock,
  getCACertUrl,
  type ProxyRecord,
  type MockRule,
} from '@/lib/api'
import type { MockSaveParams } from '@/components/mock-editor-dialog'

import { Radio, ShieldCheck, Plus, Trash2, RefreshCw } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'

export const Route = createFileRoute('/')({ component: App })

function App() {
  const { records, refresh: refreshRecords } = useRecords()
  const { mocks, refresh: refreshMocks } = useMocks()

  // 详情面板（快照：打开时冻结记录，不随轮询变化）
  const [selectedRecord, setSelectedRecord] = useState<ProxyRecord | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Mock 编辑器
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorData, setEditorData] = useState<MockEditorData | null>(null)

  // ---- 事件处理 ----

  const handleSelectRecord = useCallback((record: ProxyRecord) => {
    setSelectedRecord(record)
    setDetailOpen(true)
  }, [])

  const handleClearRecords = useCallback(async () => {
    await clearRecords()
    refreshRecords()
    setDetailOpen(false)
    toast.success('记录已清空')
  }, [refreshRecords])

  const handlePin = useCallback(
    async (record: ProxyRecord) => {
      // 将当前 request body 作为精确匹配条件
      const matchBody =
        record.requestBody &&
        typeof record.requestBody === 'object' &&
        !Array.isArray(record.requestBody)
          ? (record.requestBody as Record<string, unknown>)
          : undefined
      await pinMock(
        record.method,
        record.urlPath,
        {
          statusCode: record.statusCode,
          headers: record.responseHeaders,
          body: record.responseBody,
        },
        matchBody,
      )
      refreshMocks()
      toast.success(`已 Pin: ${record.method} ${record.urlPath}`)
    },
    [refreshMocks],
  )

  const handleUnpin = useCallback(
    async (record: ProxyRecord) => {
      const rule = mocks.find(
        (r) =>
          r.method === record.method &&
          r.urlPath === record.urlPath &&
          !r.matchBody,
      )
      if (rule) await removeMock(rule.id)
      refreshMocks()
      toast.success(`已取消 Pin: ${record.method} ${record.urlPath}`)
    },
    [mocks, refreshMocks],
  )

  const handleEditFromDetail = useCallback(
    (record: ProxyRecord) => {
      const response = {
        statusCode: record.statusCode,
        headers: record.responseHeaders,
        body: record.responseBody,
      }
      // 查找已有的无条件规则
      const existing = mocks.find(
        (r) =>
          r.method === record.method &&
          r.urlPath === record.urlPath &&
          !r.matchBody,
      )
      setEditorData({
        mode: 'edit',
        id: existing?.id,
        method: record.method,
        urlPath: record.urlPath,
        response: JSON.stringify(response, null, 2),
        matchBody: existing?.matchBody,
      })
      setEditorOpen(true)
    },
    [mocks],
  )

  const handleEditMock = useCallback((rule: MockRule) => {
    setEditorData({
      mode: 'edit',
      id: rule.id,
      method: rule.method,
      urlPath: rule.urlPath,
      response: JSON.stringify(rule.response, null, 2),
      matchBody: rule.matchBody,
    })
    setEditorOpen(true)
  }, [])

  const handleRemoveMock = useCallback(
    async (id: string) => {
      await removeMock(id)
      refreshMocks()
      toast.success('已删除 Mock 规则')
    },
    [refreshMocks],
  )

  const handleAddMock = useCallback(() => {
    setEditorData({
      mode: 'add',
      method: 'GET',
      urlPath: '',
      response: JSON.stringify({ code: 0, data: {}, message: 'ok' }, null, 2),
    })
    setEditorOpen(true)
  }, [])

  const handleSaveMock = useCallback(
    async (params: MockSaveParams) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(params.response)
      } catch {
        parsed = params.response
      }
      if (params.id) {
        // 编辑已有规则
        await updateMock(params.id, {
          method: params.method,
          urlPath: params.urlPath,
          response: parsed as import('@/lib/api').MockResponse,
          matchBody: params.matchBody,
        })
      } else {
        await setMock(params.method, params.urlPath, parsed, {
          matchBody: params.matchBody,
        })
      }
      refreshMocks()
      toast.success(`Mock 已保存: ${params.method} ${params.urlPath}`)
    },
    [refreshMocks],
  )

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* ===== 顶栏 ===== */}
      <header className="flex shrink-0 items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-3">
          <Radio className="h-5 w-5 text-primary" />
          <h1 className="text-base font-semibold tracking-tight">
            Dev Mock API
          </h1>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            自动刷新
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="sm" asChild>
            <a href={getCACertUrl()} download>
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              CA 证书
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={() => refreshRecords()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            刷新
          </Button>
        </div>
      </header>

      {/* ===== 主体内容 (Tabs) ===== */}
      <Tabs
        defaultValue="records"
        className="flex flex-1 flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between border-b px-5">
          <TabsList className="h-10 rounded-none border-0 bg-transparent p-0">
            <TabsTrigger
              value="records"
              className="relative h-10 rounded-none border-b-2 border-transparent px-4 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              📋 请求记录
              {records.length > 0 && (
                <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium">
                  {records.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="mocks"
              className="relative h-10 rounded-none border-b-2 border-transparent px-4 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              📌 Mock 规则
              {mocks.length > 0 && (
                <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium">
                  {mocks.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <TabsContent value="records" className="m-0 p-0">
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleClearRecords}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                清空记录
              </Button>
            </TabsContent>
            <TabsContent value="mocks" className="m-0 p-0">
              <Button size="sm" onClick={handleAddMock}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                新增 Mock
              </Button>
            </TabsContent>
          </div>
        </div>

        <Separator className="m-0" />

        {/* 请求记录面板 */}
        <TabsContent
          value="records"
          className="m-0 flex flex-1 flex-col overflow-hidden"
        >
          <RecordList
            records={records}
            selectedTimestamp={selectedRecord?.timestamp ?? null}
            onSelect={handleSelectRecord}
          />
        </TabsContent>

        {/* Mock 规则面板 */}
        <TabsContent
          value="mocks"
          className="m-0 flex flex-1 flex-col overflow-y-auto"
        >
          <MockList
            mocks={mocks}
            onEdit={handleEditMock}
            onRemove={handleRemoveMock}
          />
        </TabsContent>
      </Tabs>

      {/* ===== 详情侧边栏 ===== */}
      <RecordDetailSheet
        record={selectedRecord}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        mocks={mocks}
        onPin={handlePin}
        onUnpin={handleUnpin}
        onEdit={handleEditFromDetail}
      />

      {/* ===== Mock 编辑弹窗 ===== */}
      <MockEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        data={editorData}
        onSave={handleSaveMock}
      />
    </div>
  )
}
