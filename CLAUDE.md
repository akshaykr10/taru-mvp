# Taru — Claude Code Project Context

> Read this file before writing any code. It is the authoritative source for all architectural, design, and product decisions in this codebase. The full PRD is `Taru_MVP_PRD_v2.1.docx`. This file is the distilled version.

---

## What Taru Is

A dual-experience **web app** hosted at `taru.money`. Two distinct products sharing one codebase:

- **Parent app** (`/parent/*`) — authenticated dashboard. Parent manages their mutual fund portfolio visibility, sets task rules, reads weekly conversation prompts.
- **Child app** (`/child/:token`) — token-gated Money Garden. No login. Child sees portfolio as a growing plant, earns coins, receives financial education from Penny the Squirrel.

**Phase 0 scope: 10 pilot families only.** Do not build for scale. Do not add features from the out-of-scope list.

---

## Tech Stack — Non-Negotiable

| Layer | Technology | Hosting |
|---|---|---|
| Frontend | React + Vite | Netlify or Vercel (free tier) |
| Backend | Node.js + Express | Render (free tier) or Railway |
| Database | Supabase (PostgreSQL) | Supabase free tier |
| Auth | Supabase Auth | Email + password for parents |
| Portfolio fetch | CASParser API (primary) | api.casparser.in |
| PDF fallback | CASParser API via backend | Same |
| Static assets | SVG + JSON | CDN (Netlify/Vercel edge) |
| Domain | taru.money | Purchased separately |

**Never suggest alternative databases, auth providers, or hosting platforms.** These decisions are final for Phase 0.

---

## Route Map

```
/signup                   — Parent signup (public)
/login                    — Parent login (public)
/verify-email             — Post-signup holding page (public)
/parent/onboarding        — 3-step wizard, post-verification
/parent/dashboard         — Main parent view (auth required)
/parent/portfolio         — Fund tagging + CASParser widget (auth required)
/parent/settings          — Child details, goal, task rules (auth required)
/child/:token             — Child Money Garden (token-gated, no login)
```

All `/parent/*` routes require a valid Supabase Auth JWT. Redirect to `/login` if missing.

The `/child/:token` route requires a valid signed child JWT. If invalid or expired, render a friendly error page — never a 500 or raw JSON.

---

## Database Schema

All tables live in Supabase (PostgreSQL). Enable Row Level Security on every table.

```sql
-- Parents
parents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
)

-- Children
children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES parents(id) ON DELETE CASCADE,
  name text NOT NULL,
  dob date NOT NULL,
  age_stage text NOT NULL,          -- 'seed' | 'sprout' | 'growth' | 'investor'
  goal_name text,
  goal_amount numeric,
  goal_date date,
  child_token text UNIQUE,          -- signed JWT, 90-day expiry
  created_at timestamptz DEFAULT now()
)

-- Portfolio snapshots (one per CASParser fetch)
portfolio_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES parents(id) ON DELETE CASCADE,
  fetched_at timestamptz DEFAULT now(),
  cas_type text,                    -- 'casparser_widget' | 'pdf_upload'
  raw_json jsonb NOT NULL,          -- full CASParser response
  statement_period text
)

-- Fund visibility per parent
fund_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES parents(id) ON DELETE CASCADE,
  isin text NOT NULL,
  fund_name text NOT NULL,
  fund_type text,                   -- 'Equity' | 'Debt' | 'Hybrid' | 'Other'
  is_visible_to_child boolean DEFAULT false,
  UNIQUE(parent_id, isin)
)

-- Task rules (max 3 per parent)
task_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES parents(id) ON DELETE CASCADE,
  child_id uuid REFERENCES children(id) ON DELETE CASCADE,
  task_name text NOT NULL,
  reward_coins integer NOT NULL,
  frequency text NOT NULL,          -- 'one-time' | 'weekly' | 'custom'
  status text DEFAULT 'active'      -- 'active' | 'paused'
)

-- Task completion records
task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_rule_id uuid REFERENCES task_rules(id) ON DELETE CASCADE,
  completed_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  rejected_at timestamptz
  -- status is derived: null approved/rejected = pending
)

-- Child learning state
learning_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid REFERENCES children(id) ON DELETE CASCADE UNIQUE,
  current_week integer DEFAULT 1,
  last_trigger_type text,
  coins_total integer DEFAULT 0,
  xp_total integer DEFAULT 0
)

-- Weekly conversation log
conversation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES parents(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  prompt_text text NOT NULL,
  marked_done_at timestamptz
)

-- Activity tracking (see ## Activity Tracking below)
activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type text NOT NULL,         -- 'parent' | 'child'
  parent_id uuid REFERENCES parents(id) ON DELETE CASCADE,
  child_id uuid REFERENCES children(id) ON DELETE SET NULL,
  event_type text NOT NULL,         -- see event taxonomy below
  section text,                     -- route/tab visited, null for app_open events
  occurred_at timestamptz DEFAULT now(),  -- ALWAYS server-set, never client
  metadata jsonb                    -- optional: week number, card_id, etc. NO PII
)
```

