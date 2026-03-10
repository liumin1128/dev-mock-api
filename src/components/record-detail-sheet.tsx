import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { MethodBadge, StatusBadge, SourceBadge } from '@/components/badges'
import type { ProxyRecord, MockRule } from '@/lib/api'
import { Pin, PinOff, Pencil } from 'lucide-react'

function prettyJSON(obj: unknown): string {
  if (obj === null || obj === undefined) return ''
  if (typeof obj === 'string') {
    try {
      return JSON.stringify(JSON.parse(obj), null, 2)
    } catch {
      return obj
    }
  }
  return JSON.stringify(obj, null, 2)
}

function formatTime(ts: string) {
  if (!ts) return '-'
  const d = new Date(ts)
  return d.toLocaleString('zh-CN', { hour12: false })
}

interface RecordDetailSheetProps {
  record: ProxyRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  mocks: MockRule[]
  onPin: (record: ProxyRecord) => void
  onUnpin: (record: ProxyRecord) => void
  onEdit: (record: ProxyRecord) => void
}

export function RecordDetailSheet({
  record,
  open,
  onOpenChange,
  mocks,
  onPin,
  onUnpin,
  onEdit,
}: RecordDetailSheetProps) {
  if (!record) return null

  const hasMock = mocks.some(
    (r) => r.method === record.method && r.urlPath === record.urlPath,
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-5xl sm:max-w-5xl flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 px-6 pt-5 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-sm font-medium">
            <MethodBadge method={record.method} />
            <span className="truncate font-mono text-xs" title={record.urlPath}>
              {record.urlPath}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* 两栏可滚动内容区 */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 divide-x">
            {/* 左栏：请求 */}
            <div className="space-y-5 p-6">
              <DetailSection title="基本信息">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <InfoItem label="Method" value={record.method} />
                  <InfoItem label="Host" value={record.targetHost || '-'} />
                  <InfoItem label="Status">
                    <StatusBadge code={record.statusCode} />
                  </InfoItem>
                  <InfoItem label="来源">
                    <SourceBadge source={record.source} />
                  </InfoItem>
                  <InfoItem
                    label="时间"
                    value={formatTime(record.timestamp)}
                    className="col-span-2"
                  />
                </div>
              </DetailSection>

              <Separator />

              <DetailSection title="Request Headers">
                <CodeBlock content={prettyJSON(record.requestHeaders)} />
              </DetailSection>

              {record.requestBody != null && (
                <DetailSection title="Request Body">
                  <CodeBlock content={prettyJSON(record.requestBody)} />
                </DetailSection>
              )}
            </div>

            {/* 右栏：响应 */}
            <div className="space-y-5 p-6">
              <DetailSection title="Response Headers">
                <CodeBlock content={prettyJSON(record.responseHeaders)} />
              </DetailSection>

              <DetailSection title="Response Body">
                <CodeBlock content={prettyJSON(record.responseBody)} />
              </DetailSection>
            </div>
          </div>
        </div>

        {/* 底部操作 */}
        <div className="flex shrink-0 gap-2 border-t px-6 py-4">
          {hasMock ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUnpin(record)}
              className="border-yellow-500/30 text-yellow-600 hover:bg-yellow-500/10 dark:text-yellow-400"
            >
              <PinOff className="mr-1.5 h-3.5 w-3.5" />
              取消 Pin
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPin(record)}
              className="border-yellow-500/30 text-yellow-600 hover:bg-yellow-500/10 dark:text-yellow-400"
            >
              <Pin className="mr-1.5 h-3.5 w-3.5" />
              Pin 住此响应
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onEdit(record)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            编辑响应
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DetailSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {title}
      </h4>
      {children}
    </div>
  )
}

function InfoItem({
  label,
  value,
  children,
  className,
}: {
  label: string
  value?: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <span className="text-xs text-muted-foreground uppercase">{label}</span>
      <div className="mt-0.5 font-mono">{children || value}</div>
    </div>
  )
}

function CodeBlock({ content }: { content: string }) {
  return (
    <pre className="max-h-64 overflow-auto rounded-md border bg-muted/50 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
      {content || '(empty)'}
    </pre>
  )
}
