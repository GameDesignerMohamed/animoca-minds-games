# Support System Trend Watcher

A passive observatory that answers one question over months: **is the support
system (writing, gym, running, physio, therapy, nutrition) holding up, and is
it moving the outcomes that matter?**

Core principle: if a metric requires daily logging, it doesn't exist in this
product. Every signal comes from a source that updates itself (Whoop, Google
Calendar, RSS) or from an event rare enough that entering it is painless (an
InBody scan, a shipped essay, an optional monthly pulse).

## Run it now (demo mode)

```sh
cd support-dashboard
npm install
npm run dev
```

With no env vars set, the app serves a deterministic 14-month demo dataset so
every view is reviewable before any integration is connected. Manual entries
persist to localStorage. A "demo data" badge shows in the header.

## Views

- **Trends** — the main screen, 12-week / 12-month toggle. Body composition
  (BF% + SMM in two aligned panels with the 12%/10% targets), recovery
  baseline (trailing 28-day Whoop average), training cadence (lift/run rhythm
  bars), writing (essays per month + cumulative), care cadence (therapy and
  physio appointments as dots on a timeline).
- **Correlations** — overlay any two series as aligned, cursor-synced panels.
  No causal claims; patterns surface visually.
- **Quarterly** — auto-generated, read-only summary: what trended up, what
  trended down, what went quiet (e.g. no physio events in 6+ weeks), the
  largest change vs the prior quarter. No action items, no guilt.
- **Add data** — the only manual inputs, all rare by design: InBody scan
  (3 numbers, ~30s), essay link (~10s), monthly pulse (60s, skippable).

Deliberately absent: daily checklists, streaks, adherence percentages,
traffic lights, editable weekly goals, and any notification other than the
quarterly summary.

## Going live

### 1. Supabase

```sh
supabase link --project-ref <PROJECT_REF>
psql "$SUPABASE_DB_URL" -f supabase/schema.sql   # or paste into the SQL editor
supabase functions deploy whoop-sync calendar-sync rss-poll
supabase secrets set CRON_SECRET=$(openssl rand -hex 24)
```

Then set the frontend vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and
uncomment/run the `cron.schedule` block at the bottom of `schema.sql` to wire
the nightly syncs (03:10 / 03:20 / 03:30 UTC).

### 2. Whoop (one-time, ~10 min)

1. Create an app at <https://developer.whoop.com> with redirect URI
   `https://<PROJECT_REF>.supabase.co/functions/v1/whoop-sync` and scopes
   `read:cycles read:recovery read:sleep read:workout offline`.
2. `supabase secrets set WHOOP_CLIENT_ID=… WHOOP_CLIENT_SECRET=… WHOOP_REDIRECT_URI=…`
3. Open `https://<PROJECT_REF>.supabase.co/functions/v1/whoop-sync?authorize=1`
   once and approve. Tokens are stored server-side; the nightly job refreshes
   them forever after.

### 3. Google Calendar

1. Create a GCP service account with the Calendar API enabled, download its
   JSON key.
2. Share your calendar (read-only) with the service account's email address.
3. `supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON='…' GOOGLE_CALENDAR_ID=you@example.com`
4. Optional: `THERAPY_KEYWORDS` / `PHYSIO_KEYWORDS` (comma-separated) if the
   default event-name matching (therapy/therapist/counselling;
   physio/physiotherapy/physical therapy) doesn't fit how the events are named.

### 4. Writing source

If the blog has a feed: `supabase secrets set BLOG_FEED_URL=https://…/rss.xml`.
If not, skip it — the "Essay shipped" form is the fallback and takes ~10s.

### 5. Vercel

Import the repo, set the project root to `support-dashboard/`, framework
Vite, and add the two `VITE_*` env vars. Nothing else — the app is static;
all secrets live in Supabase edge functions.

## Open decisions (from the plan, still open)

1. **Whoop developer app** — needs the one-time registration above.
2. **Calendar keyword rules** — confirm what therapy/physio events are named;
   adjust `THERAPY_KEYWORDS`/`PHYSIO_KEYWORDS` if needed.
3. **Writing source** — RSS URL if one exists, otherwise paste-per-ship.

## Data model

See `supabase/schema.sql` — `whoop_cycles`, `whoop_workouts`,
`calendar_events`, `inbody_scans`, `essays`, `monthly_pulse`, plus
`whoop_tokens` (service-role only) for the OAuth pair.
