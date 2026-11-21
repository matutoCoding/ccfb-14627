// Reflection table generation.
//
// The table is built once per sample/beam configuration and cached. Every
// reflection keeps its index and slot for the whole session, which is what
// lets the detector renderer update positions in place on the timeline.

import { BeamConfig, Reflection, Sample, TwinDomain } from './types'
import { reciprocalMatrix, reciprocalVectorCrystal, twoThetaDeg } from './lattice'
import { orientationMatrix, labAtZero, stageAxis } from './orientation'
import { spaceGroupByNumber } from './spacegroup_registry'
import { isSystematicallyAbsent } from './spacegroup_types'
import { EwaldOptions, rockingWindows } from './ewald'
import { reflectionIntensity } from './structure_factor'
import { Mat3, Vec3, mulMV, norm } from './math3d'

export interface GenerationOptions {
  beam: BeamConfig
  ewald: EwaldOptions
  // Reflection sphere radius margin beyond the Ewald sphere, in A^-1.
  marginAInv?: number
  maxIndices?: number
  includeTwins?: boolean
}

export interface ReflectionTable {
  reflections: Reflection[]
  // Per-stage rotation axes in the lab frame, shared by every reflection.
  omegaAxis: Vec3
  phiAxis: Vec3
  uniqueCount: number
  absentCount: number
}

const millerBounds = (bMatrix: Mat3, rLimit: number, hardCap: number): number => {
  // Each reciprocal basis length gives a safe per-axis index bound.
  const lens = [
    norm(mulMV(bMatrix, [1, 0, 0])),
    norm(mulMV(bMatrix, [0, 1, 0])),
    norm(mulMV(bMatrix, [0, 0, 1])),
  ]
  const bound = Math.ceil(rLimit / Math.min(...lens)) + 1
  return Math.min(bound, hardCap)
}

const buildDomain = (
  sample: Sample,
  domainIndex: number,
  twin: TwinDomain | null,
  beam: BeamConfig,
  ewald: EwaldOptions,
  marginAInv: number,
  hardCap: number,
): { reflections: Reflection[]; absentCount: number } => {
  const sg = spaceGroupByNumber(sample.spaceGroupNumber)
  const bMatrix = reciprocalMatrix(sample.cell)
  const u = orientationMatrix(
    sample.orientation.phi,
    sample.orientation.kappa,
    sample.orientation.omega,
  )
  const rLimit = 2 / beam.wavelengthA + marginAInv
  const bound = millerBounds(bMatrix, rLimit, hardCap)
  const law = twin ? twin.law : null
  const out: Reflection[] = []
  let absentCount = 0

  for (let h = -bound; h <= bound; h++) {
    for (let k = -bound; k <= bound; k++) {
      for (let l = -bound; l <= bound; l++) {
        if (h === 0 && k === 0 && l === 0) continue
        // Twin law maps the Miller indices of the secondary lattice.
        const hkl: Vec3 = law
          ? (mulMV(law.flat() as unknown as Mat3, [h, k, l]).map(Math.round) as Vec3)
          : [h, k, l]
        if (isSystematicallyAbsent(sg, hkl[0], hkl[1], hkl[2])) {
          absentCount++
          continue
        }
        const rCrystal = reciprocalVectorCrystal(bMatrix, hkl[0], hkl[1], hkl[2])
        const rLength = norm(rCrystal)
        if (rLength > rLimit) continue
        const twoTheta = twoThetaDeg(rLength, beam.wavelengthA)
        if (Number.isNaN(twoTheta)) continue
        const rLab0 = labAtZero(u, rCrystal)
        const intensity =
          reflectionIntensity(sample, sg, hkl[0], hkl[1], hkl[2], rLength, twoTheta) *
          (twin ? twin.volumeFraction : 1)

        out.push({
          h: hkl[0],
          k: hkl[1],
          l: hkl[2],
          rCrystal: [rCrystal[0], rCrystal[1], rCrystal[2]],
          rLab0: [rLab0[0], rLab0[1], rLab0[2]],
          intensity,
          twoThetaDeg: twoTheta,
          resolutionA: 1 / rLength,
          windows: {},
          domain: domainIndex,
        })
      }
    }
  }
  return { reflections: out, absentCount }
}

export const generateReflections = (
  sample: Sample,
  options: GenerationOptions,
): ReflectionTable => {
  const { beam, ewald } = options
  const margin = options.marginAInv ?? 0.05
  const hardCap = options.maxIndices ?? 24

  const primary = buildDomain(sample, 0, null, beam, ewald, margin, hardCap)
  let all = primary.reflections
  let absent = primary.absentCount

  if (options.includeTwins !== false) {
    sample.twins.forEach((twin, i) => {
      const secondary = buildDomain(sample, i + 1, twin, beam, ewald, margin, hardCap)
      all = all.concat(secondary.reflections)
      absent += secondary.absentCount
    })
  }

  const omegaAxis = stageAxis(sample.orientation.phi, sample.orientation.kappa, 'omega')
  const phiAxis = stageAxis(sample.orientation.phi, sample.orientation.kappa, 'phi')
  for (const refl of all) {
    refl.windows.omega = rockingWindows(
      refl.rLab0 as Vec3,
      refl.twoThetaDeg,
      omegaAxis,
      ewald,
    )
    refl.windows.phi = rockingWindows(refl.rLab0 as Vec3, refl.twoThetaDeg, phiAxis, ewald)
  }

  return {
    reflections: all,
    omegaAxis,
    phiAxis,
    uniqueCount: new Set(all.map((r) => `${r.h},${r.k},${r.l}`)).size,
    absentCount: absent,
  }
}
