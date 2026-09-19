/* Shared "tc-hero" pattern used by TaxCalculator and MilestoneTool (and,
   historically, the now-unrouted MilestoneCalculatorPage).
   srOnly reproduces the visually-hidden SEO heading pattern (no `wrap`/
   subtitle, just a `.tc-seo-text` <h1>); otherwise renders the visible
   hero (title + optional subtitle) used by TaxCalculator. */
export default function Hero({ title, subtitle, srOnly = false }) {
  if (srOnly) {
    return (
      <header className="tc-hero">
        <h1 className="tc-seo-text">{title}</h1>
      </header>
    )
  }

  return (
    <header className="tc-hero">
      <div className="wrap">
        <h1 className="tc-hero__title serif">{title}</h1>
        {subtitle && <p className="tc-hero__sub">{subtitle}</p>}
      </div>
    </header>
  )
}
