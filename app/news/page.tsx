import { Footer, Header } from '@/components/mosaic-shell'
import { NewsClient } from '@/components/news-client'

export default function NewsPage() {
  return (
    <div id="top" className="min-h-screen bg-background text-foreground">
      <Header />
      <NewsClient />
      <Footer />
    </div>
  )
}
