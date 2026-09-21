import { Helmet } from 'react-helmet-async'
import ReactMarkdown from 'react-markdown'
import { privacyContent } from '../legal/index.js'
import Footer from '../components/Footer.jsx'
import Header from '../components/Header.jsx'
import '../styles/landing.css'

// Wrap [bracketed placeholder] text in <mark> for visibility
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

export default function PrivacyPolicy() {
  return (
    <div className="landing-page" style={styles.page}>
      <Helmet>
        <title>Privacy Policy — Taru | How We Handle Your Data</title>
        <meta name="description" content="Taru's Privacy Policy: how we collect, use, store, and protect your family's personal data on the Taru parent and child investing platform." />
        <link rel="canonical" href="https://taru.money/privacy/" />
      </Helmet>

      <Header scrolledThreshold={10} />

      <div style={styles.content}>
        <h1 style={styles.pageTitle}>Privacy Policy</h1>
        <ReactMarkdown components={mdComponents}>{privacyContent}</ReactMarkdown>
      </div>

      <Footer showTaxCalculatorLink />
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
