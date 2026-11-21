// Registry of the common teaching/service-laboratory space groups.
//
// Every group carries exact systematic-absence conditions. Groups with
// generators also get a complete general-position closure computed at load
// time (see buildGroup in spacegroup_types); groups without generators keep
// identity-only operations, which the UI flags as structure-factor limited.

import { SpaceGroup, AbsenceRule, axial, centeringRules } from './spacegroup_types'
import { CrystalSystem } from './types'

interface RegistryEntry {
  number: number
  symbol: string
  system: CrystalSystem
  laue: string
  centering: 'P' | 'I' | 'F' | 'C' | 'A' | 'R'
  axial?: AbsenceRule[]
  generators?: number[][]
  centeringTranslations?: number[][]
}

const C = axial

// Integer/half affine rows: [R3x3 row-major | t3], 12 entries.
// Monoclinic unique-b twofold and 2_1 screw.
const twoB = [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0]
const screw21B = [-1, 0, 0, 0, 0, 1, 0, 0.5, 0, 0, -1, 0]
const inv = [-1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0]
// Counterclockwise 4-fold about z: (x, y, z) -> (-y, x, z).
const c4z = [0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0]
const c3body = [0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0]
// Orthorhombic P212121: all three operations share the C2 rotation
// diag(1,-1,-1); they differ only in their half translation, which is what
// produces the three mutually perpendicular screw axes under closure.
const screwX_ab = [1, 0, 0, 0.5, 0, -1, 0, 0.5, 0, 0, -1, 0]
const screwX_ac = [1, 0, 0, 0.5, 0, -1, 0, 0, 0, 0, -1, 0.5]
const screwX_bc = [1, 0, 0, 0, 0, -1, 0, 0.5, 0, 0, -1, 0.5]
// Single-axis 2_1 screws for groups built on one screw plus mirrors/inversion.
const screw21A = [1, 0, 0, 0.5, 0, -1, 0, 0, 0, 0, -1, 0]
const screw21BOrtho = [-1, 0, 0, 0, 0, 1, 0, 0.5, 0, 0, -1, 0]
const screw21C = [-1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0.5]
// Pure twofold about a basal-plane axis for trigonal/hexagonal groups:
// (x, y, z) -> (x-y, -y, -z), no z translation.
const twoFoldBasal = [1, -1, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0]
// Pure twofold about the tetragonal a axis: (x, y, z) -> (x, -y, -z).
const twoFoldTetA = [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0]
// Pure twofold about the face diagonal [110]: (x, y, z) -> (y, x, -z).
const twoFoldTetDiag = [0, 1, 0, 0, 1, 0, 0, 0, 0, 0, -1, 0]
// Body-centering translation shared by every I-lattice entry.
// Hexagonal 6-fold about z: (x, y, z) -> (x-y, x, z), order 6.
const c6hex = [1, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0]
// Hexagonal 3-fold about z: (x, y, z) -> (-y, x-y, z), order 3.
const c3hex = [0, -1, 0, 0, 1, -1, 0, 0, 0, 0, 1, 0]
// 3x3 MUST be the identity matrix: a pure translation is (I | t), and zeroing
// the rotation part would collapse every g*(I|t) coset composite.
const iTranslation = [1, 0, 0, 0.5, 0, 1, 0, 0.5, 0, 0, 1, 0.5]
// Rhombohedral obverse centering needs two independent lattice translations.
const rTranslations = [
  [1, 0, 0, 2 / 3, 0, 1, 0, 1 / 3, 0, 0, 1, 1 / 3],
  [1, 0, 0, 1 / 3, 0, 1, 0, 2 / 3, 0, 0, 1, 2 / 3],
]

