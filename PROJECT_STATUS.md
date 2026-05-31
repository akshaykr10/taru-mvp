# Taru MVP — Project Status

> Last updated: 28 May 2026. Reflects the live codebase on `main`. All architecture, security, and product decisions are as per `CLAUDE.md` (aligned with PRD v2.1).

---

## Deployment

| Layer | Service | URL / Detail |
|---|---|---|
| Frontend | Netlify (free tier) | https://taru.money |
| Backend | Render (free tier) | https://taru-mvp-dr4o.onrender.com |
| Database | Supabase (free tier) | PostgreSQL + Auth + RLS |
| Domain | taru.money | Purchased separately |
| Analytics | Google Ads tag | AW-18172166013 (gtag.js in `<head>`) |

**Build config:** `netlify.toml` pins Node 20, sets `VITE_BACKEND_URL` at build time, and has a catch-all SPA redirect rule so React Router handles all client-side routes.

---

## Build Order Progress (from CLAUDE.md)

| Step | Description | Status |
|---|---|---|
| 1 | Supabase migrations — all tables, RLS, indexes | ✅ Done (8 migrations) |
| 2 | Auth flow — signup, email verify, login, session | ✅ Done |
| 3 | Parent dashboard shell — routes, nav, layout | ✅ Done |
| 4 | CASParser integration — token endpoint + SDK widget + PDF fallback | ✅ Done |
| 5 | Child token generation — JWT signing, storage, `/child/:token` route | ✅ Done |
| 6 | Activity logging — `POST /api/activity` + all event fires | ✅ Done |
| 7 | Fund tagging — toggle UI, child visibility | ✅ Done |
| 8 | Child Money Garden — plant SVG, portfolio values, goal bar | ✅ Done |
| 9 | Task rules + approval flow | ✅ Done |
| 10 | Content cards — Penny copy, 48-week curriculum, trigger cards | ✅ Done |
| 11 | Gullak — coin counter, milestone badges | ✅ Done (basic) |

**All 11 build steps are complete. The app is in active pilot use.**

---

## Database Schema

### Applied Migrations

| File | Description |
|---|---|
| `001_initial_schema.sql` | All 8 core tables + RLS + indexes |
| `002_auth_trigger.sql` | Auto-creates `parents` row on Supabase Auth signup |
| `003_task_rules_created_at.sql` | Added `created_at` to `task_rules` |
| `004_learning_module.sql` | Added `current_week_started_at`, `week_completed_at`, `dinner_prompted_at` to `learning_state`; added `child_id` to `conversation_log` + index |
| `005_cas_tables.sql` | Production CAS tables: `cas_fetch_log`, `cas_portfolio`, `cas_funds` + RLS |
| `006_conversation_log_child_rls.sql` | Tightened RLS WITH CHECK on `conversation_log` (child_id ownership guard) |
| `007_cas_funds_update_with_check.sql` | Explicit `WITH CHECK` on `cas_funds` UPDATE policy |
| `008_conversation_log_unique_constraint.sql` | Unique constraint on `conversation_log(parent_id, week_number)` — required for week-complete upsert |
| `012_consent_log_create.sql` | Creates `consent_log` table + RLS (migration 009 was written but never applied to production) |

### Tables

**Core (from `001`)**
- `parents` — one row per authenticated user (auto-created by auth trigger)
- `children` — child profile; `age_stage` derived from DOB on write; `child_token` is the signed 90-day JWT
- `portfolio_snapshots` — legacy table (still exists; superseded by `cas_portfolio`)
- `fund_tags` — legacy table (still exists; superseded by `cas_funds`)
- `task_rules` — max 3 per parent; `frequency` in `one-time | weekly | custom`
- `task_completions` — derived status: both nulls = pending, `approved_at` set = approved, `rejected_at` set = rejected
- `learning_state` — one row per child; `current_week` (1–48), `coins_total`, `xp_total`, `last_trigger_type`, `week_completed_at`, `current_week_started_at`
- `conversation_log` — dinner-table prompt history; unique on `(parent_id, week_number)`
- `activity_events` — append-only; written via service role only; parent can SELECT own rows

