import { cn } from '@/lib/utils'

export function EmptyState({
  icon,
  title,
  description,
  className,
}: {
  icon?: string
  title: string
  description?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-20 text-center',
        className,
      )}
    >
      {icon && <span className="text-4xl">{icon}</span>}
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {description && (
        <p className="max-w-sm text-xs text-muted-foreground/70">
          {description}
        </p>
      )}
    </div>
  )
}
