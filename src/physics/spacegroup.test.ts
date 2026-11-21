import { describe, expect, it } from 'vitest'
import { spaceGroups, spaceGroupByNumber, closureFromGenerators } from './spacegroup_registry'
import { isSystematicallyAbsent, expandSites } from './spacegroup_types'

describe('space group registry', () => {
  it('covers the common service-laboratory groups', () => {
    expect(spaceGroups.length).toBeGreaterThanOrEqual(30)
    const numbers = spaceGroups.map((g) => g.number)
    for (const n of [1, 2, 4, 14, 19, 61, 136, 148, 194, 225, 227, 229]) {
      expect(numbers).toContain(n)
    }
  })

  it('enforces F-centering absences in Fm-3m (NaCl)', () => {
    const sg = spaceGroupByNumber(225)
    // Mixed parity must all be absent.
    expect(isSystematicallyAbsent(sg, 1, 0, 0)).toBe(true)
    expect(isSystematicallyAbsent(sg, 1, 1, 0)).toBe(true)
    expect(isSystematicallyAbsent(sg, 2, 1, 0)).toBe(true)
    expect(isSystematicallyAbsent(sg, 3, 2, 0)).toBe(true)
    // All-even / all-odd survive.
    expect(isSystematicallyAbsent(sg, 1, 1, 1)).toBe(false)
    expect(isSystematicallyAbsent(sg, 2, 0, 0)).toBe(false)
    expect(isSystematicallyAbsent(sg, 2, 2, 0)).toBe(false)
    expect(isSystematicallyAbsent(sg, 4, 2, 2)).toBe(false)
  })

  it('enforces I-centering: h+k+l must be even', () => {
    const sg = spaceGroupByNumber(229)
    expect(isSystematicallyAbsent(sg, 1, 0, 0)).toBe(true)
    expect(isSystematicallyAbsent(sg, 1, 1, 0)).toBe(false)
    expect(isSystematicallyAbsent(sg, 2, 1, 1)).toBe(false)
  })

  it('enforces the P21 screw rule 0k0: k = 2n', () => {
    const sg = spaceGroupByNumber(4)
    expect(isSystematicallyAbsent(sg, 0, 1, 0)).toBe(true)
    expect(isSystematicallyAbsent(sg, 0, 2, 0)).toBe(false)
    expect(isSystematicallyAbsent(sg, 1, 1, 0)).toBe(false)
  })

  it('enforces P21/c zonal rules including h0l with l even', () => {
    const sg = spaceGroupByNumber(14)
    expect(isSystematicallyAbsent(sg, 0, 1, 0)).toBe(true)
    expect(isSystematicallyAbsent(sg, 1, 0, 1)).toBe(true)
    expect(isSystematicallyAbsent(sg, 1, 0, 2)).toBe(false)
  })

  it('enforces rutile P42/mnm axial rules', () => {
    const sg = spaceGroupByNumber(136)
    expect(isSystematicallyAbsent(sg, 1, 0, 0)).toBe(true)
    expect(isSystematicallyAbsent(sg, 2, 0, 0)).toBe(false)
    expect(isSystematicallyAbsent(sg, 1, 1, 0)).toBe(true)
    expect(isSystematicallyAbsent(sg, 2, 2, 0)).toBe(false)
  })

  it('handles R-centering with the obverse -h+k+l = 3n condition', () => {
    const sg = spaceGroupByNumber(148)
    expect(isSystematicallyAbsent(sg, 1, 0, 0)).toBe(true)
    expect(isSystematicallyAbsent(sg, 1, 1, 0)).toBe(false)
    expect(isSystematicallyAbsent(sg, 0, 0, 3)).toBe(false)
  })

  it('never marks an origin reflection as absent', () => {
    for (const sg of spaceGroups) {
      expect(isSystematicallyAbsent(sg, 0, 0, 0)).toBe(false)
    }
  })
})

describe('symmetry closure and site expansion', () => {
  it('closes P-1 inversion into exactly two operations', () => {
    const sg = spaceGroupByNumber(2)
    // Identity plus inversion.
    expect(sg.symops.length + 1).toBe(2)
  })

  it('closes P212121 into the full four general positions', () => {
    const sg = spaceGroupByNumber(19)
    expect(sg.symops.length + 1).toBe(4)
  })

  it('reproduces the known general-position multiplicity of core groups', () => {
    // Only groups whose full general positions are embedded exactly are
    // pinned. Others are validated through their absence rules alone.
    const expectedOrders: Record<number, number> = {
      1: 1, 2: 2, 3: 2, 4: 2, 5: 4, 10: 4, 11: 4, 12: 8, 13: 4, 14: 4, 15: 8,
      19: 4, 29: 4, 33: 4, 61: 8, 62: 8, 74: 8, 75: 4, 76: 4, 78: 4, 79: 8,
      83: 8, 87: 16, 139: 32,
      146: 9, 148: 18, 167: 18, 168: 6, 176: 12,
      200: 48, 225: 192, 227: 192, 229: 96,
    }
    for (const sg of spaceGroups) {
      const expected = expectedOrders[sg.number]
      if (expected === undefined) continue
      expect(sg.symops.length + 1, `SG ${sg.number} ${sg.symbol}`).toBe(expected)
    }
  })

  it('closes Fm-3m into the full 192 general positions', () => {
    const sg = spaceGroupByNumber(225)
    // m-3m order 48 times F centering x4.
    expect(sg.symops.length + 1).toBe(192)
  })

  it('expands a P21 site into two unique positions', () => {
    const sg = spaceGroupByNumber(4)
    const sites = expandSites(sg, {
      element: 'C', label: 'C1', x: 0.2, y: 0.3, z: 0.4, occupancy: 1, bIso: 1,
    })
    expect(sites).toHaveLength(2)
    const second = sites[1]
    // P21 unique b: (-x, y+1/2, -z) wrapped into [0,1).
    expect(second.x).toBeCloseTo(0.8, 4)
    expect(second.y).toBeCloseTo(0.8, 4)
    expect(second.z).toBeCloseTo(0.6, 4)
  })

  it('closure generator never emits duplicate identity rows', () => {
    const ops = closureFromGenerators(
      [[-1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0]],
      [],
    )
    expect(ops).toHaveLength(1)
  })
})
