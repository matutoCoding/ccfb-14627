// Built-in demo crystals spanning simple salts, inorganic oxides and large
// organic cells. Atom coordinates use conventional settings; symmetry
// expansion produces the full unit cell at runtime.

import { Sample, DetectorConfig, BeamConfig } from '@/physics/types'

export const defaultBeam: BeamConfig = {
  wavelengthA: 0.71073, // Mo K-alpha
  airScatter: 0.18,
  beamStopMm: 3.2,
}

export const defaultDetector: DetectorConfig = {
  distanceMm: 60,
  centerXPx: 512,
  centerYPx: 512,
  pixelSizeMm: 0.075,
  twoThetaOffsetDeg: 0,
  widthPx: 1024,
  heightPx: 1024,
}

const now = Date.now()

// 1. NaCl, Fm-3m (No.225): classic F-centering extinction teaching case.
const nacl: Sample = {
  id: 'demo-nacl',
  code: 'NaCl-001',
  name: '氯化钠（岩盐结构）',
  group: '无机化学课题组',
  createdAt: now,
  cell: { a: 5.6402, b: 5.6402, c: 5.6402, alpha: 90, beta: 90, gamma: 90 },
  spaceGroupNumber: 225,
  orientation: { phi: 0, kappa: 54.7, omega: 0 },
  mosaicity: 0.25,
  wavelengthSpread: 0.0008,
  size: { x: 0.22, y: 0.18, z: 0.2 },
  shape: 'block',
  color: '#7dd3fc',
  atoms: [
    { element: 'Na', label: 'Na1', x: 0, y: 0, z: 0, occupancy: 1, bIso: 1.2 },
    { element: 'Cl', label: 'Cl1', x: 0.5, y: 0, z: 0, occupancy: 1, bIso: 1.4 },
  ],
  twins: [],
  notes: 'F 点阵消光教学样：hkl 奇偶混合时全部缺席。',
}

// 2. Rutile TiO2, P42/mnm (No.136): tetragonal, screw-axis absences.
const rutile: Sample = {
  id: 'demo-rutile',
  code: 'TiO2-014',
  name: '金红石型二氧化钛',
  group: '材料学院 X 射线组',
  createdAt: now - 86400000,
  cell: { a: 4.5937, b: 4.5937, c: 2.9587, alpha: 90, beta: 90, gamma: 90 },
  spaceGroupNumber: 136,
  orientation: { phi: 12, kappa: 54.7, omega: 0 },
  mosaicity: 0.18,
  wavelengthSpread: 0.0007,
  size: { x: 0.15, y: 0.12, z: 0.3 },
  shape: 'prism',
  color: '#fcd34d',
  atoms: [
    { element: 'Ti', label: 'Ti1', x: 0, y: 0, z: 0, occupancy: 1, bIso: 0.6 },
    { element: 'O', label: 'O1', x: 0.3048, y: 0.3048, z: 0, occupancy: 1, bIso: 0.8 },
  ],
  twins: [],
  notes: 'h00 要求 h=2n；hh0 要求 h=2n，适合核对螺旋轴消光。',
}

// 3. Sucrose, P21 (No.4): large monoclinic organic cell, no centering.
const sucrose: Sample = {
  id: 'demo-sucrose',
  code: 'ORG-2207',
  name: '蔗糖（教学有机大晶胞）',
  group: '糖化学实验室',
  createdAt: now - 172800000,
  cell: { a: 10.863, b: 8.705, c: 7.762, alpha: 90, beta: 102.94, gamma: 90 },
  spaceGroupNumber: 4,
  orientation: { phi: 0, kappa: 54.7, omega: 18 },
  mosaicity: 0.35,
  wavelengthSpread: 0.001,
  size: { x: 0.4, y: 0.25, z: 0.2 },
  shape: 'plate',
  color: '#c4b5fd',
  // Reduced representative sites (C12H22O11 simplified to heavy atoms);
  // the 21 screw expands each site to two general positions.
  atoms: [
    { element: 'O', label: 'O1', x: 0.072, y: 0.835, z: 0.208, occupancy: 1, bIso: 1.8 },
    { element: 'O', label: 'O2', x: 0.321, y: 0.552, z: 0.402, occupancy: 1, bIso: 1.9 },
    { element: 'O', label: 'O3', x: 0.448, y: 0.182, z: 0.127, occupancy: 1, bIso: 2.0 },
    { element: 'C', label: 'C1', x: 0.183, y: 0.671, z: 0.304, occupancy: 1, bIso: 1.5 },
    { element: 'C', label: 'C2', x: 0.266, y: 0.524, z: 0.158, occupancy: 1, bIso: 1.6 },
    { element: 'C', label: 'C3', x: 0.391, y: 0.382, z: 0.266, occupancy: 1, bIso: 1.6 },
    { element: 'C', label: 'C4', x: 0.318, y: 0.214, z: 0.402, occupancy: 1, bIso: 1.7 },
  ],
  twins: [],
  notes: '大晶胞低对称，反射密集，用于检验完整度统计。',
}

// 4. Twin teaching sample: rutile-like cell carrying a (101) twin law.
const twinSample: Sample = {
  id: 'demo-twin',
  code: 'TWN-003',
  name: '孪晶教学样（金红石双畴）',
  group: '材料学院 X 射线组',
  createdAt: now - 259200000,
  cell: { a: 4.5937, b: 4.5937, c: 2.9587, alpha: 90, beta: 90, gamma: 90 },
  spaceGroupNumber: 136,
  orientation: { phi: 0, kappa: 54.7, omega: 0 },
  mosaicity: 0.4,
  wavelengthSpread: 0.0012,
  size: { x: 0.2, y: 0.2, z: 0.18 },
  shape: 'irregular',
  color: '#fda4af',
  atoms: [
    { element: 'Ti', label: 'Ti1', x: 0, y: 0, z: 0, occupancy: 1, bIso: 0.6 },
    { element: 'O', label: 'O1', x: 0.3048, y: 0.3048, z: 0, occupancy: 1, bIso: 0.8 },
  ],
  twins: [
    {
      label: '180° 绕 c 轴（孪晶面 (001)）',
      volumeFraction: 0.32,
      law: [[-1, 0, 0], [0, -1, 0], [0, 0, 1]],
    },
  ],
  notes: '主畴 0.68 / 次畴 0.32，重叠斑用独立标记显示。',
}

export const demoSamples: Sample[] = [nacl, rutile, sucrose, twinSample]
