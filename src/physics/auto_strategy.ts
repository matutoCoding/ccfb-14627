// Automatic scan-program optimizer.
//
// Greedy set cover over rocking windows: at each round the candidate sweep
// whose window covers the most still-missing unique reflections wins, until
// the target completeness is reached or no candidate adds anything. Sweeps
// on both omega and phi are scored on equal footing, so the cheapest program
// naturally prefers one axis and only adds the other to fill blind regions.

import { Reflection, ScanSegment, ScanAxis } from './types'
import { evaluateStrategy, reflectionCovered } from './strategy'

export interface AutoStrategyRequest {
  reflections: Reflection[]
  resolutionLimitA: number
  targetCompleteness: number
  // Candidate sweep width per round in degrees.
  sweepWidthDeg: number
  // Angular spacing between candidate sweep starts.
  candidateStepDeg: number
  defaultFrameStepDeg: number
  defaultExposureSec: number
  maxSegments: number
}

const coveredKey = (r: Reflection): string => `${r.h},${r.k},${r.l}`
const friedelKey = (r: Reflection): string => `${-r.h},${-r.k},${-r.l}`

interface Candidate {
  axis: ScanAxis
  startDeg: number
  endDeg: number
  gain: number
}

const scoreCandidate = (
  seg: Pick<ScanSegment, 'axis' | 'startDeg' | 'endDeg'>,
  unique: Reflection[],
  missing: Set<string>,
): number => {
  const probe: ScanSegment = {
    id: 'probe',
    axis: seg.axis,
    startDeg: seg.startDeg,
    endDeg: seg.endDeg,
    stepDeg: 1,
    exposureSec: 1,
  }
  let gain = 0
  for (const r of unique) {
    if (!missing.has(coveredKey(r))) continue
    if (reflectionCovered(r, probe)) gain++
  }
  return gain
}

export const optimizeStrategy = (req: AutoStrategyRequest): ScanSegment[] => {
  const unique: Reflection[] = []
  const seen = new Set<string>()
  for (const r of req.reflections) {
    if (r.domain !== 0 || r.resolutionA < req.resolutionLimitA) continue
    const key = coveredKey(r)
    if (seen.has(key) || seen.has(friedelKey(r))) continue
    seen.add(key)
    unique.push(r)
  }

  const missing = new Set(unique.map(coveredKey))
  const chosen: ScanSegment[] = []
  let segmentId = 0

  const targetCount = Math.ceil(unique.length * req.targetCompleteness)

  while (chosen.length < req.maxSegments && missing.size > unique.length - targetCount) {
    const best: Candidate = { axis: 'omega', startDeg: 0, endDeg: 0, gain: 0 }
    for (const axis of ['omega', 'phi'] as ScanAxis[]) {
      for (let start = -180; start < 180; start += req.candidateStepDeg) {
        const end = start + req.sweepWidthDeg
        const gain = scoreCandidate({ axis, startDeg: start, endDeg: end }, unique, missing)
        // Tie-break toward omega to avoid pointless axis switching.
        const tieBonus = axis === 'omega' ? 0.01 : 0
        if (gain + tieBonus > best.gain) {
          best.axis = axis
          best.startDeg = start
          best.endDeg = end
          best.gain = gain
        }
      }
    }
    if (best.gain === 0) break

    const segment: ScanSegment = {
      id: `auto-${segmentId++}`,
      axis: best.axis,
      startDeg: best.startDeg,
      endDeg: best.endDeg,
      stepDeg: req.defaultFrameStepDeg,
      exposureSec: req.defaultExposureSec,
    }
    chosen.push(segment)
    for (const r of unique) {
      if (reflectionCovered(r, segment)) missing.delete(coveredKey(r))
    }
  }

  return mergeAdjacent(chosen)
}

// Join same-axis segments that touch or overlap, reducing goniometer resets.
const mergeAdjacent = (segments: ScanSegment[]): ScanSegment[] => {
  const sorted = [...segments].sort((a, b) =>
    a.axis === b.axis ? a.startDeg - b.startDeg : a.axis.localeCompare(b.axis))
  const merged: ScanSegment[] = []
  for (const seg of sorted) {
    const last = merged[merged.length - 1]
    if (
      last &&
      last.axis === seg.axis &&
      Math.abs(seg.startDeg - last.endDeg) < 0.5
    ) {
      last.endDeg = Math.max(last.endDeg, seg.endDeg)
      continue
    }
    merged.push({ ...seg })
  }
  return merged
}

export const summarizeOptimization = (
  reflections: Reflection[],
  segments: ScanSegment[],
  resolutionLimitA: number,
) => evaluateStrategy(reflections, segments, resolutionLimitA)
