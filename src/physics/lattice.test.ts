import { describe, expect, it } from 'vitest'
import {
  directBasis, reciprocalMatrix, cellVolume, twoThetaDeg, checkCell,
} from './lattice'
import { mulMV, norm, angleBetween } from './math3d'
import { CellParams } from './types'

const cubic: CellParams = { a: 10, b: 10, c: 10, alpha: 90, beta: 90, gamma: 90 }
const monoclinic: CellParams = { a: 10, b: 8, c: 12, alpha: 90, beta: 105, gamma: 90 }

describe('direct lattice basis', () => {
  it('places a on +x and b in the xy plane', () => {
    const { a, b, c } = directBasis(cubic)
    expect(a[1]).toBeCloseTo(0, 12)
    expect(a[2]).toBeCloseTo(0, 12)
    expect(b[2]).toBeCloseTo(0, 12)
    expect(norm(c)).toBeCloseTo(10, 10)
  })

  it('reproduces edge lengths and angles for a monoclinic cell', () => {
    const { a, b, c } = directBasis(monoclinic)
    expect(norm(a)).toBeCloseTo(10, 10)
    expect(norm(b)).toBeCloseTo(8, 10)
    expect(norm(c)).toBeCloseTo(12, 10)
    expect((angleBetween(a, c) * 180) / Math.PI).toBeCloseTo(105, 9)
    expect((angleBetween(a, b) * 180) / Math.PI).toBeCloseTo(90, 9)
    expect((angleBetween(b, c) * 180) / Math.PI).toBeCloseTo(90, 9)
  })

  it('keeps reciprocal orthogonality a.a* = 1 and a.b* = 0', () => {
    const basis = directBasis(monoclinic)
    const bm = reciprocalMatrix(monoclinic)
    const astar = mulMV(bm, [1, 0, 0])
    const bstar = mulMV(bm, [0, 1, 0])
    const cstar = mulMV(bm, [0, 0, 1])
    expect(basis.a.reduce((s, v, i) => s + v * astar[i], 0)).toBeCloseTo(1, 10)
    expect(basis.b.reduce((s, v, i) => s + v * astar[i], 0)).toBeCloseTo(0, 10)
    expect(basis.a.reduce((s, v, i) => s + v * bstar[i], 0)).toBeCloseTo(0, 10)
    expect(basis.c.reduce((s, v, i) => s + v * cstar[i], 0)).toBeCloseTo(1, 10)
  })

  it('matches hand calculation for the cubic reciprocal length', () => {
    const bm = reciprocalMatrix(cubic)
    // |r_100| = 1/a = 0.1 A^-1; |r_111| = sqrt(3)/a.
    expect(norm(mulMV(bm, [1, 0, 0]))).toBeCloseTo(0.1, 12)
    expect(norm(mulMV(bm, [1, 1, 1]))).toBeCloseTo(Math.sqrt(3) / 10, 12)
  })

  it('computes volume as a*b*c*sin(beta) in the monoclinic case', () => {
    const expected = 10 * 8 * 12 * Math.sin((105 * Math.PI) / 180)
    expect(cellVolume(monoclinic)).toBeCloseTo(expected, 8)
  })
})

describe('bragg geometry', () => {
  it('reproduces Bragg law 2theta = 2 asin(lambda/2d)', () => {
    const d = 5
    const lambda = 1
    const r = 1 / d
    const expected = (2 * Math.asin(lambda / (2 * d)) * 180) / Math.PI
    expect(twoThetaDeg(r, lambda)).toBeCloseTo(expected, 10)
  })

  it('flags reflections outside the Ewald sphere as NaN', () => {
    expect(Number.isNaN(twoThetaDeg(3, 1))).toBe(true)
  })
})

describe('cell validation', () => {
  it('accepts a valid cell without warnings', () => {
    expect(checkCell(cubic).warnings).toHaveLength(0)
  })

  it('rejects a degenerate cell with non-positive volume', () => {
    const bad = checkCell({ ...cubic, a: 0 })
    expect(bad.warnings.length).toBeGreaterThan(0)
  })
})
