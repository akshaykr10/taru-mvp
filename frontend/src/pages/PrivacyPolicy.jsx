import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { privacyContent } from '../legal/index.js'

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
  const navigate = useNavigate()

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <button style={styles.backBtn} onClick={() => navigate(-1)} aria-label="Go back">
          ← Back
        </button>
      </div>

      <div style={styles.content}>
        <h1 style={styles.pageTitle}>Privacy Policy</h1>
        <ReactMarkdown components={mdComponents}>{privacyContent}</ReactMarkdown>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#fff',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    color: '#0B1628',
  },
  topBar: {
    position: 'sticky',
    top: 0,
    background: '#fff',
    borderBottom: '1px solid #E2E8F0',
    padding: '12px 16px',
    zIndex: 10,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    fontSize: '0.95rem',
    color: '#0B1628',
    padding: '6px 0',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  content: {
    maxWidth: '720px',
    margin: '0 auto',
    padding: '24px 16px 48px',
    lineHeight: 1.7,
    fontSize: '0.95rem',
  },
  pageTitle: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontWeight: 600,
    fontSize: '2rem',
    color: '#1a2238',
    marginBottom: '24px',
  },
}
