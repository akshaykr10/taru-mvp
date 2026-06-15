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
                <span className="dot"></span>Built for Indian families
              </span>
              <h1 className="hero-title serif">
                <span className="l">Plant a future.</span>
                <span className="l">Watch them</span>
                <span className="l"><em className="italic-amber">grow</em> with it.</span>
              </h1>
              <p className="hero-sub">
                Taru helps parents invest in mutual funds in their child&apos;s name &mdash; while
                children watch a living garden grow alongside them. Real money. Real lessons.
                One quiet ritual.
              </p>
              <div className="hero-cta-row">
                <a href="#cta" className="btn primary">Join the waitlist</a>
                <Link to="/app/login" className="btn ghost">Try the MVP &rarr;</Link>
              </div>
              <div className="social-row">
                <div className="avatars">
                  <div className="av av-1">A</div>
                  <div className="av av-2">R</div>
                  <div className="av av-3">M</div>
                  <div className="av av-4">+</div>
                </div>
                <div className="social-text">
                  <b>35+ families</b> helped shape Taru. <b>5</b> are already growing their gardens.
                </div>
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

      {/* ══════════ PROBLEM ══════════ */}
      <section className="block dark" id="problem">
        <div className="wrap">
          <div className="section-head reveal">
            <span className="eyebrow">The opportunity</span>
            <h2 className="serif">
              Indians save fiercely.<br/>
              They invest <em className="italic-amber">cautiously</em>.
            </h2>
            <p>
              Most Indian parents start their child&apos;s investments late, in their own name, in
              instruments that lose to inflation. The next generation should grow up watching
              markets &mdash; not fearing them.
            </p>
          </div>
          <div className="stat-row">
            <div className="stat-card reveal">
              <div className="v">&#8377;55L<span style={{ fontSize: '0.55em', marginLeft: '6px' }}>Cr</span></div>
              <div className="d">
                <b>Sitting in low-yield savings.</b> Household deposits parked at ~3% real
                return while equities have averaged 12%+.
              </div>
            </div>
            <div className="stat-card reveal">
              <div className="v">82%</div>
              <div className="d">
                <b>Of urban parents</b> say they want to invest for their child &mdash; but
                feel it&apos;s too complex to start.
              </div>
            </div>
            <div className="stat-card reveal">
              <div className="v">Age 8</div>
              <div className="d">
                <b>Is when financial habits set in</b>, per Cambridge research. India
                hasn&apos;t built a single product for that window.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ HOW IT WORKS ══════════ */}
      <section className="block cream" id="how">
        <div className="wrap">
          <div className="section-head reveal">
            <span className="eyebrow">How Taru works</span>
            <h2 className="serif">Two apps. One <em className="italic-amber">family ritual</em>.</h2>
            <p>Parents handle the money. Children handle the wonder. Taru is the quiet bridge between the two.</p>
          </div>

          <div className="two-cards">
            <div className="feature-card reveal">
              <span className="pill tag-amber">For parents</span>
              <h3>A trusted home for your child&apos;s first portfolio.</h3>
              <p>
                Open a SEBI-compliant minor folio in your child&apos;s name in under four minutes.
                Set a monthly SIP. Pause, top up, or gift in two taps. No paperwork, no jargon.
              </p>
              <ul className="bullets">
                <li>Pick exactly which funds appear in your child&apos;s garden</li>
                <li>Goal-linked baskets: college, first bike, a gap year</li>
                <li>Grandparents can gift directly to the folio</li>
                <li>Chore-based incentives &mdash; turn pocket money into seeds</li>
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
                The squirrel who <em className="italic-amber">explains the market</em> to your 8-year-old.
              </h2>
              <p className="lead">
                Penny is Taru&apos;s AI companion &mdash; built on a child-safe model, vetted by
                educators, and incapable of selling anything. She answers exactly one kind of
                question: <em>&ldquo;why?&rdquo;</em>
              </p>

              <div className="trait">
                <div className="trait-ico">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <div>
                  <div className="t-title">Talks like a children&apos;s-book author</div>
                  <div className="t-desc">No jargon. No charts. Just clear, age-tiered explanations that a parent would actually approve of.</div>
                </div>
              </div>

              <div className="trait">
                <div className="trait-ico">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <div>
                  <div className="t-title">Cannot give financial advice</div>
                  <div className="t-desc">Penny is hard-coded to educate, never to recommend. A teacher in the room, not a broker.</div>
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
                  <div className="t-desc">Penny appears once a week and delivers a single financial concept &mdash; in language matched to your child&apos;s age.</div>
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
            <span className="eyebrow">Early signals</span>
            <h2 className="serif">
              Quiet conviction from <em className="italic-amber">the families we listen to</em>.
            </h2>
          </div>

          <div className="signals-stats">
            <div className="signal-card reveal">
              <div className="sv">35</div>
              <div className="sd"><b>Families</b> in our private co-design group, all parents of 6&ndash;12 year olds.</div>
            </div>
            <div className="signal-card reveal">
              <div className="sv">5</div>
              <div className="sd"><b>Live folios</b> already growing &mdash; the very first Taru gardens.</div>
            </div>
            <div className="signal-card reveal">
              <div className="sv">91%</div>
              <div className="sd"><b>Of parents</b> who tried the MVP said they would set up a SIP for their child this quarter.</div>
            </div>
          </div>

          <div className="quote-block reveal">
            <span className="qmark">&ldquo;</span>
            <blockquote>
              My daughter asked me, for the first time, what a mutual fund is. I have been trying
              to start her SIP for two years. Taru got me to do it in one weekend &mdash; because
              she wanted me to.
            </blockquote>
            <div className="attrib">&mdash; <b>Meera S.</b>, Bengaluru &middot; mother to Ananya, 9</div>
          </div>
        </div>
      </section>

      {/* ══════════ WHY NOW ══════════ */}
      <section className="why-section cream" id="why">
        <div className="wrap">
          <div className="why-head reveal">
            <span className="eyebrow">Why now</span>
            <h2>Four shifts that <em className="italic-amber">finally</em> make this possible.</h2>
            <p>
              Taru couldn&apos;t have existed five years ago. Four things had to be true at
              once &mdash; and they finally are.
            </p>
          </div>

          <div className="grid-2x2 reveal">
            <div className="why-card">
              <div className="why-top">
                <span className="why-num">01</span>
                <div className="ico-tile">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 21h18M5 21V8l7-5 7 5v13M9 12h6M9 16h6"/>
                  </svg>
                </div>
              </div>
              <h4>SEBI&apos;s minor folio framework</h4>
              <p>A digital-first KYC flow now opens a true in-the-child&apos;s-name folio in under five minutes. The rails are finally ready.</p>
              <span className="why-meta"><b>2024</b> &middot; regulation went live</span>
            </div>

            <div className="why-card">
              <div className="why-top">
                <span className="why-num">02</span>
                <div className="ico-tile">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>
                  </svg>
                </div>
              </div>
              <h4>Mutual fund penetration</h4>
              <p>SIP accounts crossed 11 crore in 2025. A whole generation of parents is now market-comfortable &mdash; but their children still aren&apos;t.</p>
              <span className="why-meta"><b>11Cr+</b> &middot; SIP accounts</span>
            </div>

            <div className="why-card">
              <div className="why-top">
                <span className="why-num">03</span>
                <div className="ico-tile">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="14" rx="3"/>
                    <path d="M8 20h8M12 18v2"/>
                    <circle cx="9" cy="11" r="1"/>
                    <circle cx="15" cy="11" r="1"/>
                  </svg>
                </div>
              </div>
              <h4>Child-safe AI is finally good</h4>
              <p>Smaller, supervised models can now hold a real conversation with a child &mdash; safely, with age-appropriate voice and guardrails.</p>
              <span className="why-meta"><b>Now</b> &middot; on-device inference</span>
            </div>

            <div className="why-card">
              <div className="why-top">
                <span className="why-num">04</span>
                <div className="ico-tile">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="6" y="2" width="12" height="20" rx="3"/>
                    <path d="M11 18h2"/>
                  </svg>
                </div>
              </div>
              <h4>A smartphone-native generation</h4>
              <p>Indian children under 12 spend 90+ minutes a day on a parent&apos;s phone. The question isn&apos;t whether they&apos;ll use a product. It&apos;s which one.</p>
              <span className="why-meta"><b>90 min</b> &middot; daily screen time</span>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ TAX CALCULATOR BRIDGE ══════════ */}
      <section className="why-section cream">
        <div className="wrap-narrow">
          <div className="tc-bridge reveal">
            <span className="eyebrow">Free calculator</span>
            <h2 className="serif">
              See what 18 years of investing <em className="italic-amber">builds</em>
            </h2>
            <p>
              A parent investing ₹5,000 a month from birth builds a corpus of over ₹60 lakhs by the
              time their child turns 18 — ringfenced, compounding, and tax-efficient.
            </p>
            <Link to="/tax-calculator" className="btn primary">
              Calculate your child&apos;s corpus &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════ CTA ══════════ */}
      <section className="block dark cta-section" id="cta">
        <div className="wrap-narrow reveal">
          <span className="eyebrow">Early access</span>
          <h2>
            We&apos;re building this <em className="italic-amber">for you</em>.<br/>
            Be there from day one.
          </h2>
          <p className="cta-sub">
            Taru is being shaped with parents who care about this exact problem. Join the waitlist
            and we&apos;ll bring you in for early access the moment we go live in your city.
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