export const registry: RegistryEntry[] = [
  { number: 1, symbol: 'P1', system: 'triclinic', laue: '-1', centering: 'P' },
  { number: 2, symbol: 'P-1', system: 'triclinic', laue: '-1', centering: 'P', generators: [inv] },
  { number: 3, symbol: 'P2', system: 'monoclinic', laue: '2/m', centering: 'P',
    generators: [twoB] },
  {
    number: 4, symbol: 'P21', system: 'monoclinic', laue: '2/m', centering: 'P',
    axial: [C.ok0_2n],
    generators: [screw21B],
  },
  { number: 5, symbol: 'C2', system: 'monoclinic', laue: '2/m', centering: 'C',
    axial: [C.ok0_2n],
    generators: [twoB],
    centeringTranslations: [[1, 0, 0, 0.5, 0, 1, 0, 0.5, 0, 0, 1, 0]] },
  { number: 10, symbol: 'P2/m', system: 'monoclinic', laue: '2/m', centering: 'P',
    generators: [inv, twoB] },
  { number: 11, symbol: 'P21/m', system: 'monoclinic', laue: '2/m', centering: 'P',
    axial: [C.ok0_2n], generators: [inv, screw21B] },
  { number: 12, symbol: 'C2/m', system: 'monoclinic', laue: '2/m', centering: 'C',
    generators: [inv, twoB],
    centeringTranslations: [[1, 0, 0, 0.5, 0, 1, 0, 0.5, 0, 0, 1, 0]] },
  { number: 13, symbol: 'P2/c', system: 'monoclinic', laue: '2/m', centering: 'P',
    axial: [C.ool_2n],
    generators: [inv, [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0.5]] },
  {
    number: 14, symbol: 'P21/c', system: 'monoclinic', laue: '2/m', centering: 'P',
    axial: [C.ok0_2n, C.hol_l_2n], generators: [inv, screw21B],
  },
  { number: 15, symbol: 'C2/c', system: 'monoclinic', laue: '2/m', centering: 'C',
    axial: [C.hol_l_2n],
    generators: [inv, [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0.5]],
    centeringTranslations: [[1, 0, 0, 0.5, 0, 1, 0, 0.5, 0, 0, 1, 0]] },
  {
    number: 19, symbol: 'P212121', system: 'orthorhombic', laue: 'mmm', centering: 'P',
    axial: [C.h00_2n, C.ok0_2n, C.ool_2n],
    // Two generators suffice: their product is the third screw operation.
    generators: [screwX_ab, screwX_ac],
  },
  { number: 29, symbol: 'Pca21', system: 'orthorhombic', laue: 'mmm', centering: 'P',
    axial: [C.hk0_h_2n, C.ool_2n, C.okl_k_2n],
    generators: [screw21A, screw21BOrtho] },
  { number: 33, symbol: 'Pna21', system: 'orthorhombic', laue: 'mmm', centering: 'P',
    axial: [C.hk0_hk_2n, C.ool_2n, C.okl_l_2n],
    generators: [screw21A, screw21BOrtho] },
  { number: 61, symbol: 'Pbca', system: 'orthorhombic', laue: 'mmm', centering: 'P',
    axial: [C.hk0_h_2n, C.hol_l_2n, C.okl_k_2n, C.ool_2n, C.h00_2n, C.ok0_2n],
    generators: [inv, screw21A, screw21BOrtho] },
  { number: 62, symbol: 'Pnma', system: 'orthorhombic', laue: 'mmm', centering: 'P',
    axial: [C.hk0_hk_2n, C.hol_h_2n, C.okl_l_2n],
    generators: [inv, screw21A, screw21BOrtho] },
  { number: 74, symbol: 'Imma', system: 'orthorhombic', laue: 'mmm', centering: 'I',
    axial: [C.hol_h_2n, C.okl_l_2n],
    generators: [inv, [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0]],
    centeringTranslations: [[1, 0, 0, 0.5, 0, 1, 0, 0.5, 0, 0, 1, 0.5]] },
  { number: 75, symbol: 'P4', system: 'tetragonal', laue: '4/m', centering: 'P',
    generators: [c4z] },
  { number: 76, symbol: 'P41', system: 'tetragonal', laue: '4/m', centering: 'P',
    axial: [C.ool_4n],
    generators: [[0, -1, 0, 0, 1, 0, 0, 0.5, 0, 0, 1, 0.25]] },
  { number: 78, symbol: 'P43', system: 'tetragonal', laue: '4/m', centering: 'P',
    axial: [C.ool_4n],
    generators: [[0, -1, 0, 0, 1, 0, 0, 0.5, 0, 0, 1, 0.75]] },
  { number: 79, symbol: 'I4', system: 'tetragonal', laue: '4/m', centering: 'I',
    generators: [c4z],
    centeringTranslations: [[1, 0, 0, 0.5, 0, 1, 0, 0.5, 0, 0, 1, 0.5]] },
  { number: 83, symbol: 'P4/m', system: 'tetragonal', laue: '4/m', centering: 'P',
    generators: [inv, c4z] },
  { number: 87, symbol: 'I4/m', system: 'tetragonal', laue: '4/m', centering: 'I',
    generators: [inv, c4z],
    centeringTranslations: [[1, 0, 0, 0.5, 0, 1, 0, 0.5, 0, 0, 1, 0.5]] },
  { number: 88, symbol: 'I41/a', system: 'tetragonal', laue: '4/m', centering: 'I',
    axial: [C.ool_4n, C.hh0_h_2n],
    generators: [inv, [0, -1, 0, 0, 1, 0, 0, 0.5, 0, 0, 1, 0.25]],
    centeringTranslations: [[1, 0, 0, 0.5, 0, 1, 0, 0.5, 0, 0, 1, 0.5]] },
  { number: 92, symbol: 'P41212', system: 'tetragonal', laue: '4/mmm', centering: 'P',
    axial: [C.ool_4n, C.h00_2n, C.hh0_h_2n],
    generators: [[0, -1, 0, 0, 1, 0, 0, 0.5, 0, 0, 1, 0.25], twoFoldTetA] },
  { number: 94, symbol: 'P42212', system: 'tetragonal', laue: '4/mmm', centering: 'P',
    axial: [C.ool_2n, C.h00_2n],
    generators: [[0, -1, 0, 0, 1, 0, 0, 0.5, 0, 0, 1, 0.5], twoFoldTetA] },
  {
    number: 136, symbol: 'P42/mnm', system: 'tetragonal', laue: '4/mmm', centering: 'P',
    axial: [C.h00_2n, C.hh0_h_2n],
    generators: [inv, [0, -1, 0, 0.5, 1, 0, 0, 0.5, 0, 0, 1, 0.5], twoFoldTetA],
  },
  { number: 139, symbol: 'I4/mmm', system: 'tetragonal', laue: '4/mmm', centering: 'I',
    generators: [inv, c4z, twoFoldTetA],
    centeringTranslations: [iTranslation] },
  { number: 141, symbol: 'I41/amd', system: 'tetragonal', laue: '4/mmm', centering: 'I',
    axial: [C.ool_4n, C.hh0_h_2n],
    generators: [inv, [0, -1, 0, 0, 1, 0, 0, 0.5, 0, 0, 1, 0.25], twoFoldTetA],
    centeringTranslations: [iTranslation] },
  { number: 146, symbol: 'R3', system: 'trigonal', laue: '-3', centering: 'R',
    generators: [c3hex],
    centeringTranslations: rTranslations },
  { number: 148, symbol: 'R-3', system: 'trigonal', laue: '-3', centering: 'R',
    generators: [inv, c3hex],
    centeringTranslations: rTranslations },
  { number: 152, symbol: 'P3121', system: 'trigonal', laue: '-3m', centering: 'P',
    axial: [C.ool_2n],
    generators: [[0, -1, 0, 0, 1, -1, 0, 0, 0, 0, 1, 1 / 3], twoFoldBasal] },
  { number: 154, symbol: 'P3221', system: 'trigonal', laue: '-3m', centering: 'P',
    axial: [C.ool_2n],
    generators: [[0, -1, 0, 0, 1, -1, 0, 0, 0, 0, 1, 2 / 3], twoFoldBasal] },
  { number: 167, symbol: 'R-3c', system: 'trigonal', laue: '-3m', centering: 'R',
    axial: [C.ool_2n],
    generators: [inv, c3hex],
    centeringTranslations: rTranslations },
  { number: 168, symbol: 'P6', system: 'hexagonal', laue: '6/m', centering: 'P',
    generators: [c6hex] },
  { number: 173, symbol: 'P63', system: 'hexagonal', laue: '6/m', centering: 'P',
    axial: [C.ool_2n],
    generators: [[1, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0.5]] },
  { number: 176, symbol: 'P63/m', system: 'hexagonal', laue: '6/m', centering: 'P',
    axial: [C.ool_2n],
    generators: [inv, [1, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0.5]] },
  { number: 194, symbol: 'P63/mmc', system: 'hexagonal', laue: '6/mmm', centering: 'P',
    axial: [C.ool_2n, C.hhl_l_2n],
    generators: [inv, [1, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0.5], twoFoldBasal] },
  { number: 195, symbol: 'P23', system: 'cubic', laue: 'm-3', centering: 'P',
    generators: [c4z, c3body] },
  { number: 200, symbol: 'Pm-3m', system: 'cubic', laue: 'm-3m', centering: 'P',
    generators: [inv, c4z, c3body] },
  {
    number: 225, symbol: 'Fm-3m', system: 'cubic', laue: 'm-3m', centering: 'F',
    generators: [inv, c4z, c3body],
    centeringTranslations: [
      [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
      [1, 0, 0, 0.5, 0, 1, 0, 0.5, 0, 0, 1, 0],
      [1, 0, 0, 0.5, 0, 1, 0, 0, 0, 0, 1, 0.5],
      [1, 0, 0, 0, 0, 1, 0, 0.5, 0, 0, 1, 0.5],
    ],
  },
  { number: 227, symbol: 'Fd-3m', system: 'cubic', laue: 'm-3m', centering: 'F',
    axial: [(_h, k, l) => k === l && (k + l) % 4 !== 0],
    generators: [inv, c4z, c3body],
    centeringTranslations: [
      [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
      [1, 0, 0, 0.5, 0, 1, 0, 0.5, 0, 0, 1, 0],
      [1, 0, 0, 0.5, 0, 1, 0, 0, 0, 0, 1, 0.5],
      [1, 0, 0, 0, 0, 1, 0, 0.5, 0, 0, 1, 0.5],
    ] },
  { number: 229, symbol: 'Im-3m', system: 'cubic', laue: 'm-3m', centering: 'I',
    generators: [inv, c4z, c3body],
    centeringTranslations: [[1, 0, 0, 0.5, 0, 1, 0, 0.5, 0, 0, 1, 0.5]] },
]

// Affine rows are stored row-major as 12 entries: three [R|t] rows of four,
// i.e. indices 0..3 = first row, 4..7 = second, 8..11 = third, so the
// translation lives at slots 3, 7, 11. Multiplication must use the matching
// row-major formula; a column-major formula happens to work for pure
// rotations but corrupts every translation component.
const TRANSLATION_SLOTS = new Set([3, 7, 11])

const compose = (a: number[], b: number[]): number[] => {
  const r = new Array<number>(12)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      let sum = 0
      for (let k = 0; k < 3; k++) {
        sum += a[row * 4 + k] * b[k * 4 + col]
      }
      // Homogeneous coordinate: add a's translation for the output vector.
      if (col === 3) sum += a[row * 4 + 3]
      r[row * 4 + col] = sum
    }
  }
  return r
}

