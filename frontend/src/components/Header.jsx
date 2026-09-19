import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import Button from './Button.jsx'
import IconSprite from './IconSprite.jsx'

/* Masthead ported verbatim from design-reference.html:

     <header class="wrap masthead">
       <a class="logo" href="#/">taru.</a>
       <nav class="nav">
         <a class="nav-link" id="nav-tools" href="#/tools">Tools</a>
         <a class="nav-link" id="nav-learn" href="#/learn">Learn</a>
         <a class="btn btn--sm" href="#/waitlist">Join the waitlist</a>
       </nav>
     </header>

   Deliberate deviations from the mockup (all flagged, none silent):

   1. Real routes (/calculator, /blog), not the mockup's hash routes —
      per the "no route renames" constraint for this pass.
   2. The mockup's masthead is a plain, non-fixed <header>. Every other
      marketing page sizes its own top padding to clear a FIXED nav, and
      TaxCalculator.jsx (which shares this component) is out of scope for
      this pass — so the outer fixed/blur-on-scroll wrapper (class "top",
      landing.css) is kept and the mockup's masthead markup is nested
      inside it, rather than replacing it outright.
   3. Active-link state: the mockup sets aria-current="page" on the
      current nav-link via its router, with NO visual styling at all for
      it (no [aria-current] rule anywhere in its CSS — accessible, but
      invisible to sighted users). The old Header visibly bolded the
      active link. Both are kept: aria-current (matches mockup semantics)
      plus a `.nav-link[aria-current="page"]` visual style (landing.css,
      not in the mockup) so the pre-existing sighted-user highlighting
      survives.
   4. CTA label/target: the mockup uses "Join the waitlist" everywhere,
      hash-linked to a waitlist section present on every view of its
      single-page demo. Our non-home marketing pages have no on-page
      waitlist section — their existing "Get started" -> /signup CTA is
      the site's real, working signup entry point and has no equivalent
      in the mockup's world (nothing there is actually live yet), so it's
      kept for variant="standard" rather than replaced with a dead-end
      "join waitlist" label.
   5. Logo: mockup is plain "taru." text, one color, no two-tone dot.
      Ported verbatim here. PrivacyPolicy.jsx/TermsOfUse.jsx (out of
      scope) still hand-roll their own nav with the old dotted logo —
      untouched, since they don't use this component. */
export default function Header({ variant = 'standard', active, scrolledThreshold = 24 }) {
  const navRef = useRef(null)

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > scrolledThreshold)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [scrolledThreshold])

  const cta = variant === 'home'
    ? <Button href="#waitlist" variant="primary" className="btn--sm">Join the waitlist</Button>
    : <Button to="/signup" variant="primary" className="btn--sm">Get started</Button>

  return (
    <>
      <IconSprite />
      <div className="top" id={variant === 'home' ? 'topnav' : undefined} ref={navRef}>
        <header className="section-wrap masthead">
          <Link to="/" className="logo">taru.</Link>
          <nav className="nav">
            <Link to="/calculator" className="nav-link" aria-current={active === 'calculator' ? 'page' : undefined}>Tools</Link>
            <Link to="/blog" className="nav-link" aria-current={active === 'blog' ? 'page' : undefined}>Learn</Link>
            {cta}
          </nav>
        </header>
      </div>
    </>
  )
}
