import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { MethodBadge, StatusBadge, SourceBadge } from '@/components/badges'
import type { ProxyRecord, MocksMap } from '@/lib/api'
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
  mocks: MocksMap
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

  const mockKey = `${record.method} ${record.urlPath}`
  const hasMock = !!mocks[mockKey]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-xl">
        <SheetHeader className="gap-2 px-6">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <MethodBadge method={record.method} />
            <span className="truncate font-mono text-xs">{record.urlPath}</span>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-5 pb-4">
            {/* 基本信息 */}
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

            {/* Request Headers */}
            <DetailSection title="Request Headers">
              <CodeBlock content={prettyJSON(record.requestHeaders)} />
            </DetailSection>

            {/* Request Body */}
            {record.requestBody != null && (
              <DetailSection title="Request Body">
                <CodeBlock content={prettyJSON(record.requestBody)} />
              </DetailSection>
            )}

            <Separator />

            {/* Response Headers */}
            <DetailSection title="Response Headers">
              <CodeBlock content={prettyJSON(record.responseHeaders)} />
            </DetailSection>

            {/* Response Body */}
            <DetailSection title="Response Body">
              <CodeBlock content={prettyJSON(record.responseBody)} />
            </DetailSection>
          </div>
        </ScrollArea>

        {/* 底部操作 */}
        <div className="flex gap-2 border-t px-6 py-4">
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
      </SheetContent>
    </Sheet>
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
