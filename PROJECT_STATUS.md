# Taru MVP — Project Status

> **Phase 0 is complete and live.**
> This file is the primary context anchor for all future development sessions.
> Read it before writing any code. For full product decisions see `CLAUDE.md`.

---

## 1. Core Architecture

### Frontend — `frontend/`
| Concern | Choice |
|---|---|
| Framework | React 18 + Vite 8 |
| Routing | React Router v6 |
| Auth client | `@supabase/supabase-js` (anon key only) |
| Portfolio SDK | `@cas-parser/connect` (Lite plan) |
| Styling | Plain CSS with CSS custom properties — zero CSS-in-JS |
| Entry point | `src/main.jsx` → imports `src/styles/tokens.css` globally |

### Backend — `backend/`
| Concern | Choice |
|---|---|
| Runtime | Node.js (CommonJS) |
| Framework | Express 4 |
| Auth validation | Supabase service-role key — validates JWTs server-side |
| File handling | `multer` (memory storage, 20 MB cap) |
| PDF proxy | `node-fetch` + `form-data` — forwards to CASParser |
| JWT signing | `jsonwebtoken` — for child tokens only |

### Database — Supabase (PostgreSQL)
All tables use Row Level Security. The backend connects via service-role key (`SUPABASE_SERVICE_ROLE_KEY`). The frontend connects via anon key (`VITE_SUPABASE_ANON_KEY`) for auth only — never for direct data writes.

**Tables:**
```
parents              — email, name
children             — parent_id, name, dob, age_stage, goal_*, child_token
portfolio_snapshots  — parent_id, cas_type, raw_json (full CASParser response)
fund_tags            — parent_id, isin, fund_name, fund_type, is_visible_to_child
task_rules           — parent_id, child_id, task_name, reward_coins, frequency, status
task_completions     — task_rule_id, completed_at, approved_at, rejected_at
learning_state       — child_id (UNIQUE), current_week, coins_total, xp_total, last_trigger_type
conversation_log     — parent_id, week_number, prompt_text, marked_done_at
activity_events      — actor_type, parent_id, child_id, event_type, section, occurred_at (server-set), metadata
```

### External APIs
| Service | Usage | Key location |
|---|---|---|
| CASParser (`api.casparser.in`) | Portfolio import via SDK widget and PDF upload | `CASPARSER_API_KEY` — backend env only, never bundled |
| Supabase Auth | Parent email/password auth | Service role key — backend only; anon key — frontend |

---

## 2. Deployment Infrastructure

### Frontend → Netlify
- **Build config:** `netlify.toml` in repo root
  - `base = "frontend"` — Netlify runs `npm run build` from the `frontend/` directory
  - `publish = "dist"` (relative to base)
  - `NODE_VERSION = "20"` pinned
