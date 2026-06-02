import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { ErrorState, Loading, currency } from '../components/States.jsx'

const CARDS = [
  { key: 'total_products', label: 'Total Products', icon: '📦', to: '/products', tone: 'blue' },
  { key: 'total_customers', label: 'Total Customers', icon: '👥', to: '/customers', tone: 'green' },
  { key: 'total_orders', label: 'Total Orders', icon: '🧾', to: '/orders', tone: 'purple' },
  { key: 'low_stock_count', label: 'Low Stock', icon: '⚠️', to: '/products', tone: 'amber' },
]

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await api.dashboard())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <Loading label="Loading dashboard…" />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div className="page">
      <div className="page-head">
        <h1>Dashboard</h1>
        <button className="btn btn-ghost" onClick={load}>
          ↻ Refresh
        </button>
      </div>

      <div className="stat-grid">
        {CARDS.map((c) => (
          <Link to={c.to} key={c.key} className={`stat-card tone-${c.tone}`}>
            <div className="stat-icon">{c.icon}</div>
            <div className="stat-value">{data[c.key]}</div>
            <div className="stat-label">{c.label}</div>
          </Link>
        ))}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Revenue</h2>
        </div>
        <p className="big-number">{currency(data.total_revenue)}</p>
        <p className="muted">Total value of all confirmed orders.</p>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Low Stock Products</h2>
          <span className="badge">at or below {data.low_stock_threshold} units</span>
        </div>
        {data.low_stock_products.length === 0 ? (
          <p className="muted">All products are well stocked. 🎉</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th className="num">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {data.low_stock_products.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td><code>{p.sku}</code></td>
                  <td className="num">
                    <span className={p.quantity === 0 ? 'pill pill-danger' : 'pill pill-warn'}>
                      {p.quantity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
