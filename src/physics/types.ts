// Shared domain types for the diffraction planner.

export type CrystalSystem =
  | 'triclinic'
  | 'monoclinic'
  | 'orthorhombic'
  | 'tetragonal'
  | 'trigonal'
  | 'hexagonal'
  | 'cubic'

export interface CellParams {
  // Edge lengths in angstrom.
  a: number
  b: number
  c: number
  // Angles in degrees.
  alpha: number
  beta: number
  gamma: number
}

// Fractional atomic position inside one unit cell.
export interface AtomSite {
  element: string
  label: string
  x: number
  y: number
  z: number
  occupancy: number
  // Isotropic displacement parameter B in A^2.
  bIso: number
}

export type CrystalShape =
  | 'prism'
  | 'plate'
  | 'needle'
  | 'block'
  | 'irregular'

export interface TwinDomain {
  // Twin law as a 3x3 matrix acting on Miller indices (column vectors).
  law: number[][]
  volumeFraction: number
  label: string
}

export interface Sample {
  id: string
  code: string
  name: string
  group: string
  createdAt: number
  cell: CellParams
  spaceGroupNumber: number
  // Goniometer orientation as Euler z-x-z angles, in degrees.
  orientation: { phi: number; kappa: number; omega: number }
  mosaicity: number
  wavelengthSpread: number
  size: { x: number; y: number; z: number }
  shape: CrystalShape
  color: string
  atoms: AtomSite[]
  twins: TwinDomain[]
  notes: string
}

export type ScanAxis = 'omega' | 'phi'

export interface ScanSegment {
  id: string
  axis: ScanAxis
  startDeg: number
  endDeg: number
  stepDeg: number
  exposureSec: number
}

export interface DetectorConfig {
  // Sample-to-detector distance in mm.
  distanceMm: number
  // Direct-beam center in pixel coordinates.
  centerXPx: number
  centerYPx: number
  pixelSizeMm: number
  // Detector 2theta offset in degrees (0 = perpendicular to incident beam).
  twoThetaOffsetDeg: number
  widthPx: number
  heightPx: number
}

export interface BeamConfig {
  wavelengthA: number
  // Air-scatter background level, relative intensity 0..1.
  airScatter: number
  // Beam-stop radius in mm on the detector plane.
  beamStopMm: number
}

export interface Reflection {
  h: number
  k: number
  l: number
  // Reciprocal vector in the crystal Cartesian frame, A^-1.
  rCrystal: [number, number, number]
  // Reciprocal vector in the lab frame at goniometer zero.
  rLab0: [number, number, number]
  // Structure-factor based relative intensity, Friedel-merged.
  intensity: number
  twoThetaDeg: number
  resolutionA: number
  // Rocking windows per stage, populated by the reflection generator.
  windows: { omega?: import('./ewald').RockingWindow[]; phi?: import('./ewald').RockingWindow[] }
  // Twin domain index this reflection belongs to (0 = primary).
  domain: number
}

export interface DetectorSpot {
  reflectionIndex: number
  xPx: number
  yPx: number
  // Spot footprint radius in pixels (mosaicity + wavelength spread).
  radiusPx: number
  partiality: number
  intensity: number
  domain: number
  overlapped: boolean
  h: number
  k: number
  l: number
}
