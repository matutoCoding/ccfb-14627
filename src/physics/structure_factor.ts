// Structure factors and reflection intensity model.
//
// For a reflection hkl the structure factor is
//   F(hkl) = sum_j f_j(s) * occ_j * exp(-B_j*s^2) * exp(2*pi*i h.r_j)
// over every symmetry-expanded atom in the unit cell. Intensities are
// Friedel-merged (|F|^2 of hkl equals -h -k -l in the demo data) and scaled
// by the Lorentz-polarization factor for an unpolarized beam.

import { AtomSite, Sample } from './types'
import { SpaceGroup, expandSites } from './spacegroup_types'
import { atomicFactor } from './scattering'

const twoPi = 2 * Math.PI

export interface StructureFactor {
  real: number
  imag: number
  magnitude: number
}

// Evaluate F(hkl) with the correct scattering-vector length, Debye-Waller
// factor and full symmetry expansion of the entered sites.
export const structureFactorAt = (
  sg: SpaceGroup,
  atoms: AtomSite[],
  h: number,
  k: number,
  l: number,
  rLength: number,
): StructureFactor => {
  const sinThetaOverLambda = rLength / 2
  const sites = atoms.flatMap((site) => expandSites(sg, site))
  let re = 0
  let im = 0
  for (const site of sites) {
    const f0 = atomicFactor(site.element, sinThetaOverLambda)
    const dw = Math.exp(-site.bIso * sinThetaOverLambda * sinThetaOverLambda)
    const f = f0 * dw * site.occupancy
    const phase = twoPi * (h * site.x + k * site.y + l * site.z)
    re += f * Math.cos(phase)
    im += f * Math.sin(phase)
  }
  return { real: re, imag: im, magnitude: Math.hypot(re, im) }
}

// Lorentz-polarization factor for unpolarized radiation on a four-circle
// instrument, expressed through 2theta only (L absorbed into scan geometry).
export const lorentzPolarization = (twoThetaDeg: number): number => {
  const t = (twoThetaDeg * Math.PI) / 180
  const p = (1 + Math.cos(t) * Math.cos(t)) / 2
  const l = 1 / Math.max(1e-6, Math.sin(t / 2) * Math.sin(t / 2))
  return p * l
}

// Relative intensity used for spot rendering and completeness statistics.
export const reflectionIntensity = (
  sample: Sample,
  sg: SpaceGroup,
  h: number,
  k: number,
  l: number,
  rLength: number,
  twoThetaDeg: number,
): number => {
  if (sample.atoms.length === 0) {
    // No atomic model: unit-weight reflections so geometry is still testable.
    return 1
  }
  const f = structureFactorAt(sg, sample.atoms, h, k, l, rLength)
  return f.magnitude * f.magnitude * lorentzPolarization(twoThetaDeg)
}
