import { GoogleGenAI, Type } from '@google/genai'
import { z } from 'zod'
import { getEnv, getOptionalEnv, createMosaicError } from './env'
import type { ArticleExtraction, ComparisonAnalysis, HomeStory, NarrativeAnalysis, NormalizedArticle } from './types'

const HOMEPAGE_MODELS = modelsFromEnv('GEMINI_HOMEPAGE_MODELS', ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'])
const ANALYSIS_MODELS = modelsFromEnv('GEMINI_ANALYSIS_MODELS', ['gemini-3.6-flash', 'gemini-3.6-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'])

function getClient() {
  return new GoogleGenAI({ apiKey: getEnv('GEMINI_API_KEY') })
}

function modelsFromEnv(name: string, defaults: string[]) {
  const configured = getOptionalEnv(name)
    ?.split(',')
    .map((model) => model.trim())
    .filter(Boolean)

  return configured?.length ? configured : defaults
}

async function generateJson<T>(
  models: string[],
  prompt: string,
  responseSchema: Record<string, unknown>,
  validator?: z.ZodType<T>,
): Promise<T> {
  const failures: Array<{ model: string; error: unknown }> = []

  for (const model of models) {
    try {
      return await generateJsonWithModel<T>(model, prompt, responseSchema, validator)
    } catch (error) {
      failures.push({ model, error: normalizeGeminiError(error) })
    }
  }

  throw createMosaicError('GEMINI_ALL_MODELS_FAILED', 'All configured Gemini models failed for this structured JSON generation.', { failures })
}

async function generateJsonWithModel<T>(
  model: string,
  prompt: string,
  responseSchema: Record<string, unknown>,
  validator?: z.ZodType<T>,
): Promise<T> {
  const response = await getClient().models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0.2,
    },
  })

  const text = response.text
  if (!text) throw createMosaicError('GEMINI_EMPTY_RESPONSE', `Gemini ${model} returned an empty JSON response.`)

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw createMosaicError('GEMINI_JSON_PARSE_FAILED', `Gemini ${model} returned invalid JSON.`, { error, text })
  }

  if (validator) {
    const result = validator.safeParse(parsed)
    if (!result.success) {
      throw createMosaicError('GEMINI_VALIDATION_FAILED', `Gemini ${model} output failed schema validation.`, {
        validationError: result.error.issues,
        text,
      })
    }
    return result.data
  }

  return parsed as T
}

function normalizeGeminiError(error: unknown) {
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    return {
      name: record.name,
      message: record.message,
      status: record.status,
      code: record.code,
      details: record.details,
    }
  }

  return String(error)
}

const sourcePreviewSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    url: { type: Type.STRING },
  },
  required: ['name', 'url'],
}

const homeCardOutputZod = z.object({
  neutral_headline: z.string(),
  snippet: z.string(),
  sources_preview: z.array(
    z.object({
      name: z.string(),
      url: z.string(),
    }),
  ),
})

const articleExtractionListZod = z.array(
  z.object({
    source: z.string(),
    url: z.string(),
    headline: z.string(),
    claims: z.array(
      z.object({
        claim: z.string(),
        type: z.enum(['reported_fact', 'quoted_statement', 'interpretation', 'framing']),
      }),
    ),
  }),
)

const comparisonAnalysisZod = z.object({
  overall_note: z.string(),
  claims: z.array(
    z.object({
      claim_summary: z.string(),
      type: z.enum(['reported_fact', 'quoted_statement', 'interpretation', 'framing']),
      shared_by: z.array(z.string()),
      conflicting: z.array(
        z.object({
          source: z.string(),
          stance: z.string(),
          emphasis: z.string(),
          emotion: z.string(),
        }),
      ),
      progression: z.string(),
      consensus_level: z.enum(['low', 'medium', 'high']),
    }),
  ),
})

const narrativeOutputZod = z.object({
  opening_paragraph: z.string(),
  sections: z.array(
    z.object({
      label: z.string(),
      body: z.string(),
    }),
  ),
  conclusion: z.string(),
  differs_on: z.string(),
})

export function calculateCoverageOverlapPercent(comparison: ComparisonAnalysis): number {
  if (!comparison.claims || comparison.claims.length === 0) return 0

  const weights = { high: 1.0, medium: 0.6, low: 0.2 }
  const totalScore = comparison.claims.reduce((acc, c) => acc + (weights[c.consensus_level] ?? 0.5), 0)
  const percent = Math.round((totalScore / comparison.claims.length) * 100)

  return Math.max(0, Math.min(100, percent))
}