---

## Security Model — Read Every Line

**Parent routes:** All `/parent/*` API endpoints require a valid Supabase Auth JWT in the `Authorization: Bearer` header. The backend validates this with Supabase before returning any data.

**Child routes:** The `/child/:token` endpoint validates a signed JWT (`child_token`). The backend resolves `child_id` from the token and returns **only** the `fund_tags` rows where `is_visible_to_child = true` for that child's parent. No parent financial data is reachable from a child token — enforce this at the query level, not just via route protection.

**CASParser API key:** Stored in backend environment variables only (`CASPARSER_API_KEY`). Never in frontend code, never in client-side `.env` that gets bundled. The backend generates short-lived `at_...` access tokens (60-minute expiry) and passes only those to the frontend SDK.

**Activity events:** Written via `POST /api/activity` only. The backend resolves `parent_id` and `child_id` from the session/token. The frontend never writes directly to Supabase for this table.

**RLS policies:** Every table needs RLS. Parents may only SELECT/UPDATE their own rows (`parent_id = auth.uid()`). The `activity_events` table is read-only for parents via RLS; the founder queries via service role key.

---

## CASParser Integration

**Primary flow — Portfolio Connect SDK:**
```jsx
import { PortfolioConnect } from '@cas-parser/connect';

<PortfolioConnect
  accessToken={atToken}  // fetched from POST /api/casparser/token — never from frontend
  config={{
    enableGenerator: false,   // Lite plan
    enableCdslFetch: false,   // Lite plan
    enableInbox: false,       // Lite plan
  }}
  onSuccess={(data) => handlePortfolioData(data)}
  onError={(err) => handleFallback(err)}
>
  {({ open }) => <button onClick={open}>Import Portfolio</button>}
</PortfolioConnect>
```

**Backend token endpoint:**
```
POST /api/casparser/token
Auth: Supabase session JWT required
→ calls POST https://api.casparser.in/v1/token
→ returns { access_token: "at_...", expires_at: "..." }
```

**PDF fallback endpoint:**
```
POST /api/casparser/parse-pdf
Auth: Supabase session JWT required
Body: multipart/form-data { pdf_file, password? }
→ forwards to POST https://api.casparser.in/v4/smart/parse
→ stores result as portfolio_snapshot
```

**Use sandbox key during all development:** `sandbox-with-json-responses` (check CASParser docs for current value). Never consume production credits during development.

**After a successful parse, the backend must:**
1. Store full response JSON in `portfolio_snapshots`
2. Upsert `fund_tags` — preserve `is_visible_to_child` for existing ISINs; default new ISINs: `Equity → true`, all others `→ false`
3. Compute tagged portfolio total (sum of `scheme.value` where `is_visible_to_child = true`)
4. Check for goal milestone crossing (25/50/75/100%) — create event in `learning_state` if newly crossed
5. Check NAV change trigger (>1% vs previous snapshot for any tagged scheme)
6. Check SIP transaction trigger (new `PURCHASE_SIP` transaction since last snapshot)

---

## Child Token Generation

```js
// Backend only — never expose signing secret to frontend
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { child_id: child.id, parent_id: child.parent_id },
  process.env.CHILD_TOKEN_SECRET,
  { expiresIn: '90d' }
);
// Store token in children.child_token
// Full URL: https://taru.money/child/{token}
```

On regeneration, the old token is invalidated (update `children.child_token` to the new value; the backend always validates against the DB-stored token, not just the JWT signature).

---

## Activity Tracking

**Backend endpoint only:** `POST /api/activity`

The frontend calls this fire-and-forget — do not `await` it, do not block UI on it. A failed write is acceptable for Phase 0.

