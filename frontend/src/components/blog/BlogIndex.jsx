import { useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { blogs } from '../../data/blogs.js'
import '../../styles/landing.css'
import './blog.css'

export default function BlogIndex() {
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
        <title>Blog — Taru | Investing for Your Child's Future</title>
        <meta name="description" content="Practical guides for Indian parents on investing in their child's name — minor mutual fund accounts, SIP calculations, and how to get started." />
        <link rel="canonical" href="https://taru.money/blog/" />

        <meta property="og:title" content="Blog — Taru | Investing for Your Child's Future" />
        <meta property="og:description" content="Practical guides for Indian parents on investing in their child's name — minor mutual fund accounts, SIP calculations, and how to get started." />
        <meta property="og:url" content="https://taru.money/blog" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://taru.money/og-image.png" />

        <meta name="twitter:title" content="Blog — Taru | Investing for Your Child's Future" />
        <meta name="twitter:description" content="Practical guides for Indian parents on investing in their child's name — minor mutual fund accounts, SIP calculations, and how to get started." />
        <meta name="twitter:image" content="https://taru.money/og-image.png" />
      </Helmet>

      <nav className="top" ref={navRef}>
        <div className="inner">
          <Link to="/" className="logo">taru<span className="dot">.</span></Link>
          <div className="nav-links">
            <Link to="/tax-calculator">Tax calculator</Link>
            <Link to="/calculator">Milestone calculator</Link>
            <Link to="/blog" style={{ opacity: 1, fontWeight: 500 }}>Blogs</Link>
            <Link to="/signup" className="btn primary">Get started</Link>
          </div>
        </div>
      </nav>

      <main className="blog-index">
        <header className="blog-index__hero">
          <h1 className="blog-index__title">For parents who think ahead</h1>
          <p className="blog-index__subtitle">Guides on investing in your child's name — no jargon, real numbers.</p>
        </header>

        <section className="blog-index__grid">
          {blogs.map(blog => (
            <article key={blog.slug} className="blog-card">
              <div className="blog-card__meta">
                <span className="reading-time-badge">{blog.readingTime} read</span>
              </div>
              <h2 className="blog-card__title">{blog.title}</h2>
              <p className="blog-card__subtitle">{blog.subtitle}</p>
              <Link to={`/blog/${blog.slug}`} className="blog-card__cta">
                Read article →
              </Link>
            </article>
          ))}
        </section>
      </main>

      <footer>
        <div className="inner">
          <div className="f-left">
            <Link to="/" className="logo">taru<span className="dot">.</span></Link>
            <div className="copy">&copy; 2026 NextGenOS Financial Services Private Limited</div>
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