**Production CAS (from `005`)**
- `cas_fetch_log` — one row per fetch attempt; rate-limit check uses only `status='success'` rows within 14-day window
- `cas_portfolio` — full raw CASParser JSON snapshot per import
- `cas_funds` — one row per `(user_id, isin, folio_number)`; `show_in_child_app` preserved across re-imports; `inception_nav` / `inception_date` set once and never overwritten

**Additional (created outside migrations)**
- `nav_history` — daily NAV snapshot per fund; written by the NAV update job; unique on `(user_id, isin, folio_number, nav_date)`
- `waitlist` — public email waitlist from landing page

### RLS Summary
- All tables have RLS enabled.
- Parent routes: service role key bypasses RLS for backend writes; anon key + session JWT covers client-side reads on `cas_funds`, `cas_fetch_log`.
- `activity_events`: INSERT/UPDATE/DELETE blocked for authenticated role; all writes via service role.
- `learning_state`: read-only for authenticated parents (`child_id IN (SELECT id FROM children WHERE parent_id = auth.uid())`); writes via service role.

---

## Auth Flow

- **Provider:** Supabase Auth (email + password)
- **Email verification:** Skipped for pilot — users land on onboarding immediately after signup
- **Session management:** `AuthContext.jsx` wraps the app; `RequireParentAuth.jsx` guards all `/parent/*` routes; redirects to `/login` if no valid session
- **Child auth:** Token-gated only. `X-Child-Token` header carries a signed JWT. Backend validates signature AND matches against `children.child_token` in DB (revocation works by overwriting the stored token)

---

## Parent App

### Routes
```
/                         Landing page (public, waitlist form)
/signup                   Parent signup
/login                    Parent login
/verify-email             Holding page (currently bypassed for pilot)
/parent/onboarding        4-step wizard (Step 0 intro + Steps 1–3 data)
/parent/dashboard         Main parent view
/parent/portfolio         CAS import + fund tagging
/parent/settings          Child profile, goal, tasks, garden link
```

### Onboarding (`/parent/onboarding`)
- **Step 0** — Value proposition (4 bullets: garden, Penny, coins, prompts) → "Set up your garden →"
- **Step 1** — Child name + DOB. DOB bounds: ages 5–17 enforced by `min`/`max` on date input. `age_stage` auto-derived client-side for preview badge; written to DB on finish.
- **Step 2** — Savings goal: 6 presets + custom (✏️ Other). Target amount with Indian number formatting and word preview (lakh/crore). Target year + optional month (year → Dec 31; year+month → last day of that month). Fully optional — "Skip for now" if nothing entered.
- **Step 3** — Review summary → inserts `children` row + initialises `learning_state` row → navigates to `/parent/dashboard`.

### Dashboard (`/parent/dashboard`)
- Time-based greeting (Good morning / afternoon / evening)
- **Dinner prompt card** — appears when a `conversation_log` row has `marked_done_at` set (i.e. child completed a week). Parent dismisses with "We talked about this ✓" which nulls `marked_done_at`.
- **Portfolio card** — gold card showing tagged total (sum of `cas_funds.current_value` where `show_in_child_app = true`). Shows last-updated date from `cas_fetch_log`. Falls back to a premium empty state (blurred mock + CTA → Portfolio page) if no funds imported.
- **Child overview** — name, age-stage badge, goal name, progress bar, pending task count pill.
- **Weekly Learning** — reads `current_week` from `learning_state` via Supabase client. Shows the week's dinner prompt from `parentWeeklyPrompts.js` (48 weeks). Portfolio nudge shown if `portfolioStatus = REQUIRED` or `OPTIONAL`. "Mark as done" upserts to `conversation_log`.
- **Task approvals** — polls `GET /api/tasks/pending`. Approve → awards coins to child's `learning_state.coins_total`. Reject → sets `rejected_at`. Optimistic UI removes card immediately on action.

