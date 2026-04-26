# Taru MVP — Project Status
> **Baseline as of Phase 0 Sprint Close.** This document is the single source of truth for current architecture, UX state, and code health. Update it whenever a structural decision changes.

---

## Table of Contents
1. [What We've Built](#1-what-weve-built)
2. [Tech Stack](#2-tech-stack)
3. [Route Map](#3-route-map)
4. [Brand & Mascot Identity](#4-brand--mascot-identity)
5. [Mobile-First Architecture](#5-mobile-first-architecture)
6. [Parent App — Taru](#6-parent-app--taru)
7. [Child App — Taru Jr.](#7-child-app--taru-jr)
8. [Backend API](#8-backend-api)
9. [Database Schema](#9-database-schema)
10. [Design System](#10-design-system)
11. [Activity Tracking](#11-activity-tracking)
12. [Security Audit — Session Fixes](#12-security-audit--session-fixes)
13. [Code Health & Edge Cases](#13-code-health--edge-cases)
14. [Dev Environment](#14-dev-environment)
15. [Out of Scope — Phase 0](#15-out-of-scope--phase-0)

---

## 1. What We've Built

Two distinct products sharing one codebase, deployed at `taru.money`.

| Product | Audience | Access | Purpose |
|---|---|---|---|
| **Taru** (Parent App) | Parent | Email + password (Supabase Auth) | Manage portfolio visibility, set tasks, approve completions, read weekly prompts |
| **Taru Jr.** (Child App) | Child | Signed JWT in URL, no login | Money Garden, weekly lessons, task submission, coin jar |

**Phase 0 scope:** 10 pilot families. Not built for scale. One child per family.

---

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React 18 + Vite | Both apps live in `/frontend/src` |
| Routing | React Router DOM v6 | Single SPA, nested routes |
| Backend | Node.js + Express | `/backend/src`, nodemon in dev |
| Database | Supabase (PostgreSQL) | RLS enabled on every table |
| Auth | Supabase Auth | Parents only — email + password |
| Child Auth | Signed JWT in URL | 90-day expiry, DB-validated for revocation |
| Portfolio import | CASParser API | SDK widget (primary) + PDF fallback |
| Hosting (frontend) | Netlify / Vercel (free tier) | |
| Hosting (backend) | Render (free tier) | `render.yaml` configured |
| Domain | taru.money | Purchased separately |

---

## 3. Route Map

```
/signup                  Public — parent signup
/login                   Public — parent login
/verify-email            Public — post-signup holding page

/parent/onboarding       Auth-required — 3-step wizard (full screen, no nav)
/parent/dashboard        Auth-required — main parent hub
/parent/portfolio        Auth-required — CAS import + fund tagging
/parent/settings         Auth-required — child profile, tasks, garden link

/child/:token            Token-gated — child Money Garden (Taru Jr.)

/                        → redirects to /login
/*                       → redirects to /login
```

**Auth guard:** `RequireParentAuth` wraps all `/parent/*` routes. Redirects to `/login` with `from` state preserved.

**Child token guard:** Backend validates the JWT signature AND that it matches the value stored in `children.child_token` (supports revocation). A mismatch returns `401` — the child app renders a friendly error, never raw JSON or a 500.

---

## 4. Brand & Mascot Identity

### Official Mascot: Penny the Squirrel 🐿️

- **Name:** Penny the Squirrel
- **Emoji:** 🐿️ — used in speech bubbles, card headers, error states
- **Voice:** Curious, sharp. Speaks like a smart 16-year-old talking to a 10-year-old. Asks questions before giving answers. Never says "lesson", "should", "must", or "Great job learning!"
- **Voice varies by age stage** — see § 7.2 for stage-by-stage rules

### Mascot Purge — Completed
All references to the former mascot "Gilli" (an owl) have been fully removed from the codebase:

| Was | Now |
|---|---|
| `WiseGilliSVG` component (36-line SVG owl) | `PennyIcon` — 3-line `🐿️` emoji span |
| `.learn-week-card__gilli` CSS class | `.learn-week-card__penny` |
| All comments referencing "Gilli" or "Wise Gilli" | Updated to "Penny" |
| Separate `learn-done-state` confirmation banner | Removed — button morphs in-place |

`grep -r "Gilli\|🦉\|owl" src/` returns **zero results** across all `.jsx` and `.css` files.

---

## 5. Mobile-First Architecture

Both Taru and Taru Jr. are strictly mobile-first, single-column applications. There is no desktop breakpoint — the max-width container centres on larger screens.

### Constraints enforced in CSS
- **Max width:** `480px` with `margin: 0 auto` on `.child-shell` and `.parent-shell`
- **Min tap target:** `44px` (via `--tap-target` token) on all interactive elements
- **Min font size:** `14px` across all body text
- **Viewport unit:** `min-height: 100dvh` (accounts for mobile browser chrome)
- **Safe area:** Bottom nav uses `env(safe-area-inset-bottom)` for notched devices
- **Browser targets:** Chrome 80+, Safari 13+, Samsung Internet 12+

### Layout model
Both apps use a three-layer flex column:
```
.app-shell
  ├── top bar         (fixed height)
  ├── main content    (flex: 1, overflow-y: auto)
  └── bottom nav      (fixed height + safe-area inset)
```

---

## 6. Parent App — Taru

### 6.1 Navigation
Bottom nav with 3 tabs rendered by `ParentLayout.jsx`. Active route highlighted with `color: var(--forest)`. Fires `parent_section_visit` activity event on every route change.

| Tab | Icon | Route |
|---|---|---|
| Home | 🏡 | `/parent/dashboard` |
| Portfolio | 📊 | `/parent/portfolio` |
| Settings | ⚙️ | `/parent/settings` |

### 6.2 Onboarding (`/parent/onboarding`)
3-step wizard. Full-screen — no nav shell. Redirects to dashboard on completion.

| Step | Fields | Notes |
|---|---|---|
| 1 — Child basics | First name, Date of birth | Age stage (`seed`/`sprout`/`growth`/`investor`) auto-derived from DOB. Parent cannot override. |
| 2 — Savings goal | Goal name, Target ₹, Target date | All optional. Can be set later in Settings. |
| 3 — Review | Summary card | Inserts `children` + `learning_state` rows on confirm. |

### 6.3 Dashboard (`/parent/dashboard`)

**Child Overview Widget**
Rendered prominently at the top of the feed. Shows:
- Child name + age stage badge
- Goal name and progress bar (0–100%)
- ₹ saved vs. ₹ target
- Task status pill: "X tasks pending" or "All clear ✓"

**Portfolio Summary Card**
- Total tagged portfolio value (₹) and number of funds shared with child
- **Empty state (PortfolioEmptyState):** A blurred mock portfolio background is rendered behind a "Connect your portfolio →" CTA overlay. New parents see a realistic preview of what the screen will look like, not an empty void.

**Inline Task Approvals**
- Lists all `task_completions` where `approved_at IS NULL AND rejected_at IS NULL`
- Per-completion row: task name, child name, coins at stake
- **Approve** and **Reject** action buttons — no separate approvals page needed
- Approval immediately awards coins (`learning_state.coins_total += reward_coins`)

**Weekly Learning Prompt**
- Prompt card for the current week surfaced on the dashboard
- Fires `parent_prompt_viewed` activity event when scrolled into viewport (IntersectionObserver, 0 ms dwell)

### 6.4 Portfolio (`/parent/portfolio`)

**Two import modes (tabbed):**

| Mode | Flow |
|---|---|
| Portfolio Connect | Backend generates short-lived `at_...` token → CASParser SDK widget handles CAMS/KFintech auth → `onSuccess` POSTs data to `/api/casparser/process-widget` |
| PDF Upload | Drag-drop / file picker → optional password → `POST /api/casparser/parse-pdf` (multipart, max 5 MB) |

**Post-import pipeline (backend):**
1. Full CAS response stored in `portfolio_snapshots`
2. `fund_tags` upserted — new **Equity** funds default to `is_visible_to_child: true`, others `false`. Existing visibility preserved.
3. Goal milestone trigger checked (25 / 50 / 75 / 100%)
4. NAV change trigger checked (>1% on any tagged scheme vs. prior snapshot)
5. SIP transaction trigger checked (new `PURCHASE_SIP` since last snapshot)

**Fund Tagging UI (`FundTagList` component):**
- Funds grouped: Equity → Hybrid → Debt → Other
- Per-fund toggle: "Shared" / "Hidden" — optimistic update + `PATCH /api/casparser/fund-tags/:isin`
- "What your child sees" summary strip

### 6.5 Settings (`/parent/settings`)

**Assigned Tasks — Quick Assign Chips**
Pre-built chips (Tidy Room, Homework, Dog Walking, etc.) populate the task form in one tap, reducing friction for the most common tasks.

Full task form fields: task name + coins (1–100) + frequency (`one-time` | `weekly` | `custom`).
Max **3 active task rules** per family enforced at the API level.

Per-rule controls: Pause / Resume (non-one-time rules) · Delete with confirmation.

**Child's Garden Link**
- Generates a 90-day signed JWT and displays the full `taru.money/child/{token}` URL
- Copy button + Regenerate button (invalidates old token immediately via DB overwrite)

---

## 7. Child App — Taru Jr.

### 7.1 Routing & Default Tab

The child app is a **single-component SPA** (`ChildGarden.jsx`). Tabs are managed by local React state — not URL sub-routes.

**Default tab on load: Garden** — set by `useState('garden')` in `ChildGarden.jsx`.

**Bottom nav order (left → right):**

| Position | Tab | Icon | Default? |
|---|---|---|---|
| 1 | Garden | 🌱 | ✅ Yes |
| 2 | Learn | 💡 | |
| 3 | Tasks | ✅ | |
| 4 | Gullak | 🪙 | |

Active tab styling: `color: var(--forest)`, `background: var(--frost)`, icon scales `1.15×` with bounce easing. All nav buttons maintain `min-height: 44px`.

### 7.2 Garden Tab

**Plant emoji reflects goal progress:**

| Progress | Emoji | Animation |
|---|---|---|
| 0–24% | 🌰 Seed | `seedPulse` — gentle scale breathe |
| 25–49% | 🪴 Sprout | `plantFloat` — vertical drift |
| 50–74% | 🌱 Small plant | `plantFloat` |
| 75–99% | 🌿 Full plant | `plantFloat` |
| 100% | 🌳 Bloom | `plantFloat` |

**Goal Card:** goal name + age stage badge + progress bar + **single Next Milestone badge**.

**Next Milestone logic (`getNextMilestone`):**
- `Array.find()` — returns the **first** unachieved threshold only (25 / 50 / 75 / 100%)
- Never renders all four milestones simultaneously
- At 100%: renders "🌸 Goal complete!" badge with `--complete` variant styling

**Penny speech bubble:**
- 🐿️ emoji floats above the bubble (`.penny-bubble-wrap__squirrel`)
- Bubble: `background: var(--frost)`, `padding: var(--sp4)`, `border-radius: var(--r-xl)`
- `::before` pseudo-element creates an upward-pointing tail connecting to the emoji above
- Text varies by `age_stage` via `getPennyGreeting()`

**Penny's voice by age stage:**

| Stage | Age | Character |
|---|---|---|
| `seed` | 5–8 | One sentence max. No quizzes. "Your money is growing! 🌱" |
| `sprout` | 9–11 | Leads with a question. Ties to real portfolio number. |
| `growth` | 12–14 | Discovery framing. Never "you should". |
| `investor` | 15–17 | Peer-level, data-first. Never simplifies. |

### 7.3 Learn Tab

**Layout (vertical timeline):**
1. "This Week" heading + week number + age stage
2. `CurrentWeekCard` — sky-lt themed card with Penny icon (🐿️)
3. "Recent updates" — `TriggerCard` for `last_trigger_type` (if set)

**CurrentWeekCard:**
- Content from `data/content.json` → `weekly_concepts[week][ageStage]`
- Fields rendered: `title` · `penny_says` · `body` · `question` (optional)
- Title styled: `font-family: var(--font-kid)`, `font-weight: 800`, `color: var(--forest)`
- Card header: week badge (left) + 🐿️ Penny icon (right)

**Mark as Done — XP Reward Logic:**
```
Child taps "Mark as done ✓"
  → onXpEarned(50) fires
  → Garden.jsx: gardenData.learning_state.xp_total += 50 (local state)
  → "+50 XP! 🌟" burst floats up and fades (1.4s, amber, font-kid)
  → Button morphs in-place (no separate banner):
        text:        "✓ 50 XP Earned!"
        background:  var(--mint)
        color:       var(--leaf)
        box-shadow:  none       ← physically "pressed down"
        transform:   translateY(2px)
        disabled:    true       ← cannot be tapped again
        aria-pressed: true      ← accessible state
```

**Activity:** `child_learn_card_viewed` fires after 3-second dwell in viewport (`useActivityOnView` hook).

**Trigger types (Recent Updates section):**

| Type | Icon | Fires when |
|---|---|---|
| `sip` | 💰 | New SIP purchase in latest CAS import |
| `nav_change` | 📈 | Tagged fund moved >1% vs. prior snapshot |
| `milestone` | 🎉 | Goal progress newly crossed 25/50/75/100% |
| `task_approved` | 🪙 | Parent approved a task completion |

### 7.4 Tasks Tab

**Three card states per task:**

| State | Trigger | Visual |
|---|---|---|
| **Active** | Default | Amber "Done!" button. `box-shadow: 0 3px 0 var(--amber-dk)` gives physical depth. `:active` → `translateY(2px)` + shadow collapses — tactile press feel. |
| **Pending** | After submit OR 409 response | Button morphs: `⏳ Pending Parent`, `background: var(--amber-lt)`, `box-shadow: none`, `translateY(2px)`. `disabled={true}`. Cannot be tapped again. |
| **Approved (Cooldown)** | `task.has_approved === true` | Button removed entirely. Read-only pill badge replaces it. |

**Cooldown badge (approved state):**
- `background: var(--frost)` · `color: var(--forest)` · `border: 1px solid var(--mint)`
- `border-radius: var(--r-pill)` · `padding: var(--sp2) var(--sp4)` · `font-family: var(--font-kid)`
- Dynamic text:
  - `task.frequency === 'weekly'` → **"✓ Done for this week"**
  - All other frequencies → **"✓ Done for today"**

**Approved card:** `.child-task-card--approved` — `background: var(--frost)`, `border-color: var(--mint)`, `box-shadow: none` on the full card.

**Task frequency lock (backend-enforced):**

| Frequency | Lock |
|---|---|
| `one-time` | Permanently locked after first approval |
| `weekly` | Locked for 7 days after approval |
| `custom` | No automatic lock |

### 7.5 Gullak Tab

- Large 🪙 + XL `coins_total` counter (`--font-kid`, `font-weight: 900`)
- **Coin rain:** 12 coins fall with staggered delays when coins increase or on first mount if `coins > 0`. Total duration: 1800 ms.
- Info: "Complete tasks and ask a parent to approve them."

### 7.6 Error & Loading States

**Loading:** Full-screen centred `🌱` + "Getting your garden ready…"

**Error:**
```
       🐿️
Penny can't find your garden
{descriptive error message}
```
Never a raw 500 or JSON. `401` → "This link has expired or is no longer valid. Ask a parent to send a new one."

---

## 8. Backend API

`/parent/*` endpoints: `Authorization: Bearer <supabase_jwt>` validated server-side via `requireParentAuth` middleware.
Child endpoints: `X-Child-Token: <child_jwt>` validated against JWT signature + DB-stored value.

### CASParser — `/api/casparser/*`
| Method | Path | Auth | Action |
|---|---|---|---|
| POST | `/token` | Parent | Generate short-lived CASParser SDK access token |
| POST | `/parse-pdf` | Parent | Upload CAS PDF → parse → store snapshot + upsert tags |
| POST | `/process-widget` | Parent | Store Portfolio Connect SDK result |
| GET | `/fund-tags` | Parent | List all fund_tags grouped by type |
| PATCH | `/fund-tags/:isin` | Parent | Toggle `is_visible_to_child` |

### Children — `/api/children/*`
| Method | Path | Auth | Action |
|---|---|---|---|
| POST | `/:childId/token` | Parent | Generate 90-day child JWT, store in DB |
| POST | `/:childId/token/regenerate` | Parent | Rotate child JWT (old token immediately invalid) |

### Tasks — `/api/tasks/*`
| Method | Path | Auth | Action |
|---|---|---|---|
| GET | `/` | Parent | List all task rules |
| POST | `/` | Parent | Create task rule (max 3 per family) |
| PATCH | `/:id` | Parent | Update name / coins / frequency / status |
| DELETE | `/:id` | Parent | Delete rule |
| GET | `/pending` | Parent | List completions awaiting approval |
| POST | `/completions/:id/approve` | Parent | Approve + award coins to child |
| POST | `/completions/:id/reject` | Parent | Reject completion |
| GET | `/child` | Child token | List tasks with `has_pending` + `has_approved` state |
| POST | `/:id/complete` | Child token | Submit completion (409 if duplicate or frequency-locked) |

### Child Garden — `/api/child/*`
| Method | Path | Auth | Action |
|---|---|---|---|
| GET | `/garden` | Child token | Fetch child record, tagged portfolio total, learning state |
| POST | `/week-complete` | Child token | Mark current week done, upsert `conversation_log`, advance week after 7-day gate |

### Cron — `/api/cron/*`
| Method | Path | Auth | Action |
|---|---|---|---|
| POST | `/update-navs` | `CRON_SECRET` bearer token | Fetch AMFI NAVAll.txt, update `nav` + `current_value` in `cas_funds` for all matched ISINs |

Cron is called daily at 22:30 IST (17:00 UTC) by the Render cron job defined in `render.yaml`. Can also be triggered manually with `Authorization: Bearer <CRON_SECRET>`.

### Activity — `/api/activity`
| Method | Path | Auth | Action |
|---|---|---|---|
| POST | `/` | Parent or Child token | Log activity event (safe to fire-and-forget) |

### Health
| Method | Path | Auth | Action |
|---|---|---|---|
| GET | `/health` | None | `{ status: 'ok' }` |

---

## 9. Database Schema

All tables have Row Level Security enabled. `SUPABASE_SERVICE_ROLE_KEY` is backend-only and never sent to the frontend.

```sql
parents (
  id uuid PK, email text UNIQUE, name text, created_at timestamptz
)

children (
  id uuid PK, parent_id uuid FK,
  name text, dob date, age_stage text,       -- seed|sprout|growth|investor
  goal_name text, goal_amount numeric, goal_date date,
  child_token text UNIQUE,                   -- 90-day JWT; DB-validated for revocation
  created_at timestamptz
)

portfolio_snapshots (
  id uuid PK, parent_id uuid FK,
  fetched_at timestamptz, cas_type text,     -- casparser_widget|pdf_upload
  raw_json jsonb, statement_period text
)

fund_tags (
  id uuid PK, parent_id uuid FK,
  isin text, fund_name text, fund_type text, -- Equity|Debt|Hybrid|Other
  is_visible_to_child boolean DEFAULT false,
  UNIQUE(parent_id, isin)
)

task_rules (
  id uuid PK, parent_id uuid FK, child_id uuid FK,
  task_name text, reward_coins integer,
  frequency text,                            -- one-time|weekly|custom
  status text DEFAULT 'active'               -- active|paused
)

task_completions (
  id uuid PK, task_rule_id uuid FK,
  completed_at timestamptz,
  approved_at timestamptz,                   -- null = pending
  rejected_at timestamptz                    -- null = not rejected
  -- status is derived: both null = pending
)

learning_state (
  id uuid PK, child_id uuid FK UNIQUE,
  current_week integer DEFAULT 1,
  last_trigger_type text,                    -- sip|nav_change|milestone|task_approved
  coins_total integer DEFAULT 0,
  xp_total integer DEFAULT 0
)

conversation_log (
  id uuid PK, parent_id uuid FK,
  week_number integer, prompt_text text, marked_done_at timestamptz
)

activity_events (
  id uuid PK, actor_type text,              -- parent|child
  parent_id uuid FK, child_id uuid FK,
  event_type text, section text,
  occurred_at timestamptz,                  -- ALWAYS server-set
  metadata jsonb                            -- no PII
)
```

---

## 10. Design System

All values sourced from `src/styles/tokens.css`. **No hardcoded hex values, no hardcoded font-family strings** anywhere in component JSX or CSS files.

### Colour Tokens

| Group | Key Tokens | Notes |
|---|---|---|
| Brand greens | `--forest`, `--moss`, `--leaf`, `--mint`, `--frost` | Main brand palette |
| Amber accent | `--amber`, `--amber-lt`, `--amber-md`, `--amber-dk` | Buttons, pending states, coins |
| Learn card | `--sky`, `--sky-lt`, `--sky-md` | Used exclusively in Learn tab cards |
| Status | `--coral` (error), `--purple` | Supporting colours |
| Neutral | `--ink`, `--ink-60`, `--ink-30`, `--ink-10` | Text opacity scale |
| Surface | `--surface`, `--bg`, `--border` | Card and page backgrounds |
| Shadows | `--shadow-sm`, `--shadow-md`, `--shadow-lg` | Elevation |

### Typography Tokens

| Token | Font | Used in |
|---|---|---|
| `--font-display` | DM Serif Display | Section headings, hero numbers |
| `--font-kid` | Nunito | All child app UI, task badges, XP button |
| `--font-parent` | Plus Jakarta Sans | Parent app body text |
| `--font-mono` | JetBrains Mono | Token URLs, code display |

### Spacing Scale
`--sp1` (4px) · `--sp2` (8px) · `--sp3` (12px) · `--sp4` (16px) · `--sp6` (24px) · `--sp8` (32px) · `--sp12` (48px)

### Border Radius Scale

| Token | Value | Usage |
|---|---|---|
| `--r-sm` | 8px | Small UI chips |
| `--r-md` | 12px | Inner elements, speech bubbles |
| `--r-lg` | 16px | Standard cards |
| `--r-xl` | 24px | Kid-friendly cards — bouncy, rounded |
| `--r-pill` | 100px | Badges, buttons, nav pills |

### Button Physics (Child App)
- **Active (resting):** `box-shadow: 0 3px 0 <shadow-colour>` — physical depth
- **`:active` (press):** `translateY(2px)` + shadow collapses to `0 1px 0` — mimics physical button
- **`disabled` / done:** `box-shadow: none` + `translateY(2px)` — permanently pressed flat; no opacity reduction so the colour stays vivid

### Reduced Motion
All animations (plant float, coin rain, XP burst, badge glow) have `@media (prefers-reduced-motion: reduce)` fallbacks disabling animation while preserving layout.

---

## 11. Activity Tracking

All writes go through `POST /api/activity` only. The frontend never writes to Supabase directly for this table.

**Event taxonomy:**

| Event | Actor | When fired |
|---|---|---|
| `parent_app_open` | parent | Authenticated load of `/parent/dashboard` |
| `parent_section_visit` | parent | Every route change within `/parent/*` |
| `parent_prompt_viewed` | parent | Weekly prompt card enters viewport (0 ms dwell) |
| `child_app_open` | child | Successful load of `/child/:token` |
| `child_tab_visit` | child | Each bottom nav tab tap |
| `child_learn_card_viewed` | child | Card visible for ≥ 3 seconds |

**Client pattern (fire-and-forget, never awaited):**
```js
fetch('/api/activity', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...authHeaders },
  body: JSON.stringify({ event_type, section, metadata })
}).catch(() => {}) // silent failure is intentional
```

**Metadata rules:** IDs, slugs, week numbers only. No names, emails, PAN numbers, fund names, or portfolio values.

**Weekly founder query:** Runs in Supabase SQL editor every Sunday — aggregates `parent_open_days`, `child_open_days`, and derives `same_day_open_occurred` per family per week.

---

## 12. Security Audit — Session Fixes

Full RLS and route authentication audit completed. All findings resolved.

### ✅ Client-controlled week advancement patched (`/api/child/week-complete`)
**Problem (MEDIUM):** `current_week` was read from `req.body` and used to advance `learning_state.current_week`. A child could send `current_week: 999` to skip to week 1000.

**Fix (`backend/src/index.js`):** `current_week` is now ignored from the request body entirely. It is read from `learning_state.current_week` in the DB after child authentication, before any write occurs.

### ✅ TOCTOU gap closed in task PATCH and DELETE (`/api/tasks/:id`)
**Problem (LOW):** `ownedRule()` verified ownership, but the terminal `.update()` and `.delete()` queries filtered only by `id`. The service role bypasses RLS, so the final query had no parent scoping.

**Fix (`backend/src/routes/tasks.js`):** Added `.eq('parent_id', req.parentId)` to both the terminal UPDATE and DELETE queries.

### ✅ `conversation_log` RLS tightened — child_id ownership enforced
**Problem (LOW):** The `FOR ALL` policy checked `parent_id = auth.uid()` but not whether the `child_id` being written belongs to that parent. A parent could insert a row referencing another parent's child.

**Fix (`supabase/migrations/006_conversation_log_child_rls.sql`):** Drops and recreates the policy with `WITH CHECK` requiring `child_id IS NULL OR child_id IN (SELECT id FROM children WHERE parent_id = auth.uid())`.

### ✅ `cas_funds` UPDATE policy — explicit WITH CHECK added
**Problem (LOW):** The UPDATE policy had a `USING` clause but no `WITH CHECK`. PostgreSQL fills this implicitly, but the intent was not explicit.

**Fix (`supabase/migrations/007_cas_funds_update_with_check.sql`):** Recreates the policy with `WITH CHECK (auth.uid() = user_id)` stated explicitly.

### ✅ `conversation_log` upsert now has backing unique constraint
**Problem (MEDIUM functional):** `POST /api/child/week-complete` uses `.upsert({ onConflict: 'parent_id,week_number' })` but no UNIQUE constraint existed — the upsert silently inserted duplicates instead of updating.

**Fix (`supabase/migrations/008_conversation_log_unique_constraint.sql`):** Adds `CONSTRAINT uq_conversation_parent_week UNIQUE (parent_id, week_number)`.

### ✅ `POST /api/activity` — try/catch added around parent JWT validation
**Problem (LOW reliability):** `sb.auth.getUser(token)` was called without a try/catch. A malformed Supabase response would throw an uncaught exception in the async handler, causing the request to hang rather than returning 401.

**Fix (`backend/src/routes/activity.js`):** Wrapped the `auth.getUser` call in a try/catch matching the existing pattern used for the child token path. Returns `401` on any error.

### ✅ `resolveChildToken` — fail-closed warning comment added
Added a prominent block comment above `resolveChildToken()` in `tasks.js` warning that it is the sole auth gate for child routes, must remain fail-closed, and that child routes have no middleware-level auth protection.

### ✅ `.env.example` files sanitised
Real production credentials (Supabase service role key, project URL, CHILD_TOKEN_SECRET) that were accidentally committed in example files have been replaced with `your_value_here` placeholders.

> ⚠️ **Action required:** The previously committed service role key and CHILD_TOKEN_SECRET must be rotated in the Supabase dashboard and Render environment variables. The committed values are now invalid placeholders but the old secrets remain valid until rotated.

---

## 13. Code Health & Edge Cases

### ✅ 409 Conflict — Pending Task Button (patched)
**Problem:** When `POST /api/tasks/:id/complete` returns `409` (a completion already exists in DB), `submitMsg[ruleId]` was set to `'pending'`. The `isPending` derivation only checked for `=== 'sent'`, leaving the "Done!" button re-clickable.

**Fix (`Garden.jsx`):**
```js
// Before — buggy
const isPending = task.has_pending || submitMsg[task.id] === 'sent'

// After — patched
const isPending = task.has_pending
               || submitMsg[task.id] === 'sent'
               || submitMsg[task.id] === 'pending'
```
Button now correctly enters disabled `⏳ Pending Parent` state on both 200 and 409 responses.

### ✅ Dead Import Removed (`Learn.jsx`)
`useRef` was imported but never called (ref is returned by `useActivityOnView` hook). Removed. Zero lint warnings.

### ✅ Inline Styles Eliminated
Task error message previously used `style={{ color: 'var(--coral)' }}` inline. Replaced with `.child-task-card__error` class. All styling now flows through `tokens.css` variables.

### ✅ Mascot Fully Replaced
`WiseGilliSVG` (36-line inline SVG owl) removed. `PennyIcon` (3-line emoji span) replaces all usages. CSS class `__gilli` renamed to `__penny`. Zero Gilli/owl references remain anywhere in the source tree.

### ✅ Token Security Enforced
- `SUPABASE_SERVICE_ROLE_KEY` and `CASPARSER_API_KEY` — backend env only, never bundled by Vite
- `CHILD_TOKEN_SECRET` — backend env only
- Frontend receives only short-lived `at_...` CASParser tokens (60-min expiry) generated on-demand from backend

### ✅ Child Token Revocation
Backend validates `X-Child-Token` against both JWT signature and `children.child_token` DB column. Regenerating a token in Settings immediately voids the old one — no grace period.

### ✅ tokens.css Strictly Enforced
All new components added during the Phase 0 sprint (cooldown badge, next milestone badge, Penny bubble wrapper, XP button done state) use only CSS variable references. Confirmed: no hardcoded hex, rgba, or font-family literals in any new rule.

### ✅ Mark-as-Done Persistence Fixed — Child Learn Tab
**Problem:** The backend's `POST /api/child/week-complete` returned `429` (week not ready) *before* writing `week_completed_at` to `learning_state`. On refresh, `weekCompletedAt` was null → button reset to active.

**Fix (`backend/src/index.js`):** Steps 1 & 2 (write `week_completed_at` + upsert `conversation_log`) now run unconditionally before the 7-day gate. The gate only controls week advancement (Step 4). The response for within-7-days is now HTTP 200 `{ ok: true, next_week: null, available_at }` instead of 429.

### ✅ Mark-as-Done Persistence Fixed — Parent Weekly Learning Card
**Problem:** `promptDone` in `Dashboard.jsx` was pure `useState(false)` — never read from or written to the DB. Every refresh reset it to unchecked.

**Fix (`frontend/src/pages/parent/Dashboard.jsx`):**
- `promptDone` is now initialised by querying `conversation_log` for `parent_id + week_number` with `marked_done_at IS NOT NULL`, chained after the existing `learning_state` fetch.
- `handlePromptDone` is now `async` — checks for an existing row, then UPDATEs `marked_done_at` or INSERTs a new row.

### ✅ Daily NAV Update Job Added
New files: `backend/src/jobs/updateNavs.js` and `backend/src/routes/cron.js`.
- Fetches AMFI NAVAll.txt (pipe-delimited), builds an `{ isin → nav }` map, and updates `nav` + `current_value` in `cas_funds` via a single batched upsert.
- Endpoint `POST /api/cron/update-navs` protected by `CRON_SECRET` bearer token.
- Scheduled via Render cron job in `render.yaml` at `0 17 * * *` (22:30 IST).
- Skips ISINs absent from the feed (stale/delisted funds are left untouched).

### ⚠️ Known Limitations (Phase 0, by design)
- One child per family — multiple children out of scope
- `last_trigger_type` stores only the most recent trigger; history is not surfaced in the UI
- XP total (`xp_total`) is updated optimistically in local React state on "Mark as done" — the actual DB column is incremented only via task approval, not week completion (acceptable for Phase 0 pilot)

---

## 14. Dev Environment

Config stored at `.claude/launch.json`.

| Server | Command | URL |
|---|---|---|
| Frontend (Vite) | `npm run dev` in `/frontend` | http://localhost:5173 |
| Backend (Express / nodemon) | `npm run dev` in `/backend` | http://localhost:3001 |

Vite proxies `/api/*` → `http://localhost:3001` (configured in `vite.config.js`). Both servers must be running simultaneously in development.

**Environment variables:**
```bash
# backend/.env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=    # server only — never in frontend
CASPARSER_API_KEY=             # server only — use sandbox key in dev
CHILD_TOKEN_SECRET=            # JWT signing secret for child tokens
CRON_SECRET=                   # bearer token protecting POST /api/cron/update-navs
PORT=3001

# frontend/.env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=        # anon key only — never service role
VITE_API_BASE_URL=http://localhost:3001
```

**Render cron job:** `render.yaml` defines a `taru-nav-update` cron service that runs `updateAllNavs()` daily at 17:00 UTC. Add `CRON_SECRET` (and all other backend env vars) to both the web service and cron service in the Render dashboard, or use a shared Environment Group.

**CASParser sandbox key:** `sandbox-with-json-responses` — always use in dev to avoid consuming production API credits.

---

## 15. Out of Scope — Phase 0

Do not build any of the following. If a session starts drifting toward one, stop immediately.

- Hero tools: Compounding Visualiser, Goal Reverse Planner, SIP Step-Up Calculator, RCA Visualiser, Opportunity Cost Engine, Savings Rate Simulator
- Real MF folio creation (AMC API / NACH mandate)
- In-app payments / Razorpay
- Automated push notifications
- Shareable milestone cards (image generation)
- Multiple children per family
- Gmail inbox integration / CDSL OTP fetch / CAS Generator (requires CASParser Pro plan)
- Full Independence curriculum (28 lessons)
- Daily lesson cadence (current model: weekly)
- Analytics SDK (Mixpanel / Amplitude)
- Android or iOS native app

---

*Version: Phase 0 Sprint Close. Next update trigger: any new route, schema change, or UX pattern introduced.*
