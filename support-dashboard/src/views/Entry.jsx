import { useState } from 'react'
import { addInbodyScan, addEssay, addMonthlyPulse, isDemo } from '../lib/data.js'

/**
 * The only manual inputs in the product, all rare by design:
 * an InBody scan (~30s), a shipped essay (~10s), the optional monthly pulse (60s).
 */
export default function Entry({ onSaved }) {
  return (
    <div className="space-y-4">
      {isDemo && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Demo mode — entries are kept in this browser only. Connect Supabase to persist them.
        </p>
      )}
      <ScanForm onSaved={onSaved} />
      <EssayForm onSaved={onSaved} />
      <PulseForm onSaved={onSaved} />
    </div>
  )
}

const inputStyle = {
  background: 'var(--page)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
}

function Card({ title, subtitle, children }) {
  return (
    <section className="rounded-xl p-5" style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
        {subtitle}
      </p>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Field({ label, ...props }) {
  return (
    <label className="block text-xs" style={{ color: 'var(--text-secondary)' }}>
      {label}
      <input className="mt-1 w-full rounded-md px-2.5 py-2 text-sm" style={inputStyle} {...props} />
    </label>
  )
}

function SaveButton({ saving, saved, children = 'Save' }) {
  return (
    <button
      type="submit"
      disabled={saving}
      className="rounded-md px-3 py-2 text-xs font-medium"
      style={{ background: 'var(--text-primary)', color: 'var(--page)', opacity: saving ? 0.6 : 1 }}
    >
      {saved ? 'Saved ✓' : saving ? 'Saving…' : children}
    </button>
  )
}

function useSave(fn, onSaved) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const run = async (payload, reset) => {
    setSaving(true)
    setError(null)
    try {
      await fn(payload)
      setSaved(true)
      reset?.()
      onSaved?.()
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e.message ?? String(e))
    } finally {
      setSaving(false)
    }
  }
  return { run, saving, saved, error }
}

function ErrorNote({ error }) {
  if (!error) return null
  return (
    <p className="mt-2 text-xs" style={{ color: 'var(--delta-bad)' }}>
      {error}
    </p>
  )
}

const todayStr = () => new Date().toISOString().slice(0, 10)

function ScanForm({ onSaved }) {
  const [form, setForm] = useState({ date: todayStr(), weight_kg: '', smm_kg: '', bf_pct: '' })
  const { run, saving, saved, error } = useSave(addInbodyScan, onSaved)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <Card title="InBody scan" subtitle="Three numbers per scan — the nutrition verdict, not the process.">
      <form
        className="grid grid-cols-2 gap-3 sm:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault()
          run(
            {
              date: form.date,
              weight_kg: parseFloat(form.weight_kg),
              smm_kg: parseFloat(form.smm_kg),
              bf_pct: parseFloat(form.bf_pct),
            },
            () => setForm({ date: todayStr(), weight_kg: '', smm_kg: '', bf_pct: '' })
          )
        }}
      >
        <Field label="Date" type="date" required value={form.date} onChange={set('date')} />
        <Field label="Weight (kg)" type="number" step="0.1" min="30" max="250" required value={form.weight_kg} onChange={set('weight_kg')} />
        <Field label="SMM (kg)" type="number" step="0.1" min="10" max="80" required value={form.smm_kg} onChange={set('smm_kg')} />
        <Field label="Body fat (%)" type="number" step="0.1" min="2" max="60" required value={form.bf_pct} onChange={set('bf_pct')} />
        <div className="flex items-end">
          <SaveButton saving={saving} saved={saved} />
        </div>
      </form>
      <ErrorNote error={error} />
    </Card>
  )
}

function EssayForm({ onSaved }) {
  const [form, setForm] = useState({ date: todayStr(), url: '', title: '' })
  const { run, saving, saved, error } = useSave(addEssay, onSaved)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <Card title="Essay shipped" subtitle="Paste the link when it goes live. Skip this if RSS is connected.">
      <form
        className="grid grid-cols-1 gap-3 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault()
          run({ date: form.date, url: form.url, title: form.title || form.url }, () =>
            setForm({ date: todayStr(), url: '', title: '' })
          )
        }}
      >
        <Field label="Date" type="date" required value={form.date} onChange={set('date')} />
        <Field label="URL" type="url" required placeholder="https://…" value={form.url} onChange={set('url')} />
        <Field label="Title (optional)" type="text" value={form.title} onChange={set('title')} />
        <div className="flex items-end">
          <SaveButton saving={saving} saved={saved} />
        </div>
      </form>
      <ErrorNote error={error} />
    </Card>
  )
}

const DOMAINS = ['writing', 'gym', 'running', 'physio', 'therapy', 'nutrition']

function PulseForm({ onSaved }) {
  const [ratings, setRatings] = useState({})
  const [note, setNote] = useState('')
  const { run, saving, saved, error } = useSave(addMonthlyPulse, onSaved)
  const month = new Date().toISOString().slice(0, 7)

  return (
    <Card title="Monthly pulse" subtitle={`How did ${month} feel, 1–5 per domain. Optional and skippable — there is no streak.`}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          run({ month, ratings, note: note || null }, () => {
            setRatings({})
            setNote('')
          })
        }}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {DOMAINS.map((d) => (
            <div key={d} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              <span className="capitalize">{d}</span>
              <div className="mt-1 flex gap-1" role="radiogroup" aria-label={d}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={ratings[d] === n}
                    onClick={() => setRatings((r) => ({ ...r, [d]: n }))}
                    className="h-8 w-8 rounded-md text-xs font-medium"
                    style={
                      ratings[d] === n
                        ? { background: 'var(--text-primary)', color: 'var(--page)' }
                        : { ...inputStyle, color: 'var(--text-secondary)' }
                    }
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-end gap-3">
          <label className="block grow text-xs" style={{ color: 'var(--text-secondary)' }}>
            One line, optional
            <input
              type="text"
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-md px-2.5 py-2 text-sm"
              style={inputStyle}
            />
          </label>
          <SaveButton saving={saving} saved={saved} />
        </div>
      </form>
      <ErrorNote error={error} />
    </Card>
  )
}