export async function generateHomepageCardForTopic(input: {
  topic_id: string
  category: HomeStory['category']
  articles: NormalizedArticle[]
}): Promise<HomeStory> {
  const schema = {
    type: Type.OBJECT,
    properties: {
      neutral_headline: { type: Type.STRING },
      snippet: { type: Type.STRING },
      sources_preview: {
        type: Type.ARRAY,
        items: sourcePreviewSchema,
      },
    },
    required: ['neutral_headline', 'snippet', 'sources_preview'],
  }

  const result = await generateJson<Omit<HomeStory, 'topic_id' | 'source_count' | 'category' | 'updated_at'>>(
    HOMEPAGE_MODELS,
    [
      'You produce neutral topic cards for Mosaic, a news comparison platform.',
      'Never declare which source is correct. Never introduce information absent from the source articles.',
      'Return only JSON matching the schema. Write disagreement as disagreement, not resolution.',
      '',
      JSON.stringify({
        articles: input.articles.map((article) => ({
          source: article.source,
          headline: article.headline,
          body: article.body,
          url: article.url,
        })),
      }),
    ].join('\n'),
    schema,
    homeCardOutputZod,
  )

  return {
    topic_id: input.topic_id,
    neutral_headline: result.neutral_headline,
    snippet: result.snippet,
    source_count: input.articles.length,
    sources_preview: result.sources_preview,
    category: input.category,
    updated_at: new Date().toISOString(),
  }
}

export async function extractArticleClaims(articles: NormalizedArticle[]): Promise<ArticleExtraction[]> {
  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        source: { type: Type.STRING },
        url: { type: Type.STRING },
        headline: { type: Type.STRING },
        claims: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              claim: { type: Type.STRING },
              type: {
                type: Type.STRING,
                enum: ['reported_fact', 'quoted_statement', 'interpretation', 'framing'],
              },
            },
            required: ['claim', 'type'],
          },
        },
      },
      required: ['source', 'url', 'headline', 'claims'],
    },
  }

  return generateJson<ArticleExtraction[]>(
    ANALYSIS_MODELS,
    [
      'Extract claims from these source articles for Mosaic.',
      'Allowed claim types: reported_fact, quoted_statement, interpretation, framing.',
      'Do not add claims not present in the articles. Do not decide which claim is correct.',
      'Return only JSON matching the schema.',
      '',
      JSON.stringify({ articles }),
    ].join('\n'),
    schema,
    articleExtractionListZod,
  )
}

export async function synthesizeComparison(extractions: ArticleExtraction[]): Promise<ComparisonAnalysis> {
  const schema = {
    type: Type.OBJECT,
    properties: {
      overall_note: { type: Type.STRING },
      claims: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            claim_summary: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['reported_fact', 'quoted_statement', 'interpretation', 'framing'] },
            shared_by: { type: Type.ARRAY, items: { type: Type.STRING } },
            conflicting: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING },
                  stance: { type: Type.STRING },
                  emphasis: { type: Type.STRING },
                  emotion: { type: Type.STRING },
                },
                required: ['source', 'stance', 'emphasis', 'emotion'],
              },
            },
            progression: { type: Type.STRING },
            consensus_level: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
          },
          required: ['claim_summary', 'type', 'shared_by', 'conflicting', 'progression', 'consensus_level'],
        },
      },
    },
    required: ['overall_note', 'claims'],
  }

  return generateJson<ComparisonAnalysis>(
    ANALYSIS_MODELS,
    [
      'Compare source claims for Mosaic.',
      'Represent disagreement. Never resolve it. Never state which source is correct.',
      'Use only the extracted source claims. Return only JSON matching the schema.',
      '',
      JSON.stringify({ extractions }),
    ].join('\n'),
    schema,
    comparisonAnalysisZod,
  )
}

export async function writeNarrative(comparison: ComparisonAnalysis): Promise<NarrativeAnalysis> {
  const schema = {
    type: Type.OBJECT,
    properties: {
      opening_paragraph: { type: Type.STRING },
      sections: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            body: { type: Type.STRING },
          },
          required: ['label', 'body'],
        },
      },
      conclusion: { type: Type.STRING },
      differs_on: { type: Type.STRING },
    },
    required: ['opening_paragraph', 'sections', 'conclusion', 'differs_on'],
  }

  const result = await generateJson<Omit<NarrativeAnalysis, 'coverage_overlap_percent'>>(
    ANALYSIS_MODELS,
    [
      'Write the Mosaic narrative from the comparison analysis only.',
      'Opening paragraph, then labeled sections covering common ground and differences, then a neutral conclusion.',
      'Do not introduce new claims. Do not decide which source is correct.',
      'Return only JSON matching the schema.',
      '',
      JSON.stringify({ comparison }),
    ].join('\n'),
    schema,
    narrativeOutputZod,
  )

  const coverage_overlap_percent = calculateCoverageOverlapPercent(comparison)

  return {
    ...result,
    coverage_overlap_percent,
  }
}
