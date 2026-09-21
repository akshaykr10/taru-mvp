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
      waitlist section, so variant="standard" links to the home page's
      waitlist section ("/#waitlist") instead of a bare "#waitlist" hash
      (which would be a no-op on a page other than Landing). The product
      isn't live yet ("Going live soon" on the home hero), so every CTA
      across the marketing site points at the waitlist, not /signup.
   5. Logo: swapped from the mockup's plain "taru." text to the
      taru.money wordmark lockup (tree mark + two-tone text), supplied
      as a PNG at public/brand/taru-logo.png. Height is capped via CSS
      to match the text logo's old visual weight in the masthead. */
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
    : <Button href="/#waitlist" variant="primary" className="btn--sm">Join the waitlist</Button>

  return (
    <>
      <IconSprite />
      <div className="top" id={variant === 'home' ? 'topnav' : undefined} ref={navRef}>
        <header className="section-wrap masthead">
          <Link to="/" className="logo logo--mark">
            <img src="/brand/taru-logo.png" alt="taru.money" />
          </Link>
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
