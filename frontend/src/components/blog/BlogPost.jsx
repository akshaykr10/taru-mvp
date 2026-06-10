import { useEffect } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { getBlogBySlug } from '../../data/blogs.js'
import './blog.css'

function renderInline(text) {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

function Block({ block }) {
  switch (block.type) {
    case 'paragraph':
      return <p className="blog-body__p">{renderInline(block.text)}</p>

    case 'heading':
      return <h2 className="blog-body__h2">{block.text}</h2>

    case 'pull_quote':
      return (
        <blockquote className="blog-pull-quote">
          {block.text}
        </blockquote>
      )

    case 'bullet_list':
      return (
        <ul className="blog-body__list">
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      )

    case 'step':
      return (
        <div className="blog-step">
          <div className="blog-step__number">{block.number}</div>
          <div className="blog-step__content">
            <h3 className="blog-step__title">{block.title}</h3>
            <p className="blog-step__body">{renderInline(block.text)}</p>
          </div>
        </div>
      )

    default:
      return null
  }
}

const CTA_DEFAULT = 'Open your child\'s account in minutes → Start on Taru'
const CTA_BLOG4   = 'Skip the steps — open your child\'s account directly on Taru →'

export default function BlogPost() {
  const { slug } = useParams()
  const blog = getBlogBySlug(slug)

  useEffect(() => {
    if (!blog) return
    // TODO: replace with real analytics event when GA4 / dedicated event is set up
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'blog_view', { blog_slug: slug })
    } else {
      console.log('blog_view', slug)
    }
  }, [slug, blog])

  if (!blog) return <Navigate to="/blog" replace />

  const ctaText = blog.ctaVariant === 'blog4' ? CTA_BLOG4 : CTA_DEFAULT

  return (
    <>
      <Helmet>
        <title>{blog.title} — Taru</title>
        <meta name="description" content={blog.metaDescription} />
      </Helmet>

      <nav className="blog-nav">
        <Link to="/" className="blog-nav__logo">Taru</Link>
        <Link to="/blog" className="blog-nav__back">← All articles</Link>
      </nav>

      <article className="blog-post">
        <header className="blog-hero">
          <span className="reading-time-badge">{blog.readingTime} read</span>
          <h1 className="blog-hero__title">{blog.title}</h1>
          <p className="blog-hero__subtitle">{blog.subtitle}</p>
        </header>

        <div className="blog-body">
          {blog.body.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </div>
      </article>

      {/* Sticky CTA bar */}
      <div className="blog-cta-bar">
        <Link to="/signup" className="blog-cta-bar__link">
          {ctaText}
        </Link>
      </div>

      <footer className="blog-footer">
        <Link to="/blog" className="blog-footer__blog-link">← Back to all articles</Link>
        <div className="blog-footer__links">
          <Link to="/privacy">Privacy Policy</Link>
          <span>·</span>
          <Link to="/terms">Terms of Use</Link>
        </div>
        <span className="blog-footer__brand">Taru</span>
      </footer>
    </>
  )
}
