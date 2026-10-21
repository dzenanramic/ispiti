/**
 * Fallback za `loading.tsx`: skeleton u formi stranice, bez skoka layouta.
 */
export function RouteLoading({ title }: { title?: string }) {
  return (
    <div className="animate-pulse" aria-busy="true" aria-live="polite">
      <span className="sr-only">Učitavam…</span>
      <div className="mb-7">
        <div className="mb-2 h-2.5 w-24 rounded bg-rule" />
        <div className="h-7 w-56 max-w-full rounded-xs bg-rule" />
        <div className="mt-3 h-3.5 w-72 max-w-full rounded bg-rule/70" />
        {title ? <span className="sr-only">{title}</span> : null}
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="sheet h-24 p-4">
            <div className="h-2.5 w-16 rounded bg-rule" />
            <div className="mt-3 h-6 w-12 rounded bg-rule" />
          </div>
        ))}
      </div>
      <div className="sheet h-64 p-5">
        <div className="h-3.5 w-40 rounded bg-rule" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2, 3, 4].map((index) => (
            <div key={index} className="h-4 w-full rounded bg-rule/60" />
          ))}
        </div>
      </div>
    </div>
  );
}
