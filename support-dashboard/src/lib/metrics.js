// Pure aggregation helpers. Everything takes raw rows and returns chart-ready
// arrays. No causal claims live here — just bucketing and rolling averages.

const DAY = 86400000

const toMs = (d) => new Date(d + 'T00:00:00Z').getTime()
const iso = (ms) => new Date(ms).toISOString().slice(0, 10)

export function mondayOf(dateStr) {
  const ms = toMs(dateStr)
  const dow = (new Date(ms).getUTCDay() + 6) % 7 // Mon=0
  return iso(ms - dow * DAY)
}

export const monthOf = (dateStr) => dateStr.slice(0, 7)

export function shortMonth(month) {
  const [y, m] = month.split('-').map(Number)
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en', { month: 'short', timeZone: 'UTC' })
  return m === 1 ? `${label} ’${String(y).slice(2)}` : label
}

export function shortWeek(weekStart) {
  const d = new Date(toMs(weekStart))
  return d.toLocaleString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function lastNMonths(n, today = new Date()) {
  const months = []
  const y = today.getUTCFullYear()
  const m = today.getUTCMonth()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - i, 1))
    months.push(d.toISOString().slice(0, 7))
  }
  return months
}

function lastNWeeks(n, today = new Date()) {
  const thisMonday = mondayOf(today.toISOString().slice(0, 10))
  const weeks = []
  for (let i = n - 1; i >= 0; i--) weeks.push(iso(toMs(thisMonday) - i * 7 * DAY))
  return weeks
}

export function bucketKeys(range, today = new Date()) {
  return range === '12w' ? lastNWeeks(12, today) : lastNMonths(12, today)
}

export const bucketOf = (range) => (range === '12w' ? mondayOf : monthOf)
export const bucketLabel = (range) => (range === '12w' ? shortWeek : shortMonth)

/** sessions per bucket, split lift vs run */
export function trainingCadence(workouts, range, today) {
  const keys = bucketKeys(range, today)
  const key = bucketOf(range)
  const map = Object.fromEntries(keys.map((k) => [k, { bucket: k, lift: 0, run: 0 }]))
  for (const w of workouts) {
    const b = map[key(w.date)]
    if (b) b[w.sport === 'run' ? 'run' : 'lift']++
  }
  return keys.map((k) => map[k])
}

/** trailing 28-day mean recovery, one point per bucket end */
export function recoveryBaseline(cycles, range, today) {
  const byDate = new Map(cycles.map((c) => [c.date, c.recovery]))
  const keys = bucketKeys(range, today)
  return keys.map((k) => {
    const endMs = range === '12w' ? toMs(k) + 6 * DAY : Date.UTC(+k.slice(0, 4), +k.slice(5, 7), 0)
    let sum = 0
    let n = 0
    for (let t = endMs - 27 * DAY; t <= endMs; t += DAY) {
      const r = byDate.get(iso(t))
      if (r != null) {
        sum += r
        n++
      }
    }
    return { bucket: k, recovery: n ? Math.round((sum / n) * 10) / 10 : null }
  })
}

/** essays per month + cumulative all-time count at each month */
export function essayCadence(essays, today) {
  const months = lastNMonths(12, today)
  const perMonth = Object.fromEntries(months.map((m) => [m, 0]))
  let before = 0
  for (const e of essays) {
    const m = monthOf(e.date)
    if (m in perMonth) perMonth[m]++
    else if (m < months[0]) before++
  }
  let cum = before
  return months.map((m) => {
    cum += perMonth[m]
    return { bucket: m, essays: perMonth[m], cumulative: cum }
  })
}

/** individual care sessions as dots on a time axis */
export function careTimeline(calendarEvents, range, today) {
  const keys = bucketKeys(range, today)
  const startMs = range === '12w' ? toMs(keys[0]) : Date.UTC(+keys[0].slice(0, 4), +keys[0].slice(5, 7) - 1, 1)
  const endMs = today.getTime()
  return calendarEvents
    .filter((e) => toMs(e.date) >= startMs && toMs(e.date) <= endMs)
    .map((e) => ({ x: toMs(e.date), type: e.type, date: e.date }))
}

