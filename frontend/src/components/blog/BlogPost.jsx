import { useEffect, useRef } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { getBlogBySlug } from '../../data/blogs.js'
import '../../styles/landing.css'
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
  const navRef = useRef(null)

  useEffect(() => {
    function onScroll() {
      if (!navRef.current) return
      navRef.current.classList.toggle('scrolled', window.scrollY > 10)
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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
    <div className="landing-page">
      <Helmet>
        <title>{blog.title} — Taru</title>
        <meta name="description" content={blog.metaDescription} />
        <link rel="canonical" href={`https://taru.money/blog/${slug}/`} />

        <meta property="og:title" content={`${blog.title} — Taru`} />
        <meta property="og:description" content={blog.metaDescription} />
        <meta property="og:url" content={`https://taru.money/blog/${slug}`} />
        <meta property="og:type" content="article" />
        <meta property="og:image" content={blog.coverImage || 'https://taru.money/og-image.png'} />

        <meta name="twitter:title" content={`${blog.title} — Taru`} />
        <meta name="twitter:description" content={blog.metaDescription} />
        <meta name="twitter:image" content={blog.coverImage || 'https://taru.money/og-image.png'} />

        {/* No named author/byline exists anywhere on the site for these posts
            (all first-person essays, none individually attributed) — author
            is Taru the Organization, not a fabricated named Person. */}
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          "headline": blog.title,
          "description": blog.metaDescription,
          "url": `https://taru.money/blog/${slug}`,
          "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": `https://taru.money/blog/${slug}`,
          },
          "image": blog.coverImage || 'https://taru.money/og-image.png',
          "datePublished": blog.datePublished,
          "dateModified": blog.dateModified || blog.datePublished,
          "author": {
            "@type": "Organization",
            "name": "Taru",
            "url": "https://taru.money",
          },
          "publisher": {
            "@type": "Organization",
            "name": "Taru",
            "legalName": "NextGenOS Financial Services Private Limited",
            "url": "https://taru.money",
            "logo": {
              "@type": "ImageObject",
              "url": "https://taru.money/og-image.png",
            },
          },
        })}</script>
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

      <footer className="blog-post-footer">
        <div className="inner">
          <div className="f-left">
            <Link to="/" className="logo">taru<span className="dot">.</span></Link>
            <div className="copy">&copy; 2026 NextGenOS Financial Services Private Limited</div>
          </div>
          <div className="fnav">
            <Link to="/blog">← All articles</Link>
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
