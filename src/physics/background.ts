// Detector background model: air-scatter radial profile plus the beam-stop
// shadow. Everything is analytic so frame generation stays deterministic.

import { BeamConfig, DetectorConfig } from './types'
import { panelFrame } from './detector'

export interface BackgroundSample {
  // Background count level at this pixel, normalized to 0..1.
  level: number
  beamStop: boolean
  radialMm: number
}

// Air scatter falls off with scattering angle; a broad radial exponential
// reproduces the characteristic bright ring near the beam stop.
export const sampleBackground = (
  xPx: number,
  yPx: number,
  det: DetectorConfig,
  beam: BeamConfig,
): BackgroundSample => {
  const dx = (xPx - det.centerXPx) * det.pixelSizeMm
  const dy = (det.centerYPx - yPx) * det.pixelSizeMm
  const radialMm = Math.hypot(dx, dy)
  const beamStop = radialMm <= beam.beamStopMm

  const t = Math.atan(radialMm / det.distanceMm)
  const air = beam.airScatter * Math.exp(-t / 0.12) * (0.85 + 0.15 * Math.cos(t * 40))
  const floor = beam.airScatter * 0.08
  return {
    level: beamStop ? 0 : Math.min(1, air + floor),
    beamStop,
    radialMm,
  }
}

// Static background canvas data for the detector renderer; rendered once per
// configuration change, never per timeline frame.
export const buildBackgroundField = (
  det: DetectorConfig,
  beam: BeamConfig,
): Float32Array => {
  const frame = panelFrame(det)
  void frame
  const data = new Float32Array(det.widthPx * det.heightPx)
  // Full pixel grids are expensive; callers downsample via the stride helper.
  for (let y = 0; y < det.heightPx; y++) {
    for (let x = 0; x < det.widthPx; x++) {
      data[y * det.widthPx + x] = sampleBackground(x + 0.5, y + 0.5, det, beam).level
    }
  }
  return data
}

// Coarse field used by the WebGL renderer as a procedural texture source.
export const buildCoarseBackground = (
  det: DetectorConfig,
  beam: BeamConfig,
  stride = 4,
): { width: number; height: number; data: Float32Array } => {
  const width = Math.ceil(det.widthPx / stride)
  const height = Math.ceil(det.heightPx / stride)
  const data = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = Math.min(det.widthPx - 1, x * stride + stride / 2)
      const py = Math.min(det.heightPx - 1, y * stride + stride / 2)
      data[y * width + x] = sampleBackground(px, py, det, beam).level
    }
  }
  return { width, height, data }
}
