import { Footer, Header } from '@/components/mosaic-shell'
import { HomeClient } from '@/components/home-client'

export default function Page() {
  return (
    <div id="top" className="min-h-screen bg-background text-foreground">
      <Header />
      <HomeClient />
      <Footer />
    </div>
  )
}
