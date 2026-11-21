// Flat-panel detector projection.
//
// Detector frame at 2theta offset t (rotation about the lab Y axis):
//   panel normal  n_d = (sin t, 0, cos t)
//   panel +x axis e_x = (cos t, 0, -sin t)
//   panel +y axis e_y = (0, 1, 0)
// A diffracted ray k_out from the origin hits the panel at parameter
// p = d / (k_hat . n_d); panel coords are x = p(k_hat.e_x), y = p(k_hat.e_y).
// Pixel origin is the panel top-left, direct beam at (centerX, centerY).

import { BeamConfig, DetectorConfig, DetectorSpot, Reflection } from './types'
import { Vec3, deg2rad, mulMV, rotAxis } from './math3d'
import { EwaldOptions, reflectionPartiality } from './ewald'
import { ScanAxis } from './types'
import { stageAxis } from './orientation'

export interface PanelFrame {
  normal: Vec3
  axisX: Vec3
  axisY: Vec3
}

export const panelFrame = (det: DetectorConfig): PanelFrame => {
  const t = deg2rad(det.twoThetaOffsetDeg)
  return {
    normal: [Math.sin(t), 0, Math.cos(t)],
    axisX: [Math.cos(t), 0, -Math.sin(t)],
    axisY: [0, 1, 0],
  }
}

export interface ProjectedPoint {
  xMm: number
  yMm: number
  xPx: number
  yPx: number
  onPanel: boolean
  // Incidence obliquity factor, 1 for normal incidence.
  obliquity: number
}

// Project a diffracted direction onto the panel. Directions pointing away
// from the panel (dot with normal <= 0) are reported as off-panel.
export const projectRay = (kOut: Vec3, det: DetectorConfig): ProjectedPoint => {
  const frame = panelFrame(det)
  const kLen = Math.hypot(kOut[0], kOut[1], kOut[2])
  const kHat: Vec3 = [kOut[0] / kLen, kOut[1] / kLen, kOut[2] / kLen]
  const cosInc = kHat[0] * frame.normal[0] + kHat[2] * frame.normal[2]
  if (cosInc <= 1e-9) {
    return { xMm: 0, yMm: 0, xPx: 0, yPx: 0, onPanel: false, obliquity: 0 }
  }
  const p = det.distanceMm / cosInc
  const xMm = p * (kHat[0] * frame.axisX[0] + kHat[2] * frame.axisX[2])
  const yMm = p * kHat[1]
  const px = det.pixelSizeMm
  const xPx = det.centerXPx + xMm / px
  const yPx = det.centerYPx - yMm / px
  const onPanel =
    xPx >= 0 && xPx <= det.widthPx && yPx >= 0 && yPx <= det.heightPx
  return { xMm, yMm, xPx, yPx, onPanel, obliquity: 1 / cosInc }
}

// Rotate a reflection's zero-frame reciprocal vector to the current angle.
export const rotatedReciprocal = (
  refl: Reflection,
  stage: ScanAxis,
  stageAngleDeg: number,
  phi0Deg: number,
  kappaDeg: number,
  omega0Deg: number,
): Vec3 => {
  const r0 = refl.rLab0 as Vec3
  if (stage === 'omega') {
    const delta = stageAngleDeg - omega0Deg
    const axis = stageAxis(phi0Deg, kappaDeg, 'omega')
    return mulMV(rotAxis(axis, deg2rad(delta)), r0)
  }
  const delta = stageAngleDeg - phi0Deg
  return mulMV(rotAxis(stageAxis(phi0Deg, kappaDeg, 'phi'), deg2rad(delta)), r0)
}

const omegaAxis = (phiDeg: number, kappaDeg: number): Vec3 =>
  stageAxis(phiDeg, kappaDeg, 'omega')

export const diffractedDirection = (rLab: Vec3, beam: BeamConfig): Vec3 => {
  const k0: Vec3 = [0, 0, 1 / beam.wavelengthA]
  return [k0[0] + rLab[0], k0[1] + rLab[1], k0[2] + rLab[2]]
}

// Spot footprint radius in pixels from mosaicity and wavelength dispersion.
// Geometric source: angular rocking width mapped through sample distance,
// plus a minimum pixel footprint to keep sub-pixel spots visible.
export const spotRadiusPx = (
  refl: Reflection,
  det: DetectorConfig,
  opt: EwaldOptions,
): number => {
  const fwhmDeg =
    refl.windows.omega && refl.windows.omega.length > 0
      ? refl.windows.omega[0].widthDeg / 2
      : opt.mosaicityDeg
  const angularRadiusMm = Math.tan(deg2rad(fwhmDeg)) * det.distanceMm
  const radius = angularRadiusMm / det.pixelSizeMm
  return Math.max(1.2, radius)
}

export interface SpotFrameInput {
  reflections: Reflection[]
  det: DetectorConfig
  beam: BeamConfig
  ewald: EwaldOptions
  stage: ScanAxis
  stageAngleDeg: number
  phi0Deg: number
  kappaDeg: number
  omega0Deg: number
}

// Build the detector spot list for one frame. Reflection identities and
// ordering never change between frames; only position/partiality update,
// which is what keeps the timeline free of flicker and index jumps.
export const buildFrameSpots = (input: SpotFrameInput): DetectorSpot[] => {
  const {
    reflections,
    det,
    beam,
    ewald,
    stage,
    stageAngleDeg,
    phi0Deg,
    kappaDeg,
    omega0Deg,
  } = input
  const spots: DetectorSpot[] = []

  reflections.forEach((refl, i) => {
    const p = reflectionPartiality(
      stage === 'omega' ? refl.windows.omega : refl.windows.phi,
      stageAngleDeg,
    )
    if (p <= 0) return
    const rLab = rotatedReciprocal(refl, stage, stageAngleDeg, phi0Deg, kappaDeg, omega0Deg)
    const kOut = diffractedDirection(rLab, beam)
    const proj = projectRay(kOut, det)
    if (!proj.onPanel) return

    spots.push({
      reflectionIndex: i,
      xPx: proj.xPx,
      yPx: proj.yPx,
      radiusPx: spotRadiusPx(refl, det, ewald),
      partiality: p,
      intensity: refl.intensity * p,
      domain: refl.domain,
      overlapped: false,
      h: refl.h,
      k: refl.k,
      l: refl.l,
    })
  })

  markOverlaps(spots)
  return spots
}

// Spots from different twin domains whose footprints overlap are flagged so
// the renderer can give them a distinct marker.
const markOverlaps = (spots: DetectorSpot[]): void => {
  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) {
      if (spots[i].domain === spots[j].domain) continue
      const dx = spots[i].xPx - spots[j].xPx
      const dy = spots[i].yPx - spots[j].yPx
      const touch = spots[i].radiusPx + spots[j].radiusPx
      if (dx * dx + dy * dy <= touch * touch) {
        spots[i].overlapped = true
        spots[j].overlapped = true
      }
    }
  }
}