### Portfolio (`/parent/portfolio`)
- **Tab 1 — Portfolio Connect (SDK):** `@cas-parser/connect` widget. Backend fetches short-lived `at_...` token from CASParser (`POST /api/cas/token`) and passes it to the SDK. `enableGenerator: true` (CAMS/KFintech email-based fetch), `enableCdslFetch: false`, `enableInbox: false`. On `onSuccess`, frontend POSTs full data to `POST /api/cas/save`. On `onError`, auto-switches to PDF tab with a dismissible fallback notice.
- **Tab 2 — PDF Upload:** Drag-and-drop or file picker. 5MB client-side size check. Optional password field for encrypted CAS PDFs. POSTs multipart to `POST /api/cas/upload` which forwards to CASParser `/v4/smart/parse`.
- **Rate limit:** 14-day rolling window enforced server-side. Banner shows `last_fetched_at` and `next_available_at` dates. Both SDK token request and PDF upload check the limit; returns HTTP 429 with details if hit.
- **Fund tag list (`FundTagList.jsx`):** All imported funds listed. Toggle `show_in_child_app` via `PATCH /api/cas/funds/:id`. Equity funds default visible on first import; all others default hidden. Toggle state preserved across re-imports.

### Settings (`/parent/settings`)
- **Child profile** — read-only display (name, DOB, learning stage). Bottom-sheet "Add child" modal for families that skipped onboarding.
- **Savings goal** — `GoalEditCard`: inline editing with same presets/custom/amount/year-month UX as onboarding. Saves via `PATCH /api/children/:childId`. Requires goal name + amount + year to save.
- **Assigned tasks** — `TaskRuleRow` per rule: name, coins, frequency, paused badge. Actions: pause/resume (weekly/custom only), delete (two-step confirm). `TaskRuleForm` has quick-assign chip rail (6 presets: Tidy Room, Homework, Dog Walking, Clear Table, Make Bed, Water Plants) + custom name/coins/frequency. Max 3 rules enforced by backend (HTTP 422).
- **Garden link** — Generate (first time) or copy/regenerate. Regeneration shows destructive-action confirmation ("This will invalidate the old link immediately."). Link format: `https://taru.money/child/{JWT}`. 90-day expiry.

---

## Child App (`/child/:token`)

**Token validation:** Backend verifies JWT signature AND matches `children.child_token` in DB. Expired or revoked tokens render a friendly Penny error page — never a 500 or raw JSON.

**Data loaded on mount:** `GET /api/child/garden` → `{ child, tagged_total, fund_count, learning_state }`. Only `cas_funds` rows with `show_in_child_app = true` are included; enforced at the query level, not just route protection.

### Garden Tab
- Plant emoji by goal progress: 🌰 (0–24%) → 🪴 (25–49%) → 🌱 (50–74%) → 🌿 (75–99%) → 🌳 (100%)
- Goal card: goal name, progress bar, percentage label, goal amount, next milestone badge (🔒 locked until reached)
- Penny speech bubble: age-stage-appropriate greeting (Penny voice rules from CLAUDE.md enforced in copy)
- **Never shows daily NAV change or daily gain/loss** — only total gain since inception (`tagged_total - tagged_cost`)

### Learn Tab
- Content from `weeklyContent.js` (48 weeks, auto-generated from `taru_curriculum_v4.xlsx`)
- **Bridge block** (`Bridge.jsx`) — prior-week callback text; suppressed for W1, W25, and all consolidation weeks (those where `bridge_59 === '—'`)
- **CurrentWeekCard:**
  - Week badge + 🐿️ icon, Penny Moment (italic tinted blue box with mode label), age-appropriate app text, portfolio status placeholder (hidden if `NOT APPLICABLE`), dinner prompt teaser
  - "Mark as done ✓" button → fires `POST /api/child/week-complete` → awards +50 XP burst animation
  - On success response with `next_week`, calls `onWeekAdvanced(nextWeek)` which updates `gardenData.learning_state.current_week` in React state — no page reload needed
  - Button is disabled (`aria-pressed`) once clicked; idempotent server-side
- **Trigger cards** — shown for `learning_state.last_trigger_type` in `{ sip, nav_change, milestone, task_approved }`; content from `content.json` keyed by trigger type and age stage

**Week advancement rule:** Weeks advance immediately upon marking done. The 7-day gate was removed (commit `9a92908`) — it created a permanent deadlock where `week_completed_at` was set by Step 1 before the gate check, causing all subsequent calls to return `already_done: true` before the advancement logic could run.

