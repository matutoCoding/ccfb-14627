// Space-group types, systematic-absence engine, site expansion.

import { AtomSite, CrystalSystem } from './types'

// A reflection condition: when predicate(hkl) is true, the reflection is absent.
export type AbsenceRule = (h: number, k: number, l: number) => boolean

export interface SpaceGroup {
  number: number
  // Hermann-Mauguin symbol, short form.
  symbol: string
  crystalSystem: CrystalSystem
  // General-position symmetry operations as 4x3 affine rows [R|t],
  // fractional coordinates. Identity is always implicitly included.
  symops: number[][]
  absenceRules: AbsenceRule[]
  // Laue class, used for Friedel-merged intensity handling.
  laueClass: string
}

const even = (n: number) => n % 2 === 0

// Centering translation conditions, keyed by lattice letter.
export const centeringRules = (letter: 'P' | 'I' | 'F' | 'C' | 'A' | 'R'): AbsenceRule[] => {
  switch (letter) {
    case 'P':
      return []
    case 'I':
      return [(h, k, l) => (h + k + l) % 2 !== 0]
    case 'F':
      // h,k,l unmixed parity: all even or all odd.
      return [(h, k, l) => !(even(h) === even(k) && even(k) === even(l))]
    case 'C':
      return [(h, k) => (h + k) % 2 !== 0]
    case 'A':
      return [(_h, k, l) => (k + l) % 2 !== 0]
    case 'R':
      // Obverse setting: -h+k+l = 3n.
      return [(h, k, l) => (-h + k + l) % 3 !== 0]
  }
}

// Reusable axial / zonal absence conditions. Each entry is one rule and can
// be combined freely in the group registry.
export const axial = {
  h00_2n: (h: number, k: number, l: number) => k === 0 && l === 0 && h % 2 !== 0,
  h00_4n: (h: number, k: number, l: number) => k === 0 && l === 0 && h % 4 !== 0,
  ok0_2n: (h: number, k: number, l: number) => h === 0 && l === 0 && k % 2 !== 0,
  ool_2n: (h: number, k: number, l: number) => h === 0 && k === 0 && l % 2 !== 0,
  ool_4n: (h: number, k: number, l: number) => h === 0 && k === 0 && l % 4 !== 0,
  hk0_hk_2n: (h: number, k: number, l: number) => l === 0 && (h + k) % 2 !== 0,
  hk0_h_2n: (h: number, k: number, l: number) => l === 0 && h % 2 !== 0,
  hk0_k_2n: (h: number, k: number, l: number) => l === 0 && k % 2 !== 0,
  hol_l_2n: (h: number, k: number, l: number) => k === 0 && l % 2 !== 0,
  hol_h_2n: (h: number, k: number, l: number) => k === 0 && h % 2 !== 0,
  okl_k_2n: (h: number, k: number, l: number) => h === 0 && k % 2 !== 0,
  okl_l_2n: (h: number, k: number, l: number) => h === 0 && l % 2 !== 0,
  hh0_h_2n: (h: number, k: number, l: number) => l === 0 && h === k && h % 2 !== 0,
  hhl_l_2n: (h: number, k: number, l: number) => h === k && l % 2 !== 0,
}

export const isSystematicallyAbsent = (
  sg: SpaceGroup,
  h: number,
  k: number,
  l: number,
): boolean => sg.absenceRules.some((rule) => rule(h, k, l))

// Apply a [R|t] symop row (12 entries) to fractional coordinates.
const applySymop = (
  sym: number[],
  x: number,
  y: number,
  z: number,
): [number, number, number] => {
  const dot = (off: number) =>
    sym[off] * x + sym[off + 1] * y + sym[off + 2] * z + sym[off + 3]
  return [dot(0), dot(4), dot(8)]
}

const wrapFractional = (v: number): number => ((v % 1) + 1.0000001) % 1

const identitySymop = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]

// Expand one asymmetric-unit site into all symmetry-equivalent unique sites.
export const expandSites = (sg: SpaceGroup, site: AtomSite): AtomSite[] => {
  const seen = new Map<string, [number, number, number]>()
  const ops = [identitySymop, ...sg.symops]
  for (const sym of ops) {
    const [x, y, z] = applySymop(sym, site.x, site.y, site.z).map(wrapFractional)
    const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`
    if (!seen.has(key)) seen.set(key, [x, y, z])
  }
  return [...seen.values()].map(([x, y, z], i) => ({
    ...site,
    label: i === 0 ? site.label : `${site.label}_${i}`,
    x,
    y,
    z,
  }))
}
