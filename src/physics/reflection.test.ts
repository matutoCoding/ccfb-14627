import { describe, expect, it } from 'vitest'
import { generateReflections } from './reflection'
import { structureFactorAt } from './structure_factor'
import { spaceGroupByNumber } from './spacegroup_registry'
import { reciprocalMatrix } from './lattice'
import { demoSamples } from '@/data/demo_samples'
import { BeamConfig } from './types'
import { evaluateStrategy } from './strategy'
import { optimizeStrategy } from './auto_strategy'
import { mulMV, norm } from './math3d'

const beam: BeamConfig = { wavelengthA: 0.71073, airScatter: 0.1, beamStopMm: 3 }

describe('reflection generation', () => {
  it('produces no systematically absent reflection for NaCl', () => {
    const sample = demoSamples.find((s) => s.id === 'demo-nacl')!
    const table = generateReflections(sample, {
      beam,
      ewald: { wavelengthA: beam.wavelengthA, mosaicityDeg: 0.25, wavelengthSpread: 0.0008 },
      maxIndices: 12,
    })
    expect(table.reflections.length).toBeGreaterThan(100)
    for (const r of table.reflections) {
      const parity = [r.h, r.k, r.l].map((v) => v % 2 === 0)
      const unmixed = parity.every((p) => p === parity[0])
      expect(unmixed).toBe(true)
    }
    expect(table.absentCount).toBeGreaterThan(0)
  })

  it('attaches omega and phi rocking windows to every reflection', () => {
    const sample = demoSamples.find((s) => s.id === 'demo-rutile')!
    const table = generateReflections(sample, {
      beam,
      ewald: { wavelengthA: beam.wavelengthA, mosaicityDeg: 0.18, wavelengthSpread: 0.0007 },
      maxIndices: 12,
    })
    for (const r of table.reflections) {
      // A tilted kappa axis gives essentially every reflection a window;
      // only exact axis-parallel degeneracies can produce none.
      expect((r.windows.omega?.length ?? 0) + (r.windows.phi?.length ?? 0)).toBeGreaterThan(0)
    }
    const withOmega = table.reflections.filter((r) => (r.windows.omega?.length ?? 0) > 0).length
    expect(withOmega / table.reflections.length).toBeGreaterThan(0.95)
  })

  it('includes a separate twin domain and preserves reflection identity', () => {
    const sample = demoSamples.find((s) => s.id === 'demo-twin')!
    const table = generateReflections(sample, {
      beam,
      ewald: { wavelengthA: beam.wavelengthA, mosaicityDeg: 0.4, wavelengthSpread: 0.0012 },
      maxIndices: 10,
    })
    const domains = new Set(table.reflections.map((r) => r.domain))
    expect(domains.has(0)).toBe(true)
    expect(domains.has(1)).toBe(true)
    const primary = table.reflections.filter((r) => r.domain === 0)
    const secondary = table.reflections.filter((r) => r.domain === 1)
    expect(secondary.length).toBeGreaterThan(0)
    // A twin law is a bijection on Miller indices, so both domains enumerate
    // the same number of reflections; they only differ in orientation/intensity.
    expect(secondary.length).toBe(primary.length)
    // And the secondary intensity is scaled down by its volume fraction.
    const primInt = primary.reduce((a, r) => a + r.intensity, 0)
    const secInt = secondary.reduce((a, r) => a + r.intensity, 0)
    expect(secInt).toBeLessThan(primInt)
  })

  it('resolution of every generated reflection matches 1/|r|', () => {
    const sample = demoSamples.find((s) => s.id === 'demo-sucrose')!
    const table = generateReflections(sample, {
      beam,
      ewald: { wavelengthA: beam.wavelengthA, mosaicityDeg: 0.35, wavelengthSpread: 0.001 },
      maxIndices: 8,
    })
    const bm = reciprocalMatrix(sample.cell)
    for (const r of table.reflections.slice(0, 50)) {
      const rlen = norm(mulMV(bm, [r.h, r.k, r.l]))
      expect(r.resolutionA).toBeCloseTo(1 / rlen, 9)
    }
  })
})

describe('structure factor', () => {
  it('gives NaCl 111 a weaker intensity than 200 due to basis interference', () => {
    const sample = demoSamples.find((s) => s.id === 'demo-nacl')!
    const sg = spaceGroupByNumber(225)
    const bm = reciprocalMatrix(sample.cell)
    const f111 = structureFactorAt(sg, sample.atoms, 1, 1, 1, norm(mulMV(bm, [1, 1, 1])))
    const f200 = structureFactorAt(sg, sample.atoms, 2, 0, 0, norm(mulMV(bm, [2, 0, 0])))
    // Rock salt: 111 sees Na and Cl contributions oppose, 200 they add.
    expect(f200.magnitude).toBeGreaterThan(f111.magnitude)
  })

  it('returns unit magnitude behavior for a model without atoms', () => {
    const sample = { ...demoSamples[0], atoms: [] }
    const table = generateReflections(sample, {
      beam,
      ewald: { wavelengthA: beam.wavelengthA, mosaicityDeg: 0.2, wavelengthSpread: 0.001 },
      maxIndices: 6,
    })
    expect(table.reflections.every((r) => r.intensity === 1)).toBe(true)
  })
})

describe('strategy evaluation and optimizer', () => {
  it('full 360 degree omega sweep reaches high completeness', () => {
    const sample = demoSamples.find((s) => s.id === 'demo-rutile')!
    const table = generateReflections(sample, {
      beam,
      ewald: { wavelengthA: beam.wavelengthA, mosaicityDeg: 0.18, wavelengthSpread: 0.0007 },
      maxIndices: 12,
    })
    const stats = evaluateStrategy(
      table.reflections,
      [{ id: 'full', axis: 'omega', startDeg: -180, endDeg: 180, stepDeg: 0.5, exposureSec: 1 }],
      0.8,
    )
    expect(stats.completeness).toBeGreaterThan(0.9)
  })

  it('optimizer reaches the requested target with bounded segments', () => {
    const sample = demoSamples.find((s) => s.id === 'demo-rutile')!
    const table = generateReflections(sample, {
      beam,
      ewald: { wavelengthA: beam.wavelengthA, mosaicityDeg: 0.18, wavelengthSpread: 0.0007 },
      maxIndices: 12,
    })
    const segments = optimizeStrategy({
      reflections: table.reflections,
      resolutionLimitA: 0.8,
      targetCompleteness: 0.9,
      sweepWidthDeg: 90,
      candidateStepDeg: 15,
      defaultFrameStepDeg: 0.5,
      defaultExposureSec: 1,
      maxSegments: 6,
    })
    expect(segments.length).toBeGreaterThan(0)
    expect(segments.length).toBeLessThanOrEqual(6)
    const stats = evaluateStrategy(table.reflections, segments, 0.8)
    expect(stats.completeness).toBeGreaterThan(0.85)
  })
})
