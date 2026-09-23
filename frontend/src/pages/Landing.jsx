import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { BACKEND_URL } from '../lib/api.js'
import Footer from '../components/Footer.jsx'
import Header from '../components/Header.jsx'
import Button from '../components/Button.jsx'
import '../styles/landing.css'

/* Home view ported verbatim from design-reference.html's #view-home
   (hero, compare band, apps band x2, why band, clarity/faq band, waitlist
   band) — markup, class names and copy match section-for-section.

   Spliced-in dynamic parts (none of this exists in the static mockup):
   - The waitlist form: real state + fetch to {BACKEND_URL}/api/waitlist,
     payload { email, source: 'landing' }, data-testid on the submit
     button — same endpoint/shape Landing.jsx already used pre-rewrite.
   - Reveal-on-scroll: the mockup has NO scroll-reveal at all (checked —
     no IntersectionObserver, no .reveal class anywhere in its CSS/JS).
     Kept the pre-existing IntersectionObserver-driven .reveal/.reveal.in
     fade-up on each band, since there's nothing in the mockup to prefer
     instead. */
export default function Landing() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
      }),
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )
    document.querySelectorAll('.landing-page .reveal').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const prev = document.body.style.overflowX
    document.body.style.overflowX = 'hidden'
    return () => { document.body.style.overflowX = prev }
  }, [])

  /* Cross-page "Join the waitlist" links (Header on non-home routes) do a
     full navigation to "/#waitlist", not a client-side route change — the
     browser's own scroll-to-fragment fires before this SPA has rendered
     the #waitlist section, so it lands at the top of the page instead.
     Re-run the scroll ourselves once the section actually exists. */
  useEffect(() => {
    if (window.location.hash !== '#waitlist') return
    const el = document.getElementById('waitlist')
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !email.includes('@')) return
    setSubmitting(true)
    setFormError('')
    try {
      const res = await fetch(`${BACKEND_URL}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'landing' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'Something went wrong. Please try again.')
      } else {
        setSubmitted(true)
        setEmail('')
      }
    } catch {
      setFormError('Could not connect. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="landing-page">

      <Helmet>
        <title>Taru — Invest for Your Child's Future | Family Fintech India</title>
        <meta name="description" content="Taru helps Indian parents invest in mutual funds for their children and teaches kids about money through a living garden. Start your child's financial journey today." />
        <meta name="keywords" content="invest for child India, mutual fund for children, kids financial education, family fintech, SIP for child education, minor folio mutual fund" />
        <link rel="canonical" href="https://taru.money/" />
        <meta property="og:title" content="Taru — Invest for Your Child's Future" />
        <meta property="og:description" content="Taru helps Indian parents invest in mutual funds for their children and teaches kids about money through a living garden. Start your child's financial journey today." />
        <meta property="og:url" content="https://taru.money/" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://taru.money/og-image.png" />
        <meta name="twitter:title" content="Taru — Invest for Your Child's Future" />
        <meta name="twitter:description" content="Taru helps Indian parents invest in mutual funds for their children and teaches kids about money through a living garden. Start your child's financial journey today." />
        <meta name="twitter:image" content="https://taru.money/og-image.png" />

        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Taru",
          "legalName": "NextGenOS Financial Services Private Limited",
          "url": "https://taru.money",
          "logo": "https://taru.money/og-image.png",
          "description": "Taru helps Indian parents invest in mutual funds for their children and teaches kids about money through a living garden.",
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "Taru",
          "url": "https://taru.money",
        })}</script>
      </Helmet>

      <Header variant="home" />

      {/* ══════════ HERO ══════════ */}
      <section className="section-wrap hero reveal">
        <div>
          <span className="tag">
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-seed" /></svg>
            Mutual funds in your child&apos;s name
          </span>
          <h1>Invest in mutual funds for your child&apos;s future.<br /><em className="italic-forest">In their name.</em></h1>
          <p>Open a mutual fund folio in your child&apos;s name. You manage it until they turn 18.</p>
          <Button href="#waitlist" variant="primary">
            Join the waitlist
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-arrow" /></svg>
          </Button>
          <p className="hero-note">Going live soon. Waitlist members get access first.</p>
          <p className="hero-trust"><svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-shield-check" /></svg>AMFI-registered Mutual Fund Distributor · ARN 367667</p>
        </div>
        <div className="hero-art">
          <div className="phone" role="img" aria-label="Parent app screen showing a child's portfolio and goal progress">
            <div className="screen">
              <div className="s-top"><span>9:41</span><span>Aarav&apos;s portfolio</span></div>
              <div className="s-card">
                <div className="s-label">Invested so far</div>
                <div className="s-amt">₹1,84,000</div>
                <div className="s-row" style={{ marginTop: 10 }}>
                  <span className="s-label">Goal · College fund</span>
                  <span className="s-chip">62%</span>
                </div>
                <div className="s-bar"><i style={{ width: '62%' }} /></div>
              </div>
              <div className="s-card">
                <div className="s-row">
                  <div>
                    <div className="s-label">Monthly SIP</div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginTop: 1 }}>₹5,000</div>
                  </div>
                  <span className="s-chip">Active</span>
                </div>
                <div className="s-row" style={{ marginTop: 10, paddingTop: 9, borderTop: '1px solid var(--rule-soft)' }}>
                  <span className="s-label">Next instalment</span>
                  <span style={{ fontSize: 11 }}>5 Oct</span>
                </div>
              </div>
              <div className="s-card">
                <div className="s-row">
                  <span className="s-label">Aarav can see</span>
                  <span className="s-chip">Progress only</span>
                </div>
              </div>
              <div className="s-nav">
                <svg className="icon on" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-home" /></svg>
                <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-target" /></svg>
                <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-chart" /></svg>
                <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-user" /></svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ WHY IT MATTERS ══════════ */}
      <section className="band band--wash reveal fold-why">
        <div className="section-wrap">
          <span className="eyebrow">Why their name matters</span>
          <h2>Give their future a place of its own.</h2>
          <p className="lede">It&apos;s more than money set aside for their future. It&apos;s a financial start they can grow up with.</p>
          <div className="progression">
            <div className="progression-item">
              <span className="progression-num">01</span>
              <h3 className="progression-label">Their name</h3>
              <p className="progression-desc">The investment is made in your child&apos;s name.</p>
            </div>
            <div className="progression-item">
              <span className="progression-num">02</span>
              <h3 className="progression-label">Their future</h3>
              <p className="progression-desc">A dedicated investment for the future you&apos;re helping them build.</p>
            </div>
            <div className="progression-item">
              <span className="progression-num">03</span>
              <h3 className="progression-label">Their story</h3>
              <p className="progression-desc">As they grow, they can see it and learn from what you&apos;re building together.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ APPS ══════════ */}
      <section className="band reveal" id="apps">
        <div className="section-wrap">
          <h2>Two apps that work together</h2>
          <p className="lede">You use one, your child uses the other.</p>

          <div className="app">
            <div>
              <div className="app-eyebrow"><svg className="icon" viewBox="0 0 24 24" style={{ width: 16, height: 16 }} aria-hidden="true"><use href="#i-user" /></svg>Your app</div>
              <h2 style={{ fontSize: '1.5rem' }}>Open the folio, set the SIP</h2>
              <ul className="feat">
                <li><svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-check" /></svg><span><b>No PAN needed for your child.</b> Their birth certificate and your KYC is enough.</span></li>
                <li><svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-target" /></svg><span><b>Pick a goal and an amount.</b> From ₹500 a month.</span></li>
                <li><svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-calendar" /></svg><span><b>Pause, increase or stop any time.</b> Runs on your bank mandate.</span></li>
                <li><svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-eye" /></svg><span><b>You choose what your child sees.</b> The full amount, or only the progress.</span></li>
              </ul>
            </div>
            <div className="app-art">
              <div className="phone" role="img" aria-label="Parent app screen showing goal setup with a monthly amount">
                <div className="screen">
                  <div className="s-top"><span>New goal</span><span>Step 2 of 3</span></div>
                  <div className="s-card">
                    <div className="s-label">Goal</div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginTop: 2 }}>Undergraduate college</div>
                    <div className="s-row" style={{ marginTop: 10, paddingTop: 9, borderTop: '1px solid var(--rule-soft)' }}>
                      <span className="s-label">Target year</span><span style={{ fontSize: 11 }}>2038 · Aarav turns 18</span>
                    </div>
                  </div>
                  <div className="s-card">
                    <div className="s-label">Monthly investment</div>
                    <div className="s-amt">₹5,000</div>
                    <div className="s-bar"><i style={{ width: '45%' }} /></div>
                    <div className="s-row" style={{ marginTop: 6 }}><span className="s-label">₹500</span><span className="s-label">₹25,000</span></div>
                  </div>
                  <div className="s-card" style={{ background: 'var(--mint)', borderColor: 'transparent' }}>
                    <div className="s-row">
                      <span style={{ color: 'var(--forest-dark)', fontSize: 11 }}>Grandparents can add to this folio</span>
                      <svg className="icon" viewBox="0 0 24 24" style={{ width: 15, height: 15, color: 'var(--forest-dark)' }} aria-hidden="true"><use href="#i-gift" /></svg>
                    </div>
                  </div>
                  <div className="s-nav">
                    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-home" /></svg>
                    <svg className="icon on" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-target" /></svg>
                    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-chart" /></svg>
                    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-user" /></svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="app app--flip app--kid">
            <div>
              <div className="app-eyebrow"><svg className="icon" viewBox="0 0 24 24" style={{ width: 16, height: 16 }} aria-hidden="true"><use href="#i-coin" /></svg>Your child&apos;s app</div>
              <h2 style={{ fontSize: '1.5rem' }}>Coins for chores, tasks and learning</h2>
              <ul className="feat">
                <li><svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-list" /></svg><span><b>Chores and tasks you set.</b> Finishing them earns coins.</span></li>
                <li><svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-book" /></svg><span><b>Short lessons, not a course.</b> How investing works, why money grows, how to think about spending.</span></li>
                <li><svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-coin" /></svg><span><b>Coins add up.</b> Effort becomes something they can see.</span></li>
                <li><svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-chart" /></svg><span><b>Their own view of the investments.</b> At the level of detail you&apos;ve chosen.</span></li>
              </ul>
            </div>
            <div className="app-art">
              <div className="phone" role="img" aria-label="Child app screen showing coins earned, a task list and a lesson">
                <div className="screen screen--kid">
                  <div className="s-top"><span>Hi Aarav</span><span>Week 12</span></div>
                  <div className="s-card">
                    <div className="s-row">
                      <div>
                        <div className="s-label">Coins earned</div>
                        <div className="s-amt" style={{ color: 'var(--amber)' }}>340</div>
                      </div>
                      <svg className="icon" viewBox="0 0 24 24" style={{ width: 30, height: 30, color: 'var(--amber)' }} aria-hidden="true"><use href="#i-coin" /></svg>
                    </div>
                  </div>
                  <div className="s-card">
                    <div className="s-label" style={{ marginBottom: 4 }}>This week&apos;s tasks</div>
                    <div className="s-task"><span className="s-box s-box--on"><svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-check" /></svg></span><span className="s-done">Make your bed</span><span className="s-coin">+10</span></div>
                    <div className="s-task"><span className="s-box s-box--on"><svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-check" /></svg></span><span className="s-done">Read for 20 minutes</span><span className="s-coin">+20</span></div>
                    <div className="s-task"><span className="s-box" /><span>Water the plants</span><span className="s-coin">+10</span></div>
                  </div>
                  <div className="s-card">
                    <div className="s-row">
                      <div>
                        <div className="s-label">Today&apos;s lesson</div>
                        <div style={{ fontWeight: 600, fontSize: 12, marginTop: 2 }}>Why waiting makes money grow</div>
                      </div>
                      <span className="s-chip s-chip--amber">+15</span>
                    </div>
                  </div>
                  <div className="s-nav">
                    <svg className="icon on" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-home" /></svg>
                    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-list" /></svg>
                    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-book" /></svg>
                    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-chart" /></svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ WHY ══════════ */}
      <section className="band band--sage reveal">
        <div className="section-wrap">
          <h2>You could do this elsewhere. Here&apos;s what&apos;s different.</h2>
          <p className="lede">Most apps let you open a minor folio. None are built around it.</p>
          <ul className="why">
            <li><svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-user" /></svg><span><b>One child, not one more holding</b>Elsewhere your child&apos;s folio is a line item. Here it&apos;s the whole app.</span></li>
            <li><svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-calendar" /></svg><span><b>Goals in your child&apos;s timeline</b>Not ₹10 lakh in 12 years. College, the year Aarav turns 18.</span></li>
            <li><svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-gift" /></svg><span><b>Grandparents can add directly</b>No account of their own, no routing money through you.</span></li>
            <li><svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-phone" /></svg><span><b>Your child gets an app</b>Nobody else will build one. For us it&apos;s the whole business.</span></li>
          </ul>
        </div>
      </section>

      {/* ══════════ CLARITY / FAQ ══════════ */}
      <section className="band reveal" id="clarity">
        <div className="section-wrap clarity">
          <div>
            <h2>Your child&apos;s money deserves clear answers</h2>
            <p className="lede">A few things worth knowing before you invest in a minor&apos;s name.</p>
            <div className="note">
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-lock" /></svg>
              <h3>Taru never holds your money</h3>
              <p>Your SIP goes from your bank to the AMC. The folio sits with the AMC and its registrar, in your child&apos;s name. If Taru shut down tomorrow, the investments wouldn&apos;t be affected.</p>
            </div>
            <div className="note">
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-receipt" /></svg>
              <h3>Free for parents</h3>
              <p>No subscription and no account fee. We earn a trail commission from the AMC, paid out of the fund&apos;s expense ratio rather than added to what you invest.</p>
            </div>
          </div>
          <div className="faq">
            <details><summary>Who owns the investment?</summary>
              <p>Your child. The folio is in their name from the first instalment — not held for them, not promised to them.</p></details>
            <details><summary>Who manages it while they&apos;re a minor?</summary>
              <p>You do, as parent or guardian. Your KYC, your bank mandate. You can pause, increase or stop any time.</p></details>
            <details><summary>Where is the money invested?</summary>
              <p>In mutual fund schemes you choose, held by the AMC and its registrar. Taru is a distributor, not a fund.</p></details>
            <details><summary>What happens when they turn 18?</summary>
              <p>The folio becomes a regular account in their name after a KYC update. Nothing is transferred or gifted — they&apos;ve owned it all along.</p></details>
            <details><summary>Does my child need a PAN card?</summary>
              <p>No. Their birth certificate, your PAN and Aadhaar, and your bank account details.</p></details>
            <details><summary>Who pays tax on the returns?</summary>
              <p>While your child is a minor, gains are added to your income and taxed at your slab. After 18, gains are taxed in their hands at their own slab, which for most young adults is lower.</p></details>
          </div>
        </div>
      </section>

      {/* ══════════ WAITLIST ══════════ */}
      <section className="band band--wash reveal" id="waitlist">
        <div className="section-wrap">
          <h2>The hardest part is starting</h2>
          <p className="lede">Join the waitlist and we&apos;ll tell you the day it opens.</p>
          {submitted ? (
            <p className="form-msg" data-state="ok" role="status" aria-live="polite">You&apos;re on the list. We&apos;ll email you when it opens.</p>
          ) : (
            <form className="signup" onSubmit={handleSubmit}>
              <input
                type="email"
                name="email"
                placeholder="you@example.com"
                autoComplete="email"
                aria-label="Email address"
                value={email}
                onChange={e => { setEmail(e.target.value); setFormError('') }}
                required
                disabled={submitting}
              />
              <Button type="submit" variant="primary" disabled={submitting} data-testid="waitlist-submit-button">
                {submitting ? 'Adding…' : 'Join the waitlist'}
              </Button>
            </form>
          )}
          {formError && <p className="form-msg" data-state="error" role="status" aria-live="polite">{formError}</p>}
        </div>
      </section>

      <Footer showTaxCalculatorLink />

    </div>
  )
}
