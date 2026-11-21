import { describe, expect, it } from 'vitest'
import {
  solveCrossingCenters, rockingWindows, partialityAt, wrap180,
} from './ewald'
import { projectRay, diffractedDirection } from './detector'
import { orientationMatrix, labAtZero, stageAxis } from './orientation'
import { reciprocalMatrix } from './lattice'
import { BeamConfig, DetectorConfig, CellParams } from './types'
import { mulMV, norm, rotAxis } from './math3d'

const cell: CellParams = { a: 10, b: 10, c: 10, alpha: 90, beta: 90, gamma: 90 }
const beam: BeamConfig = { wavelengthA: 1, airScatter: 0.1, beamStopMm: 3 }
const det: DetectorConfig = {
  distanceMm: 100,
  centerXPx: 512,
  centerYPx: 512,
  pixelSizeMm: 0.1,
  twoThetaOffsetDeg: 0,
  widthPx: 1024,
  heightPx: 1024,
}

// With U = I, r100 = (0.1, 0, 0). Rotation about the lab Y axis (perpendicular
// to the +Z beam) sweeps it through the Ewald sphere at sin(theta) = 0.05.
const r100 = (): [number, number, number] => {
  const bm = reciprocalMatrix(cell)
  return labAtZero(orientationMatrix(0, 0, 0), mulMV(bm, [1, 0, 0]))
}
const yAxis: [number, number, number] = [0, 1, 0]
const zAxis: [number, number, number] = [0, 0, 1]

describe('ewald crossing solver', () => {
  it('finds the hand-calculated centers for rotation about an axis perpendicular to the beam', () => {
    const r = r100()
    const centers = solveCrossingCenters(r, yAxis, beam.wavelengthA)
    // r(theta) = (0.1 cos, 0, -0.1 sin); Ewald => sin(theta) = 0.05.
    const first = (Math.asin(0.05) * 180) / Math.PI
    const second = 180 - first
    expect(centers).toHaveLength(2)
    expect(centers.some((c) => Math.abs(wrap180(c - first)) < 1e-9)).toBe(true)
    expect(centers.some((c) => Math.abs(wrap180(c - second)) < 1e-9)).toBe(true)
  })

  it('returns no crossings when the rotation axis is parallel to the beam', () => {
    // The beam-parallel axis leaves k0.r constant: the point never sweeps
    // the sphere, which is the physical blind region of a single-axis stage.
    const centers = solveCrossingCenters(r100(), zAxis, beam.wavelengthA)
    expect(centers).toHaveLength(0)
  })

  it('rocking windows bracket the exact center with symmetric FWHM', () => {
    const windows = rockingWindows(r100(), 5.732, yAxis, {
      wavelengthA: 1,
      mosaicityDeg: 0.2,
      wavelengthSpread: 0.001,
    })
    expect(windows.length).toBeGreaterThan(0)
    for (const w of windows) {
      expect(Math.abs(w.centerDeg - (w.entryDeg + w.exitDeg) / 2)).toBeLessThan(1e-9)
      expect(w.widthDeg).toBeGreaterThan(0)
    }
  })

  it('partiality peaks at the center and vanishes beyond the window', () => {
    const w = { centerDeg: 30, widthDeg: 1, entryDeg: 29.5, exitDeg: 30.5 }
    expect(partialityAt(w, 30)).toBeCloseTo(1, 6)
    expect(partialityAt(w, 29.5)).toBeCloseTo(0.5, 1)
    expect(partialityAt(w, 28)).toBe(0)
    expect(partialityAt(w, 210)).toBe(0)
  })
})

describe('detector projection', () => {
  it('projects the hand-calculated (100) reflection within half a pixel', () => {
    const r0 = r100()
    const thetaRad = Math.asin(0.05)
    const rRot = mulMV(rotAxis(yAxis, thetaRad), r0)
    // The rotated vector must satisfy the Ewald equality to machine precision.
    const kOut = diffractedDirection(rRot, beam)
    expect(norm(kOut)).toBeCloseTo(1 / beam.wavelengthA, 10)

    const p = projectRay(kOut, det)
    // 2theta = 2 asin(0.05); x = D tan(2theta), converted through pixel size.
    const twoTheta = 2 * Math.asin(0.05)
    const xExpectedPx = det.centerXPx + (det.distanceMm * Math.tan(twoTheta)) / det.pixelSizeMm
    expect(p.onPanel).toBe(true)
    expect(Math.abs(p.xPx - xExpectedPx)).toBeLessThan(0.5)
    expect(Math.abs(p.yPx - det.centerYPx)).toBeLessThan(1e-9)
  })

  it('keeps the direct beam at the panel center', () => {
    const p = projectRay([0, 0, 1 / beam.wavelengthA], det)
    expect(p.xPx).toBeCloseTo(det.centerXPx, 9)
    expect(p.yPx).toBeCloseTo(det.centerYPx, 9)
  })

  it('rejects rays pointing away from the panel', () => {
    const p = projectRay([0, 0, -1], det)
    expect(p.onPanel).toBe(false)
  })

  it('diffracted wave keeps the incident wave number at the Bragg orientation', () => {
    const rRot = mulMV(rotAxis(yAxis, Math.asin(0.05)), r100())
    const kOut = diffractedDirection(rRot, beam)
    expect(norm(kOut)).toBeCloseTo(1 / beam.wavelengthA, 10)
  })

  it('offsets the panel center correctly with a 2theta tilt', () => {
    const tilted: DetectorConfig = { ...det, twoThetaOffsetDeg: 30 }
    const p = projectRay([0, 0, 1 / beam.wavelengthA], tilted)
    // The direct beam now lands at x = -D tan(30deg) in mm.
    const expectedX = det.centerXPx - (det.distanceMm * Math.tan(Math.PI / 6)) / det.pixelSizeMm
    expect(Math.abs(p.xPx - expectedX)).toBeLessThan(0.5)
  })
})
