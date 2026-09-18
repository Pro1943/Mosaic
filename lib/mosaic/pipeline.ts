import { CATEGORIES } from './categories'
import {
  acquireIngestionLease,
  clearHomepageCache,
  deleteInvalidTopics,
  getArticlesForTopic,
  getCachedComparison,
  getCachedExtractions,
  getCachedNarrative,
  getHomeStories,
  getTopicsNeedingHomepageCards,
  needsIngestion,
  recordIngestionRun,
  releaseIngestionLease,
  upsertArticlesAndTopics,
  upsertComparison,
  upsertExtractions,
  upsertNarrative,
  upsertHomepageCards,
} from './db'
import { createMosaicError } from './env'
import { extractArticleClaims, generateHomepageCardForTopic, synthesizeComparison, writeNarrative } from './gemini'
import { fetchNewsForCategory } from './news'
import type { CategoryId, ComparisonAnalysis, HomeStory, NarrativeAnalysis, NormalizedArticle } from './types'

type TopicArticleRow = Awaited<ReturnType<typeof getArticlesForTopic>>[number]

export async function ingestCategory(category: CategoryId) {
  try {
    const result = await fetchNewsForCategory(category)
    await upsertArticlesAndTopics(result.articles)
    await recordIngestionRun(category, 'success', {
      succeeded: result.succeeded,
      failed: result.failed,
      article_count: result.articles.length,
    })
    return result
  } catch (error) {
    await recordIngestionRun(category, 'failed', error instanceof Error ? { message: error.message } : error).catch(() => undefined)
    throw error
  }
}

export async function ingestAllCategories() {
  const results = await Promise.allSettled(CATEGORIES.map((category) => refreshHomepageCategory(category.id)))
  const failures = results
    .map((result, index) => ({ result, category: CATEGORIES[index].id }))
    .filter((item) => item.result.status === 'rejected')

  if (failures.length === CATEGORIES.length) {
    throw createMosaicError('INGEST_ALL_CATEGORIES_FAILED', 'Hourly ingestion failed for every category.', failures)
  }

  return {
    succeeded: results.length - failures.length,
    failed: failures.map((item) => ({
      category: item.category,
      reason: item.result.status === 'rejected' ? String(item.result.reason) : null,
    })),
  }
}

export async function getCachedHomepage(category: CategoryId): Promise<HomeStory[]> {
  const stories = await getHomeStories(category)

  if (!stories.length) {
    throw createMosaicError('NO_HOME_STORIES', 'No homepage stories are cached for this category yet.')
  }

  return stories
}

export async function refreshHomepageCategory(category: CategoryId) {
  const acquired = await acquireIngestionLease(category)
  if (!acquired) {
    const existing = await getHomeStories(category)
    return {
      category,
      story_count: existing.length,
    }
  }

  try {
    const stale = await needsIngestion(category)

    if (stale) {
      await clearHomepageCache(category)
      await ingestCategory(category)
    }

    await deleteInvalidTopics(category)
    await regenerateHomepageCards(category)
    const stories = await getHomeStories(category)

    return {
      category,
      story_count: stories.length,
    }
  } finally {
    await releaseIngestionLease(category).catch(() => undefined)
  }
}

export async function regenerateHomepageCards(category: CategoryId) {
  const topics = await getTopicsNeedingHomepageCards(category)
  const generated = await mapWithConcurrency(topics, 2, async (topic) => {
    const articles = await getArticlesForTopic(topic.id)
    if (articles.length < 2) return null

    return generateHomepageCardForTopic({
      topic_id: topic.id,
      category,
      articles: articles.map(articleRowToNormalized),
    })
  })

  const stories = generated.filter(Boolean) as HomeStory[]
  await upsertHomepageCards(stories)
  return stories
}

export async function getOrCreateComparison(topicId: string): Promise<ComparisonAnalysis> {
  const cached = await getCachedComparison(topicId)
  if (cached && cached.claims.length > 0) return cached

  const extractions = await getOrCreateSourceClaims(topicId)
  const comparison = await synthesizeComparison(extractions)
  if (!comparison.claims.length) {
    throw createMosaicError('COMPARISON_EMPTY_CLAIMS', 'The comparison analysis produced no claims for this topic.', { topicId })
  }
  await upsertComparison(topicId, comparison)
  return comparison
}

export async function getOrCreateNarrative(topicId: string): Promise<NarrativeAnalysis> {
  const comparison = await getOrCreateComparison(topicId)
  const cached = await getCachedNarrative(topicId)
  if (cached && cached.sections.length > 0 && cached.differs_on.trim().toLowerCase() !== 'none') return cached

  const narrative = await writeNarrative(comparison)
  if (!narrative.sections.length || narrative.differs_on.trim().toLowerCase() === 'none') {
    throw createMosaicError('NARRATIVE_EMPTY_DIFFERENCES', 'The narrative analysis produced no usable differences for this topic.', { topicId })
  }
  await upsertNarrative(topicId, narrative)
  return narrative
}

async function getOrCreateSourceClaims(topicId: string) {
  const cached = await getCachedExtractions(topicId)
  if (cached && cached.some((extraction) => extraction.claims.length > 0)) return cached

  const articles = await getArticlesForTopic(topicId)
  if (articles.length < 2) {
    throw createMosaicError('INSUFFICIENT_TOPIC_SOURCES', 'A comparison requires at least two source articles for this topic.', {
      topicId,
      articleCount: articles.length,
    })
  }

  const extractions = await extractArticleClaims(articles.map(articleRowToNormalized))
  if (!extractions.some((extraction) => extraction.claims.length > 0)) {
    throw createMosaicError('SOURCE_CLAIMS_EMPTY', 'No source claims were extracted for this topic.', {
      topicId,
      articleCount: articles.length,
      sources: articles.map((article) => article.source),
      headlines: articles.map((article) => article.headline),
    })
  }
  await upsertExtractions(topicId, extractions)
  return extractions
}

function articleRowToNormalized(article: TopicArticleRow): NormalizedArticle {
  return {
    source: article.source,
    headline: article.headline,
    author: article.author,
    published_at: article.published_at,
    body: article.body,
    url: article.url,
    category: article.category,
  }
}

async function mapWithConcurrency<Input, Output>(items: Input[], limit: number, worker: (item: Input) => Promise<Output>) {
  const results: Output[] = []
  let index = 0

  async function run() {
    while (index < items.length) {
      const currentIndex = index
      index += 1
      results[currentIndex] = await worker(items[currentIndex])
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run))
  return results
}
