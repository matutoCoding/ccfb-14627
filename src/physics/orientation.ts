// Orientation matrix and goniometer geometry.
//
// Laboratory frame (right-handed):
//   X = horizontal, toward the detector's +x pixel direction
//   Y = vertical up
//   Z = incident beam direction (X-rays travel +Z toward the sample)
// Detector plane at z = distance, normal parallel Z when 2theta offset = 0.
//
// Goniometer: Eulerian cradle with angles (phi, kappa, omega), applied as
// intrinsic z-x-z: R_gon(phi,kap,om) = Rz(phi) Rx(kap) Rz(om).
// A reciprocal vector r_c in the crystal Cartesian frame appears in the lab
// as r_lab(om,phi) = R_gon(...) U r_c. With kappa fixed, rotating omega or
// phi rotates r_lab around a fixed lab axis derived below.

import { Mat3, Vec3, eulerZXZ, mulMV, rotAxis, identity3, mulM } from './math3d'

// U: crystal Cartesian frame -> lab frame at goniometer zero.
export const orientationMatrix = (phi: number, kappa: number, omega: number): Mat3 =>
  eulerZXZ((phi * Math.PI) / 180, (kappa * Math.PI) / 180, (omega * Math.PI) / 180)

export const labAtZero = (u: Mat3, rCrystal: Vec3): Vec3 => mulMV(u, rCrystal)

// Fixed lab-space rotation axis for a goniometer stage angle.
// omega (spindle): axis Rz(phi) Rx(kappa) e_z, tilted off the beam.
// phi (kappa arm): axis Rx(kappa) e_z in the arm's zero-azimuth frame,
// also tilted when kappa != 0, so both stages can sweep Ewald crossings.
export const stageAxis = (
  phiDeg: number,
  kappaDeg: number,
  stage: 'omega' | 'phi',
): Vec3 => {
  const kap = (kappaDeg * Math.PI) / 180
  const armAxis: Vec3 = [0, Math.sin(kap), Math.cos(kap)]
  if (stage === 'phi') return armAxis
  const phi = (phiDeg * Math.PI) / 180
  return mulMV(rotAxis([0, 0, 1], phi), armAxis)
}

// Rotation of the lab reciprocal vector when one stage moves by deltaDeg,
// holding every other angle fixed.
export const rotateByStage = (
  rLab0: Vec3,
  phiDeg: number,
  kappaDeg: number,
  stage: 'omega' | 'phi',
  deltaDeg: number,
): Vec3 => mulMV(rotAxis(stageAxis(phiDeg, kappaDeg, stage), (deltaDeg * Math.PI) / 180), rLab0)

// Full goniometer rotation relative to the stored zero-orientation frame.
// The zero frame already includes the sample's U matrix.
export const goniometerRotation = (
  phi0Deg: number,
  kappaDeg: number,
  omega0Deg: number,
  stage: 'omega' | 'phi',
  angleDeg: number,
): Mat3 => {
  if (stage === 'omega') {
    const base = eulerZXZ(
      (phi0Deg * Math.PI) / 180,
      (kappaDeg * Math.PI) / 180,
      (omega0Deg * Math.PI) / 180,
    )
    return mulM(base, rotAxis([0, 0, 1], ((angleDeg - omega0Deg) * Math.PI) / 180))
  }
  const base = eulerZXZ(
    (phi0Deg * Math.PI) / 180,
    (kappaDeg * Math.PI) / 180,
    (omega0Deg * Math.PI) / 180,
  )
  return mulM(rotAxis([0, 0, 1], ((angleDeg - phi0Deg) * Math.PI) / 180), base)
}

export const noRotation = identity3