// Screw/rotational closure identifies operations modulo lattice translations,
// so its key wraps translation components into [0,1). The coset stage uses
// the signed key below to keep centering translations distinct.
const rotationalKey = (s: number[]): string =>
  s
    .map((v, i) => {
      if (!TRANSLATION_SLOTS.has(i)) return `r${Math.round(v)}`
      const grid = Math.round(v * 12) / 12
      return `t${((grid % 1) + 1) % 1}`
    })
    .join('|')

// Keys must distinguish operations by BOTH their rotation and their signed
// translation. Translation components are NOT wrapped here: -1/2 and +1/2 are
// the same lattice vector only when attached to the same rotation, so
// collapsing them in the key would merge a rotated coset with the pure
// centering translation and undercount I/F lattice groups.
const keyOf = (s: number[]): string =>
  s
    .map((v, i) =>
      TRANSLATION_SLOTS.has(i)
        ? `t${Math.round(v * 12) / 12}`
        : `r${Math.round(v)}`,
    )
    .join('|')

// Translation slots in the 12-entry affine row: index 3, 7, 11.

// Snap an affine row onto an exact rational grid: rotation parts are
// integers (-1/0/1), translations are multiples of 1/12 (covers 1/2, 1/3,
// 1/4). Signed translations are preserved deliberately - wrapping -1/2 onto
// +1/2 would collapse a rotated centering coset onto the pure translation,
// undercounting I/F/C/R groups. Fractional-coordinate periodicity is handled
// later by expandSites, which wraps the final atomic coordinates.
const snapOperation = (s: number[]): number[] =>
  s.map((v, i) => {
    if (!TRANSLATION_SLOTS.has(i)) return Math.round(v)
    return Math.round(v * 12) / 12
  })

