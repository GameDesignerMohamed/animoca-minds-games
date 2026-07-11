import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { ChartCard, ChartTooltip } from '../components/ui.jsx'
import { correlationSeries, bucketLabel } from '../lib/metrics.js'

/**
 * Overlay any two series as two vertically aligned panels on a shared time
 * axis (synced cursor). Two panels, one y-axis each — never a dual-axis chart.
 * No causal claims; the alignment is the whole feature.
 */
export default function Correlations({ data, range, today, pair, setPair }) {
  const series = correlationSeries(data, range, today)
  const labelOf = bucketLabel(range)
  const [aKey, bKey] = pair
  const a = series[aKey]
  const b = series[bKey]

  const rows = a.points.map((p, i) => [labelOf(p.bucket), p.value, b.points[i]?.value])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SeriesPicker
          label="Series A"
          color="var(--c-a)"
          series={series}
          value={aKey}
          exclude={bKey}
          onChange={(k) => setPair([k, bKey])}
        />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          vs
        </span>
        <SeriesPicker
          label="Series B"
          color="var(--c-b)"
          series={series}
          value={bKey}
          exclude={aKey}
          onChange={(k) => setPair([aKey, k])}
        />
      </div>

      <ChartCard
        title={`${a.label} vs ${b.label}`}
        subtitle="Aligned timelines only — patterns surface visually, no causal claims."
        legend={[
          { label: a.label, color: 'var(--c-a)' },
          { label: b.label, color: 'var(--c-b)' },
        ]}
        table={{
          columns: [range === '12w' ? 'Week' : 'Month', a.label, b.label],
          rows: [...rows].reverse(),
        }}
      >
        <Panel points={a.points} name={a.label} color="var(--c-a)" labelOf={labelOf} hideX />
        <Panel points={b.points} name={b.label} color="var(--c-b)" labelOf={labelOf} />
      </ChartCard>
    </div>
  )
}

function Panel({ points, name, color, labelOf, hideX = false }) {
  return (
    <ResponsiveContainer width="100%" height={170}>
      <LineChart data={points} syncId="corr" margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="bucket" tickFormatter={labelOf} hide={hideX} interval="preserveStartEnd" tickLine={false} axisLine={{ stroke: 'var(--axis)' }} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
        <YAxis domain={['auto', 'auto']} width={46} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
        <Tooltip content={<ChartTooltip labelFormatter={labelOf} />} cursor={{ stroke: 'var(--axis)' }} />
        <Line isAnimationActive={false}
          name={name}
          dataKey="value"
          type="linear"
          stroke={color}
          strokeWidth={2}
          dot={false}
          connectNulls
          activeDot={{ r: 4, stroke: 'var(--surface-1)', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function SeriesPicker({ label, color, series, value, exclude, onChange }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
      <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md px-2 py-1.5 text-xs"
        style={{ background: 'var(--surface-1)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
      >
        {Object.entries(series).map(([k, s]) => (
          <option key={k} value={k} disabled={k === exclude}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  )
}
