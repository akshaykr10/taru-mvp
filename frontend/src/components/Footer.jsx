import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer style={styles.footer}>
      <div style={styles.inner}>
        <p style={styles.line}>
          Taru is a brand of NextGenOS Financial Services Private Limited | ARN: 367667 | AMFI-registered Mutual Fund Distributor
        </p>
        <p style={styles.line}>
          Malad West, Mumbai, 400064 | CIN: U66190MH2026PTC472911
        </p>
        <p style={styles.disclaimer}>
          Mutual Fund investments are subject to market risks.
          <br />
          Read all scheme related documents carefully.
        </p>
        <p style={styles.copyright}>
          &copy; 2026 NextGenOS Financial Services Private Limited
        </p>
        <div style={styles.links}>
          <Link to="/privacy" style={styles.link}>Privacy Policy</Link>
          <Link to="/terms" style={styles.link}>Terms of Use</Link>
          <Link to="/eula" style={styles.link}>EULA</Link>
        </div>
      </div>
    </footer>
  )
}

const styles = {
  footer: {
    padding: '28px 32px 32px',
    background: 'var(--color-bg, #FFFFFF)',
    borderTop: '1px solid var(--color-border, #E2E8F0)',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    fontSize: '0.75rem',
    lineHeight: 1.5,
    color: 'var(--color-text-secondary, #64748B)',
    textAlign: 'left',
  },
  inner: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '10px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  line: {
    margin: 0,
  },
  disclaimer: {
    margin: 0,
    fontWeight: 600,
    color: 'var(--color-text-primary, #0B1628)',
  },
  copyright: {
    margin: 0,
  },
  links: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '20px',
    marginTop: '4px',
  },
  link: {
    color: 'var(--color-text-secondary, #64748B)',
    textDecoration: 'none',
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    fontWeight: 600,
  },
}
