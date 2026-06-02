import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client.js'
import Modal from '../components/Modal.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { EmptyState, ErrorState, Loading, currency } from '../components/States.jsx'
import { useToast } from '../context/ToastContext.jsx'

export default function Orders() {
  const toast = useToast()
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [lines, setLines] = useState([{ product_id: '', quantity: 1 }])
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [detail, setDetail] = useState(null)
  const [toDelete, setToDelete] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [o, p, c] = await Promise.all([
        api.listOrders(),
        api.listProducts(),
        api.listCustomers(),
      ])
      setOrders(o)
      setProducts(p)
      setCustomers(c)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const productMap = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products])

  const estimatedTotal = useMemo(() => {
    return lines.reduce((sum, l) => {
      const p = productMap[Number(l.product_id)]
      return sum + (p ? Number(p.price) * Number(l.quantity || 0) : 0)
    }, 0)
  }, [lines, productMap])

  const openCreate = () => {
    setCustomerId('')
    setLines([{ product_id: '', quantity: 1 }])
    setFormError('')
    setCreateOpen(true)
  }

  const updateLine = (i, patch) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  const addLine = () => setLines((ls) => [...ls, { product_id: '', quantity: 1 }])
  const removeLine = (i) => setLines((ls) => ls.filter((_, idx) => idx !== i))

  const submit = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!customerId) return setFormError('Please select a customer.')
    const items = lines
      .filter((l) => l.product_id)
      .map((l) => ({ product_id: Number(l.product_id), quantity: Number(l.quantity) }))
    if (items.length === 0) return setFormError('Add at least one product.')
    if (items.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1))
      return setFormError('Each quantity must be a whole number ≥ 1.')

    setSaving(true)
    try {
      await api.createOrder({ customer_id: Number(customerId), items })
      toast.success('Order created')
      setCreateOpen(false)
      await load()
    } catch (err) {
      // Surface business-rule errors (e.g. insufficient stock) inline.
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const openDetail = async (id) => {
    try {
      setDetail(await api.getOrder(id))
    } catch (err) {
      toast.error(err.message)
    }
  }

  const confirmDelete = async () => {
    try {
      await api.deleteOrder(toDelete.id)
      toast.success('Order cancelled & stock restored')
      setToDelete(null)
      await load()
    } catch (err) {
      toast.error(err.message)
      setToDelete(null)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Orders</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          + Create Order
        </button>
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : orders.length === 0 ? (
        <EmptyState
          message="No orders yet."
          action={
            <button className="btn btn-primary" onClick={openCreate}>
              Create your first order
            </button>
          }
        />
      ) : (
        <div className="panel no-pad">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Customer</th>
                <th className="num">Items</th>
                <th className="num">Total</th>
                <th>Status</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td><strong>#{o.id}</strong></td>
                  <td>{o.customer_name || `Customer ${o.customer_id}`}</td>
                  <td className="num">{o.items.reduce((s, i) => s + i.quantity, 0)}</td>
                  <td className="num">{currency(o.total_amount)}</td>
                  <td><span className="pill pill-ok">{o.status}</span></td>
                  <td className="actions-col">
                    <button className="btn btn-sm btn-ghost" onClick={() => openDetail(o.id)}>
                      View
                    </button>
                    <button className="btn btn-sm btn-danger-ghost" onClick={() => setToDelete(o)}>
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create order modal */}
      <Modal
        open={createOpen}
        title="Create Order"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={submit} disabled={saving}>
              {saving ? 'Placing…' : `Place order · ${currency(estimatedTotal)}`}
            </button>
          </>
        }
      >
        <form onSubmit={submit} className="form">
          <label className="field">
            <span>Customer *</span>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select a customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} ({c.email})
                </option>
              ))}
            </select>
          </label>

          <div className="field">
            <span>Products *</span>
            {lines.map((line, i) => {
              const p = productMap[Number(line.product_id)]
              return (
                <div className="order-line" key={i}>
                  <select
                    value={line.product_id}
                    onChange={(e) => updateLine(i, { product_id: e.target.value })}
                  >
                    <option value="">Select product…</option>
                    {products.map((pr) => (
                      <option key={pr.id} value={pr.id} disabled={pr.quantity === 0}>
                        {pr.name} — {currency(pr.price)} ({pr.quantity} in stock)
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    max={p ? p.quantity : undefined}
                    value={line.quantity}
                    onChange={(e) => updateLine(i, { quantity: e.target.value })}
                    className="qty-input"
                  />
                  {lines.length > 1 && (
                    <button type="button" className="icon-btn" onClick={() => removeLine(i)} aria-label="Remove line">
                      ✕
                    </button>
                  )}
                </div>
              )
            })}
            <button type="button" className="btn btn-sm btn-ghost" onClick={addLine}>
              + Add another product
            </button>
          </div>

          <div className="estimate">
            <span>Estimated total</span>
            <strong>{currency(estimatedTotal)}</strong>
          </div>

          {formError && <div className="form-error">{formError}</div>}
        </form>
      </Modal>

      {/* Order detail modal */}
      <Modal open={!!detail} title={detail ? `Order #${detail.id}` : ''} onClose={() => setDetail(null)}>
        {detail && (
          <div className="order-detail">
            <div className="detail-meta">
              <div>
                <span className="muted small">Customer</span>
                <div>{detail.customer_name || `Customer ${detail.customer_id}`}</div>
              </div>
              <div>
                <span className="muted small">Status</span>
                <div><span className="pill pill-ok">{detail.status}</span></div>
              </div>
              <div>
                <span className="muted small">Placed</span>
                <div>{new Date(detail.created_at).toLocaleString()}</div>
              </div>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="num">Unit</th>
                  <th className="num">Qty</th>
                  <th className="num">Line total</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.product_name || `Product ${it.product_id}`}</td>
                    <td className="num">{currency(it.unit_price)}</td>
                    <td className="num">{it.quantity}</td>
                    <td className="num">{currency(it.line_total ?? it.unit_price * it.quantity)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="3" className="num"><strong>Total</strong></td>
                  <td className="num"><strong>{currency(detail.total_amount)}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Cancel order"
        message={`Cancel order #${toDelete?.id}? Stock for its items will be returned to inventory.`}
        confirmLabel="Cancel order"
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
