export function getApiBaseUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_MOSAIC_API_URL?.trim()
  if (!apiUrl) {
    throw new Error('NEXT_PUBLIC_MOSAIC_API_URL must be configured.')
  }
  return apiUrl.replace(/\/$/, '')
}

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${getApiBaseUrl()}${cleanPath}`
}
