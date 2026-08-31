import { useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import ReactMarkdown from 'react-markdown'
import { termsContent } from '../legal/index.js'
import '../styles/landing.css'

function BracketHighlight({ children }) {
  if (typeof children !== 'string') return children
  const parts = children.split(/(\[[^\]]+\])/g)
  return parts.map((part, i) =>
    /^\[[^\]]+\]$/.test(part)
      ? <mark key={i} style={{ background: '#FEF08A', borderRadius: '3px', padding: '0 2px' }}>{part}</mark>
      : part
  )
}

function highlightComponents(tag) {
  return function HighlightedTag({ children, ...props }) {
    const Tag = tag
    return (
      <Tag {...props}>
        {typeof children === 'string'
          ? <BracketHighlight>{children}</BracketHighlight>
          : children}
      </Tag>
    )
  }
}

const mdComponents = {
  p: highlightComponents('p'),
  li: highlightComponents('li'),
}

export default function TermsOfUse() {
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
    <div className="landing-page" style={styles.page}>
      <Helmet>
        <title>Terms of Use — Taru</title>
        <meta name="description" content="Taru's Terms of Use: the rules governing your access to and use of the Taru parent and child investing platform." />
        <link rel="canonical" href="https://taru.money/terms/" />
      </Helmet>

      <nav className="top" ref={navRef}>
        <div className="inner">
          <Link to="/" className="logo">taru<span className="dot">.</span></Link>
          <div className="nav-links">
            <Link to="/tax-calculator">Tax calculator</Link>
            <Link to="/calculator">Milestone calculator</Link>
            <Link to="/blog">Blogs</Link>
            <Link to="/signup" className="btn primary">Get started</Link>
          </div>
        </div>
      </nav>

      <div style={styles.content}>
        <h1 style={styles.pageTitle}>Terms of Use</h1>
        <ReactMarkdown components={mdComponents}>{termsContent}</ReactMarkdown>
      </div>

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

const styles = {
  page: {
    minHeight: '100vh',
  },
  content: {
    maxWidth: '720px',
    margin: '0 auto',
    padding: 'calc(48px + 92px) 16px 48px',
    lineHeight: 1.7,
    fontSize: '0.95rem',
  },
  pageTitle: {
    fontSize: '2rem',
    marginBottom: '24px',
  },
}
