import type { CategoryId } from './types'

export const CATEGORIES: Array<{ id: CategoryId; label: string; query: string }> = [
  { id: 'world', label: 'World/International News', query: 'world international news diplomacy conflict global policy' },
  { id: 'economy', label: 'Economic News', query: 'economy markets inflation central bank business finance' },
  { id: 'sports', label: 'Sports News', query: 'sports football soccer basketball tennis cricket championship tournament athletics' },
  { id: 'others', label: 'Others', query: 'science technology health culture environment' },
]

export const DEFAULT_CATEGORY: CategoryId = 'world'

export function isCategoryId(value: string | null): value is CategoryId {
  return Boolean(value && CATEGORIES.some((category) => category.id === value))
}

export function getCategory(category: CategoryId) {
  return CATEGORIES.find((item) => item.id === category) ?? CATEGORIES[0]
}
