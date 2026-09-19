import { useEffect, useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { blogs, getBlogBySlug } from '../../data/blogs.js'
import { BACKEND_URL } from '../../lib/api.js'
import Footer from '../Footer.jsx'
import Header from '../Header.jsx'
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

/* Block types added in Phase 3 (table/assume/callout) kept as-is — this
   pass only changes the classNames they render (mockup's actual .figures/
   .assume/.callout instead of the "blog-*" prefixed ones). 'step' is
   handled separately by renderBody below, since the mockup wraps
   consecutive steps in one shared <ol class="steps">, not one div each. */
function Block({ block }) {
  switch (block.type) {
    case 'paragraph':
      return <p>{renderInline(block.text)}</p>

    case 'heading':
      return <h2>{block.text}</h2>

    case 'pull_quote':
      return <blockquote>{block.text}</blockquote>

    case 'bullet_list':
      return (
        <ul>
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      )

    case 'table':
      return (
        <table className="figures">
          <thead>
            <tr>{block.headers.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      )

    case 'assume':
      return (
        <div className="assume">
          <b>{block.title}</b>
          {renderInline(block.text)}
        </div>
      )

    case 'callout':
      return (
        <div className="callout">
          <b>{block.title}</b>
          <p>{renderInline(block.text)}</p>
        </div>
      )

    default:
      return null
  }
}

/* Groups consecutive 'step' blocks into one <ol class="steps"> (design-
   reference.html's how-to-open-minor-mutual-fund view wraps all 5 steps
   in a single ordered list, not five independent cards). */
function renderBody(body) {
  const nodes = []
  let i = 0
  while (i < body.length) {
    const block = body[i]
    if (block.type === 'step') {
      const group = []
      while (i < body.length && body[i].type === 'step') {
        group.push(body[i])
        i++
      }
      nodes.push(
        <ol className="steps" key={`steps-${i}`}>
          {group.map(s => (
            <li key={s.number}>
              <h3>{s.title}</h3>
              <p>{renderInline(s.text)}</p>
            </li>
          ))}
        </ol>
      )
    } else {
      nodes.push(<Block key={i} block={block} />)
      i++
    }
  }
  return nodes
}

function shareArticle(title) {
  const url = window.location.href
  if (navigator.share) {
    navigator.share({ title, url }).catch(() => {})
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(url).catch(() => {})
  }
}

const DISCLAIMER = "Taru is an AMFI-registered mutual fund distributor. Nothing here is personalised investment advice or a recommendation to buy any particular scheme. Figures are illustrative and based on the assumptions stated above. Mutual fund investments are subject to market risks — read all scheme related documents carefully."

/* Article shell ported verbatim from design-reference.html's
   #view-blog-* templates (back link, article-head with tag/h1/standfirst/
   byline+share, body, disclaimer, next-article, waitlist-block).

   Deliberate deviation: the pre-existing sticky bottom CTA bar (fixed
   "Open your child's account..." / blog4-variant bar linking to /signup)
   is dropped, not carried forward — the mockup has a full structural
   equivalent for "conversion prompt at the end of an article" already
   (an inline, functioning waitlist-block form right after the body), at
   the same point in the page, so it's a replacement rather than a silent
   drop. Its per-post ctaVariant copy ('blog4' for how-to-open-minor-
   mutual-fund) goes with it — the mockup's waitlist-block copy is
   identical on every article, with no per-post variant mechanism to
   attach it to.

   Spliced-in dynamic parts: the waitlist form (real state + fetch to
   {BACKEND_URL}/api/waitlist, payload { email, source: 'article:<slug>' }
   — matching the mockup's own source-derivation logic, one
   view.id.replace('view-blog-','article:') per post), and "next article"
   computed from blogs.js's array order (wrapping around) rather than the
   mockup's hardcoded 5-post loop, since myths-that-delay-action (out of
   scope, no mockup equivalent) sits in that rotation too. */
export default function BlogPost() {
  const { slug } = useParams()
  const blog = getBlogBySlug(slug)

  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState('')

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

  const idx = blogs.findIndex(b => b.slug === slug)
  const next = blogs[(idx + 1) % blogs.length]

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !email.includes('@')) return
    setSubmitting(true)
    setFormError('')
    try {
      const res = await fetch(`${BACKEND_URL}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: `article:${slug}` }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'Something went wrong. Please try again.')
      } else {
        setSubmitted(true)
        setEmail('')
      }
    } catch {
      setFormError('Could not connect. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

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

      <Header active="blog" scrolledThreshold={10} />

      <div className="blog-post">
        <article className="article">
          <Link to="/blog" className="back">
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-arrow-left" /></svg>
            All articles
          </Link>

          <header className="article-head">
            {blog.topic && <span className="tag">{blog.topic}</span>}
            <h1>{blog.title}</h1>
            <p className="standfirst">{blog.subtitle}</p>
            <div className="byline">
              <span>{blog.readingTime} read</span>
              <button className="share" type="button" onClick={() => shareArticle(blog.title)}>
                <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-share" /></svg>
                <span>Share</span>
              </button>
            </div>
          </header>

          <div className="body">
            {renderBody(blog.body)}
          </div>

          <p className="disclaimer">{DISCLAIMER}</p>

          <Link to={`/blog/${next.slug}`} className="next-article">
            <span className="label">Next article</span>
            <b>{next.title}</b>
            <span className="dek">{next.subtitle}</span>
            <span className="go">Read it
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-arrow" /></svg>
            </span>
          </Link>

          <section className="waitlist-block">
            <h2>The hardest part is starting</h2>
            <p className="lede">Join the waitlist and we&apos;ll tell you the day it opens.</p>
            {submitted ? (
              <p className="form-msg" data-state="ok" role="status" aria-live="polite">You&apos;re on the list. We&apos;ll email you when it opens.</p>
            ) : (
              <form className="signup" onSubmit={handleSubmit}>
                <input
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  aria-label="Email address"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setFormError('') }}
                  required
                  disabled={submitting}
                />
                <button className="btn" type="submit" disabled={submitting}>
                  {submitting ? 'Adding…' : 'Join the waitlist'}
                </button>
              </form>
            )}
            {formError && <p className="form-msg" data-state="error" role="status" aria-live="polite">{formError}</p>}
          </section>
        </article>
      </div>

      <Footer showTaxCalculatorLink />
    </div>
  )
}