/** generic per-bucket aggregation of a numeric daily field (mean) */
function bucketMean(rows, field, range, today, digits = 1) {
  const keys = bucketKeys(range, today)
  const key = bucketOf(range)
  const acc = Object.fromEntries(keys.map((k) => [k, { sum: 0, n: 0 }]))
  for (const r of rows) {
    const b = acc[key(r.date)]
    if (b && r[field] != null) {
      b.sum += r[field]
      b.n++
    }
  }
  const f = 10 ** digits
  return keys.map((k) => ({
    bucket: k,
    value: acc[k].n ? Math.round((acc[k].sum / acc[k].n) * f) / f : null,
  }))
}

function bucketCount(rows, range, today, filter = () => true) {
  const keys = bucketKeys(range, today)
  const key = bucketOf(range)
  const map = Object.fromEntries(keys.map((k) => [k, 0]))
  for (const r of rows) {
    const k = key(r.date)
    if (k in map && filter(r)) map[k]++
  }
  return keys.map((k) => ({ bucket: k, value: map[k] }))
}

/** step-interpolate sparse scan values onto buckets (last known value) */
function bucketLastKnown(scans, field, range, today) {
  const keys = bucketKeys(range, today)
  const key = bucketOf(range)
  const sorted = [...scans].sort((a, b) => a.date.localeCompare(b.date))
  return keys.map((k) => {
    let last = null
    for (const s of sorted) {
      if (key(s.date) <= k) last = s[field]
      else break
    }
    return { bucket: k, value: last }
  })
}

/** registry of overlayable series for the Correlations view */
export function correlationSeries(data, range, today) {
  const { cycles, workouts, calendarEvents, inbodyScans, essays } = data
  return {
    recovery: { label: 'Recovery, 28-day avg (%)', points: recoveryBaseline(cycles, range, today).map((p) => ({ bucket: p.bucket, value: p.recovery })) },
    sleep: { label: 'Sleep (hours/night, avg)', points: bucketMean(cycles, 'sleep_hours', range, today) },
    strain: { label: 'Day strain (avg)', points: bucketMean(cycles, 'strain', range, today) },
    hrv: { label: 'HRV (avg)', points: bucketMean(cycles, 'hrv', range, today, 0) },
    sessions: { label: 'Training sessions', points: bucketCount(workouts, range, today) },
    lifts: { label: 'Lift sessions', points: bucketCount(workouts, range, today, (w) => w.sport !== 'run') },
    runs: { label: 'Run sessions', points: bucketCount(workouts, range, today, (w) => w.sport === 'run') },
    therapy: { label: 'Therapy sessions', points: bucketCount(calendarEvents, range, today, (e) => e.type === 'therapy') },
    physio: { label: 'Physio sessions', points: bucketCount(calendarEvents, range, today, (e) => e.type === 'physio') },
    essays: { label: 'Essays shipped', points: bucketCount(essays, range, today) },
    bf: { label: 'Body fat (%)', points: bucketLastKnown(inbodyScans, 'bf_pct', range, today) },
    smm: { label: 'Skeletal muscle (kg)', points: bucketLastKnown(inbodyScans, 'smm_kg', range, today) },
  }
}

// ---------- quarterly review ----------

function meanBetween(rows, field, fromMs, toMsEx) {
  let sum = 0
  let n = 0
  for (const r of rows) {
    const t = toMs(r.date)
    if (t >= fromMs && t < toMsEx && r[field] != null) {
      sum += r[field]
      n++
    }
  }
  return n ? sum / n : null
}

const countBetween = (rows, fromMs, toMsEx, filter = () => true) =>
  rows.filter((r) => toMs(r.date) >= fromMs && toMs(r.date) < toMsEx && filter(r)).length

function lastScanBefore(scans, ms) {
  let last = null
  for (const s of scans) if (toMs(s.date) < ms) last = s
  return last
}

/**
 * Compares the last 13 weeks against the 13 before that. Returns plain facts:
 * what moved, what stopped, the largest relative change. No action items.
 */