### Tasks Tab
- Lists active `task_rules` for this child via `GET /api/tasks/child`
- "Done!" button → `POST /api/tasks/:id/complete` → creates `task_completions` row
- **Locking logic (derived at read time, not stored):**
  - `one-time`: locked forever once approved
  - `weekly`: locked until next Monday 00:00 UTC (calendar-week boundary via `currentWeekStart()`)
  - `custom`: never auto-locked (parent controls manually)
- 409 response shows "⏳ Pending Parent"; approved tasks award coins to `learning_state.coins_total`

### Gullak Tab
- Displays `learning_state.coins_total`
- Shows tagged portfolio total and goal amount

---

## Backend API Reference

All `/parent/*` endpoints require `Authorization: Bearer <supabase-jwt>`. Child endpoints validate `X-Child-Token` internally.

### CAS / Portfolio
| Method | Route | Description |
|---|---|---|
| GET | `/api/cas/status` | Rate-limit state + fund count |
| POST | `/api/cas/token` | Short-lived SDK access token (14-day rate limit gated) |
| POST | `/api/cas/save` | Store SDK `onSuccess` payload → triggers full pipeline |
| POST | `/api/cas/upload` | PDF → CASParser API → same pipeline |
| GET | `/api/cas/funds` | List all `cas_funds` for parent |
| PATCH | `/api/cas/funds/:id` | Toggle `show_in_child_app` |

**CAS save pipeline (shared by `/save` and `/upload`):**
1. Insert raw JSON into `cas_portfolio`
2. Flatten schemes from production (`folios[].schemes[]`) and sandbox (`mutual_funds[]`) shapes
3. Load existing `show_in_child_app` values keyed by `isin::folio_number` to preserve toggles
4. Deduplicate within batch (same ISIN → last occurrence wins)
5. Upsert into `cas_funds` on conflict `(user_id, isin, folio_number)`; Equity visible by default, others hidden
6. Log `status='success'` in `cas_fetch_log`
7. Run trigger checks: goal milestone (25/50/75/100%), NAV change (>1% vs prior snapshot for any fund), SIP purchase (new `PURCHASE_SIP` transaction since last fetch)

### Children
| Method | Route | Description |
|---|---|---|
| PATCH | `/api/children/:childId` | Update goal fields (name, amount, date). Validates ownership at query level. |
| POST | `/api/children/:childId/token` | Generate child JWT (first time) |
| POST | `/api/children/:childId/token/regenerate` | Invalidate old token, issue new |