- **SPA redirect:** `/* → /index.html (200)` — required for React Router to handle `/child/:token` and all parent routes on hard refresh
- **Security headers:** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`
- **Critical env var:** `VITE_BACKEND_URL` must be set in Netlify → Site settings → Environment variables

### Backend → Render
- **Config:** `backend/render.yaml`
  - `runtime: node`, `region: singapore` (lowest latency for Indian users on free tier)
  - `buildCommand: npm install` / `startCommand: node src/index.js`
  - Health check path: `GET /health` → `{ status: 'ok', timestamp: '...' }`
- **CORS:** `process.env.FRONTEND_URL` — set to the Netlify URL in Render dashboard
- **Required env vars (all set in Render dashboard — never in YAML):**
  ```
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY   ← server only, never expose
  CASPARSER_API_KEY           ← server only, never expose
  CHILD_TOKEN_SECRET          ← JWT signing secret, generate with: openssl rand -base64 48
  FRONTEND_URL                ← Netlify deployment URL (for CORS + garden link generation)
  PORT=3001
  NODE_ENV=production
  ```

### Backend URL — how the frontend resolves it
`frontend/src/lib/api.js` exports a single `BACKEND_URL` constant:
```js
export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'
```
**Every** `fetch()` call in the frontend imports from this file. There are zero inline `import.meta.env` calls for the backend URL anywhere else. This prevents the `undefined/api/...` relative-path bug that occurs when the env var is missing.

---

## 3. Completed Features

### Auth & Onboarding (Parent)
- **Signup** (`/signup`) — email + password via Supabase Auth; inserts row into `parents` table
- **Email verification** (`/verify-email`) — holding page; Supabase sends the link
- **Login** (`/login`) — Supabase session; redirects to `/parent/dashboard`
- **3-step onboarding wizard** (`/parent/onboarding`)
  - Step 1: Child name + DOB → `age_stage` derived automatically from DOB (parent cannot override)
  - Step 2: Savings goal (name, amount, date — all optional)
  - Step 3: Confirmation + creates `children` row + seeds `learning_state` row
- **Auth guard** (`RequireParentAuth`) — validates Supabase session; redirects to `/login` if missing
- **Session context** (`AuthContext`) — exposes `user`, `session`, `signOut` app-wide

### CASParser Integration (`/parent/portfolio`)
- **SDK widget tab** — fetches a short-lived `at_...` token from `POST /api/casparser/token` (master API key never leaves backend); renders `<PortfolioConnect>` SDK; on success calls `POST /api/casparser/process-widget`
- **PDF upload tab** — drag-and-drop + file picker; forwards to `POST /api/casparser/parse-pdf` which proxies to `POST https://api.casparser.in/v4/smart/parse`; SDK errors auto-switch user to PDF tab
- **Portfolio processing pipeline** (runs after every successful import):
  1. Stores full CASParser JSON in `portfolio_snapshots`
  2. Flattens schemes — handles both production (`folios[].schemes[]`) and sandbox (`mutual_funds[]`) response shapes
  3. Upserts `fund_tags` — preserves existing `is_visible_to_child`; defaults: `Equity → true`, all others `→ false`
  4. Computes tagged portfolio total (tries all known value field names across API shapes)
  5. Checks goal milestone crossing (25/50/75/100%) → updates `learning_state.last_trigger_type`
  6. Checks NAV change trigger (>1% vs previous snapshot) → updates trigger type
  7. Checks SIP transaction trigger (new `PURCHASE_SIP` since last snapshot) → updates trigger type

### Fund Tagging (`/parent/portfolio` — fund list section)
- Displays all imported funds grouped by type: Equity / Hybrid / Debt / Other
- Toggle per fund — `PATCH /api/casparser/fund-tags/:isin` — optimistic UI update
- Live "What your child sees" count strip
- Equity funds visible by default; all others hidden

### Child Token & Garden Link (`/parent/settings`)
- `POST /api/children/:childId/token` — signs a 90-day JWT (`{ child_id, parent_id }`) with `CHILD_TOKEN_SECRET`, stores in `children.child_token`
- `POST /api/children/:childId/token/regenerate` — overwrites `child_token`; old token instantly invalid because backend validates JWT signature **and** DB-stored value on every request
- Garden URL format: `https://taru.money/child/{token}`
- One-click copy to clipboard in Settings

### Child Money Garden (`/child/:token`)
Full token-gated experience — no login. Token validated on every API call against DB (not just JWT signature). On invalid/expired token: friendly error screen, never a 500 or raw JSON.

**4-tab navigation (bottom nav):**

| Tab | Key behaviour |
|---|---|
| **Garden** | Plant emoji (5 growth stages) with smooth CSS animation; Goal Card with progress bar + inline milestone badges (25/50/75/100%); Penny the Squirrel speech bubble |
| **Learn** | Vertical timeline — "This Week" section header (DM Serif Display), current week concept card (left green accent), "Recent Updates" divider, past trigger cards (muted bg) |
| **Tasks** | Lists active task rules; child taps "Done!" → `POST /api/tasks/:id/complete`; frequency locking enforced server-side; pending state shown while awaiting parent approval |
| **Gullak** | Coin counter (Nunito 900, 80px); coin-rain SVG animation on mount and on coin increase; "How to earn more" info card |

**Plant growth stages:**
| Portfolio progress | Emoji | Animation |
|---|---|---|
| 0–24% (seed) | 🌰 | `seedPulse` — gentle scale 1→1.10 |
| 25–49% | 🪴 | `plantFloat` — translateY + scale breath |
| 50–74% | 🌱 | `plantFloat` |
| 75–99% | 🌿 | `plantFloat` |
| 100% | 🌳 | `plantFloat` |

**Penny the Squirrel voice rules (never deviate):**
- Never say: "lesson", "should", "must", "important", "understand", "learn", "Great job!"
- One sentence max at Seed stage (ages 5–8)
- Discovery framing at Growth stage (12–14)
- Peer-level data-first at Investor stage (15–17)
- Never display daily NAV change — total growth since inception only

