import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts'
import { ChartCard, ChartTooltip, StatTile } from '../components/ui.jsx'
import {
  trainingCadence,
  recoveryBaseline,
  essayCadence,
  careTimeline,
  bucketLabel,
  quarterlyReview,
  fmt,
} from '../lib/metrics.js'

const DAY = 86400000

function windowStart(range, today) {
  return new Date(today.getTime() - (range === '12w' ? 84 : 365) * DAY)
    .toISOString()
    .slice(0, 10)
}

const shortDate = (d) =>
  new Date(d + 'T00:00:00Z').toLocaleString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })

const axisProps = {
  tickLine: false,
  axisLine: { stroke: 'var(--axis)' },
  tick: { fill: 'var(--text-muted)', fontSize: 11 },
}

export default function Trends({ data, range, today }) {
  const labelOf = bucketLabel(range)
  const scans = data.inbodyScans.filter((s) => s.date >= windowStart(range, today))
  const recovery = recoveryBaseline(data.cycles, range, today)
  const cadence = trainingCadence(data.workouts, range, today)
  const essays = essayCadence(data.essays, today)
  const care = careTimeline(data.calendarEvents, range, today)
  const q = quarterlyReview(data, today)

  const latestScan = data.inbodyScans[data.inbodyScans.length - 1]
  const prevScan = data.inbodyScans[data.inbodyScans.length - 2]
  const recNow = q.metrics.find((m) => m.key === 'recovery')
  const essaysQ = q.metrics.find((m) => m.key === 'essays')

  const careRows = [...care].reverse().map((e) => [shortDate(e.date), e.type === 'therapy' ? 'Therapy' : 'Physio'])

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Body fat"
          value={latestScan ? fmt(latestScan.bf_pct) : '—'}
          unit="%"
          delta={latestScan && prevScan ? latestScan.bf_pct - prevScan.bf_pct : null}
          deltaLabel="vs last scan"
          downIsGood
        />
        <StatTile
          label="Skeletal muscle"
          value={latestScan ? fmt(latestScan.smm_kg) : '—'}
          unit="kg"
          delta={latestScan && prevScan ? latestScan.smm_kg - prevScan.smm_kg : null}
          deltaLabel="vs last scan"
        />
        <StatTile
          label="Recovery, 13-week avg"
          value={fmt(recNow?.now)}
          unit="%"
          delta={recNow?.delta}
          deltaLabel="vs prior quarter"
        />
        <StatTile
          label="Essays this quarter"
          value={essaysQ?.now ?? '—'}
          delta={essaysQ?.delta}
          deltaLabel="vs prior quarter"
        />
      </div>

      {/* Body composition — two aligned panels, one axis each (never dual-axis) */}
      <ChartCard
        title="Body composition"
        subtitle="InBody scans. Body fat with the 12% and 10% targets; muscle mass aligned below to catch loss during the cut."
        legend={[
          { label: 'Body fat %', color: 'var(--c-bf)' },
          { label: 'Skeletal muscle kg', color: 'var(--c-smm)' },
        ]}
        table={{
          columns: ['Scan', 'Body fat %', 'SMM kg', 'Weight kg'],
          rows: [...scans].reverse().map((s) => [shortDate(s.date), s.bf_pct, s.smm_kg, s.weight_kg]),
        }}
      >
        {scans.length < 2 ? (
          <Empty msg="Not enough scans in this window yet." />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={scans} syncId="bodycomp" margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} {...axisProps} hide />
                <YAxis domain={['auto', 'auto']} width={46} {...axisProps} />
                <Tooltip content={<ChartTooltip labelFormatter={shortDate} />} cursor={{ stroke: 'var(--axis)' }} />
                <ReferenceLine y={12} label={{ value: '12% target', position: 'insideTopRight', fill: 'var(--text-muted)', fontSize: 10 }} />
                <ReferenceLine y={10} label={{ value: '10% target', position: 'insideBottomRight', fill: 'var(--text-muted)', fontSize: 10 }} />
                <Line isAnimationActive={false}
                  name="Body fat %"
                  dataKey="bf_pct"
                  type="monotone"
                  stroke="var(--c-bf)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: 'var(--c-bf)', stroke: 'var(--surface-1)', strokeWidth: 2 }}
                  activeDot={{ r: 5, stroke: 'var(--surface-1)', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={scans} syncId="bodycomp" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} {...axisProps} />
                <YAxis domain={['auto', 'auto']} width={46} {...axisProps} />
                <Tooltip content={<ChartTooltip labelFormatter={shortDate} />} cursor={{ stroke: 'var(--axis)' }} />
                <Line isAnimationActive={false}
                  name="Skeletal muscle kg"
                  dataKey="smm_kg"
                  type="monotone"
                  stroke="var(--c-smm)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: 'var(--c-smm)', stroke: 'var(--surface-1)', strokeWidth: 2 }}
                  activeDot={{ r: 5, stroke: 'var(--surface-1)', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </ChartCard>

      {/* Recovery baseline */}
      <ChartCard
        title="Recovery baseline"
        subtitle="Whoop recovery, trailing 28-day average. The single best proxy for whether the whole system works."
        table={{
          columns: [range === '12w' ? 'Week' : 'Month', 'Recovery %'],
          rows: [...recovery].reverse().map((p) => [labelOf(p.bucket), p.recovery]),
        }}
      >
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={recovery} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="bucket" tickFormatter={labelOf} {...axisProps} interval="preserveStartEnd" />
            <YAxis domain={['auto', 'auto']} width={46} {...axisProps} />
            <Tooltip
              content={<ChartTooltip labelFormatter={labelOf} valueFormatter={(v) => `${v}%`} />}
              cursor={{ stroke: 'var(--axis)' }}
            />
            <Line isAnimationActive={false}
              name="Recovery, 28-day avg"
              dataKey="recovery"
              type="monotone"
              stroke="var(--c-recovery)"
              strokeWidth={2}
              dot={false}
              connectNulls
              activeDot={{ r: 4, stroke: 'var(--surface-1)', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Training cadence */}
      <ChartCard
        title="Training cadence"
        subtitle={`Sessions per ${range === '12w' ? 'week' : 'month'} from Whoop workouts. A rhythm, not a compliance score.`}
        legend={[
          { label: 'Lift', color: 'var(--c-lift)' },
          { label: 'Run', color: 'var(--c-run)' },
        ]}
        table={{
          columns: [range === '12w' ? 'Week' : 'Month', 'Lift', 'Run'],
          rows: [...cadence].reverse().map((p) => [labelOf(p.bucket), p.lift, p.run]),
        }}
      >
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={cadence} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="bucket" tickFormatter={labelOf} {...axisProps} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} width={40} {...axisProps} />
            <Tooltip content={<ChartTooltip labelFormatter={labelOf} />} cursor={{ fill: 'var(--grid)', opacity: 0.4 }} />
            <Bar isAnimationActive={false} name="Lift" dataKey="lift" stackId="s" fill="var(--c-lift)" maxBarSize={24} stroke="var(--surface-1)" strokeWidth={1} />
            <Bar isAnimationActive={false} name="Run" dataKey="run" stackId="s" fill="var(--c-run)" maxBarSize={24} radius={[4, 4, 0, 0]} stroke="var(--surface-1)" strokeWidth={1} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Writing */}
      <ChartCard
        title="Writing"
        subtitle={`Essays shipped per month. ${essays[essays.length - 1]?.cumulative ?? 0} shipped all-time.`}
        table={{
          columns: ['Month', 'Shipped', 'Cumulative'],
          rows: [...essays].reverse().map((p) => [labelOf(p.bucket), p.essays, p.cumulative]),
        }}
      >
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={essays} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="bucket" tickFormatter={labelOf} {...axisProps} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} width={40} {...axisProps} />
            <Tooltip content={<ChartTooltip labelFormatter={labelOf} />} cursor={{ fill: 'var(--grid)', opacity: 0.4 }} />
            <Bar isAnimationActive={false} name="Essays" dataKey="essays" fill="var(--c-essays)" maxBarSize={24} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Care cadence */}
      <ChartCard
        title="Care cadence"
        subtitle="Therapy and physio sessions from the calendar, each dot one appointment."
        legend={[
          { label: 'Therapy', color: 'var(--c-therapy)' },
          { label: 'Physio', color: 'var(--c-physio)' },
        ]}
        table={{ columns: ['Date', 'Type'], rows: careRows }}
      >
        <ResponsiveContainer width="100%" height={140}>
          <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid horizontal={false} />
            <XAxis
              type="number"
              dataKey="x"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(ms) => shortDate(new Date(ms).toISOString().slice(0, 10))}
              {...axisProps}
            />
            <YAxis
              type="category"
              dataKey="row"
              domain={['Physio', 'Therapy']}
              allowDuplicatedCategory={false}
              width={64}
              {...axisProps}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={
                <ChartTooltip
                  labelFormatter={(_, payload) => shortDate(payload?.[0]?.payload?.date ?? '')}
                  valueFormatter={() => ''}
                />
              }
              cursor={false}
            />
            <Scatter isAnimationActive={false}
              name="Therapy"
              data={care.filter((e) => e.type === 'therapy').map((e) => ({ ...e, row: 'Therapy' }))}
              fill="var(--c-therapy)"
            >
              {care.filter((e) => e.type === 'therapy').map((e, i) => (
                <Cell key={i} stroke="var(--surface-1)" strokeWidth={2} />
              ))}
            </Scatter>
            <Scatter isAnimationActive={false}
              name="Physio"
              data={care.filter((e) => e.type === 'physio').map((e) => ({ ...e, row: 'Physio' }))}
              fill="var(--c-physio)"
            >
              {care.filter((e) => e.type === 'physio').map((e, i) => (
                <Cell key={i} stroke="var(--surface-1)" strokeWidth={2} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

function Empty({ msg }) {
  return (
    <div className="flex h-32 items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
      {msg}
    </div>
  )
}
