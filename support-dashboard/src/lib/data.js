// Data layer. With VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY set, reads/writes
// the Supabase tables in supabase/schema.sql. Without them, serves the demo
// dataset and persists manual entries to localStorage so the app is fully
// usable before any integration is connected.

import { createClient } from '@supabase/supabase-js'
import { generateDemoData } from './demo.js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isDemo = !url || !anonKey
const supabase = isDemo ? null : createClient(url, anonKey)

const LS_KEY = 'trend-watcher-demo-entries'

function loadLocalEntries() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) ?? { inbodyScans: [], essays: [], monthlyPulse: [] }
  } catch {
    return { inbodyScans: [], essays: [], monthlyPulse: [] }
  }
}

function saveLocalEntry(kind, row) {
  const entries = loadLocalEntries()
  entries[kind].push(row)
  localStorage.setItem(LS_KEY, JSON.stringify(entries))
}

export async function loadAll() {
  if (isDemo) {
    const base = generateDemoData()
    const local = loadLocalEntries()
    return {
      ...base,
      inbodyScans: [...base.inbodyScans, ...local.inbodyScans].sort((a, b) => a.date.localeCompare(b.date)),
      essays: [...base.essays, ...local.essays].sort((a, b) => a.date.localeCompare(b.date)),
      monthlyPulse: [...base.monthlyPulse, ...local.monthlyPulse],
    }
  }

  const [cycles, workouts, calendarEvents, inbodyScans, essays, monthlyPulse] = await Promise.all([
    supabase.from('whoop_cycles').select('*').order('date'),
    supabase.from('whoop_workouts').select('*').order('date'),
    supabase.from('calendar_events').select('*').order('date'),
    supabase.from('inbody_scans').select('*').order('date'),
    supabase.from('essays').select('*').order('date'),
    supabase.from('monthly_pulse').select('*').order('month'),
  ])
  const fail = [cycles, workouts, calendarEvents, inbodyScans, essays, monthlyPulse].find((r) => r.error)
  if (fail) throw fail.error
  return {
    cycles: cycles.data,
    workouts: workouts.data,
    calendarEvents: calendarEvents.data,
    inbodyScans: inbodyScans.data,
    essays: essays.data,
    monthlyPulse: monthlyPulse.data,
  }
}

export async function addInbodyScan(row) {
  if (isDemo) return saveLocalEntry('inbodyScans', row)
  const { error } = await supabase.from('inbody_scans').insert(row)
  if (error) throw error
}

export async function addEssay(row) {
  if (isDemo) return saveLocalEntry('essays', row)
  const { error } = await supabase.from('essays').insert(row)
  if (error) throw error
}

export async function addMonthlyPulse(row) {
  if (isDemo) return saveLocalEntry('monthlyPulse', row)
  const { error } = await supabase.from('monthly_pulse').upsert(row, { onConflict: 'month' })
  if (error) throw error
}