### Task Rules & Approval Flow
- **Parent creates rules** (`/parent/settings`) — max 3 per parent; `task_name`, `reward_coins` (1–100), `frequency` (`one-time` | `weekly` | `custom`)
- **Parent can pause/resume/delete** — `PATCH` / `DELETE /api/tasks/:id`
- **Child submits completion** — `POST /api/tasks/:id/complete`; server blocks if pending or frequency-locked
- **Frequency locking logic** (enforced server-side, mirrored in child UI):
  - `one-time` — locked forever after first approval
  - `weekly` — locked until 7 days since last approval have passed
  - `custom` — never auto-locked
- **Parent approves/rejects** (`/parent/dashboard` approval queue)
  - Approve: stamps `approved_at`, increments `learning_state.coins_total` via upsert
  - Reject: stamps `rejected_at`

### Activity Logging
Fire-and-forget (`fetch(...).catch(() => {})` — UI never blocked). All 7 event types implemented:
| Event | Actor | Trigger |
|---|---|---|
| `parent_app_open` | parent | Authenticated load of `/parent/dashboard` |
| `parent_section_visit` | parent | Every route change within `/parent/*` |
| `parent_prompt_viewed` | parent | Weekly prompt card enters viewport (IntersectionObserver, fires immediately) |
| `child_app_open` | child | Successful `/child/:token` load |
| `child_tab_visit` | child | Bottom-nav tab tap |
| `child_learn_card_viewed` | child | Learn card visible for ≥3 seconds (IntersectionObserver dwell timer) |

Server always sets `occurred_at` — never trusted from client. PII fields stripped from metadata in `activity.js` route before insert.

### Content System
`frontend/src/data/content.json` — weekly concept cards and trigger cards keyed by `week` number and `age_stage`. The `Learn` component resolves the right copy for the child's current week and stage. No content is hardcoded in JSX.

---

## 4. Design System

**Single source of truth:** `frontend/src/styles/tokens.css`
Extracted from `Taru_Design_System (1).html` (repo root). Imported globally in `main.jsx`.

**Strict guardrail: no hardcoded hex codes or `font-family` strings anywhere in JSX or component CSS. All values must use `var(--token-name)`.**

### Key tokens
```css
/* Brand greens */
--forest:    #1C4A3A   /* primary dark — topbars, headings */
--leaf:      #40916C   /* success, progress fills */
--sage:      #74C69D   /* muted accents */
--frost:     #D8F3DC   /* light green tint surfaces */
--bg:        #F4FAF6   /* page background */
--surface:   #FFFFFF   /* card backgrounds */

/* Amber accent — Gullak, badges, CTA */
--amber:     #E8920A
--amber-md:  #F9C84A   /* gold highlight */
--amber-lt:  #FDF0DC   /* light amber surfaces */
--amber-dk:  #7A4800   /* dark amber text */

/* Ink (text) */
--ink:       #1A2B22   /* primary text */
--ink-60:    rgba(26,43,34,.6)   /* secondary text */
--ink-30:    rgba(26,43,34,.3)   /* muted / labels */
--ink-10:    rgba(26,43,34,.08)  /* hairline backgrounds */

/* Shadows */
--shadow-sm: 0 1px 3px rgba(26,43,34,.08)
--shadow-md: 0 4px 16px rgba(26,43,34,.1)   /* cards */
--shadow-lg: 0 8px 32px rgba(26,43,34,.12)

/* Typography */
--font-parent:  'Plus Jakarta Sans'   /* parent app body + UI */
--font-kid:     'Nunito'              /* child app — coin counter, badges */
--font-display: 'DM Serif Display'   /* all headings + hero numbers */
--font-mono:    'JetBrains Mono'     /* code/URL display */

/* Radii */
--r-sm: 8px  --r-md: 12px  --r-lg: 16px  --r-xl: 24px  --r-pill: 100px

/* Spacing */
--sp1: 4px  --sp2: 8px  --sp3: 12px  --sp4: 16px  --sp6: 24px  --sp8: 32px
```

**Legacy aliases** (`--color-navy`, `--color-gold`, `--color-border`, `--radius-md`, `--space-*`, etc.) are defined in `tokens.css` as pointers to the new tokens. They exist only so that parent-app CSS written before the design system migration continues to work. New code must use the design-system token names directly.

### SVG fill exception
SVG `fill` attributes cannot use CSS variables. In these cases, use the literal hex value from the matching token with a comment:
```jsx
<circle fill="#E8920A" />  {/* --amber */}
```

---

## 5. Current State

