import { quarterlyReview, fmt } from '../lib/metrics.js'
import { DataTable } from '../components/ui.jsx'

const shortDate = (d) =>
  d ? new Date(d + 'T00:00:00Z').toLocaleString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '—'

/** Read-only auto-summary of the last 13 weeks vs the 13 before.
 *  Facts only: what moved, what stopped, the largest change. No action items. */
export default function Quarterly({ data, today }) {
  const q = quarterlyReview(data, today)

  const sentence = (m) => {
    const dir = m.delta > 0 ? 'up' : 'down'
    const d = Math.abs(m.delta)
    return `${m.label} ${dir} ${fmt(d, m.digits)}${m.unit} (${fmt(m.prev, m.digits)}${m.unit} → ${fmt(m.now, m.digits)}${m.unit})`
  }

  return (
    <div className="space-y-4">
      <section
        className="rounded-xl p-5"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
      >
        <h2 className="text-sm font-semibold">Quarter in review</h2>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {shortDate(q.from)} – {shortDate(q.to)}, compared with the 13 weeks before. Auto-generated, read-only.
        </p>

        {q.largest && (
          <p className="mt-4 text-sm" style={{ color: 'var(--text-primary)' }}>
            Largest change: <strong>{sentence(q.largest)}</strong>.
          </p>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <SummaryList title="Trended up" items={q.up.map(sentence)} empty="Nothing moved up." />
          <SummaryList title="Trended down" items={q.down.map(sentence)} empty="Nothing moved down." />
        </div>

        {q.stopped.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Went quiet
            </h3>
            <ul className="mt-1 space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {q.stopped.map((s) => (
                <li key={s.label}>
                  {s.label}: nothing in 6+ weeks (last {shortDate(s.lastDate)})
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section
        className="rounded-xl p-5"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
      >
        <h2 className="mb-3 text-sm font-semibold">All metrics</h2>
        <DataTable
          columns={['Metric', 'This quarter', 'Prior quarter', 'Change']}
          rows={q.metrics.map((m) => [
            m.label,
            fmt(m.now, m.digits) + m.unit,
            fmt(m.prev, m.digits) + m.unit,
            m.delta == null ? '—' : `${m.delta > 0 ? '+' : '−'}${fmt(Math.abs(m.delta), m.digits)}${m.unit}`,
          ])}
        />
      </section>
    </div>
  )
}

function SummaryList({ title, items, empty }) {
  return (
    <div>
      <h3 className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        {title}
      </h3>
      {items.length ? (
        <ul className="mt-1 space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {items.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          {empty}
        </p>
      )}
    </div>
  )
}