export function quarterlyReview(data, today = new Date()) {
  const { cycles, workouts, calendarEvents, inbodyScans, essays } = data
  const end = toMs(today.toISOString().slice(0, 10)) + DAY
  const qStart = end - 91 * DAY
  const pStart = qStart - 91 * DAY

  const metrics = [
    {
      key: 'recovery',
      label: 'Recovery (avg %)',
      now: meanBetween(cycles, 'recovery', qStart, end),
      prev: meanBetween(cycles, 'recovery', pStart, qStart),
      digits: 1,
      unit: '%',
    },
    {
      key: 'sleep',
      label: 'Sleep (hours/night)',
      now: meanBetween(cycles, 'sleep_hours', qStart, end),
      prev: meanBetween(cycles, 'sleep_hours', pStart, qStart),
      digits: 1,
      unit: 'h',
    },
    {
      key: 'sessions',
      label: 'Training sessions',
      now: countBetween(workouts, qStart, end),
      prev: countBetween(workouts, pStart, qStart),
      digits: 0,
      unit: '',
    },
    {
      key: 'essays',
      label: 'Essays shipped',
      now: countBetween(essays, qStart, end),
      prev: countBetween(essays, pStart, qStart),
      digits: 0,
      unit: '',
    },
    {
      key: 'therapy',
      label: 'Therapy sessions',
      now: countBetween(calendarEvents, qStart, end, (e) => e.type === 'therapy'),
      prev: countBetween(calendarEvents, pStart, qStart, (e) => e.type === 'therapy'),
      digits: 0,
      unit: '',
    },
    {
      key: 'physio',
      label: 'Physio sessions',
      now: countBetween(calendarEvents, qStart, end, (e) => e.type === 'physio'),
      prev: countBetween(calendarEvents, pStart, qStart, (e) => e.type === 'physio'),
      digits: 0,
      unit: '',
    },
  ]

  const scanNow = lastScanBefore(inbodyScans, end)
  const scanPrev = lastScanBefore(inbodyScans, qStart)
  if (scanNow && scanPrev) {
    metrics.push(
      { key: 'bf', label: 'Body fat (%)', now: scanNow.bf_pct, prev: scanPrev.bf_pct, digits: 1, unit: '%', downIsGood: true },
      { key: 'smm', label: 'Skeletal muscle (kg)', now: scanNow.smm_kg, prev: scanPrev.smm_kg, digits: 1, unit: 'kg' }
    )
  }

  for (const m of metrics) {
    m.delta = m.now != null && m.prev != null ? m.now - m.prev : null
    m.relative = m.delta != null && m.prev ? m.delta / Math.abs(m.prev) : null
  }

  // stopped signals: no events of a type in the trailing 6 weeks, when the
  // prior period had them
  const sixWeeksAgo = end - 42 * DAY
  const stopped = []
  for (const [type, label] of [
    ['therapy', 'Therapy'],
    ['physio', 'Physio'],
  ]) {
    const recent = countBetween(calendarEvents, sixWeeksAgo, end, (e) => e.type === type)
    const before = countBetween(calendarEvents, pStart, sixWeeksAgo, (e) => e.type === type)
    if (recent === 0 && before > 0) {
      const last = [...calendarEvents].reverse().find((e) => e.type === type)
      stopped.push({ label, lastDate: last?.date ?? null })
    }
  }
  const lastEssay = essays[essays.length - 1]
  if (lastEssay && toMs(lastEssay.date) < sixWeeksAgo) {
    stopped.push({ label: 'Writing', lastDate: lastEssay.date })
  }

  const comparable = metrics.filter((m) => m.relative != null)
  const largest = comparable.length
    ? comparable.reduce((a, b) => (Math.abs(b.relative) > Math.abs(a.relative) ? b : a))
    : null

  return {
    from: iso(qStart),
    to: iso(end - DAY),
    metrics,
    stopped,
    largest,
    up: metrics.filter((m) => m.delta != null && m.delta > 0),
    down: metrics.filter((m) => m.delta != null && m.delta < 0),
  }
}

export function fmt(v, digits = 1) {
  if (v == null) return '—'
  return Number(v).toFixed(digits).replace(/\.0+$/, '')
}
