// Kept for reference — superseded by MilestoneTool.jsx (pages/MilestoneTool.jsx). Not currently routed.
import { Helmet } from 'react-helmet-async'
import Footer from '../components/Footer.jsx'
import Header from '../components/Header.jsx'
import Hero from '../components/Hero.jsx'
import '../styles/landing.css'
import MilestoneCalculator from '../components/MilestoneCalculator'

export default function MilestoneCalculatorPage() {
  return (
    <div className="landing-page">

      <Helmet>
        <title>Child Milestone Savings Calculator — Taru</title>
        <meta name="description" content="Calculate exactly how much you need to invest each month for your child's education, marriage, house, or startup. Free SIP planner for Indian parents. Powered by Taru." />
        <meta name="keywords" content="child education savings calculator India, SIP calculator for child, how much to save for child education, marriage savings calculator, mutual fund for children India, minor folio SIP planner" />
        <link rel="canonical" href="https://taru.money/calculator/" />

        <meta property="og:title" content="Child Milestone Savings Calculator — Taru" />
        <meta property="og:description" content="Plan your child's financial future. Calculate the SIP needed for education, marriage, home, and more." />
        <meta property="og:url" content="https://taru.money/calculator" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://taru.money/og-image.png" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Child Milestone Savings Calculator — Taru" />
        <meta name="twitter:description" content="Plan your child's financial future. Calculate the SIP needed for education, marriage, home, and more." />
        <meta name="twitter:image" content="https://taru.money/og-image.png" />

        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          "name": "Child Milestone Savings Calculator",
          "url": "https://taru.money/calculator",
          "description": "Calculate how much to invest monthly for your child's education, marriage, house down payment, or startup seed fund. Free SIP planner for Indian parents.",
          "applicationCategory": "FinanceApplication",
          "operatingSystem": "Web",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "INR"
          },
          "provider": {
            "@type": "Organization",
            "name": "Taru",
            "url": "https://taru.money"
          }
        })}</script>
      </Helmet>

      {/* ── Navbar ── */}
      <Header active="calculator" scrolledThreshold={10} />

      {/* ── Page hero ── */}
      <Hero srOnly title="Child milestone savings calculator — Taru" />

      {/* ── Calculator ── */}
      <section className="tc-section">
        <div className="wrap">
          <MilestoneCalculator />
        </div>
      </section>

      <Footer showTaxCalculatorLink />

    </div>
  )
}
