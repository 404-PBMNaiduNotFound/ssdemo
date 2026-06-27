import { Navbar } from "./navbar"
import { Hero } from "./hero"
import { Stats } from "./stats"
import { FeaturedOrganizations } from "./featured-organizations"
import { HowItWorks } from "./how-it-works"
import { RoleCards } from "./role-cards"
import { Footer } from "./footer"
import { ReviewCarousel } from "./review-carousel"

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-col gap-20 pb-20 pt-8">
        <Hero />
        <Stats />
        <FeaturedOrganizations />
        <HowItWorks />
        <RoleCards />
        <ReviewCarousel />
      </main>
      <Footer />
    </div>
  )
}

