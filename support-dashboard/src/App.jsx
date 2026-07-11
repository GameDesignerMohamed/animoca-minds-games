import { useEffect, useState, useCallback } from 'react'
import { loadAll, isDemo } from './lib/data.js'
import { SegmentedControl } from './components/ui.jsx'
import Trends from './views/Trends.jsx'
import Correlations from './views/Correlations.jsx'
import Quarterly from './views/Quarterly.jsx'
import Entry from './views/Entry.jsx'

const VIEWS = [
  { value: 'trends', label: 'Trends' },
  { value: 'correlations', label: 'Correlations' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'add', label: 'Add data' },
]

export default function App() {
  const [view, setView] = useState('trends')
  const [range, setRange] = useState('12w')
  const [pair, setPair] = useState(['therapy', 'recovery'])
  const [data, setData] = useState(null)
  const [stale, setStale] = useState(false)
  const [error, setError] = useState(null)
  const today = new Date()

  const refresh = useCallback(async () => {
    setStale(true)
    try {
      setData(await loadAll())
      setError(null)
    } catch (e) {
      setError(e.message ?? String(e))
    } finally {
      setStale(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <header className="mb-5">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-lg font-semibold">Trend Watcher</h1>
          {isDemo && (
            <span
              className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            >
              demo data
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Is the support system holding up? Nothing here needs daily input.
        </p>
      </header>

      {/* the one filter row — scopes every chart below it */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl options={VIEWS} value={view} onChange={setView} />
        {(view === 'trends' || view === 'correlations') && (
          <SegmentedControl
            options={[
              { value: '12w', label: '12 weeks' },
              { value: '12m', label: '12 months' },
            ]}
            value={range}
            onChange={setRange}
          />
        )}
      </div>

      {error && (
        <p className="mb-4 text-sm" style={{ color: 'var(--delta-bad)' }}>
          Couldn’t load data: {error}
        </p>
      )}

      {!data ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Loading…
        </p>
      ) : (
        // hold the previous render at reduced opacity on refetch — no skeleton flash
        <main style={{ opacity: stale ? 0.6 : 1, transition: 'opacity 150ms' }}>
          {view === 'trends' && <Trends data={data} range={range} today={today} />}
          {view === 'correlations' && (
            <Correlations data={data} range={range} today={today} pair={pair} setPair={setPair} />
          )}
          {view === 'quarterly' && <Quarterly data={data} today={today} />}
          {view === 'add' && <Entry onSaved={refresh} />}
        </main>
      )}
    </div>
  )
}
