// Central API client.
//
// API base resolution:
//  - VITE_API_BASE_URL (build-time env) wins — used for split deployments
//    (e.g. frontend on Vercel/Netlify, backend on Render).
//  - Otherwise defaults to "/api", which the dev server proxy and the
//    production nginx config both forward to the backend.
const BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request(path, options = {}) {
  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch (networkErr) {
    throw new ApiError('Network error — is the backend reachable?', 0)
  }

  if (res.status === 204) return null

  let body = null
  let parseFailed = false
  const text = await res.text()
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      parseFailed = true
      body = { detail: text }
    }
  }

  if (!res.ok) {
    const detail = body?.detail
    const message = Array.isArray(detail)
      ? detail.map((d) => `${d.loc?.slice(1).join('.') || 'field'}: ${d.msg}`).join('; ')
      : (typeof detail === 'string' && detail.length < 300 ? detail : `Request failed (${res.status})`)
    throw new ApiError(message, res.status)
  }

  // A 2xx response that isn't valid JSON means we're not actually talking to
  // the API (e.g. an SPA host returned index.html). Surface a clear error
  // instead of letting malformed data crash the UI.
  if (parseFailed) {
    throw new ApiError(
      'Unexpected response from the server. Check that VITE_API_BASE_URL points to the backend API.',
      res.status,
    )
  }
  return body
}

export const api = {
  // Products
  listProducts: () => request('/products'),
  getProduct: (id) => request(`/products/${id}`),
  createProduct: (data) => request('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id, data) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),

  // Customers
  listCustomers: () => request('/customers'),
  createCustomer: (data) => request('/customers', { method: 'POST', body: JSON.stringify(data) }),
  deleteCustomer: (id) => request(`/customers/${id}`, { method: 'DELETE' }),

  // Orders
  listOrders: () => request('/orders'),
  getOrder: (id) => request(`/orders/${id}`),
  createOrder: (data) => request('/orders', { method: 'POST', body: JSON.stringify(data) }),
  deleteOrder: (id) => request(`/orders/${id}`, { method: 'DELETE' }),

  // Dashboard
  dashboard: () => request('/dashboard/summary'),
}

export { ApiError }
