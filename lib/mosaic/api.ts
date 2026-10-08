const DEFAULT_API_URL = 'https://mosaic-api-avi4.onrender.com'

export function getApiBaseUrl(): string {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_MOSAIC_API_URL) {
    return process.env.NEXT_PUBLIC_MOSAIC_API_URL.replace(/\/$/, '')
  }
  return DEFAULT_API_URL
}

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${getApiBaseUrl()}${cleanPath}`
}
