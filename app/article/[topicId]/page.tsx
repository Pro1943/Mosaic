import { Footer, Header } from '@/components/mosaic-shell'
import { ArticleClient } from '@/components/article-client'

export default async function ArticlePage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params

  return (
    <div id="top" className="min-h-screen bg-background text-foreground">
      <Header />
      <ArticleClient topicId={topicId} />
      <Footer />
    </div>
  )
}
