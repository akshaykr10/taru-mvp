import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BACKEND_URL } from '../lib/api.js'
import '../styles/landing.css'

export default function Landing() {
  const navRef    = useRef(null)
  const [email,      setEmail]      = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [formError,  setFormError]  = useState('')

  /* ── Navbar scroll shadow ── */
  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const onScroll = () => {
      if (window.scrollY > 24) nav.classList.add('scrolled')
      else nav.classList.remove('scrolled')
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /* ── Reveal-on-scroll ── */
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

  /* ── Prevent horizontal scroll while landing is mounted ── */
  useEffect(() => {
    const prev = document.body.style.overflowX
    document.body.style.overflowX = 'hidden'
    return () => { document.body.style.overflowX = prev }
  }, [])

  /* ── Waitlist form submit ── */
  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !email.includes('@')) return
    setSubmitting(true)
    setFormError('')
    try {
      const res  = await fetch(`${BACKEND_URL}/api/waitlist`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
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

      {/* ══════════ NAVBAR ══════════ */}
      <nav className="top" id="topnav" ref={navRef}>
        <div className="inner">
          <a href="#" className="logo">taru<span className="dot">.</span></a>
          <div className="nav-links">
            <Link to="/tax-calculator" className="nav-tax-calc">Tax calculator</Link>
            <Link to="/calculator" className="nav-tax-calc">Milestone calculator</Link>
            <Link to="/blog" className="nav-blogs">Blogs</Link>
            <a href="#cta" className="btn primary">Join waitlist</a>
          </div>
        </div>
      </nav>

      {/* ══════════ HERO ══════════ */}
      <header className="hero">
        <div className="wrap">
          <div className="hero-grid">

            {/* Left copy */}
            <div className="reveal">
              <span className="pill badge-pill">
                <span className="dot"></span>Mutual funds for your kids
              </span>
              <h1 className="hero-title serif">
                Start early. Invest for your kid&apos;s goals.
              </h1>
              <p className="hero-sub">
                From school fees to college to their first home, Taru helps you invest in
                mutual funds for your child. One portfolio. Every milestone.
              </p>
              <div className="hero-cta-row">
                <a href="#cta" className="btn primary">Join the waitlist</a>
                <Link to="/app/login" className="btn ghost">Try the MVP &rarr;</Link>
              </div>
            </div>

            {/* Right — phone mockup */}
            <div className="phone-stage reveal">

              {/* Floating badge — top-left */}
              <div className="badge-tl-wrap">
                <div className="float-anim-a">
                  <div className="float-badge">
                    <div className="ico honey">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2v20M5 9l7-7 7 7"/>
                      </svg>
                    </div>
                    <div>
                      <div className="lbl">12-mo return</div>
                      <div className="val">+14.2%<span className="small">XIRR</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating badge — bottom-right */}
              <div className="badge-br-wrap">
                <div className="float-anim-b">
                  <div className="float-badge">
                    <div className="ico mint">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>
                      </svg>
                    </div>
                    <div>
                      <div className="lbl">Lessons read</div>
                      <div className="val">28<span className="small">this month</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Phone */}
              <div className="phone-float">
                <div className="phone">
                  <div className="screen">

                    <div className="screen-header">
                      <div className="hi">
                        Good morning, Anika
                        <small>Aarav&apos;s garden &middot; Day 184</small>
                      </div>
                      <div className="bell">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
                          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                        </svg>
                      </div>
                    </div>

                    <div className="portfolio-card">
                      <div className="label">Aarav&apos;s portfolio</div>
                      <div className="num">&#8377;18,240</div>
                      <div className="delta">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M7 17l5-5 4 4 5-5"/><path d="M14 7h7v7"/>
                        </svg>
                        +&#8377;1,240 this month
                      </div>
                      <svg className="spark" viewBox="0 0 280 60" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="lp-sg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0" stopColor="#ef9f27" stopOpacity="0.35"/>
                            <stop offset="1" stopColor="#ef9f27" stopOpacity="0"/>
                          </linearGradient>
                        </defs>
                        <path d="M0,48 C30,42 50,38 80,34 C110,30 130,38 160,28 C190,20 210,22 240,14 L280,8 L280,60 L0,60 Z" fill="url(#lp-sg)"/>
                        <path d="M0,48 C30,42 50,38 80,34 C110,30 130,38 160,28 C190,20 210,22 240,14 L280,8" stroke="#ef9f27" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>

                    <div className="ai-bubble">
                      <div className="penny-av">P</div>
                      <div className="msg">
                        <b>Penny here!</b> Aarav planted a new seed this week. Want to see what it
                        learned about compounding?
                      </div>
                    </div>

                    <div className="week">
                      <div className="week-top">
                        <div className="t">This week</div>
                        <div className="v">5 / 7 days</div>
                      </div>
                      <div className="week-bars">
                        <div className="b f" style={{ height: '70%' }}></div>
                        <div className="b f" style={{ height: '50%' }}></div>
                        <div className="b f" style={{ height: '90%' }}></div>
                        <div className="b f" style={{ height: '60%' }}></div>
                        <div className="b a" style={{ height: '100%' }}></div>
                        <div className="b"   style={{ height: '30%' }}></div>
                        <div className="b"   style={{ height: '20%' }}></div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>{/* /phone-stage */}

          </div>
        </div>
      </header>

      {/* ══════════ THE DIFFERENCE ══════════ */}
      <section className="block white" id="difference">
        <div className="wrap">
          <div className="section-head reveal">
            <span className="eyebrow">The difference</span>
            <h2 className="serif">Why investing for them works <em className="italic-amber">better than investing for yourself</em>.</h2>
          </div>

          <div className="stat-row">
            <div className="feature-card reveal">
              <h3>Goals that don&apos;t drift</h3>
              <p>
                You set the goal today. The folio holds it until they&apos;re ready. No dipping in
                for other priorities.
              </p>
            </div>
            <div className="feature-card reveal">
              <h3>Better tax treatment</h3>
              <p>
                When you withdraw after your child turns 18, they get the benefit of a clean tax
                slate &mdash; one that most parents have already used up in their own name.
              </p>
            </div>
            <div className="feature-card reveal">
              <h3>The money stays put</h3>
              <p>
                Funds in your own account get used. In your child&apos;s name, withdrawal takes
                intent. That friction is what turns a SIP into real wealth.
              </p>
            </div>
          </div>

          <p className="reveal" style={{ marginTop: '24px', fontFamily: 'var(--sans)', fontSize: '14px', color: 'var(--sage)' }}>
            <Link to="/tax-calculator" style={{ color: 'var(--amber)', textDecoration: 'none', fontWeight: 500 }}>
              See exactly how much tax you save &rarr;
            </Link>
          </p>
        </div>
      </section>

      {/* ══════════ HOW IT WORKS ══════════ */}
      <section className="block cream" id="how">
        <div className="wrap">
          <div className="section-head reveal">
            <span className="eyebrow">How Taru works</span>
            <h2 className="serif">Two apps. One <em className="italic-amber">habit that lasts</em>.</h2>
            <p>Parents invest. Children watch it grow. The conversation happens on its own.</p>
          </div>

          <div className="two-cards">
            <div className="feature-card reveal">
              <span className="pill tag-amber">For parents</span>
              <h3 style={{ fontSize: '32px' }}>Open your child&apos;s first mutual fund portfolio in minutes.</h3>
              <p>
                Open a SEBI-compliant minor folio in your child&apos;s name in under four minutes.
                Set a monthly SIP. Your child&apos;s portfolio is legally theirs &mdash; not a mental
                account in yours.
              </p>
              <ul className="bullets">
                <li>Goal-linked baskets: college, first bike, MS from USA</li>
                <li>Chore-based investing &mdash; turn pocket money into mutual fund seeds</li>
                <li>Grandparents can gift directly into the folio</li>
                <li>You choose exactly which funds appear in your child&apos;s garden</li>
              </ul>
            </div>

            <div className="feature-card reveal">
              <span className="pill tag-mint">For children</span>
              <h3>A garden that grows with the market.</h3>
              <p>
                Children see a soft, illustrated garden &mdash; not numbers. Each SIP plants a
                seed. Markets up, the canopy thickens. Markets down, Penny the Squirrel
                explains why, in their language.
              </p>
              <ul className="bullets">
                <li>Children see only the numbers their parents choose to show</li>
                <li>Weekly 90-second lessons with Penny</li>
                <li>Earn seeds for finishing chores, not for screen time</li>
                <li>Streaks for showing up, never for spending</li>
              </ul>
            </div>
          </div>

          <div className="flywheel reveal">
            <span>Parent invests</span>
            <span className="arrow">&rarr;</span>
            <span>Child watches it grow</span>
            <span className="arrow">&rarr;</span>
            <span>Child asks questions</span>
            <span className="arrow">&rarr;</span>
            <span>Parent stays invested</span>
          </div>
        </div>
      </section>

      {/* ══════════ PENNY ══════════ */}
      <section className="block mintbg" id="penny">
        <div className="wrap">
          <div className="penny-grid">

            <div className="reveal">
              <span className="eyebrow">Meet Penny</span>
              <h2 className="serif">
                The reason your child will <em className="italic-amber">ask you about money</em> first.
              </h2>
              <p className="lead">
                Penny is Taru&apos;s AI companion. She&apos;s built on a child-safe model, vetted by
                educators, and hard-coded to never sell anything. Every week, she delivers one
                financial concept &mdash; in language matched to your child&apos;s age.
              </p>

              <div className="trait">
                <div className="trait-ico">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <div>
                  <div className="t-title">Talks like a children&apos;s-book author</div>
                  <div className="t-desc">No jargon. No charts. Just explanations a 9-year-old gets and a parent approves.</div>
                </div>
              </div>

              <div className="trait">
                <div className="trait-ico">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <div>
                  <div className="t-title">Cannot give financial advice. Ever.</div>
                  <div className="t-desc">Penny is a teacher, not a broker. She explains why markets move. She never tells anyone what to buy.</div>
                </div>
              </div>

              <div className="trait">
                <div className="trait-ico">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9"/>
                    <path d="M12 7v5l3 2"/>
                  </svg>
                </div>
                <div>
                  <div className="t-title">One concept, once a week</div>
                  <div className="t-desc">Penny shows up once a week with a single idea &mdash; timed to what&apos;s happening in your child&apos;s portfolio right now.</div>
                </div>
              </div>
            </div>

            {/* Chat card */}
            <div className="reveal">
              <div className="chat-card">
                <div className="chat-head">
                  <div className="p-av">P</div>
                  <div className="who">
                    Penny
                    <small>Aarav&apos;s companion</small>
                  </div>
                  <div className="live"><span className="lpdot"></span>Lesson 12</div>
                </div>

                <div className="msgs">
                  <div className="bub from-penny">
                    Hi Aarav! Your tree got a little taller this week. Want to know why?
                  </div>
                  <div className="bub from-aarav">
                    yes! why?
                  </div>
                  <div className="bub from-penny">
                    People bought more of the same little pieces your appa bought. When more people
                    want a piece, each one becomes worth a bit more. That&apos;s it. That&apos;s the whole
                    secret. 🌱
                  </div>
                </div>

                <div className="lesson-bar">
                  <div className="lesson-top">
                    <div className="lt">Lesson progress</div>
                    <div className="lv">13 / 20</div>
                  </div>
                  <div className="lbar"><div className="fill"></div></div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════ EARLY SIGNALS ══════════ */}
      <section className="block white" id="signals">
        <div className="wrap">
          <div className="section-head reveal">
            <h2 className="serif">
              What parents are <em className="italic-amber">saying</em>.
            </h2>
          </div>

          <div className="quote-block reveal" style={{ textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: '0' }}>

              {/* Left column — stat */}
              <div style={{ flex: '0 0 35%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 40px 0 0' }}>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(52px, 6vw, 80px)', fontWeight: 500, color: 'var(--forest)', lineHeight: 1, letterSpacing: '-0.02em' }}>91%</div>
                <div style={{ fontFamily: 'var(--sans)', fontSize: '15px', color: 'var(--sage)', lineHeight: 1.55, marginTop: '16px' }}>
                  <b style={{ color: 'var(--forest)', fontWeight: 600 }}>Of parents</b> who tried the MVP said they would set up a SIP for their child this quarter.
                </div>
              </div>

              {/* Vertical divider */}
              <div style={{ width: '1px', background: 'rgba(26,61,43,0.15)', flexShrink: 0, alignSelf: 'stretch' }} />

              {/* Right column — quote */}
              <div style={{ flex: '0 0 65%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 0 0 40px' }}>
                <blockquote style={{ margin: 0 }}>
                  My daughter asked me, for the first time, what a mutual fund is. I have been trying
                  to start her SIP for two years. Taru got me to do it in one weekend &mdash; because
                  she wanted me to.
                </blockquote>
                <div className="attrib" style={{ textAlign: 'left', marginTop: '20px' }}>&mdash; <b>Meera S.</b>, Bengaluru &middot; mother to Ananya, 9</div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ══════════ CALCULATOR BRIDGE ══════════ */}
      <section className="why-section cream" id="calculator">
        <div className="wrap-narrow">
          <div className="tc-bridge reveal">
            <h2 className="serif">
              How much do you need to invest for your child&apos;s future?
            </h2>
            <p>
              Tell us their age and what you&apos;re saving for — college,
              marriage, or their first home. We&apos;ll show you the exact monthly
              SIP to get there.
            </p>
            <Link to="/calculator" className="btn primary">
              Calculate now &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════ CTA ══════════ */}
      <section className="block dark cta-section" id="cta">
        <div className="wrap-narrow reveal">
          <h2>
            Your child&apos;s first portfolio <em className="italic-amber">is waiting</em>.
          </h2>
          <p className="cta-sub">
            Join the waitlist and get early access the moment investments on Taru go live.
          </p>

          {submitted ? (
            <p className="cta-success">You&apos;re in ✓ — we&apos;ll be in touch soon.</p>
          ) : (
            <form className="cta-form" onSubmit={handleSubmit}>
              <input
                type="email"
                name="email"
                placeholder="you@family.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setFormError('') }}
                required
                disabled={submitting}
              />
              <button type="submit" className="btn amber" disabled={submitting}>
                {submitting ? 'Joining…' : 'Join waitlist'}
              </button>
            </form>
          )}

          {formError && <p className="cta-error">{formError}</p>}

          <div className="or-divider">or try it now</div>

          <Link to="/app" className="btn ghost-cream">
            Explore the Taru MVP
            <span className="live-tag"><span className="ldot"></span>Live</span>
          </Link>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer>
        <div className="inner">
          <div className="f-left">
            <a href="#" className="logo">taru<span className="dot">.</span></a>
            <div className="copy">&copy; 2026 Taru Money Pvt. Ltd.</div>
          </div>
          <div className="fnav">
            <Link to="/blog">Blogs</Link>
            <Link to="/tax-calculator">Tax calculator</Link>
            <Link to="/calculator">Milestone calculator</Link>
          </div>
          <div className="made-tag">
            <span className="flag-dot"></span>
            Made in India, for India
          </div>
        </div>
      </footer>

    </div>
  )
}
