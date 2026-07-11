// Deterministic demo dataset — used when Supabase env vars are absent, so the
// app runs and every view is reviewable before any integration is connected.
// ~14 months of data shaped like the real thing: a cut that preserves muscle,
// recovery improving after therapy becomes regular, and a physio gap in the
// last 6 weeks (which the quarterly review should flag as "stopped").

function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DAY = 86400000

function iso(ms) {
  return new Date(ms).toISOString().slice(0, 10)
}

export function generateDemoData(today = new Date()) {
  const rand = mulberry32(20260711)
  const end = new Date(today.toISOString().slice(0, 10)).getTime()
  const days = 425
  const start = end - days * DAY

  const cycles = []
  const workouts = []
  const calendarEvents = []
  const inbodyScans = []
  const essays = []
  const monthlyPulse = []

  // therapy becomes weekly from day ~90; physio biweekly, but stops 45 days ago
  const therapyStart = start + 90 * DAY
  const physioStop = end - 45 * DAY

  for (let t = start, d = 0; t <= end; t += DAY, d++) {
    const progress = d / days
    // recovery baseline drifts up over the year, dips with heavy strain weeks
    const therapyLift = t > therapyStart ? 8 * Math.min(1, (t - therapyStart) / (120 * DAY)) : 0
    const seasonal = 4 * Math.sin(d / 29)
    const recovery = Math.max(
      18,
      Math.min(96, Math.round(52 + therapyLift + seasonal + (rand() - 0.5) * 26))
    )
    const sleep = Math.round((6.4 + progress * 0.7 + (rand() - 0.5) * 1.6) * 10) / 10
    const hrv = Math.round(48 + therapyLift * 1.5 + (rand() - 0.5) * 18)

    const dow = new Date(t).getUTCDay()
    let strain = 5 + rand() * 4
    // ~3 lifts (Mon/Wed/Fri) + ~1.7 runs (Tue/Sat) per week, with misses
    if ((dow === 1 || dow === 3 || dow === 5) && rand() > 0.18) {
      const dur = Math.round(48 + rand() * 25)
      const s = Math.round((9 + rand() * 5) * 10) / 10
      workouts.push({ date: iso(t), sport: 'lift', strain: s, duration_min: dur })
      strain += s
    }
    if ((dow === 2 || dow === 6) && rand() > 0.32) {
      const dur = Math.round(30 + rand() * 30)
      const s = Math.round((10 + rand() * 6) * 10) / 10
      workouts.push({ date: iso(t), sport: 'run', strain: s, duration_min: dur })
      strain += s
    }
    cycles.push({
      date: iso(t),
      strain: Math.round(Math.min(20.9, strain) * 10) / 10,
      recovery,
      hrv,
      sleep_hours: sleep,
    })

    // care events land on calendar days
    if (t > therapyStart && dow === 4 && rand() > 0.22) {
      calendarEvents.push({ date: iso(t), type: 'therapy', source_id: `demo-th-${d}` })
    }
    if (t < physioStop && dow === 2 && d % 14 < 7 && rand() > 0.25) {
      calendarEvents.push({ date: iso(t), type: 'physio', source_id: `demo-ph-${d}` })
    }
  }

  // InBody scans roughly monthly: cut from 21.8% → ~14.6%, SMM held (small mid-cut dip)
  const scanCount = 14
  for (let i = 0; i < scanCount; i++) {
    const t = start + i * 30 * DAY + Math.floor(rand() * 5) * DAY
    if (t > end) break
    const p = i / (scanCount - 1)
    const bf = 21.8 - 7.2 * p + (rand() - 0.5) * 0.6
    const dip = Math.sin(p * Math.PI) * 0.45 // slight mid-cut muscle dip, then recovered
    const smm = 36.1 - dip + p * 0.3 + (rand() - 0.5) * 0.25
    const weight = 88.4 - 7.8 * p + (rand() - 0.5) * 0.8
    inbodyScans.push({
      date: iso(t),
      weight_kg: Math.round(weight * 10) / 10,
      smm_kg: Math.round(smm * 10) / 10,
      bf_pct: Math.round(bf * 10) / 10,
    })
  }

  // essays: sparse early, steadier later
  const titles = [
    'On systems that hold',
    'The cut, honestly',
    'Recovery is a lagging indicator',
    'What physio taught me about debt',
    'Writing as load-bearing habit',
    'Notes on a plateau',
    'The observatory, not the cockpit',
    'Strain budgets',
    'Twelve weeks of quiet data',
    'Maintenance is progress',
    'The therapy cadence',
    'Slow variables',
    'What the scale can’t see',
    'Season two',
  ]
  let ti = 0
  for (let m = 0; m < 14; m++) {
    const monthStart = start + m * 30 * DAY
    const n = rand() > 0.5 ? (m > 5 ? 2 : 1) : m > 8 ? 2 : rand() > 0.4 ? 1 : 0
    for (let k = 0; k < n; k++) {
      const t = monthStart + Math.floor(rand() * 26) * DAY
      if (t > end) break
      const title = ti < titles.length ? titles[ti] : `${titles[ti % titles.length]}, pt. ${Math.floor(ti / titles.length) + 1}`
      essays.push({ date: iso(t), url: `https://example.com/essays/${ti + 1}`, title })
      ti++
    }
  }

  // monthly pulse: filled most months, skipped some (it's optional by design)
  for (let m = 2; m < 14; m++) {
    if (rand() < 0.25) continue
    const t = start + m * 30 * DAY
    if (t > end - 15 * DAY) break
    const month = iso(t).slice(0, 7)
    const r = () => Math.max(1, Math.min(5, Math.round(2.6 + m * 0.12 + rand() * 1.6)))
    monthlyPulse.push({
      month,
      ratings: { writing: r(), gym: r(), running: r(), physio: r(), therapy: r(), nutrition: r() },
      note: rand() > 0.6 ? 'Steady. Nothing dramatic.' : null,
    })
  }

  essays.sort((a, b) => a.date.localeCompare(b.date))
  calendarEvents.sort((a, b) => a.date.localeCompare(b.date))
  return { cycles, workouts, calendarEvents, inbodyScans, essays, monthlyPulse }
}
