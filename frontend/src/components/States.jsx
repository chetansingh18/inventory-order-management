// Small presentational helpers shared across pages.

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="state">
      <div className="spinner" />
      <span>{label}</span>
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state state-error">
      <p>⚠️ {message}</p>
      {onRetry && (
        <button className="btn btn-ghost" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}

export function EmptyState({ message, action }) {
  return (
    <div className="state">
      <p className="muted">{message}</p>
      {action}
    </div>
  )
}

export function currency(value) {
  const n = Number(value || 0)
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}
