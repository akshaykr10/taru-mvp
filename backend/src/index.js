require('dotenv').config()
const express = require('express')
const cors = require('cors')

const { supabase } = require('./middleware/auth')
const waitlistRouter        = require('./routes/waitlist')

// The pilot app was retired on 4 Nov 2026. This service now only takes
// waitlist sign-ups from the nuberry.in marketing site (repo
// Taru-Money/nuberry-web). Every other route (cas, casparser, children,
// tasks, gullak, activity, consent, cron, calculator-leads, child garden)
// was removed; see git history before this commit if you need them.

const app = express()
const PORT = process.env.PORT || 3001

// ── Middleware ────────────────────────────────────────────────
const allowedOrigins = [
  'https://nuberry.in',
  'https://www.nuberry.in',
  'http://localhost:4321', // nuberry-web dev server
].filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, health checks)
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}))
app.use(express.json({ limit: '100kb' }))

// Route files read the Supabase admin client from req.supabaseAdmin
app.use((req, _res, next) => {
  req.supabaseAdmin = supabase
  next()
})

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── Routes ────────────────────────────────────────────────────
app.use('/api/waitlist', waitlistRouter)

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// ── Start server ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Nuberry waitlist backend running on http://localhost:${PORT}`)
})
