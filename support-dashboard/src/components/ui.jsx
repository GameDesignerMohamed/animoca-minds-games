import { useState } from 'react'

/** card wrapper: title, subtitle, legend row, and a chart ⇄ table toggle so no
 * value is gated behind hover or color */
export function ChartCard({ title, subtitle, legend, table, children }) {
  const [showTable, setShowTable] = useState(false)
  return (
    <section
      className="rounded-xl p-4 sm:p-5"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {subtitle}
            </p>
          )}
        </div>
        {table && (
          <button
            onClick={() => setShowTable((s) => !s)}
            className="shrink-0 rounded-md px-2 py-1 text-xs"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            {showTable ? 'Chart' : 'Table'}
          </button>
        )}
      </div>
      {legend && legend.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {legend.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: l.color }}
              />
              {l.label}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3">
        {showTable && table ? <DataTable {...table} /> : children}
      </div>
    </section>
  )
}

export function DataTable({ columns, rows }) {
  return (
    <div className="max-h-72 overflow-auto rounded-lg" style={{ border: '1px solid var(--border)' }}>
      <table className="w-full text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c}
                className="sticky top-0 px-3 py-2 text-left font-medium"
                style={{ background: 'var(--surface-1)', color: 'var(--text-muted)', borderBottom: '1px solid var(--grid)' }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} className="px-3 py-1.5" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--grid)' }}>
                  {cell ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** shared recharts tooltip: surface card, text tokens, series key dots */
export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter }) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-sm"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
    >
      <div className="mb-1 font-medium" style={{ color: 'var(--text-primary)' }}>
        {labelFormatter ? labelFormatter(label, payload) : label}
      </div>
      {payload
        .filter((p) => p.value != null)
        .map((p) => (
          <div key={p.dataKey} className="flex items-center gap-1.5" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
            <span>{p.name}</span>
            <span className="ml-auto pl-3 font-medium" style={{ color: 'var(--text-primary)' }}>
              {valueFormatter ? valueFormatter(p.value, p.dataKey) : p.value}
            </span>
          </div>
        ))}
    </div>
  )
}

export function SegmentedControl({ options, value, onChange }) {
  return (
    <div
      className="inline-flex rounded-lg p-0.5"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
      role="tablist"
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className="rounded-md px-3 py-1 text-xs font-medium transition-colors"
          style={
            value === o.value
              ? { background: 'var(--page)', color: 'var(--text-primary)', border: '1px solid var(--border)' }
              : { color: 'var(--text-muted)' }
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function StatTile({ label, value, unit, delta, deltaLabel, downIsGood = false }) {
  const good = delta != null && (downIsGood ? delta < 0 : delta > 0)
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}>
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        {value}
        {unit && (
          <span className="ml-0.5 text-sm font-normal" style={{ color: 'var(--text-secondary)' }}>
            {unit}
          </span>
        )}
      </div>
      {delta != null && Math.abs(delta) >= 0.05 && (
        <div className="mt-0.5 text-xs" style={{ color: good ? 'var(--delta-good)' : 'var(--delta-bad)' }}>
          {delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1).replace(/\.0$/, '')}
          {unit} {deltaLabel}
        </div>
      )}
    </div>
  )
}
