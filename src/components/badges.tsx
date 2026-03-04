import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

const METHOD_STYLES: Record<string, string> = {
  GET: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  POST: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20',
  PUT: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20',
  DELETE: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20',
  PATCH:
    'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/20',
}

export function MethodBadge({
  method,
  className,
}: {
  method: string
  className?: string
}) {
  const m = method.toUpperCase()
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-mono text-[10px] font-bold uppercase tracking-wider',
        METHOD_STYLES[m] || 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {m}
    </Badge>
  )
}

export function StatusBadge({ code }: { code: number }) {
  const style =
    code >= 200 && code < 300
      ? 'text-emerald-600 dark:text-emerald-400'
      : code >= 300 && code < 400
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400'

  return (
    <span className={cn('font-mono text-xs font-semibold', style)}>{code}</span>
  )
}

export function SourceBadge({ source }: { source: 'proxy' | 'mock' }) {
  return source === 'mock' ? (
    <Badge
      variant="outline"
      className="border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-[10px]"
    >
      📌 Mock
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className="border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px]"
    >
      ↗ Proxy
    </Badge>
  )
}