// Close generators under multiplication; centering translations are applied
// as a coset expansion after the rotational/screw part closes.
//
// A space group is a point-group closure G (rotations and screws) combined
// with a translation lattice L: every operation is g + t for g in G and t in
// L. Folding translations into the same BFS loop works for P lattices but
// misses rotation*translation composites for I/F/C/R lattices, so the two
// stages are kept explicit here.
export function closureFromGenerators(
  generators: number[][],
  translations: number[][],
): number[][] {
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]

  // Stage 1: close the rotational/screw generators on their own.
  const rotational = bfsClosure(identity, generators)

  // Stage 2: for every closed operation, add each centering translation.
  // Pure translation entries are also valid operations on their own.
  const seedTranslations = translations.map((t) => snapOperation(compose(identity, t)))
  const all = new Map<string, number[]>()
  for (const g of rotational) {
    all.set(keyOf(g), g)
    for (const t of seedTranslations) {
      const shifted = snapOperation(compose(g, t))
      all.set(keyOf(shifted), shifted)
    }
  }
  for (const t of seedTranslations) all.set(keyOf(t), t)

  return [...all.values()].filter((s) => keyOf(s) !== keyOf(identity))
}

const bfsClosure = (identity: number[], generators: number[][]): number[][] => {
  const seen = new Map<string, number[]>()
  const queue: number[][] = [identity]
  seen.set(rotationalKey(identity), identity)
  // Largest shipped point group is m-3m at order 48.
  const safetyCap = 256

  while (queue.length > 0) {
    const cur = queue.pop()!
    for (const g of generators) {
      const next = snapOperation(compose(cur, g))
      const key = rotationalKey(next)
      if (!seen.has(key)) {
        if (seen.size >= safetyCap) {
          throw new Error('点群闭包超过 256 项，生成元可能不构成有限晶体学点群')
        }
        seen.set(key, next)
        queue.push(next)
      }
    }
  }
  return [...seen.values()]
}

export const spaceGroups: SpaceGroup[] = registry.map((e) => {
  let ops: number[][] = []
  try {
    ops = closureFromGenerators(e.generators ?? [], e.centeringTranslations ?? [])
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[space group ${e.number} ${e.symbol}] ${(err as Error).message}`)
  }
  if (ops.length > 200) {
    // eslint-disable-next-line no-console
    console.warn(`[sg ${e.number} ${e.symbol}] closure size ${ops.length + 1}`)
  }
  return {
  number: e.number,
  symbol: e.symbol,
  crystalSystem: e.system,
  laueClass: e.laue,
  absenceRules: [...centeringRules(e.centering), ...(e.axial ?? [])],
  symops: ops,
  }
})

export const spaceGroupByNumber = (n: number): SpaceGroup => {
  const found = spaceGroups.find((g) => g.number === n)
  if (!found) throw new Error(`未内置的空间群编号: ${n}`)
  return found
}

export const hasFullSymops = (sg: SpaceGroup): boolean => sg.symops.length > 0


