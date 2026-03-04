import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { MethodBadge, StatusBadge, SourceBadge } from '@/components/badges'
import { EmptyState } from '@/components/empty-state'
import type { ProxyRecord } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Search } from 'lucide-react'

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
  selectedIndex: number | null
  onSelect: (index: number) => void
}

export function RecordList({
  records,
  selectedIndex,
  onSelect,
}: RecordListProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return records
    const q = search.toLowerCase()
    return records.filter(
      (r) =>
        r.urlPath.toLowerCase().includes(q) ||
        (r.targetHost && r.targetHost.toLowerCase().includes(q)),
    )
  }, [records, search])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* 搜索栏 */}
      <div className="border-b px-4 py-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索 URL 路径或主机名..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <EmptyState
            icon="📡"
            title="暂无请求记录"
            description="开始使用代理后，所有经过的请求都会显示在这里"
          />
        ) : (
          filtered.map((record, i) => {
            const realIndex = records.indexOf(record)
            return (
              <RecordRow
                key={`${record.timestamp}-${i}`}
                record={record}
                isSelected={selectedIndex === realIndex}
                onClick={() => onSelect(realIndex)}
              />
            )
          })
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
        'grid cursor-pointer grid-cols-[64px_1fr_56px_80px_96px] items-center gap-2 border-b px-4 py-2.5 transition-colors hover:bg-accent/50',
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
          <div className="truncate text-[10px] text-muted-foreground">
            {record.targetHost}
          </div>
        )}
      </div>
      <StatusBadge code={record.statusCode} />
      <SourceBadge source={record.source} />
      <span className="text-right text-[11px] text-muted-foreground">
        {formatTime(record.timestamp)}
      </span>
    </div>
  )
}
