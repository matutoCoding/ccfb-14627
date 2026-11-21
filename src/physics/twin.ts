// Twin law presets and volume-fraction handling.
// Laws act on Miller indices as 3x3 integer matrices.

import { TwinDomain } from './types'

export interface TwinLawPreset {
  id: string
  label: string
  // Common growth/transformation twin laws, expressed on hkl.
  law: number[][]
  applicableSystems: string[]
}

export const twinLawPresets: TwinLawPreset[] = [
  {
    id: 'mero-180a',
    label: '180° 绕 a 轴（孪晶面 (100)）',
    law: [[1, 0, 0], [0, -1, 0], [0, 0, -1]],
    applicableSystems: ['monoclinic', 'orthorhombic', 'tetragonal', 'cubic'],
  },
  {
    id: 'mero-180b',
    label: '180° 绕 b 轴（孪晶面 (010)）',
    law: [[-1, 0, 0], [0, 1, 0], [0, 0, -1]],
    applicableSystems: ['monoclinic', 'orthorhombic', 'tetragonal', 'cubic'],
  },
  {
    id: 'mero-180c',
    label: '180° 绕 c 轴（孪晶面 (001)）',
    law: [[-1, 0, 0], [0, -1, 0], [0, 0, 1]],
    applicableSystems: ['orthorhombic', 'tetragonal', 'hexagonal', 'cubic'],
  },
  {
    id: 'mero-110',
    label: '180° 绕 [110]（孪晶面 (110)）',
    law: [[0, 1, 0], [1, 0, 0], [0, 0, -1]],
    applicableSystems: ['orthorhombic', 'tetragonal', 'cubic'],
  },
  {
    id: 'mero-1-10',
    label: '180° 绕 [1-10]（孪晶面 (1-10)）',
    law: [[0, -1, 0], [-1, 0, 0], [0, 0, -1]],
    applicableSystems: ['tetragonal', 'cubic'],
  },
  {
    id: 'hex-100',
    label: '六方 180° 孪晶（面 (100)，六方指数）',
    law: [[1, -1, 0], [-1, 0, 0], [0, 0, -1]],
    applicableSystems: ['hexagonal', 'trigonal'],
  },
  {
    id: 'spinel-111',
    label: '尖晶石律 180° 绕 [111]',
    law: [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    applicableSystems: ['cubic'],
  },
]

export const makeTwinDomain = (presetId: string, volumeFraction: number): TwinDomain => {
  const preset = twinLawPresets.find((p) => p.id === presetId)
  if (!preset) throw new Error(`未知孪生律: ${presetId}`)
  return {
    label: preset.label,
    volumeFraction,
    law: preset.law.map((row) => [...row]),
  }
}

// Twin fraction must stay in (0, 1); primary domain keeps the complement.
export const normalizeFractions = (primary: number, twins: TwinDomain[]): number[] => {
  const secondary = twins.reduce((acc, t) => acc + t.volumeFraction, 0)
  const scale = primary + secondary > 1 ? 1 / (primary + secondary) : 1
  return [primary * scale, ...twins.map((t) => t.volumeFraction * scale)]
}
