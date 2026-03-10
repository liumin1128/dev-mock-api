import { Button } from '@/components/ui/button'
import { MethodBadge } from '@/components/badges'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/empty-state'
import type { MockRule } from '@/lib/api'
import { Pencil, Trash2 } from 'lucide-react'

interface MockListProps {
  mocks: MockRule[]
  onEdit: (rule: MockRule) => void
  onRemove: (id: string) => void
}

/** 生成 matchBody 摘要 badge 列表 */
function MatchBodyBadges({ rule }: { rule: MockRule }) {
  const mb = rule.matchBody
  if (!mb || Object.keys(mb).length === 0) return null
  const parts = Object.entries(mb).map(
    ([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`,
  )
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {parts.map((p) => (
        <Badge
          key={p}
          variant="outline"
          className="border-blue-500/30 bg-blue-500/10 font-mono text-[10px] text-blue-600 dark:text-blue-400"
        >
          {p}
        </Badge>
      ))}
    </div>
  )
}

export function MockList({ mocks, onEdit, onRemove }: MockListProps) {
  if (mocks.length === 0) {
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
      {mocks.map((rule) => (
        <div
          key={rule.id}
          className="grid grid-cols-[4rem_1fr_6.25rem_auto] items-start gap-3 border-b px-4 py-3"
        >
          <MethodBadge method={rule.method} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-mono text-sm" title={rule.urlPath}>
                {rule.urlPath}
              </span>
              {rule.pinned ? (
                <Badge
                  variant="outline"
                  className="shrink-0 border-yellow-500/30 bg-yellow-500/10 text-xs text-yellow-600 dark:text-yellow-400"
                >
                  📌 Pinned
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="shrink-0 border-violet-500/30 bg-violet-500/10 text-xs text-violet-600 dark:text-violet-400"
                >
                  ✏️ Custom
                </Badge>
              )}
              {rule.priority > 0 && (
                <Badge
                  variant="outline"
                  className="shrink-0 border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400"
                >
                  P{rule.priority}
                </Badge>
              )}
            </div>
            {rule.name && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {rule.name}
              </p>
            )}
            <MatchBodyBadges rule={rule} />
          </div>
          <span className="pt-0.5 text-xs text-muted-foreground">
            {new Date(rule.updatedAt).toLocaleString('zh-CN', {
              hour12: false,
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          <div className="flex gap-1.5 pt-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onEdit(rule)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onRemove(rule.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
