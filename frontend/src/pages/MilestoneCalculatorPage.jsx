import { useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import '../styles/landing.css'
import MilestoneCalculator from '../components/MilestoneCalculator'

export default function MilestoneCalculatorPage() {
  const navRef = useRef(null)

  useEffect(() => {
    function onScroll() {
      if (!navRef.current) return
      navRef.current.classList.toggle('scrolled', window.scrollY > 10)
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="landing-page">

      <Helmet>
        <title>Milestone Calculator — Taru</title>
        <meta name="description" content="Calculate how much you need to invest for your child's education, marriage, home, and more. Free SIP planner for Indian parents." />
        <meta property="og:title" content="How much do you need to invest for your child's future?" />
        <meta property="og:description" content="Tell us their age and what you're saving for — college, marriage, or their first home. We'll show you the exact monthly SIP to get there." />
        <meta property="og:url" content="https://taru.money/calculator" />
        <meta property="og:type" content="website" />
      </Helmet>

      {/* ── Navbar ── */}
      <nav className="top" ref={navRef}>
        <div className="inner">
          <Link to="/" className="logo">taru<span className="dot">.</span></Link>
          <div className="nav-links">
            <Link to="/blog">Blogs</Link>
            <Link to="/tax-calculator">Tax calculator</Link>
            <Link to="/signup" className="btn primary">Get started</Link>
          </div>
        </div>
      </nav>

      {/* ── Page hero ── */}
      <header className="tc-hero">
        <div className="wrap">
          <h1 className="tc-hero__title serif">
            How much do you need to invest for your child&apos;s future?
          </h1>
          <p className="tc-hero__sub">
            Tell us their age and what you&apos;re saving for — college, marriage, or their first home.
            We&apos;ll show you the exact monthly SIP to get there.
          </p>
        </div>
      </header>

      {/* ── Calculator ── */}
      <section className="tc-section">
        <div className="wrap">
          <MilestoneCalculator />
        </div>
      </section>

      {/* ── Footer ── */}
      <footer>
        <div className="inner">
          <div className="f-left">
            <Link to="/" className="logo">taru<span className="dot">.</span></Link>
            <div className="copy">&copy; 2026 Taru Money Pvt. Ltd.</div>
          </div>
          <div className="fnav">
            <Link to="/blog">Blogs</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </div>
          <div className="made-tag">
            <span className="flag-dot"></span>
            Made in India, for India
          </div>
        </div>
      </footer>

    </div>
  )
}
