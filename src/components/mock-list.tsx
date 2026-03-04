import { Button } from '@/components/ui/button'
import { MethodBadge } from '@/components/badges'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/empty-state'
import type { MocksMap } from '@/lib/api'
import { Pencil, Trash2 } from 'lucide-react'

interface MockListProps {
  mocks: MocksMap
  onEdit: (method: string, urlPath: string) => void
  onRemove: (method: string, urlPath: string) => void
}

export function MockList({ mocks, onEdit, onRemove }: MockListProps) {
  const entries = Object.entries(mocks)

  if (entries.length === 0) {
    return (
      <EmptyState
        icon="📌"
        title="暂无 Mock 规则"
        description="可以从请求记录中 Pin 住某条响应，或手动添加新的 Mock 规则"
      />
    )
  }

  return (
    <div className="flex flex-col">
      {entries.map(([key, rule]) => (
        <div
          key={key}
          className="grid grid-cols-[64px_1fr_100px_auto] items-center gap-3 border-b px-4 py-3"
        >
          <MethodBadge method={rule.method} />
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-mono text-sm" title={rule.urlPath}>
              {rule.urlPath}
            </span>
            {rule.pinned ? (
              <Badge
                variant="outline"
                className="shrink-0 border-yellow-500/30 bg-yellow-500/10 text-[10px] text-yellow-600 dark:text-yellow-400"
              >
                📌 Pinned
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="shrink-0 border-violet-500/30 bg-violet-500/10 text-[10px] text-violet-600 dark:text-violet-400"
              >
                ✏️ Custom
              </Badge>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground">
            {new Date(rule.updatedAt).toLocaleString('zh-CN', {
              hour12: false,
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          <div className="flex gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onEdit(rule.method, rule.urlPath)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onRemove(rule.method, rule.urlPath)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
