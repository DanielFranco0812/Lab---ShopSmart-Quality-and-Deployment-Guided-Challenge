const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// DEF-1 fix: every request ends. Without a timeout, a frozen or cold-starting API
// left product pages on "Loading…" and checkout on "Submitting order…" forever.
export const REQUEST_TIMEOUT_MS = 15000;
const DEFAULT_TIMEOUT_MESSAGE = 'The request took too long. Please try again.';

export async function request(path, options = {}, { timeoutMs = REQUEST_TIMEOUT_MS, timeoutMessage = DEFAULT_TIMEOUT_MESSAGE } = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: options.signal ?? AbortSignal.timeout(timeoutMs),
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
  } catch (caught) {
    if (caught?.name === 'TimeoutError' || caught?.name === 'AbortError') {
      const error = new Error(timeoutMessage);
      error.code = 'TIMEOUT';
      throw error;
    }
    throw new Error('ShopSmart could not reach the server. Check that the API is running and try again.');
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message || `Request failed with status ${response.status}.`;
    const error = new Error(message);
    error.status = response.status;
    error.code = data?.error?.code;
    throw error;
  }
  return data;
}

export const api = {
  getProducts: (query = '') => request(`/products${query ? `?search=${encodeURIComponent(query)}` : ''}`),
  getProduct: (id) => request(`/products/${id}`),
  // A timed-out order may still have been saved, so the message tells the customer not to resubmit blindly.
  createOrder: (order) => request('/orders', { method: 'POST', body: JSON.stringify(order) }, {
    timeoutMessage: 'The server took too long to confirm your order. It may still have been placed, so please wait a moment before trying again.'
  }),
  askAssistant: (question) => request('/assistant/questions', { method: 'POST', body: JSON.stringify({ question }) }, { timeoutMs: 35000 })
};
