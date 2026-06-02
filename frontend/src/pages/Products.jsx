import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'
import Modal from '../components/Modal.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { EmptyState, ErrorState, Loading, currency } from '../components/States.jsx'
import { useToast } from '../context/ToastContext.jsx'

const BLANK = { name: '', sku: '', price: '', quantity: '', description: '' }

function validate(form) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'Name is required'
  if (!form.sku.trim()) errors.sku = 'SKU is required'
  if (form.price === '' || Number(form.price) < 0) errors.price = 'Price must be 0 or more'
  if (form.quantity === '' || Number(form.quantity) < 0 || !Number.isInteger(Number(form.quantity)))
    errors.quantity = 'Quantity must be a whole number ≥ 0'
  return errors
}

export default function Products() {
  const toast = useToast()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setProducts(await api.listProducts())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(BLANK)
    setFormErrors({})
    setModalOpen(true)
  }

  const openEdit = (p) => {
    setEditing(p)
    setForm({
      name: p.name,
      sku: p.sku,
      price: String(p.price),
      quantity: String(p.quantity),
      description: p.description || '',
    })
    setFormErrors({})
    setModalOpen(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    const errors = validate(form)
    setFormErrors(errors)
    if (Object.keys(errors).length) return

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      price: Number(form.price),
      quantity: Number(form.quantity),
      description: form.description.trim() || null,
    }
    setSaving(true)
    try {
      if (editing) {
        await api.updateProduct(editing.id, payload)
        toast.success('Product updated')
      } else {
        await api.createProduct(payload)
        toast.success('Product created')
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    try {
      await api.deleteProduct(toDelete.id)
      toast.success('Product deleted')
      setToDelete(null)
      await load()
    } catch (err) {
      toast.error(err.message)
      setToDelete(null)
    }
  }

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.sku.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div className="page">
      <div className="page-head">
        <h1>Products</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          + Add Product
        </button>
      </div>

      <input
        className="search"
        placeholder="Search by name or SKU…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyState
          message={query ? 'No products match your search.' : 'No products yet.'}
          action={
            !query && (
              <button className="btn btn-primary" onClick={openCreate}>
                Add your first product
              </button>
            )
          }
        />
      ) : (
        <div className="panel no-pad">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th className="num">Price</th>
                <th className="num">Stock</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                    {p.description && <div className="muted small">{p.description}</div>}
                  </td>
                  <td><code>{p.sku}</code></td>
                  <td className="num">{currency(p.price)}</td>
                  <td className="num">
                    <span className={p.quantity === 0 ? 'pill pill-danger' : p.quantity <= 10 ? 'pill pill-warn' : 'pill pill-ok'}>
                      {p.quantity}
                    </span>
                  </td>
                  <td className="actions-col">
                    <button className="btn btn-sm btn-ghost" onClick={() => openEdit(p)}>
                      Edit
                    </button>
                    <button className="btn btn-sm btn-danger-ghost" onClick={() => setToDelete(p)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editing ? 'Edit Product' : 'Add Product'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={submit} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create'}
            </button>
          </>
        }
      >
        <form onSubmit={submit} className="form">
          <label className="field">
            <span>Name *</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            {formErrors.name && <em className="field-error">{formErrors.name}</em>}
          </label>
          <label className="field">
            <span>SKU / Code *</span>
            <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            {formErrors.sku && <em className="field-error">{formErrors.sku}</em>}
          </label>
          <div className="field-row">
            <label className="field">
              <span>Price *</span>
              <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              {formErrors.price && <em className="field-error">{formErrors.price}</em>}
            </label>
            <label className="field">
              <span>Quantity *</span>
              <input type="number" min="0" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              {formErrors.quantity && <em className="field-error">{formErrors.quantity}</em>}
            </label>
          </div>
          <label className="field">
            <span>Description</span>
            <textarea rows="2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete product"
        message={`Delete "${toDelete?.name}"? This cannot be undone.`}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
