// Ewald sphere geometry and rotation-axis crossing solver.
//
// Beam convention: X-rays travel along +Z, k0 = (0, 0, 1/lambda).
// Ewald sphere (radius 1/lambda, center -k0) equation for a reciprocal
// vector r in the lab frame:
//
//   |k0 + r|^2 = |k0|^2  <=>  r^2 + 2*k0.r = 0
//
// A reflection r0 rotated about a fixed unit lab axis n by angle theta:
//   r(theta) = n(n.r0) + [r0 - n(n.r0)] cos(theta) + (n x r0) sin(theta)
// Substitution gives one scalar equation in theta:
//   A + B*cos(theta) + C*sin(theta) = -rho^2/2
// with A=(k0.n)(n.r0), B=k0.r0-A, C=k0.(n x r0), rho=|r0|.
// The sinusoid crosses the target up to twice per revolution: the two
// Bragg orientations of one reflection in a full 360 degree turn.

import { Vec3, cross, dot, normalize, rad2deg, deg2rad } from './math3d'
import { ScanAxis } from './types'

export interface EwaldOptions {
  wavelengthA: number
  // Mosaic spread FWHM in degrees.
  mosaicityDeg: number
  // Relative wavelength dispersion dlambda/lambda, e.g. 0.001.
  wavelengthSpread: number
}

export interface RockingWindow {
  // Bragg angle center, wrapped to (-180, 180].
  centerDeg: number
  // Full rocking width (FWHM-based footprint) in degrees.
  widthDeg: number
  entryDeg: number
  exitDeg: number
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
export const wrap180 = (deg: number): number => {
  const d = (((deg + 180) % 360) + 360) % 360 - 180
  return d === -180 ? 180 : d
}

// Rocking-curve FWHM in degrees at a given 2theta Bragg angle.
// Mosaic spread and wavelength dispersion add in quadrature;
// the latter scales with tan(theta) via Bragg-law differentiation.
export const rockingFwhm = (twoThetaDeg: number, opt: EwaldOptions): number => {
  const theta = deg2rad(twoThetaDeg / 2)
  const lambdaTerm = Math.tan(theta) * opt.wavelengthSpread * rad2deg(1)
  return Math.hypot(opt.mosaicityDeg, lambdaTerm)
}

// Exact Bragg crossing centers for one reciprocal vector on one rotation
// axis. Returns 0, 1 (tangent) or 2 centers per revolution.
export const solveCrossingCenters = (
  rLab0: Vec3,
  axis: Vec3,
  wavelengthA: number,
): number[] => {
  const n = normalize(axis)
  const k0: Vec3 = [0, 0, 1 / wavelengthA]
  const rho2 = dot(rLab0, rLab0)
  if (rho2 === 0) return []

  const ndotr = dot(n, rLab0)
  const kdotn = dot(k0, n)
  const A = kdotn * ndotr
  const B = dot(k0, rLab0) - A
  const C = dot(k0, cross(n, rLab0))
  const amplitude = Math.hypot(B, C)
  // Rotation axis parallel to the beam: the point never sweeps the sphere.
  if (amplitude < 1e-14) return []

  const target = -rho2 / 2 - A
  const ratio = clamp(target / amplitude, -1, 1)
  const phase0 = Math.atan2(C, B)
  const delta = Math.acos(ratio)
  if (delta < 1e-9) return [wrap180(rad2deg(phase0))]
  return [
    wrap180(rad2deg(phase0 - delta)),
    wrap180(rad2deg(phase0 + delta)),
  ]
}

// Broadened rocking windows for both Bragg orientations of a reflection.
export const rockingWindows = (
  rLab0: Vec3,
  twoThetaDeg: number,
  axis: Vec3,
  opt: EwaldOptions,
): RockingWindow[] => {
  const centers = solveCrossingCenters(rLab0, axis, opt.wavelengthA)
  const fwhm = rockingFwhm(twoThetaDeg, opt)
  return centers.map((centerDeg) => ({
    centerDeg,
    widthDeg: 2 * fwhm,
    entryDeg: wrap180(centerDeg - fwhm),
    exitDeg: wrap180(centerDeg + fwhm),
  }))
}

// Gaussian partiality at a stage angle relative to one rocking window.
// Returns 0 beyond +/-2 FWHM so spots fade in/out instead of popping.
export const partialityAt = (window: RockingWindow, angleDeg: number): number => {
  const fwhm = window.widthDeg / 2
  if (fwhm <= 0) {
    return Math.abs(wrap180(angleDeg - window.centerDeg)) < 1e-6 ? 1 : 0
  }
  const offset = wrap180(angleDeg - window.centerDeg)
  if (Math.abs(offset) > 2 * fwhm) return 0
  const sigma = fwhm / 1.1774100225 // FWHM = 2*sqrt(2 ln2) * sigma
  return Math.exp(-(offset * offset) / (2 * sigma * sigma))
}

// Partiality combined over every window of a stage's two Bragg orientations.
export const reflectionPartiality = (
  windows: RockingWindow[] | undefined,
  angleDeg: number,
): number => {
  if (!windows || windows.length === 0) return 0
  let best = 0
  for (const w of windows) best = Math.max(best, partialityAt(w, angleDeg))
  return best
}

export type StageWindows = Record<ScanAxis, RockingWindow[]>
