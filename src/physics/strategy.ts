// Collection statistics: frame coverage, completeness, redundancy,
// resolution shells and machine-time accounting.

import { Reflection, ScanSegment } from './types'
import { reflectionPartiality, wrap180 } from './ewald'

export interface FrameRecord {
  segmentId: string
  axis: 'omega' | 'phi'
  angleDeg: number
  index: number
}

// Enumerate every frame produced by a scan program.
export const enumerateFrames = (segments: ScanSegment[]): FrameRecord[] => {
  const frames: FrameRecord[] = []
  for (const seg of segments) {
    if (seg.stepDeg <= 0 || seg.exposureSec <= 0) continue
    const span = seg.endDeg - seg.startDeg
    const count = Math.max(1, Math.round(Math.abs(span) / seg.stepDeg) + 1)
    const dir = span >= 0 ? 1 : -1
    for (let i = 0; i < count; i++) {
      frames.push({
        segmentId: seg.id,
        axis: seg.axis,
        angleDeg: seg.startDeg + dir * i * seg.stepDeg,
        index: i,
      })
    }
  }
  return frames
}

const inRangeWrapped = (angleDeg: number, start: number, end: number): boolean => {
  // Segments are short compared to a full turn; normalize by window midpoint.
  const mid = (start + end) / 2
  const local = wrap180(angleDeg - mid)
  const half = Math.abs(end - start) / 2
  return Math.abs(local) <= half + 1e-9
}

// Does any rocking window of the reflection intersect this segment?
export const reflectionCovered = (
  refl: Reflection,
  segment: ScanSegment,
): boolean => {
  const windows = segment.axis === 'omega' ? refl.windows.omega : refl.windows.phi
  if (!windows) return false
  return windows.some((w) => inRangeWrapped(w.centerDeg, segment.startDeg, segment.endDeg))
}

export interface CompletenessResult {
  measuredUnique: number
  totalUnique: number
  completeness: number
  averageRedundancy: number
  highestResolutionA: number
  shellBins: ResolutionShell[]
  coverageByReflection: boolean[]
}

export interface ResolutionShell {
  dMinA: number
  dMaxA: number
  total: number
  measured: number
  completeness: number
  redundancy: number
}

export const evaluateStrategy = (
  reflections: Reflection[],
  segments: ScanSegment[],
  resolutionLimitA: number,
  shellCount = 8,
): CompletenessResult => {
  const eligible = reflections.filter(
    (r) => r.domain === 0 && r.resolutionA >= resolutionLimitA,
  )
  // Friedel-merge: keep only one of hkl / -h -k -l for unique statistics.
  const unique: Reflection[] = []
  const seen = new Set<string>()
  for (const r of eligible) {
    const key = `${r.h},${r.k},${r.l}`
    const friedel = `${-r.h},${-r.k},${-r.l}`
    if (seen.has(key) || seen.has(friedel)) continue
    seen.add(key)
    unique.push(r)
  }

  const covered = unique.map((r) => segments.some((s) => reflectionCovered(r, s)))
  const measuredUnique = covered.filter(Boolean).length

  // Redundancy: count segment/window observations across all eligible refls.
  let observations = 0
  for (const r of eligible) {
    for (const seg of segments) {
      const windows = seg.axis === 'omega' ? r.windows.omega : r.windows.phi
      observations += windows?.filter((w) =>
        inRangeWrapped(w.centerDeg, seg.startDeg, seg.endDeg)).length ?? 0
    }
  }
  const averageRedundancy = measuredUnique === 0 ? 0 : observations / measuredUnique

  const dMin = Math.min(...unique.map((r) => r.resolutionA))
  const dMax = Math.max(...unique.map((r) => r.resolutionA))
  const shells: ResolutionShell[] = []
  for (let i = 0; i < shellCount; i++) {
    const hi = dMax - ((dMax - dMin) * i) / shellCount
    const lo = dMax - ((dMax - dMin) * (i + 1)) / shellCount
    const members = unique.filter((r) => r.resolutionA > lo && r.resolutionA <= hi)
    const hit = members.filter((r) =>
      segments.some((s) => reflectionCovered(r, s))).length
    shells.push({
      dMinA: lo,
      dMaxA: hi,
      total: members.length,
      measured: hit,
      completeness: members.length === 0 ? 1 : hit / members.length,
      redundancy: hit === 0 ? 0 : members.reduce((acc, r) => acc + segmentHits(r, segments), 0) / hit,
    })
  }

  return {
    measuredUnique,
    totalUnique: unique.length,
    completeness: unique.length === 0 ? 0 : measuredUnique / unique.length,
    averageRedundancy,
    highestResolutionA: dMin,
    shellBins: shells,
    coverageByReflection: covered,
  }
}

const segmentHits = (r: Reflection, segments: ScanSegment[]): number => {
  let n = 0
  for (const seg of segments) {
    const windows = seg.axis === 'omega' ? r.windows.omega : r.windows.phi
    n += windows?.filter((w) =>
      inRangeWrapped(w.centerDeg, seg.startDeg, seg.endDeg)).length ?? 0
  }
  return n
}

// Total instrument time including per-frame overhead (shutter, readout).
export const machineTimeSec = (
  segments: ScanSegment[],
  readoutSec: number,
  overheadSec: number,
): number => {
  const frames = enumerateFrames(segments)
  if (frames.length === 0) return 0
  return (
    frames.reduce((acc, f) => {
      const seg = segments.find((s) => s.id === f.segmentId)!
      return acc + seg.exposureSec
    }, 0) +
    frames.length * readoutSec +
    segments.length * overheadSec
  )
}

export const formatDuration = (sec: number): string => {
  if (sec <= 0) return '0 分钟'
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  return h > 0 ? `${h} 小时 ${m} 分` : `${m} 分钟`
}
