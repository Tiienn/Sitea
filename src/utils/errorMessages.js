// Coerce an API error payload to a readable string.
// Vercel platform failures return `error` as an object ({ code, message }),
// while app endpoints return plain strings — handle both so the chat never
// renders "[object Object]".
export function toErrorMessage(value, fallback = 'Something went wrong. Please try again.') {
  if (typeof value === 'string' && value.trim()) return value
  if (value instanceof Error) return value.message || fallback
  if (value && typeof value === 'object') {
    if (typeof value.message === 'string' && value.message.trim()) {
      return value.code ? `${value.message} (${value.code})` : value.message
    }
    if (value.error && value.error !== value) {
      return toErrorMessage(value.error, fallback)
    }
    if (typeof value.code === 'string' && value.code.trim()) return value.code
    try {
      const text = JSON.stringify(value)
      if (text && text !== '{}') return text.slice(0, 200)
    } catch { /* circular — fall through */ }
  }
  return fallback
}