**Phase 0 MVP is complete and live for the 10-family pilot.**

### What is live
- Full parent auth flow (signup → verify → login → onboarding)
- CASParser portfolio import (SDK widget + PDF fallback)
- Fund visibility tagging
- Child token generation and garden link sharing
- Child Money Garden at `taru.money/child/:token`
- Task rules + parent approval queue + coin awarding
- Activity event logging (all 7 events)
- Weekly Penny content cards (Learn tab)
- Milestone badges in Goal Card (Garden tab)
- Coin counter + coin-rain animation (Gullak tab)

### What is explicitly out of scope for Phase 0
Per `CLAUDE.md` — do not build any of these until Phase 1 is scoped:
- Multiple children per family
- In-app payments (Razorpay)
- Hero tools (Compounding Visualiser, SIP Calculator, etc.)
- Real MF folio creation (AMC API / NACH)
- Automated push notifications
- Shareable milestone cards (image generation)
- Gmail inbox / CDSL OTP / CAS Generator (requires CASParser Pro plan)
- Full 28-lesson Independence curriculum
- Analytics SDKs (Mixpanel / Amplitude)
- Android or iOS native apps

### Key file index
```
taru-mvp/
├── CLAUDE.md                          ← authoritative product/arch decisions
├── PROJECT_STATUS.md                  ← this file — session context anchor
├── Taru_Design_System (1).html        ← design system source (tokens extracted from here)
├── netlify.toml                       ← frontend build + SPA redirect
├── frontend/
│   ├── src/
│   │   ├── main.jsx                   ← entry — imports tokens.css
│   │   ├── App.jsx                    ← route map (all 8 routes)
│   │   ├── lib/
│   │   │   ├── api.js                 ← BACKEND_URL — import here, nowhere else
│   │   │   ├── supabase.js            ← Supabase browser client
│   │   │   └── activity.js            ← logActivity() fire-and-forget helper
│   │   ├── hooks/
│   │   │   └── useActivityOnView.js   ← IntersectionObserver + dwell timer hook
│   │   ├── context/AuthContext.jsx    ← Supabase session, exposed app-wide
│   │   ├── components/
│   │   │   ├── RequireParentAuth.jsx  ← auth guard for /parent/* routes
│   │   │   ├── ParentLayout.jsx       ← shared header + bottom nav
│   │   │   └── FundTagList.jsx        ← fund visibility toggle list
│   │   ├── pages/
│   │   │   ├── Signup / Login / VerifyEmail
│   │   │   ├── parent/
│   │   │   │   ├── Onboarding.jsx     ← 3-step wizard, writes to Supabase directly
│   │   │   │   ├── Dashboard.jsx      ← portfolio total, weekly prompt, task approvals
│   │   │   │   ├── Portfolio.jsx      ← CASParser widget + PDF upload tabs
│   │   │   │   └── Settings.jsx       ← child profile, goal, task rules, garden link
│   │   │   └── child/
│   │   │       ├── Garden.jsx         ← main child shell: 4 tabs, plant, goal card, milestones
│   │   │       ├── Learn.jsx          ← weekly concept cards + trigger cards (timeline layout)
│   │   │       └── Gullak.jsx         ← coin counter + SVG coin rain animation
│   │   ├── data/content.json          ← Penny copy: weekly_concepts[], triggers{}
│   │   └── styles/
│   │       ├── tokens.css             ← ALL design tokens live here — never hardcode elsewhere
│   │       ├── auth.css
│   │       ├── parent.css
│   │       ├── portfolio.css
│   │       └── child.css
└── backend/
    ├── render.yaml                    ← Render service config
    └── src/
        ├── index.js                   ← Express app, middleware, GET /health, GET /api/child/garden
        ├── middleware/auth.js         ← requireParentAuth + Supabase admin client
        └── routes/
            ├── casparser.js           ← /api/casparser/* (token, parse-pdf, process-widget, fund-tags)
            ├── tasks.js               ← /api/tasks/* (CRUD + approval flow + child endpoints)
            ├── children.js            ← /api/children/:id/token (generate + regenerate)
            └── activity.js            ← POST /api/activity (resolves actor from JWT or child token)
```

### Weekly founder tracking query
Run every Sunday in the Supabase SQL editor — see `CLAUDE.md` for the full SQL. It produces per-parent, per-week counts of `parent_open_days`, `child_open_days`, and `same_day_open_occurred`.

---

*Last updated: Phase 0 deployment complete. 10-family pilot live.*
