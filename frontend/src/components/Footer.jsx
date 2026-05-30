import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer style={styles.footer}>
      <span style={styles.brand}>Taru</span>
      <div style={styles.links}>
        <Link to="/privacy" style={styles.link}>Privacy Policy</Link>
        <span style={styles.divider}>·</span>
        <Link to="/terms" style={styles.link}>Terms of Use</Link>
      </div>
    </footer>
  )
}

const styles = {
  footer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    padding: '20px 16px 28px',
    borderTop: '1px solid var(--color-border, #E2E8F0)',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    fontSize: '0.8rem',
    color: 'var(--color-text-secondary, #64748B)',
  },
  brand: {
    fontWeight: 600,
    color: 'var(--color-navy, #0B1628)',
  },
  links: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  link: {
    color: 'var(--color-text-secondary, #64748B)',
    textDecoration: 'none',
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
  },
  divider: {
    userSelect: 'none',
  },
}
