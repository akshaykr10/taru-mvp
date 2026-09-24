import { Link } from 'react-router-dom'
import { SOCIAL_LINKS, CONTACT_EMAIL } from '../config/links.js'

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
          <Link to="/about" style={styles.link}>About</Link>
          <Link to="/privacy" style={styles.link}>Privacy</Link>
          <Link to="/terms" style={styles.link}>Terms</Link>
          <Link to="/eula" style={styles.link}>EULA</Link>
          <Link to="/blog" style={styles.link}>Learn</Link>
          {showTaxCalculatorLink && <Link to="/tax-calculator" style={styles.link}>Tax Calculator</Link>}
          <a href={`mailto:${CONTACT_EMAIL}`} style={styles.link}>Contact</a>
        </nav>
        <ul style={styles.social} aria-label="Taru on social media">
          {SOCIAL_LINKS.map(s => (
            <li key={s.label}>
              {/* url is null until the real profile URL is filled in
                  (config/links.js) — renders as a placeholder <a>, not a guess. */}
              <a
                href={s.url || undefined}
                aria-label={`Taru on ${s.label}`}
                style={styles.socialLink}
                {...(s.url ? { target: '_blank', rel: 'noopener noreferrer' } : { 'data-todo': 'url-missing' })}
              >
                <SocialIcon name={s.icon} />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  )
}

/* Outline glyphs drawn to match the marketing icon sprite (24px grid,
   1.6 stroke, round caps). Inline rather than sprite refs because the
   sprite only exists on marketing pages, and Footer also renders inside
   the parent dashboard. */
function SocialIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {name === 'instagram' && (<>
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.1" cy="6.9" r="0.6" fill="currentColor" stroke="none" />
      </>)}
      {name === 'linkedin' && (<>
        <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
        <path d="M8 10.5V16" />
        <circle cx="8" cy="7.6" r="0.6" fill="currentColor" stroke="none" />
        <path d="M11.5 16v-5.5" />
        <path d="M11.5 13a2.25 2.25 0 0 1 4.5 0v3" />
      </>)}
      {name === 'facebook' && (
        <path d="M14.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H9.2v3h2.5V21" />
      )}
    </svg>
  )
}

const styles = {
  footer: {
    // Overridable so a page with its own grid (About) can line the footer
    // up with it; unset everywhere else, so the fallbacks apply unchanged.
    padding: '36px var(--footer-gutter, 32px) 48px',
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
    maxWidth: 'var(--footer-max, 1200px)',
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
  social: {
    display: 'flex',
    gap: '4px',
    listStyle: 'none',
    margin: 0,
    padding: 0,
    marginLeft: '-12px',
  },
  socialLink: {
    color: 'var(--color-text-secondary, #64748B)',
    width: '44px',
    height: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}
