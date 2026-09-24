import { useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import Footer from '../components/Footer.jsx'
import Header from '../components/Header.jsx'
import Button from '../components/Button.jsx'
import {
  FOUNDER_LINKEDIN_URL, FOUNDER_PHOTO_URL, AMFI_REGISTRATION_URL, DISCLOSURES_URL,
} from '../config/links.js'
import '../styles/landing.css'
import '../styles/about.css'

/* About page — wealth-first company story:
     WEALTH → OWNERSHIP → GROWTH → UNDERSTANDING
   The investment is the product; the child experience is the
   differentiator around it, not the reason Taru exists.

   Product moments reuse the homepage's screen primitives (.screen /
   .s-card / .s-bar …, landing.css) but in NEW compositions, each used
   once, and without phone frames — so nothing here repeats a homepage
   mockup. Figures are illustrative (the global footer says so).

   Investing is NOT live yet (INVESTMENT_ENABLED is false; BSE StAR MF
   empanelment pending) — copy describes what Taru is building and never
   claims a live transaction flow.

   Layout: one grid (about.css). Multi-column sections use .about-cols +
   .about-col subgrids spanning --rows rows so paired rows align.

   External links with no known URL yet come from config/links.js as null
   and render as placeholder <a> elements (no href) until filled in. */

const Arrow = () => (
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-arrow" /></svg>
)

const Icon = ({ id, style }) => (
  <svg className="icon" viewBox="0 0 24 24" style={style} aria-hidden="true"><use href={`#${id}`} /></svg>
)

function TextLink({ href, children, external = false }) {
  return (
    <a
      className="about-link"
      href={href || undefined}
      {...(href && external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      {...(!href ? { 'data-todo': 'url-missing' } : {})}
    >
      {children}<Arrow />
    </a>
  )
}

/* ── Product moments (illustrative, each used once) ── */

function OwnershipScreen() {
  return (
    <div className="screen about-screen" role="img" aria-label="Illustrative parent app card: an investment held in the child's name, managed by the parent as guardian, with a long-term goal">
      <div className="s-top"><span>Aarav&apos;s investment</span><span>Mutual funds</span></div>
      <div className="s-card">
        <div className="s-label">Held in the name of</div>
        <div className="s-row" style={{ marginTop: 2 }}>
          <div className="about-screen-name">Aarav</div>
          <span className="s-chip">Guardian · You</span>
        </div>
      </div>
      <div className="s-card">
        <div className="s-label">Invested so far</div>
        <div className="s-amt">₹1,84,000</div>
        <div className="s-row" style={{ marginTop: 10 }}>
          <span className="s-label">Goal · College fund · 2038</span>
          <span className="s-chip">62%</span>
        </div>
        <div className="s-bar"><i style={{ width: '62%' }} /></div>
      </div>
      <div className="s-card">
        <div className="s-row">
          <span className="s-label">Horizon</span>
          <span className="about-screen-meta">Until Aarav turns 18</span>
        </div>
      </div>
    </div>
  )
}

function ParentScreen() {
  return (
    <div className="screen about-screen" role="img" aria-label="Illustrative parent app: monthly SIP, next instalment and what the child can see">
      <div className="s-card">
        <div className="s-row">
          <div>
            <div className="s-label">Monthly SIP · 2 mutual funds</div>
            <div className="about-screen-value">₹5,000</div>
          </div>
          <span className="s-chip">Active</span>
        </div>
        <div className="s-row about-screen-divider">
          <span className="s-label">Next instalment</span>
          <span className="about-screen-meta">5 Oct</span>
        </div>
      </div>
      <div className="s-card">
        <div className="s-row">
          <span className="s-label">Aarav can see</span>
          <span className="s-chip">Progress only</span>
        </div>
      </div>
    </div>
  )
}

function ChildScreen() {
  return (
    <div className="screen screen--kid about-screen" role="img" aria-label="Illustrative child app: progress towards their goal, invested for them every month">
      <div className="s-card">
        <div className="s-row">
          <div>
            <div className="s-label">Your college fund</div>
            <div className="about-screen-value">62% of the way</div>
          </div>
          <Icon id="i-seed" style={{ width: 24, height: 24, color: 'var(--forest)' }} />
        </div>
        <div className="s-bar"><i style={{ width: '62%' }} /></div>
      </div>
      <div className="s-card">
        <div className="s-row">
          <span className="s-label">Invested for you</span>
          <span className="s-chip">Every month</span>
        </div>
      </div>
    </div>
  )
}

/* Parent side = the financial product; child side = the differentiated
   experience around it. Same number of capability rows on both sides so
   the rows align (subgrid). */
const SIDES = [
  {
    key: 'parents', icon: 'i-user', eyebrow: '01 — For parents', Screen: ParentScreen,
    title: 'Build their financial foundation.',
    body: 'Invest in their name, set goals and SIPs, track progress, and decide how much of it they see.',
    caps: [
      ['Invest', 'Invest in mutual funds, in their name.'],
      ['Plan', 'Set goals and goal dates for their future.'],
      ['SIPs', 'Start, increase or pause SIPs as life changes.'],
      ['Track', 'Follow the investment’s progress towards each goal.'],
      ['Share', 'Decide what your child sees.'],
    ],
  },
  {
    key: 'children', icon: 'i-seed', eyebrow: '02 — For children', Screen: ChildScreen,
    title: 'Grow into what is being built for them.',
    body: 'A separate, age-appropriate view of the investment being built for them — so it becomes understandable long before it becomes theirs to manage.',
    caps: [
      ['See', 'Their progress towards the goals set for them.'],
      ['Understand', 'That money is being invested in their name.'],
      ['Participate', 'In age-appropriate ways their parents set up.'],
      ['Learn', 'Through experience with their own investment.'],
      ['Grow', 'Into an understanding of investing, over time.'],
    ],
  },
]

const PRINCIPLES = [
  { label: 'Children come first', title: 'Build for the child, not just the account.', body: "Every decision should make the child's investment more meaningful, understandable and age-appropriate — not just easier to administer." },
  { label: 'Long-term by design', title: 'Build for the years ahead, not the next market cycle.', body: 'Taru is designed around the long journey of building wealth for a child — not short-term financial behaviour.' },
  { label: 'Continuous', title: 'Build something they can eventually grow into.', body: 'The investment should become more understandable to the child as they grow, so that at 18 it is a continuation — not a handover.' },
  { label: 'Radical clarity', title: 'Financial products deserve radical clarity.', body: 'Be clear about where money goes, who holds it, how Taru earns and what parents are actually signing up for.' },
]

const TRUST = [
  { label: 'AMFI registered', title: 'Mutual Fund Distributor · ARN 367667', body: "Taru is an AMFI-registered Mutual Fund Distributor. We help you invest in mutual funds; we don't manage the underlying funds.", credential: true },
  { label: "Taru doesn't hold your money", title: 'Your investment sits with the relevant financial institutions.', body: "Your SIP is invested into mutual fund schemes and the investment is held through the relevant AMC and registrar, in your child's name. Taru acts as the distributor." },
  { label: 'Transparent by design', title: "Know what you're investing in. Know how we earn.", body: 'There are no hidden subscription charges for parents. Taru earns a trail commission from the AMC when you invest through us.' },
]

/* Product trajectory, not company progress. Investing isn't live yet
   (INVESTMENT_ENABLED=false), so "Today" describes what Taru starts with,
   not a claim that transactions are open. */
const JOURNEY = [
  { label: 'Today', title: "Investing for a child's future.", body: "Taru starts with mutual-fund investing — a way for parents to build long-term wealth in their child's name." },
  { label: 'Together', title: "A child who can see what's being built.", body: 'Taru gives children an age-appropriate way to understand and participate in their financial journey.' },
  { label: 'Over time', title: 'A financial foundation that grows with them.', body: 'Taru will expand beyond a single investment toward the broader financial foundation a child needs as they grow.' },
]

const pad = (i) => String(i + 1).padStart(2, '0')

export default function About() {
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

  const description = "Taru helps parents build long-term wealth for their children, in their own name — while giving them a meaningful way to understand and grow with it."

  return (
    <div className="landing-page about">

      <Helmet>
        <title>About Taru — Why Taru Exists</title>
        <meta name="description" content={description} />
        <link rel="canonical" href="https://taru.money/about/" />
        <meta property="og:title" content="About Taru — Why Taru Exists" />
        <meta property="og:description" content={description} />
        <meta property="og:url" content="https://taru.money/about/" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://taru.money/og-image.png" />
      </Helmet>

      <Header />

      {/* ══════════ 01 — WHY TARU EXISTS ══════════ */}
      <section className="section-wrap about-hero reveal">
        <div className="about-hero-copy">
          <span className="eyebrow">Why Taru exists</span>
          <h1>Every child should grow up with something of their own. <em className="italic-forest about-break">And know what to do with it.</em></h1>
          <p className="about-hero-sub">{description}</p>
        </div>
        <div className="about-hero-art">
          <OwnershipScreen />
        </div>
      </section>

      {/* ══════════ 02 — THE GAP ══════════ */}
      <section className="band band--wash reveal">
        <div className="section-wrap">
          <div className="about-intro">
            <span className="eyebrow">The gap</span>
            <h2 className="about-h2">We&apos;re building for a part of investing most products weren&apos;t designed around: <em className="italic-forest">the child.</em></h2>
          </div>
          <div className="about-cols about-cols--2 about-gap" style={{ '--rows': 3 }}>
            <article className="about-col about-card">
              <span className="about-label"><span className="about-label-num">01</span> Ownership</span>
              <h3 className="about-title about-title--lg">The money is for them. <span className="about-break">Their investment should be too.</span></h3>
              <p className="about-body">Parents build wealth for their child&apos;s future — but the investment experience itself is usually designed around the adult, not the person it is ultimately meant for.</p>
            </article>
            <article className="about-col about-card">
              <span className="about-label"><span className="about-label-num">02</span> Continuity</span>
              <h3 className="about-title about-title--lg">Wealth shouldn&apos;t suddenly become their responsibility at 18.</h3>
              <p className="about-body">The investment journey should become understandable to the child gradually — not arrive as a portfolio they&apos;re simply handed the day they turn 18.</p>
            </article>
          </div>
        </div>
      </section>

      {/* ══════════ 03 — WHAT WE'RE BUILDING ══════════ */}
      <section className="band band--sage reveal">
        <div className="section-wrap">
          <div className="about-intro">
            <span className="eyebrow">What we&apos;re building</span>
            <h2 className="about-h2">An investment built around the child.</h2>
            <p className="lede">Parents build the financial foundation. Children grow into it.</p>
          </div>

          {/* Rows: screen, eyebrow, title, body, 5 capabilities = 9 — every
              row lines up with its counterpart on the other side. */}
          <div className="about-cols about-cols--2 about-system" style={{ '--rows': 9 }}>
            {SIDES.map(({ key, icon, eyebrow, title, body, caps, Screen }) => (
              <div key={key} className={`about-col about-side about-side--${key}`}>
                <div className="about-side-art"><Screen /></div>
                <span className="about-side-eyebrow"><Icon id={icon} />{eyebrow}</span>
                <h3 className="about-title about-title--lg">{title}</h3>
                <p className="about-body">{body}</p>
                <dl className="about-caps">
                  {caps.map(([t, d]) => (
                    <div key={t}><dt>{t}</dt><dd>{d}</dd></div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ 04 — HOW WE BUILD ══════════ */}
      <section className="band reveal">
        <div className="section-wrap">
          <div className="about-intro">
            <span className="eyebrow">Our investment philosophy</span>
            <h2 className="about-h2">What we believe an investment for a child should be.</h2>
            <p className="lede">These are the principles we use when deciding what Taru should — and shouldn&apos;t — build.</p>
          </div>
          <ol className="about-principles">
            {PRINCIPLES.map((p, i) => (
              <li key={p.label}>
                <div className="about-principle-key">
                  <span className="about-num">{pad(i)}</span>
                  <span className="about-principle-label">{p.label}</span>
                </div>
                <h3 className="about-title">{p.title}</h3>
                <p className="about-body">{p.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ══════════ 05 — THE FOUNDER ══════════ */}
      <section className="band band--wash reveal">
        <div className="section-wrap">
          {/* Full container width so the question sits on one line at desktop. */}
          <div className="about-intro about-intro--full">
            <span className="eyebrow">The person behind Taru</span>
            <h2 className="about-h2">It started with a simple question: how do I invest for my daughter?</h2>
          </div>

          <div className="about-split about-founder">
            <div className="about-founder-card">
              {FOUNDER_PHOTO_URL ? (
                <img className="about-photo" src={FOUNDER_PHOTO_URL} alt="Akshay Kumar, Founder & CEO of Taru" />
              ) : (
                /* TODO: replace with a real photograph via FOUNDER_PHOTO_URL
                   (config/links.js). Empty frame by design — never a stock
                   or generated portrait. */
                <div className="about-photo about-photo--empty" data-todo="founder-photo" aria-hidden="true">
                  <Icon id="i-user" />
                </div>
              )}
              <div className="about-signature">
                <p className="about-signature-name">Akshay Kumar</p>
                <p className="about-signature-role">Founder &amp; CEO</p>
                <TextLink href={FOUNDER_LINKEDIN_URL} external>LinkedIn</TextLink>
              </div>
            </div>

            <div className="about-story">
              <div className="about-story-block">
                <span className="about-label"><span className="about-label-num">01</span> The problem</span>
                <div className="about-story-text">
                  <p>When my daughter was one, I started looking for a way to invest in mutual funds for her — and couldn&apos;t find a simple way to do it. If I was looking for this, how were other parents doing it? And why hadn&apos;t anyone built a product around children?</p>
                </div>
              </div>
              <div className="about-story-block">
                <span className="about-label"><span className="about-label-num">02</span> The insight</span>
                <div className="about-story-text">
                  <p>The more I explored, the clearer it became that minors weren&apos;t being treated as a segment in their own right. Where children were supported at all, it was a feature added to an adult product — not a product designed around the child.</p>
                  <p className="about-story-beat">That&apos;s where Taru began.</p>
                </div>
              </div>
              <div className="about-story-block">
                <span className="about-label"><span className="about-label-num">03</span> Why Taru, why me</span>
                <div className="about-story-text">
                  <p>I&apos;ve spent the last 10 years building and growing products across banking and financial services — building them from the ground up, taking them to market, and working across both the product and business sides.</p>
                  <p className="about-story-pull">But the most important qualification is simpler: I&apos;ve lived the problem myself.</p>
                  <p className="about-story-conclusion">By the time a child turns 18, they shouldn&apos;t just have money in their name. They should understand what it means, how to manage it, and how to make it grow.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ 06 — BUILT FOR TRUST ══════════ */}
      <section className="band reveal">
        <div className="section-wrap">
          <div className="about-intro">
            <span className="eyebrow">Built for trust</span>
            <h2 className="about-h2">Built for a child&apos;s future. <span className="about-break">Built on financial infrastructure you can trust.</span></h2>
            <p className="lede">Taru is built on regulated financial infrastructure, with clarity about where your money goes, who holds it and what Taru does.</p>
          </div>
          <div className="about-cols about-cols--3 about-trust" style={{ '--rows': 3 }}>
            {TRUST.map((t, i) => (
              <article key={t.label} className="about-col about-card">
                <span className="about-label"><span className="about-label-num">{pad(i)}</span> {t.label}</span>
                <h3 className="about-title about-title--sans">
                  {t.credential
                    ? <>Mutual Fund Distributor · <span className="about-nowrap">ARN 367667</span></>
                    : t.title}
                </h3>
                <p className="about-body">{t.body}</p>
              </article>
            ))}
          </div>
          <p className="about-trust-line">We believe trust in financial products comes from clarity — not complicated language.</p>
          <div className="about-trust-links">
            <TextLink href={AMFI_REGISTRATION_URL} external>AMFI Registration</TextLink>
            <TextLink href={DISCLOSURES_URL}>Disclosures</TextLink>
          </div>
        </div>
      </section>

      {/* ══════════ 07 — THE JOURNEY AHEAD ══════════ */}
      <section className="band band--sage reveal">
        <div className="section-wrap">
          <div className="about-intro">
            <span className="eyebrow">The journey ahead</span>
            <h2 className="about-h2">Built today. Designed for the journey ahead.</h2>
            <p className="lede">Taru starts with investing for a child&apos;s future, and is building toward a broader financial experience around the child as they grow.</p>
          </div>
          <ol className="about-cols about-cols--3 about-today" style={{ '--rows': 3 }}>
            {JOURNEY.map((t, i) => (
              <li key={t.label} className="about-col">
                <span className="about-label"><span className="about-label-num">{pad(i)}</span> {t.label}</span>
                <h3 className="about-title">{t.title}</h3>
                <p className="about-body">{t.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ══════════ 08 — OUR MISSION ══════════ */}
      <section className="band dark about-mission reveal">
        <div className="section-wrap">
          <span className="eyebrow">Our mission</span>
          <h2 className="about-mission-head">We want every child to turn 18 with two things.</h2>
          <p className="about-mission-statement">
            <span>Wealth to their name.</span>
            <span><em>Wisdom to multiply it.</em></span>
          </p>
          <p className="about-mission-line">Every Indian child turns 18 with wealth to their name and a lifetime of wisdom to multiply it.</p>
          <Button href="/#waitlist" variant="ghost-cream">
            Join the waitlist
            <Arrow />
          </Button>
          <p className="about-mission-micro">We&apos;re building the financial foundation for their future — one child at a time.</p>
        </div>
      </section>

      <Footer showTaxCalculatorLink />

    </div>
  )
}
