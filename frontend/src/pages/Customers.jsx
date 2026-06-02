import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'
import Modal from '../components/Modal.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { EmptyState, ErrorState, Loading } from '../components/States.jsx'
import { useToast } from '../context/ToastContext.jsx'

const BLANK = { full_name: '', email: '', phone: '' }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(form) {
  const errors = {}
  if (!form.full_name.trim()) errors.full_name = 'Full name is required'
  if (!form.email.trim()) errors.email = 'Email is required'
  else if (!EMAIL_RE.test(form.email.trim())) errors.email = 'Enter a valid email'
  return errors
}

export default function Customers() {
  const toast = useToast()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setCustomers(await api.listCustomers())
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
    setForm(BLANK)
    setFormErrors({})
    setModalOpen(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    const errors = validate(form)
    setFormErrors(errors)
    if (Object.keys(errors).length) return
    setSaving(true)
    try {
      await api.createCustomer({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
      })
      toast.success('Customer added')
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
      await api.deleteCustomer(toDelete.id)
      toast.success('Customer deleted')
      setToDelete(null)
      await load()
    } catch (err) {
      toast.error(err.message)
      setToDelete(null)
    }
  }

  const filtered = customers.filter(
    (c) =>
      c.full_name.toLowerCase().includes(query.toLowerCase()) ||
      c.email.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div className="page">
      <div className="page-head">
        <h1>Customers</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          + Add Customer
        </button>
      </div>

      <input
        className="search"
        placeholder="Search by name or email…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyState
          message={query ? 'No customers match your search.' : 'No customers yet.'}
          action={
            !query && (
              <button className="btn btn-primary" onClick={openCreate}>
                Add your first customer
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
                <th>Email</th>
                <th>Phone</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.full_name}</strong></td>
                  <td>{c.email}</td>
                  <td>{c.phone || <span className="muted">—</span>}</td>
                  <td className="actions-col">
                    <button className="btn btn-sm btn-danger-ghost" onClick={() => setToDelete(c)}>
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
        title="Add Customer"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={submit} disabled={saving}>
              {saving ? 'Saving…' : 'Create'}
            </button>
          </>
        }
      >
        <form onSubmit={submit} className="form">
          <label className="field">
            <span>Full name *</span>
            <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            {formErrors.full_name && <em className="field-error">{formErrors.full_name}</em>}
          </label>
          <label className="field">
            <span>Email *</span>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            {formErrors.email && <em className="field-error">{formErrors.email}</em>}
          </label>
          <label className="field">
            <span>Phone</span>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete customer"
        message={`Delete "${toDelete?.full_name}"? Their orders will also be removed.`}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
