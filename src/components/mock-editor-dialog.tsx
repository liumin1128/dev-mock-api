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
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import type { MatchConditions } from '@/lib/api'

export interface MockEditorData {
  mode: 'add' | 'edit'
  id?: string
  method: string
  urlPath: string
  response: string
  conditions?: MatchConditions
  priority?: number
  name?: string
}

export interface MockSaveParams {
  id?: string
  method: string
  urlPath: string
  response: string
  conditions: MatchConditions
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

interface KVEntry {
  key: string
  value: string
}

function conditionsToKV(conds: Record<string, unknown> | undefined): KVEntry[] {
  if (!conds) return []
  return Object.entries(conds).map(([key, value]) => ({
    key,
    value: String(value),
  }))
}

function kvToRecord(entries: KVEntry[]): Record<string, string> {
  return Object.fromEntries(
    entries.filter((e) => e.key.trim()).map((e) => [e.key.trim(), e.value]),
  )
}

/** KV 列表编辑器 */
function KVEditor({
  label,
  entries,
  onChange,
  placeholder,
}: {
  label: string
  entries: KVEntry[]
  onChange: (entries: KVEntry[]) => void
  placeholder?: string
}) {
  function add() {
    onChange([...entries, { key: '', value: '' }])
  }
  function remove(idx: number) {
    onChange(entries.filter((_, i) => i !== idx))
  }
  function update(idx: number, field: 'key' | 'value', val: string) {
    const next = entries.map((e, i) => (i === idx ? { ...e, [field]: val } : e))
    onChange(next)
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={add}
        >
          <Plus className="mr-1 h-3 w-3" />
          添加
        </Button>
      </div>
      {entries.length > 0 && (
        <div className="space-y-1.5 rounded-md border p-2">
          {entries.map((entry, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <Input
                className="h-7 font-mono text-xs"
                placeholder="key"
                value={entry.key}
                onChange={(e) => update(idx, 'key', e.target.value)}
              />
              <span className="shrink-0 text-xs text-muted-foreground">=</span>
              <Input
                className="h-7 font-mono text-xs"
                placeholder={
                  placeholder ?? 'value / prefix* / /regex/ / $exists'
                }
                value={entry.value}
                onChange={(e) => update(idx, 'value', e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                onClick={() => remove(idx)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

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

  const [condExpanded, setCondExpanded] = useState(false)
  const [reqHeaderKV, setReqHeaderKV] = useState<KVEntry[]>([])
  const [reqBodyKV, setReqBodyKV] = useState<KVEntry[]>([])
  const [queryParamKV, setQueryParamKV] = useState<KVEntry[]>([])

  useEffect(() => {
    if (data) {
      setMethod(data.method)
      setUrlPath(data.urlPath)
      setName(data.name ?? '')
      setPriority(data.priority ?? 0)
      setResponse(data.response)
      setJsonError(null)
      const conds = data.conditions ?? {}
      setReqHeaderKV(conditionsToKV(conds.requestHeaders))
      setReqBodyKV(conditionsToKV(conds.requestBody as Record<string, unknown>))
      setQueryParamKV(conditionsToKV(conds.queryParams))
      const hasConditions =
        (conds.requestHeaders &&
          Object.keys(conds.requestHeaders).length > 0) ||
        (conds.requestBody && Object.keys(conds.requestBody).length > 0) ||
        (conds.queryParams && Object.keys(conds.queryParams).length > 0)
      setCondExpanded(!!hasConditions)
    }
  }, [data])

  const isEdit = data?.mode === 'edit'

  function buildConditions(): MatchConditions {
    const conds: MatchConditions = {}
    const hdr = kvToRecord(reqHeaderKV)
    const body = kvToRecord(reqBodyKV)
    const query = kvToRecord(queryParamKV)
    if (Object.keys(hdr).length > 0) conds.requestHeaders = hdr
    if (Object.keys(body).length > 0)
      conds.requestBody = body as Record<string, unknown>
    if (Object.keys(query).length > 0) conds.queryParams = query
    return conds
  }

  function handleSave() {
    if (!urlPath.trim()) return
    try {
      JSON.parse(response)
      setJsonError(null)
    } catch {
      // 允许非 JSON 字符串
    }
    onSave({
      id: isEdit ? data!.id : undefined,
      method: isEdit ? data!.method : method,
      urlPath: isEdit ? data!.urlPath : urlPath.trim(),
      response,
      conditions: buildConditions(),
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
          {/* Method & URL（仅新增模式可编辑） */}
          {!isEdit && (
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
                <Label className="text-xs">URL Path（支持 * 通配）</Label>
                <Input
                  placeholder="/api/example or /api/*"
                  value={urlPath}
                  onChange={(e) => setUrlPath(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          )}

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

          {/* 匹配条件（折叠区） */}
          <div className="rounded-md border">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium"
              onClick={() => setCondExpanded((v) => !v)}
            >
              <span>
                匹配条件
                {(reqHeaderKV.length > 0 ||
                  reqBodyKV.length > 0 ||
                  queryParamKV.length > 0) && (
                  <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                    {reqHeaderKV.filter((e) => e.key).length +
                      reqBodyKV.filter((e) => e.key).length +
                      queryParamKV.filter((e) => e.key).length}{' '}
                    条
                  </span>
                )}
              </span>
              {condExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
            {condExpanded && (
              <div className="space-y-3 border-t px-3 py-3">
                <p className="text-xs text-muted-foreground">
                  缺省条件 = 通配。值支持：精确值、<code>prefix*</code>、
                  <code>/regex/</code>、<code>$exists</code>
                </p>
                <KVEditor
                  label="Request Body（支持点路径如 user.role）"
                  entries={reqBodyKV}
                  onChange={setReqBodyKV}
                  placeholder="value / prefix* / /regex/ / $exists"
                />
                <KVEditor
                  label="Query Params"
                  entries={queryParamKV}
                  onChange={setQueryParamKV}
                />
                <KVEditor
                  label="Request Headers"
                  entries={reqHeaderKV}
                  onChange={setReqHeaderKV}
                />
              </div>
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