```js
// Frontend pattern
fetch('/api/activity', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...authHeaders },
  body: JSON.stringify({ event_type, section, metadata })
}).catch(() => {}) // silent failure is intentional
```

**Event taxonomy — fire these and only these:**

| event_type | actor | When to fire | section value |
|---|---|---|---|
| `parent_app_open` | parent | On authenticated load of `/parent/dashboard` | null |
| `parent_section_visit` | parent | On every route change within `/parent/*` | e.g. `/parent/portfolio` |
| `parent_prompt_viewed` | parent | When weekly prompt card enters viewport (IntersectionObserver) | null |
| `child_app_open` | child | On successful `/child/:token` load | null |
| `child_tab_visit` | child | On each bottom-nav tab tap | `child/garden` \| `child/learn` \| `child/tasks` \| `child/gullak` |
| `child_learn_card_viewed` | child | Card in viewport for ≥3 seconds | null |

`same_day_open` is not fired — it is derived in the weekly SQL query.

**metadata rules:** Only IDs, slugs, week numbers. Never names, email addresses, portfolio values, PAN numbers, or fund names.

---

## Design System — Never Hardcode Values

All colours and typography must reference tokens. Define them once in `src/styles/tokens.css` (or `src/styles/tokens.ts` if using CSS-in-JS).

### Colour Tokens

```css
:root {
  /* Brand */
  --color-navy:       #0B1628;
  --color-gold:       #E8B84B;
  --color-gold-dark:  #C9962A;

  /* Semantic */
  --color-bg:         #FFFFFF;
  --color-surface:    #F8F4EF;
  --color-text-primary:   #0B1628;
  --color-text-secondary: #64748B;
  --color-border:     #E2E8F0;

  /* Status */
  --color-success:    #16A34A;
  --color-warning:    #D97706;
  --color-error:      #DC2626;
}
```

### Typography

```css
/* Headlines */
font-family: 'Cormorant Garamond', Georgia, serif;
font-weight: 600;

/* Body, UI, labels */
font-family: 'DM Sans', system-ui, sans-serif;
font-weight: 400;
```

Load both fonts from Google Fonts. Cormorant Garamond for all section headings and hero numbers. DM Sans for everything else.

### Minimum standards (non-negotiable)

- Contrast ratio ≥ 4.5:1 for all body text
- Minimum tap target 44×44px
- Minimum font size 14px
- All Penny animations must have `prefers-reduced-motion` fallback via CSS

---

## Penny the Squirrel — Voice Rules

Penny is the child's mascot. Every piece of in-app copy Penny delivers must follow these rules — no exceptions.

**Penny IS:**
- A curious, sharp squirrel who gets excited about how money grows
- Speaking like a smart 16-year-old talking to a 10-year-old
- Asking questions before revealing answers
- Using the child's actual portfolio numbers
- One sentence at a time for Seed stage (ages 5–8)

**Penny is NOT:**
- An owl (she was changed — catch any stale references)
- An adult talking down to a child
- Using the words: "lesson", "should", "must", "important", "understand", "learn", "Great job learning about money!"

**Never use these phrases — always substitute:**

| ❌ Never say | ✅ Say instead |
|---|---|
| "Today's lesson is..." | "Something interesting happened to your portfolio..." |
| "You should know that..." | "Here's something most people find out way too late..." |
| "Great job learning about money!" | "That's ₹208 that showed up without you doing anything." |
| "Do you understand?" | "What do you think caused that?" |
| "Let's learn about compound interest!" | "Your money made money last week. Want to know how?" |

**Voice by age stage:**

| Stage | Age | Rule |
|---|---|---|
| Seed | 5–8 | One sentence max. No quizzes. No scores. |
| Sprout | 9–11 | Lead with a question. Tie to real portfolio number. |
| Growth | 12–14 | Discovery framing. Never say "you should". |
| Investor | 15–17 | Peer-level, data-first. Never simplify. |

---

## Age Stage Derivation

Computed from child DOB — parent cannot override:

```js
function deriveAgeStage(dob) {
  const age = Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000));
  if (age <= 8)  return 'seed';
  if (age <= 11) return 'sprout';
  if (age <= 14) return 'growth';
  return 'investor';
}
```

---

## Money Garden — Plant Growth Stages

Portfolio progress → plant stage (SVG + CSS animation):

