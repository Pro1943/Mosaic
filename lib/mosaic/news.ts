import { getCategory } from './categories'
import { createMosaicError, getEnv } from './env'
import type { CategoryId, NormalizedArticle } from './types'

type ProviderResult = {
  provider: string
  articles: NormalizedArticle[]
  error?: string
}

const USER_AGENT = 'MosaicNewsComparison/0.1'

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeBody(...values: unknown[]) {
  return values.map(asText).find(Boolean) ?? ''
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    next: { revalidate: 0 },
  })

  if (!response.ok) {
    throw new Error(`HTTP_${response.status}`)
  }

  return response.json()
}

const SPORTS_KEYWORDS = [
  'sport', 'sports', 'football', 'soccer', 'fifa', 'uefa', 'premier league', 'la liga', 'serie a', 'bundesliga',
  'champions league', 'cricket', 'ipl', 'test match', 'wicket', 'icc', 'bcci', 'tennis', 'atp', 'wta',
  'wimbledon', 'grand slam', 'basketball', 'nba', 'wnba', 'baseball', 'mlb', 'hockey', 'nhl', 'rugby',
  'nfl', 'touchdown', 'quarterback', 'super bowl', 'olympics', 'olympic', 'athletics', 'marathon', 'golf',
  'pga', 'boxing', 'ufc', 'mma', 'motorsport', 'formula 1', 'formula one', 'f1', 'grand prix', 'nascar',
  'motogp', 'cycling', 'tour de france', 'swimming', 'badminton', 'volleyball', 'coach', 'quarterfinal',
  'semifinal', 'championship', 'tournament', 'playoff', 'stadium', 'ball', 'race', 'derby', 'score',
  'goal', 'striker', 'goalkeeper', 'athlete', 'athletes'
]

function isSportsArticle(article: Pick<NormalizedArticle, 'headline' | 'body' | 'url'>): boolean {
  const text = `${article.headline} ${article.body} ${article.url}`.toLowerCase()
  return SPORTS_KEYWORDS.some((kw) => text.includes(kw))
}

async function fetchGNews(category: CategoryId): Promise<ProviderResult> {
  const key = getEnv('GNEWS_API_KEY')
  const url = category === 'sports'
    ? `https://gnews.io/api/v4/top-headlines?category=sports&lang=en&max=10&apikey=${key}`
    : `https://gnews.io/api/v4/search?q=${encodeURIComponent(getCategory(category).query)}&lang=en&max=10&apikey=${key}`

  const data = await fetchJson(url)
  const articles = Array.isArray((data as { articles?: unknown }).articles) ? (data as { articles: Record<string, unknown>[] }).articles : []

  return {
    provider: 'gnews',
    articles: articles
      .map((item) => ({
        source: asText((item.source as { name?: unknown } | undefined)?.name) || 'GNews',
        headline: asText(item.title),
        author: null,
        published_at: asText(item.publishedAt) || null,
        body: normalizeBody(item.content, item.description),
        url: asText(item.url),
        category,
      }))
      .filter((article) => article.headline && article.url && article.body),
  }
}

async function fetchNewsData(category: CategoryId): Promise<ProviderResult> {
  const key = getEnv('NEWSDATA_API_KEY')
  const url = category === 'sports'
    ? `https://newsdata.io/api/1/news?apikey=${key}&language=en&category=sports`
    : `https://newsdata.io/api/1/news?apikey=${key}&language=en&q=${encodeURIComponent(getCategory(category).query)}`

  const data = await fetchJson(url)
  const results = Array.isArray((data as { results?: unknown }).results) ? (data as { results: Record<string, unknown>[] }).results : []

  return {
    provider: 'newsdata',
    articles: results
      .map((item) => ({
        source: asText(item.source_id) || asText(item.source_name) || 'NewsData.io',
        headline: asText(item.title),
        author: asText(Array.isArray(item.creator) ? item.creator.join(', ') : item.creator) || null,
        published_at: asText(item.pubDate) || null,
        body: normalizeBody(item.content, item.description),
        url: asText(item.link),
        category,
      }))
      .filter((article) => article.headline && article.url && article.body),
  }
}

async function fetchCurrents(category: CategoryId): Promise<ProviderResult> {
  const key = getEnv('CURRENTS_API_KEY')
  const url = category === 'sports'
    ? `https://api.currentsapi.services/v1/search?apiKey=${key}&language=en&category=sports`
    : `https://api.currentsapi.services/v1/search?apiKey=${key}&language=en&keywords=${encodeURIComponent(getCategory(category).query)}`

  const data = await fetchJson(url)
  const results = Array.isArray((data as { news?: unknown }).news) ? (data as { news: Record<string, unknown>[] }).news : []

  return {
    provider: 'currents',
    articles: results
      .map((item) => ({
        source: asText(item.author) || asText(item.source) || 'Currents News',
        headline: asText(item.title),
        author: asText(item.author) || null,
        published_at: asText(item.published) || null,
        body: normalizeBody(item.description),
        url: asText(item.url),
        category,
      }))
      .filter((article) => article.headline && article.url && article.body),
  }
}

export async function fetchNewsForCategory(category: CategoryId) {
  const providers = await Promise.allSettled([fetchGNews(category), fetchNewsData(category), fetchCurrents(category)])
  const results = providers.map((result, index): ProviderResult => {
    const provider = ['gnews', 'newsdata', 'currents'][index]
    if (result.status === 'fulfilled') return result.value
    return { provider, articles: [], error: result.reason instanceof Error ? result.reason.message : String(result.reason) }
  })

  let rawArticles = results.flatMap((result) => result.articles)
  if (category === 'sports') {
    rawArticles = rawArticles.filter(isSportsArticle)
  }

  const articles = dedupeArticles(rawArticles)
  const succeeded = results.filter((result) => !result.error).map((result) => result.provider)
  const failed = results.filter((result) => result.error).map((result) => ({ provider: result.provider, error: result.error }))

  if (!articles.length) {
    const code = category === 'sports' ? 'INSUFFICIENT_SPORTS_COVERAGE' : 'NEWS_ALL_PROVIDERS_FAILED'
    const message = category === 'sports'
      ? 'Insufficient sports coverage found across configured news providers.'
      : 'No news articles were fetched from GNews.io, NewsData.io, or Currents News.'
    throw createMosaicError(code, message, { failed })
  }

  return { articles, succeeded, failed }
}

function dedupeArticles(articles: NormalizedArticle[]) {
  const seen = new Map<string, NormalizedArticle>()

  for (const article of articles) {
    const key = article.url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '').toLowerCase()
    const headlineKey = article.headline.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 90)
    const existing = seen.get(key) ?? seen.get(headlineKey)

    if (!existing || article.body.length > existing.body.length) {
      seen.set(key, article)
      seen.set(headlineKey, article)
    }
  }

  return Array.from(new Set(seen.values()))
}
