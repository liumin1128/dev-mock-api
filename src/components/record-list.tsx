import { MethodBadge, StatusBadge, SourceBadge } from '@/components/badges'
import { EmptyState } from '@/components/empty-state'
import type { ProxyRecord } from '@/lib/api'
import { cn } from '@/lib/utils'

function formatTime(ts: string) {
  if (!ts) return '-'
  const d = new Date(ts)
  return (
    d.toLocaleTimeString('zh-CN', { hour12: false }) +
    '.' +
    String(d.getMilliseconds()).padStart(3, '0')
  )
}

interface RecordListProps {
  records: ProxyRecord[]
  selectedTimestamp: string | null
  onSelect: (record: ProxyRecord) => void
}

export function RecordList({
  records,
  selectedTimestamp,
  onSelect,
}: RecordListProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* 列表 */}
      <div className="flex-1 overflow-y-auto">
        {records.length === 0 ? (
          <EmptyState
            icon="📡"
            title="暂无请求记录"
            description="开始使用代理后，所有经过的请求都会显示在这里"
          />
        ) : (
          records.map((record, i) => (
            <RecordRow
              key={`${record.timestamp}-${i}`}
              record={record}
              isSelected={selectedTimestamp === record.timestamp}
              onClick={() => onSelect(record)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function RecordRow({
  record,
  isSelected,
  onClick,
}: {
  record: ProxyRecord
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'grid cursor-pointer grid-cols-[4rem_1fr_3.5rem_5rem_6rem] items-center gap-2 border-b px-4 py-2.5 transition-colors hover:bg-accent/50',
        isSelected && 'bg-accent',
        record.source === 'mock' && 'border-l-2 border-l-yellow-500',
      )}
    >
      <MethodBadge method={record.method} />
      <div className="min-w-0">
        <div className="truncate text-sm" title={record.urlPath}>
          {record.urlPath}
        </div>
        {record.targetHost && (
          <div className="truncate text-xs text-muted-foreground">
            {record.targetHost}
          </div>
        )}
      </div>
      <StatusBadge code={record.statusCode} />
      <SourceBadge source={record.source} />
      <span className="text-right text-xs text-muted-foreground">
        {formatTime(record.timestamp)}
      </span>
    </div>
  )
}
