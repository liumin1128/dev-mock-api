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
  method: string
  urlPath: string
  response: string
}

interface MockEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: MockEditorData | null
  onSave: (method: string, urlPath: string, response: string) => void
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
  const [response, setResponse] = useState(DEFAULT_RESPONSE)
  const [jsonError, setJsonError] = useState<string | null>(null)

  useEffect(() => {
    if (data) {
      setMethod(data.method)
      setUrlPath(data.urlPath)
      setResponse(data.response)
      setJsonError(null)
    }
  }, [data])

  const isEdit = data?.mode === 'edit'

  function handleSave() {
    if (!urlPath.trim()) return

    // 验证 JSON 格式
    try {
      JSON.parse(response)
      setJsonError(null)
    } catch {
      // 允许非 JSON 字符串
    }

    onSave(
      isEdit ? data!.method : method,
      isEdit ? data!.urlPath : urlPath.trim(),
      response,
    )
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
          {/* Method & URL (仅新增模式可编辑) */}
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
                <Label className="text-xs">URL Path</Label>
                <Input
                  placeholder="/api/example"
                  value={urlPath}
                  onChange={(e) => setUrlPath(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          )}

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
                className="text-sm [&_.cm-editor]:!outline-none [&_.cm-scroller]:overflow-auto"
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