### Tasks
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/tasks` | Parent JWT | List task rules |
| POST | `/api/tasks` | Parent JWT | Create rule (max 3 enforced; HTTP 422 if exceeded) |
| PATCH | `/api/tasks/:id` | Parent JWT | Update name / coins / frequency / status |
| DELETE | `/api/tasks/:id` | Parent JWT | Delete rule |
| GET | `/api/tasks/pending` | Parent JWT | Pending completions for approval |
| POST | `/api/tasks/completions/:cid/approve` | Parent JWT | Approve → award coins to `learning_state` |
| POST | `/api/tasks/completions/:cid/reject` | Parent JWT | Reject completion |
| GET | `/api/tasks/child` | Child token | Active rules with `has_pending` + `locked` flags |
| POST | `/api/tasks/:id/complete` | Child token | Submit completion (409 if already pending or frequency-locked) |

### Child Garden
| Method | Route | Description |
|---|---|---|
| GET | `/api/child/garden` | Token-gated. Returns child, tagged total, fund count, learning state. Only visible funds returned. |
| POST | `/api/child/week-complete` | Mark week done → advance `current_week`. Idempotent (`already_done: true`) if `week_completed_at` already set. |

### Activity
| Method | Route | Description |
|---|---|---|
| POST | `/api/activity` | Log event. Resolves actor from parent JWT or child token. Server sets `occurred_at`. PII keys stripped from metadata. Fire-and-forget from frontend. |

### Infrastructure
| Method | Route | Description |
|---|---|---|
| GET | `/health` | Health check (`{ status: 'ok', timestamp }`) |
| POST | `/api/cron/update-navs` | Daily NAV update. Protected by `CRON_SECRET` bearer token. |
| POST | `/api/waitlist` | Public waitlist signup |

---

## NAV Update System

- **Source:** AMFI `NAVAll.txt` — pipe-delimited, published once per business day post-market-close (~7–8pm IST)
- **Schedule:** GitHub Actions workflow → `POST /api/cron/update-navs` daily at 20:00 UTC (01:30 IST). Also configured as a Render cron job as fallback.
- **Logic:**
  1. Fetch AMFI feed with 10-second timeout and browser User-Agent (required for AMFI compatibility)
  2. Parse `ISIN → NAV` map (handles Growth and Dividend Reinvestment ISINs; skips `N.A.` entries)
  3. Load all `cas_funds` rows (full rows needed — `fund_name NOT NULL` prevents partial upserts)
  4. Match by ISIN → compute `current_value = units × new_nav`
  5. Record daily snapshot in `nav_history` (skips on duplicate — unique on `(user_id, isin, folio_number, nav_date)`)
  6. Upsert `cas_funds` in a single batched call
  7. **Inception tracking:** `inception_nav` and `inception_date` set once on first update, never overwritten. Used to show total-gain-since-inception in child app.

---

## Curriculum & Content

### `weeklyContent.js`
- 48 weeks, auto-generated from `taru_curriculum_v4.xlsx` (do not edit manually)
- Per week: `week_number`, `cycle`, `arc`, `topic`, `is_consolidation`, `bridge_59/1014/15`, `penny_moment`, `penny_mode`, `app_text_59/1014/15`, `dinner_prompt`, `portfolio_status`, `portfolio_reference`
- Helper exports: `getWeekContent(n)`, `getAppText(weekContent, ageStage)`, `getBridge(weekContent, ageStage)`, `shouldShowBridge(weekContent)`

### `parentWeeklyPrompts.js`
- 48 parent-facing dinner prompts aligned to the same 48-week curriculum
- Per week: `week`, `topic`, `theme`, `dinnerPrompt`, `portfolioStatus` (`NOT APPLICABLE | OPTIONAL | REQUIRED`)
- Helper: `getParentWeekPrompt(weekNumber)`

### Age Stage → Content Mapping
| Stage | Ages | App text field | Bridge field | Voice rule |
|---|---|---|---|---|
| seed | 5–8 | `app_text_59` | `bridge_59` | One sentence max. No quizzes. No scores. |
| sprout | 9–11 | `app_text_1014` | `bridge_1014` | Lead with a question. Tie to real portfolio number. |
| growth | 12–14 | `app_text_1014` | `bridge_1014` | Discovery framing. Never "you should". |
| investor | 15–17 | `app_text_15` | `bridge_15` | Peer-level. Data-first. Never simplify. |

---

## Activity Tracking

### Implemented Events
| event_type | actor | Fired from | section value |
|---|---|---|---|
| `parent_app_open` | parent | `Dashboard.jsx` on mount | null |
| `parent_section_visit` | parent | Route change within `/parent/*` | e.g. `/parent/portfolio` |
| `parent_prompt_viewed` | parent | IntersectionObserver on prompt card (fires immediately on viewport entry) | null |
| `child_app_open` | child | `Garden.jsx` on successful load | null |
| `child_tab_visit` | child | Each bottom-nav tab tap | `child/garden` \| `child/learn` \| `child/tasks` \| `child/gullak` |
| `child_learn_card_viewed` | child | `useActivityOnView` hook, 3-second dwell | null |

### Metadata Rules
- Only IDs, slugs, week numbers
- PII keys stripped server-side before insert: `name`, `email`, `pan`, `mobile`, `phone`, `fund_name`
- `occurred_at` always server-set via `DEFAULT now()` — client timestamp is ignored

### Founder Weekly Query
Runs every Sunday in Supabase SQL editor. Returns `parent_open_days`, `child_open_days`, and `same_day_open_occurred` per parent per week for the last 8 weeks. Full query in `CLAUDE.md`.

---

## Security Model

- **Parent API:** Supabase JWT required on all `/api/children/*`, `/api/cas/*`, `/api/tasks` (parent routes). Validated server-side via `supabase.auth.getUser(token)`.
- **Child API:** `X-Child-Token` header. Backend verifies JWT signature AND matches `children.child_token` in DB. No parent financial data is reachable from a child token — enforced at the query level, not just route protection.
- **CASParser API key:** Backend env var only (`CASPARSER_API_KEY`). Never in frontend code or Vite bundle. Frontend only receives a short-lived `at_...` access token.
- **CHILD_TOKEN_SECRET:** Backend only. JWT signed HS256. Revocation: overwrite `children.child_token` — old JWT becomes worthless even if not expired.
- **SUPABASE_SERVICE_ROLE_KEY:** Backend only. Never exposed to frontend.
- **CORS:** Allowlist: `taru.money`, `www.taru.money`, `localhost:5173`, `FRONTEND_URL` env var. Requests with no origin (curl, Render cron, health checks) are allowed.
- **Ownership:** Every mutation verifies row ownership at the query level (e.g. `parent_id = req.parentId`), not just route-level middleware.

---

## Landing Page

- Route: `/` (public, no auth required)
- Scroll-reveal animations via IntersectionObserver
- Navbar scroll shadow on scroll > 24px
- Waitlist email form → `POST /api/waitlist`
- Links to `/signup`
- Footer: logo + copyright left, "made with ♥" right (Privacy/Press links removed)

---

## Known Bugs Fixed

| Date | Commit | Issue | Fix |
|---|---|---|---|
| 2026-05-28 | `9a92908` | Curriculum stuck at Week 3 permanently on child and parent app | Removed 7-day gate (it deadlocked with the idempotent guard). Weeks now advance immediately on mark-done. `onWeekAdvanced` callback updates frontend state in-place without page reload. |
| Earlier | `c84e8bd` | Mark-as-done button state not persisting across page reload | `week_completed_at` persisted to DB in Step 1 before any gate check. Frontend reads it on load to initialise button state. |
| Earlier | `dc51170` | Child app showed wrong backend URL / API calls failed | `VITE_BACKEND_URL` added to `netlify.toml` build environment so Vite bakes the correct URL at deploy time. |
| Earlier | `23c3293` | Duplicate fund rows causing upsert failures | Deduplication within each CAS batch (`rowMap` by `isin::folio_number`) before upsert. |
| Earlier | `925bce4` | Child garden showing 0 for tagged total | Switched from reading old `fund_tags` table to `cas_funds` with `show_in_child_app` flag. |
| Earlier | `dc7684c` | RLS gaps allowing cross-parent data access | Security hardening: tightened `conversation_log` RLS (child_id ownership guard), plugged route auth gaps, added explicit `WITH CHECK` on `cas_funds`. |
| Earlier | `f27d7ae` | Settings page frozen on "Loading…" when task fetch threw | `finally` block ensures `setRulesLoading(false)` runs even on network errors. |

---

## Out of Scope (Phase 0 — Do Not Build)

Per `CLAUDE.md`, the following are explicitly excluded:

- Hero tools: Compounding Visualiser, Goal Reverse Planner, SIP Step-Up Calculator, RCA Visualiser, Opportunity Cost Engine, Savings Rate Simulator
- Real MF folio creation (AMC API / NACH / Razorpay)
- Automated push notifications
- Shareable milestone cards (image generation)
- Multiple children per family (architecture supports 1 child in the main flow; Settings has an "add child" modal as a workaround but product UX assumes 1)
- Gmail inbox / CDSL OTP fetch / CAS Generator (requires CASParser Pro plan)
- Full Independence curriculum beyond Phase 0 scope
- Daily lesson cadence
- Analytics SDK (Mixpanel / Amplitude) — founder tracks manually via SQL
- Android / iOS native app

---

## Environment Variables

### Backend (Render)
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY   # server only — never expose to frontend
CASPARSER_API_KEY           # server only — never expose to frontend
CHILD_TOKEN_SECRET          # JWT signing secret for child tokens
CRON_SECRET                 # protects POST /api/cron/update-navs
FRONTEND_URL                # used in CORS allowlist
PORT                        # defaults to 3001
```

### Frontend (Netlify — baked at build time)
```
VITE_SUPABASE_URL           # Supabase project URL (safe to expose)
VITE_SUPABASE_ANON_KEY      # Supabase anon key only — never service role
VITE_BACKEND_URL            # set in netlify.toml → https://taru-mvp-dr4o.onrender.com
```
