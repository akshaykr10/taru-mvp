import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { blogs } from '../../data/blogs.js'
import Footer from '../Footer.jsx'
import Header from '../Header.jsx'
import '../../styles/landing.css'
import './blog.css'

export default function BlogIndex() {
  return (
    <div className="landing-page">
      <Helmet>
        <title>Blog — Taru | Investing for Your Child's Future</title>
        <meta name="description" content="Practical guides for Indian parents on investing in their child's name — minor mutual fund accounts, SIP calculations, and how to get started." />
        <link rel="canonical" href="https://taru.money/blog/" />

        <meta property="og:title" content="Blog — Taru | Investing for Your Child's Future" />
        <meta property="og:description" content="Practical guides for Indian parents on investing in their child's name — minor mutual fund accounts, SIP calculations, and how to get started." />
        <meta property="og:url" content="https://taru.money/blog" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://taru.money/og-image.png" />

        <meta name="twitter:title" content="Blog — Taru | Investing for Your Child's Future" />
        <meta name="twitter:description" content="Practical guides for Indian parents on investing in their child's name — minor mutual fund accounts, SIP calculations, and how to get started." />
        <meta name="twitter:image" content="https://taru.money/og-image.png" />
      </Helmet>

      <Header active="blog" scrolledThreshold={10} />

      <main className="blog-index">
        <header className="blog-index__hero">
          <h1 className="blog-index__title">For parents who think ahead</h1>
          <p className="blog-index__subtitle">Guides on investing in your child's name — no jargon, real numbers.</p>
        </header>

        {/* Card layout ported verbatim from design-reference.html's .posts/
            .post-card (whole card is the link, tag + read-time row, title,
            dek). The bare <b> title in the mockup is kept as a real <h2>
            here (see blog.css). */}
        <section className="posts">
          {blogs.map(blog => (
            <Link key={blog.slug} to={`/blog/${blog.slug}`} className="post-card">
              <span className="card-top">
                {blog.topic && <span className="tag">{blog.topic}</span>}
                <span className="read">{blog.readingTime} read</span>
              </span>
              <h2>{blog.title}</h2>
              <p>{blog.subtitle}</p>
            </Link>
          ))}
        </section>
      </main>

      <Footer showTaxCalculatorLink />
    </div>
  )
}
