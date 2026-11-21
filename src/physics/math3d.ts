// f64 vector / matrix math. All diffraction geometry runs on these helpers;
// the GPU is only used for drawing, never for geometric decisions.

export type Vec3 = [number, number, number]
// Column-major 3x3, matching the convention used by Busing & Levy.
export type Mat3 = [number, number, number, number, number, number, number, number, number]

export const v3 = (x: number, y: number, z: number): Vec3 => [x, y, z]
export const cloneV = (a: Vec3): Vec3 => [a[0], a[1], a[2]]

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]

export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

export const norm = (a: Vec3): number => Math.hypot(a[0], a[1], a[2])

export const normalize = (a: Vec3): Vec3 => {
  const n = norm(a)
  return n === 0 ? [0, 0, 0] : [a[0] / n, a[1] / n, a[2] / n]
}

export const angleBetween = (a: Vec3, b: Vec3): number => {
  const c = dot(normalize(a), normalize(b))
  return Math.acos(Math.min(1, Math.max(-1, c)))
}

// Rotation around an arbitrary unit axis, right-handed (Rodrigues).
export const rotAxis = (axis: Vec3, rad: number): Mat3 => {
  const [x, y, z] = normalize(axis)
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  const t = 1 - c
  return [
    t * x * x + c, t * x * y + s * z, t * x * z - s * y,
    t * x * y - s * z, t * y * y + c, t * y * z + s * x,
    t * x * z + s * y, t * y * z - s * x, t * z * z + c,
  ]
}

export const mulM = (a: Mat3, b: Mat3): Mat3 => {
  const r = new Array(9) as Mat3
  for (let c = 0; c < 3; c++) {
    for (let r0 = 0; r0 < 3; r0++) {
      r[c * 3 + r0] =
        a[0 * 3 + r0] * b[c * 3 + 0] +
        a[1 * 3 + r0] * b[c * 3 + 1] +
        a[2 * 3 + r0] * b[c * 3 + 2]
    }
  }
  return r
}

// Rotation about a fixed lab axis expressed as Euler z-x-z intrinsic angles.
// Used for the goniometer orientation: R = Rz(phi) Rx(kappa) Rz(omega).
export const eulerZXZ = (phi: number, kappa: number, omega: number): Mat3 => {
  const rz = (a: number): Mat3 =>
    [Math.cos(a), Math.sin(a), 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 1]
  const rx = (a: number): Mat3 =>
    [1, 0, 0, 0, Math.cos(a), Math.sin(a), 0, -Math.sin(a), Math.cos(a)]
  return mulM(rz(phi), mulM(rx(kappa), rz(omega)))
}

export const mulMV = (m: Mat3, p: Vec3): Vec3 => [
  m[0] * p[0] + m[3] * p[1] + m[6] * p[2],
  m[1] * p[0] + m[4] * p[1] + m[7] * p[2],
  m[2] * p[0] + m[5] * p[1] + m[8] * p[2],
]

export const transpose = (m: Mat3): Mat3 =>
  [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]

export const det3 = (m: Mat3): number =>
  m[0] * (m[4] * m[8] - m[5] * m[7]) -
  m[3] * (m[1] * m[8] - m[2] * m[7]) +
  m[6] * (m[1] * m[5] - m[2] * m[4])

export const inverse3 = (m: Mat3): Mat3 => {
  const d = det3(m)
  const inv = (x: number) => x / d
  return [
    inv(m[4] * m[8] - m[5] * m[7]),
    inv(m[6] * m[5] - m[3] * m[8]),
    inv(m[3] * m[7] - m[6] * m[4]),
    inv(m[7] * m[2] - m[1] * m[8]),
    inv(m[0] * m[8] - m[6] * m[2]),
    inv(m[6] * m[1] - m[0] * m[7]),
    inv(m[1] * m[5] - m[4] * m[2]),
    inv(m[3] * m[2] - m[0] * m[5]),
    inv(m[0] * m[4] - m[3] * m[1]),
  ]
}

export const identity3 = (): Mat3 => [1, 0, 0, 0, 1, 0, 0, 0, 1]

export const deg2rad = (d: number): number => (d * Math.PI) / 180
export const rad2deg = (r: number): number => (r * 180) / Math.PI

export const mod360 = (d: number): number => ((d % 360) + 360) % 360

// Difference a-b wrapped into (-180, 180], in degrees.
export const angleDiff = (a: number, b: number): number => {
  const d = mod360(a - b)
  return d > 180 ? d - 360 : d
}