| Goal progress | Plant stage |
|---|---|
| 0–24% | Seed |
| 25–49% | Sprout |
| 50–74% | Small plant |
| 75–99% | Full plant |
| 100% | Blooming tree |

**Never display daily NAV change or daily gain/loss.** Always display total gain since inception only. This is intentional — daily fluctuation creates anxiety.

---

## What Is Out of Scope for Phase 0

Do not build any of the following. If you find yourself starting on one, stop.

- Hero tools (Compounding Visualiser, Goal Reverse Planner, SIP Step-Up Calculator, RCA Visualiser, Opportunity Cost Engine, Savings Rate Simulator)
- Real MF folio creation (AMC API / NACH)
- In-app payments / Razorpay
- Automated push notifications
- Shareable milestone cards (image generation)
- Multiple children per family
- Gmail inbox integration / CDSL OTP fetch / CAS Generator (requires CASParser Pro)
- Full Independence curriculum (28 lessons)
- Daily lesson cadence
- Analytics SDK (Mixpanel / Amplitude)
- Android or iOS native app

---

## Build Order (Follow This Sequence)

1. **Supabase migrations** — all tables, RLS policies, indexes
2. **Auth flow** — signup, email verification, login, session management
3. **Parent dashboard shell** — routes, nav, layout with stub data
4. **CASParser integration** — backend token endpoint + SDK widget + PDF fallback
5. **Child token generation** — JWT signing, storage, `/child/:token` route
6. **Activity logging** — `POST /api/activity` endpoint + all 7 event fires
7. **Fund tagging** — toggle UI, real-time child preview card
8. **Child Money Garden** — plant SVG, portfolio values, goal bar
9. **Task rules + approval flow**
10. **Content cards** — Penny copy, weekly concept cards, trigger cards
11. **Gullak** — coin counter, coin-rain animation, milestone badges

Do not skip ahead. Each step depends on the previous.

---

## Environment Variables

```bash
# Backend (.env)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=   # server only — never expose to frontend
CASPARSER_API_KEY=           # server only — never expose to frontend
CHILD_TOKEN_SECRET=          # JWT signing secret for child tokens
PORT=3001

# Frontend (.env)
VITE_SUPABASE_URL=           # same URL, safe to expose
VITE_SUPABASE_ANON_KEY=      # anon key only — never service role
VITE_API_BASE_URL=           # backend URL (e.g. https://taru-api.onrender.com)
```

`SUPABASE_SERVICE_ROLE_KEY` and `CASPARSER_API_KEY` must never appear in frontend code or in any file that Vite will bundle.

---

## Performance Targets

- Parent dashboard load (post-login): < 2 seconds on 4G, mid-range Android
- Child app load from token URL: < 2 seconds on 4G
- Money Garden SVG animation: 60fps on Chrome mobile
- Browser targets: Chrome 80+, Safari 13+, Samsung Internet 12+
- Layout: mobile-first, 375px minimum width

---

## Weekly Founder Query (for Tracking Sheet)

The founder runs this every Sunday in the Supabase SQL editor:

```sql
-- Weekly engagement summary
SELECT
  p.id AS parent_id,
  p.name AS parent_name,
  DATE_TRUNC('week', ae.occurred_at) AS week,
  COUNT(DISTINCT DATE(ae.occurred_at)) FILTER (WHERE ae.event_type = 'parent_app_open') AS parent_open_days,
  COUNT(DISTINCT DATE(ae.occurred_at)) FILTER (WHERE ae.event_type = 'child_app_open')  AS child_open_days,
  BOOL_OR(
    ae.event_type = 'parent_app_open'
    AND EXISTS (
      SELECT 1 FROM activity_events ae2
      WHERE ae2.parent_id = ae.parent_id
        AND ae2.event_type = 'child_app_open'
        AND DATE(ae2.occurred_at) = DATE(ae.occurred_at)
    )
  ) AS same_day_open_occurred
FROM activity_events ae
JOIN parents p ON p.id = ae.parent_id
WHERE ae.occurred_at >= NOW() - INTERVAL '8 weeks'
GROUP BY p.id, p.name, DATE_TRUNC('week', ae.occurred_at)
ORDER BY week DESC, parent_name;
```

---

*This file is the source of truth for Claude Code sessions. Update it when architectural decisions change. Version: aligned with PRD v2.1.*
