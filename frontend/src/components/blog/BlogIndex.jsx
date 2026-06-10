import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { blogs } from '../../data/blogs.js'
import './blog.css'

export default function BlogIndex() {
  return (
    <>
      <Helmet>
        <title>Blog — Taru | Investing for Your Child's Future</title>
        <meta name="description" content="Practical guides for Indian parents on investing in their child's name — minor mutual fund accounts, SIP calculations, and how to get started." />
      </Helmet>

      <nav className="blog-nav">
        <Link to="/" className="blog-nav__logo">Taru</Link>
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

      <footer className="blog-footer">
        <span className="blog-footer__brand">Taru</span>
        <div className="blog-footer__links">
          <Link to="/privacy">Privacy Policy</Link>
          <span>·</span>
          <Link to="/terms">Terms of Use</Link>
        </div>
      </footer>
    </>
  )
}
