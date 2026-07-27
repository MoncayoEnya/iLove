// Reusable skeleton-loading primitives. Shown wherever data is still in
// flight, instead of plain "Loading…" text, so the layout doesn't jump once
// content arrives.

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-black/[0.06] ${className}`} />
}

// A single check-in/history-style card: a title line + a couple of body lines.
export function SkeletonCard({ lines = 2 }) {
  return (
    <div className="bg-white border border-black/10 rounded-2xl p-5">
      <Skeleton className="h-3 w-24 mb-3" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-3.5 w-full max-w-md" />
        ))}
      </div>
    </div>
  )
}

// A stack of SkeletonCards, for list/feed pages (check-ins, tasks, goals…).
export function SkeletonList({ count = 3, lines = 2 }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </div>
  )
}

// Full-page placeholder shown behind the auth gate, shaped like the app
// shell (sidebar + content cards) so the first paint doesn't flash blank.
export function AppShellSkeleton() {
  return (
    <div className="min-h-screen flex bg-paper">
      <div className="hidden md:flex md:w-[230px] flex-shrink-0 bg-plumdeep p-6 flex-col gap-8">
        <div className="h-7 w-24 rounded-lg bg-white/10 animate-pulse" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 w-full rounded bg-white/10 animate-pulse" />
          ))}
        </div>
      </div>
      <div className="flex-1 p-6 sm:p-8">
        <Skeleton className="h-7 w-40 mb-2" />
        <Skeleton className="h-4 w-64 mb-6" />
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-black/10 rounded-2xl p-5">
              <Skeleton className="h-4 w-1/2 mb-3" />
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
