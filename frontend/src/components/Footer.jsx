import { Link } from 'react-router-dom'

/* Footer is shared between marketing pages and the authenticated parent
   dashboard (rendered via ParentLayout.jsx, out of scope for this pass).
   Ported from design-reference.html's <footer class="foot"> (copy, paragraph
   grouping, and link set/order/labels are verbatim), but kept as inline
   styles with var(--x, fallback) rather than a ".foot" CSS class — a real
   CSS class scoped under .landing-page would leave the dashboard's Footer
   completely unstyled (no .landing-page ancestor there), whereas the
   fallback values here reproduce today's dashboard look exactly.

   showTaxCalculatorLink is an explicit opt-in (default false) so marketing
   pages can show that link (not present in the mockup's footer at all)
   without it leaking into the parent dashboard — callers say what they
   are; Footer doesn't infer it from the route.

   Known gap: the mockup's footer links have a hover state
   (color shift + underline). Left out here — Footer has to render
   correctly in two very different visual contexts via plain inline
   styles, and :hover isn't expressible that way without introducing a
   new stylesheet dependency just for this. */
export default function Footer({ showTaxCalculatorLink = false }) {
  return (
    <footer style={styles.footer}>
      <div style={styles.inner}>
        <p style={styles.line}>
          Taru is a brand of NextGenOS Financial Services Private Limited, an AMFI-registered mutual fund distributor. ARN: 367667. CIN: U66190MH2026PTC472911. Malad West, Mumbai 400064.
        </p>
        <p style={styles.line}>
          Mutual fund investments are subject to market risks. Read all scheme related documents carefully. Taru does not guarantee returns.
        </p>
        <p style={styles.line}>
          App screens are illustrative. Figures are examples, not returns or projections.
        </p>
        <p style={styles.line}>
          &copy; 2026 NextGenOS Financial Services Private Limited
        </p>
        <nav style={styles.links}>
          <Link to="/privacy" style={styles.link}>Privacy</Link>
          <Link to="/terms" style={styles.link}>Terms</Link>
          <Link to="/eula" style={styles.link}>EULA</Link>
          <Link to="/blog" style={styles.link}>Learn</Link>
          {showTaxCalculatorLink && <Link to="/tax-calculator" style={styles.link}>Tax Calculator</Link>}
        </nav>
      </div>
    </footer>
  )
}

const styles = {
  footer: {
    padding: '36px 32px 48px',
    background: 'var(--color-bg, #FFFFFF)',
    borderTop: '1px solid var(--color-border, #E2E8F0)',
    fontFamily: "var(--sans, 'DM Sans', system-ui, sans-serif)",
    fontSize: '0.8125rem',
    lineHeight: 1.5,
    color: 'var(--color-text-secondary, #64748B)',
    textAlign: 'left',
  },
  inner: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '8px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  line: {
    margin: 0,
    maxWidth: '46rem',
  },
  links: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '20px',
    marginTop: '8px',
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
