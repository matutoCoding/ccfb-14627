// Daily schedule integration: machine-time booking against the center calendar.

import { ScanSegment } from './types'
import { machineTimeSec } from './strategy'

export interface ScheduleBlock {
  id: string
  sampleCode: string
  startMinute: number
  durationMin: number
  kind: 'experiment' | 'maintenance' | 'calibration'
  note: string
}

export interface ScheduleDay {
  // Minutes from 00:00; standard service window 8:30 - 22:00.
  openMinute: number
  closeMinute: number
  blocks: ScheduleBlock[]
  readoutSec: number
  overheadSec: number
}

export const defaultDay = (readoutSec: number, overheadSec: number): ScheduleDay => ({
  openMinute: 8 * 60 + 30,
  closeMinute: 22 * 60,
  blocks: [
    {
      id: 'cal-1',
      sampleCode: 'CAL',
      startMinute: 8 * 60 + 30,
      durationMin: 20,
      kind: 'calibration',
      note: '早间标样校准',
    },
    {
      id: 'maint-1',
      sampleCode: 'SYS',
      startMinute: 12 * 60,
      durationMin: 45,
      kind: 'maintenance',
      note: '液氮补充与巡检',
    },
  ],
  readoutSec,
  overheadSec,
})

export const programMinutes = (
  segments: ScanSegment[],
  readoutSec: number,
  overheadSec: number,
): number => machineTimeSec(segments, readoutSec, overheadSec) / 60

// Greedy first-fit placement into the day's free windows.
export const planDay = (
  jobs: { code: string; minutes: number }[],
  day: ScheduleDay,
): { placed: (ScheduleBlock | null)[]; freeMinutes: number } => {
  const busy = [...day.blocks].sort((a, b) => a.startMinute - b.startMinute)
  const windows: [number, number][] = []
  let cursor = day.openMinute
  for (const b of busy) {
    if (b.startMinute > cursor) windows.push([cursor, b.startMinute])
    cursor = Math.max(cursor, b.startMinute + b.durationMin)
  }
  if (cursor < day.closeMinute) windows.push([cursor, day.closeMinute])

  const placed: (ScheduleBlock | null)[] = []
  for (const job of jobs) {
    let slot: ScheduleBlock | null = null
    for (const w of windows) {
      if (w[1] - w[0] >= job.minutes) {
        slot = {
          id: `job-${job.code}-${w[0]}`,
          sampleCode: job.code,
          startMinute: w[0],
          durationMin: job.minutes,
          kind: 'experiment',
          note: '自动排期',
        }
        w[0] += job.minutes
        break
      }
    }
    placed.push(slot)
  }
  const freeMinutes = windows.reduce((acc, w) => acc + (w[1] - w[0]), 0)
  return { placed, freeMinutes }
}

export const formatClock = (minute: number): string => {
  const h = Math.floor(minute / 60)
  const m = Math.round(minute % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
