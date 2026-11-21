// Direct and reciprocal lattice geometry.
//
// Convention: reciprocal vectors are defined WITHOUT the 2*pi factor,
//   a* = (b x c) / V,  so that |r_hkl| = 1/d_hkl.
// Together with wave number k0 = s0 / lambda this makes the Ewald sphere
// equation simply |r - k0|^2 = |k0|^2  <=>  r^2 - 2*r.k0 = 0.

import { CellParams } from './types'
import { Vec3, Mat3, cross, dot, mulMV, normalize, norm } from './math3d'

export const toRad = (d: number) => (d * Math.PI) / 180

// Direct basis vectors in the crystal Cartesian frame (Busing & Levy layout):
// a along +x, b in the xy plane, c placed to satisfy all three angles.
export const directBasis = (cell: CellParams): { a: Vec3; b: Vec3; c: Vec3 } => {
  const { a, b, c, alpha, beta, gamma } = cell
  const al = toRad(alpha)
  const be = toRad(beta)
  const ga = toRad(gamma)

  const av: Vec3 = [a, 0, 0]
  const bv: Vec3 = [b * Math.cos(ga), b * Math.sin(ga), 0]
  const cx = c * Math.cos(be)
  const cy = (c * (Math.cos(al) - Math.cos(be) * Math.cos(ga))) / Math.sin(ga)
  // cz follows from |c|^2 = cx^2 + cy^2 + cz^2.
  const cz = Math.sqrt(Math.max(0, c * c - cx * cx - cy * cy))
  return { a: av, b: bv, c: [cx, cy, cz] }
}

export const cellVolume = (cell: CellParams): number => {
  const { a, b, c } = directBasis(cell)
  return Math.abs(dot(a, cross(b, c)))
}

// Columns of B are a*, b*, c* in the crystal Cartesian frame.
export const reciprocalMatrix = (cell: CellParams): Mat3 => {
  const { a, b, c } = directBasis(cell)
  const v = dot(a, cross(b, c))
  const as = cross(b, c).map((x) => x / v) as Vec3
  const bs = cross(c, a).map((x) => x / v) as Vec3
  const cs = cross(a, b).map((x) => x / v) as Vec3
  return [
    as[0], as[1], as[2],
    bs[0], bs[1], bs[2],
    cs[0], cs[1], cs[2],
  ]
}

export const reciprocalVectorCrystal = (bMatrix: Mat3, h: number, k: number, l: number): Vec3 =>
  mulMV(bMatrix, [h, k, l])

// d-spacing in A for a reflection, given its reciprocal-space length in A^-1.
export const dSpacing = (rLength: number): number => 1 / rLength

// Bragg resolution = d, and 2theta from Bragg's law sin(theta)=lambda/(2d).
export const twoThetaDeg = (rLength: number, wavelengthA: number): number => {
  const sinTheta = (wavelengthA * rLength) / 2
  if (Math.abs(sinTheta) > 1) return Number.NaN
  return (2 * 180 * Math.asin(Math.min(1, Math.max(-1, sinTheta)))) / Math.PI
}

export const resolutionFromTwoTheta = (twoTheta: number, wavelengthA: number): number =>
  wavelengthA / (2 * Math.sin(toRad(twoTheta) / 2))

export interface CellCheck {
  volume: number
  // Reciprocal metric sanity: smallest reciprocal length, A^-1.
  minReciprocal: number
  orthogonalError: number
  warnings: string[]
}

export const checkCell = (cell: CellParams): CellCheck => {
  const warnings: string[] = []
  const bm = reciprocalMatrix(cell)
  const lens = [
    norm(mulMV(bm, [1, 0, 0])),
    norm(mulMV(bm, [0, 1, 0])),
    norm(mulMV(bm, [0, 0, 1])),
  ]
  const v = cellVolume(cell)
  if (!Number.isFinite(v) || v <= 0) warnings.push('晶胞体积非正，参数可能无法构成有效晶胞')
  if (lens.some((x) => !Number.isFinite(x) || x <= 0)) warnings.push('倒易基矢长度异常')
  const { a, b, c } = directBasis(cell)
  const orth = [dot(normalize(a), normalize(b)), dot(normalize(a), normalize(c)), dot(normalize(b), normalize(c))]
  const orthogonalError = Math.max(...orth.map((x) => Math.abs(x)))
  return { volume: v, minReciprocal: Math.min(...lens), orthogonalError, warnings }
}
