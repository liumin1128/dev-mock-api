import { useState, useEffect } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface MockEditorData {
  mode: 'add' | 'edit'
  id?: string
  method: string
  urlPath: string
  response: string
  matchBody?: Record<string, unknown>
  priority?: number
  name?: string
}

export interface MockSaveParams {
  id?: string
  method: string
  urlPath: string
  response: string
  matchBody?: Record<string, unknown>
  priority: number
  name?: string
}

interface MockEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: MockEditorData | null
  onSave: (params: MockSaveParams) => void
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

const DEFAULT_RESPONSE = JSON.stringify(
  { code: 0, data: {}, message: 'ok' },
  null,
  2,
)

export function MockEditorDialog({
  open,
  onOpenChange,
  data,
  onSave,
}: MockEditorDialogProps) {
  const [method, setMethod] = useState('GET')
  const [urlPath, setUrlPath] = useState('')
  const [name, setName] = useState('')
  const [priority, setPriority] = useState(0)
  const [response, setResponse] = useState(DEFAULT_RESPONSE)
  const [jsonError, setJsonError] = useState<string | null>(null)

  const [matchBodyStr, setMatchBodyStr] = useState('')
  const [matchBodyError, setMatchBodyError] = useState<string | null>(null)

  useEffect(() => {
    if (data) {
      setMethod(data.method)
      setUrlPath(data.urlPath)
      setName(data.name ?? '')
      setPriority(data.priority ?? 0)
      setResponse(data.response)
      setJsonError(null)
      const mb = data.matchBody
      if (mb && Object.keys(mb).length > 0) {
        setMatchBodyStr(JSON.stringify(mb, null, 2))
      } else {
        setMatchBodyStr('')
      }
      setMatchBodyError(null)
    }
  }, [data])

  const isEdit = data?.mode === 'edit'

  function buildMatchBody(): Record<string, unknown> | undefined {
    const trimmed = matchBodyStr.trim()
    if (!trimmed) return undefined
    try {
      const parsed = JSON.parse(trimmed)
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        return parsed as Record<string, unknown>
      }
    } catch {
      // 解析失败时返回 undefined
    }
    return undefined
  }

  function handleSave() {
    if (!urlPath.trim()) return
    // 验证 matchBody JSON
    const trimmed = matchBodyStr.trim()
    if (trimmed) {
      try {
        const parsed = JSON.parse(trimmed)
        if (
          typeof parsed !== 'object' ||
          parsed === null ||
          Array.isArray(parsed)
        ) {
          setMatchBodyError('必须是 JSON 对象')
          return
        }
        setMatchBodyError(null)
      } catch {
        setMatchBodyError('JSON 格式错误')
        return
      }
    }
    try {
      JSON.parse(response)
      setJsonError(null)
    } catch {
      // 允许非 JSON 字符串
    }
    onSave({
      id: isEdit ? data!.id : undefined,
      method,
      urlPath: urlPath.trim(),
      response,
      matchBody: buildMatchBody(),
      priority,
      name: name.trim() || undefined,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="min-w-0">
          <DialogTitle
            className="truncate"
            title={
              isEdit ? `编辑 Mock: ${data?.method} ${data?.urlPath}` : undefined
            }
          >
            {isEdit
              ? `编辑 Mock: ${data?.method} ${data?.urlPath}`
              : '新增 Mock 规则'}
          </DialogTitle>
        </DialogHeader>

        <div className="min-w-0 space-y-4 py-2">
          {/* Method & URL */}
          <div className="grid grid-cols-[6.25rem_1fr] gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HTTP_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">URL Path（精确匹配，含 query）</Label>
              <Input
                placeholder="/api/example 或 /api/example?page=1"
                value={urlPath}
                onChange={(e) => setUrlPath(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>

          {/* 名称 & 优先级 */}
          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">规则名称（可选）</Label>
              <Input
                placeholder="便于区分同一路径下的多条规则"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">优先级</Label>
              <Input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="text-sm"
              />
            </div>
          </div>

          {/* 请求体匹配 */}
          <div className="space-y-1.5">
            <Label className="text-xs">Request Body 匹配（可选）</Label>
            <p className="text-xs text-muted-foreground">
              输入 JSON 对象，请求体包含此 JSON
              的全部字段则匹配成功，留空表示不限制
            </p>
            <div className="min-w-0 overflow-hidden rounded-md border">
              <CodeMirror
                value={matchBodyStr}
                onChange={(val) => {
                  setMatchBodyStr(val)
                  setMatchBodyError(null)
                }}
                extensions={[json()]}
                theme={
                  typeof document !== 'undefined' &&
                  document.documentElement.classList.contains('dark')
                    ? 'dark'
                    : 'light'
                }
                height="120px"
                width="100%"
                placeholder='{"PNR": "ABC123"}'
                basicSetup={{
                  lineNumbers: false,
                  foldGutter: false,
                  bracketMatching: true,
                  closeBrackets: true,
                }}
                className="text-sm [&_.cm-editor]:outline-none! [&_.cm-scroller]:overflow-auto"
              />
            </div>
            {matchBodyError && (
              <p className="text-xs text-destructive">{matchBodyError}</p>
            )}
          </div>

          {/* Response Body */}
          <div className="space-y-1.5">
            <Label className="text-xs">Response Body (JSON)</Label>
            <div className="min-w-0 overflow-hidden rounded-md border">
              <CodeMirror
                value={response}
                onChange={(val) => {
                  setResponse(val)
                  setJsonError(null)
                }}
                extensions={[json()]}
                theme={
                  typeof document !== 'undefined' &&
                  document.documentElement.classList.contains('dark')
                    ? 'dark'
                    : 'light'
                }
                height="280px"
                width="100%"
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  bracketMatching: true,
                  closeBrackets: true,
                  indentOnInput: true,
                }}
                className="text-sm [&_.cm-editor]:outline-none! [&_.cm-scroller]:overflow-auto"
              />
            </div>
            {jsonError && (
              <p className="text-xs text-destructive">{jsonError}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
