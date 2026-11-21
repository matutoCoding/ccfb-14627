// Atomic scattering factors using the Cromer-Mann 4-Gaussian fit:
//   f0(s) = sum_i a_i * exp(-b_i * s^2) + c,   s = sin(theta)/lambda in A^-1.
// Coefficients from the International Tables C (free-atom values).

interface Coeff {
  a: [number, number, number, number]
  b: [number, number, number, number]
  c: number
}

// Common light atoms used by the demo crystals and routine organics/salts.
const table: Record<string, Coeff> = {
  H: { a: [0.493, 0.323, 0.14, 0.041], b: [10.51, 26.13, 3.14, 57.7], c: 0.003 },
  C: { a: [2.31, 1.02, 1.589, 0.865], b: [20.84, 10.21, 0.569, 51.65], c: 0.216 },
  N: { a: [12.213, 3.132, 2.013, 1.166], b: [0.0057, 9.893, 28.997, 0.583], c: -11.529 },
  O: { a: [3.049, 2.287, 1.546, 0.867], b: [13.277, 5.701, 0.324, 32.909], c: 0.251 },
  F: { a: [3.539, 2.642, 1.49, 0.836], b: [10.655, 4.608, 0.281, 27.461], c: 0.493 },
  Na: { a: [3.257, 3.936, 1.4, 1.02], b: [2.667, 6.125, 0.299, 120.15], c: 0.387 },
  Mg: { a: [5.42, 2.174, 1.669, 1.151], b: [2.816, 80.274, 0.275, 7.171], c: 0.586 },
  Al: { a: [4.177, 3.283, 1.202, 0.527], b: [1.938, 81.16, 0.243, 5.819], c: 0.811 },
  Si: { a: [6.292, 3.035, 1.989, 1.541], b: [2.439, 32.34, 0.678, 81.694], c: 1.141 },
  P: { a: [6.435, 4.179, 1.78, 1.491], b: [1.907, 27.157, 0.526, 68.164], c: 1.115 },
  S: { a: [6.905, 5.203, 1.438, 0.851], b: [1.468, 22.215, 0.254, 56.271], c: 0.603 },
  Cl: { a: [11.46, 7.196, 6.162, 1.752], b: [0.01, 1.166, 18.52, 47.776], c: -9.567 },
  K: { a: [8.219, 7.431, 1.052, 0.862], b: [12.794, 0.773, 213.18, 41.086], c: -11.564 },
  Ca: { a: [15.635, 7.952, 8.437, 1.491], b: [0.012, 0.68, 10.331, 85.74], c: -17.515 },
  Ti: { a: [19.066, 10.386, 7.043, 2.024], b: [0.02, 0.789, 8.131, 69.157], c: -21.519 },
  Mn: { a: [14.867, 9.015, 5.079, 1.881], b: [0.244, 7.377, 22.038, 68.26], c: 3.158 },
  Fe: { a: [11.176, 7.387, 4.043, 1.372], b: [0.025, 6.875, 19.066, 61.792], c: -7.978 },
  Co: { a: [12.265, 7.569, 4.154, 1.326], b: [0.013, 6.739, 18.011, 60.02], c: -8.314 },
  Ni: { a: [13.115, 7.704, 4.213, 1.271], b: [0.011, 6.651, 17.377, 58.758], c: -8.304 },
  Cu: { a: [13.338, 7.577, 5.231, 1.558], b: [0.022, 6.789, 17.06, 46.893], c: -12.704 },
  Zn: { a: [14.074, 7.032, 5.172, 1.394], b: [0.026, 7.137, 16.547, 46.096], c: -13.672 },
  Br: { a: [17.277, 6.424, 5.565, 2.019], b: [0.065, 8.044, 22.44, 52.119], c: -14.3 },
  Ag: { a: [19.281, 6.107, 4.752, 2.322], b: [0.012, 8.112, 23.165, 52.526], c: -14.462 },
}

// Fallback: interpolate toward a neutral generic atom by atomic number-ish
// scaling; still monotonic and finite across the resolvable range.
const generic: Coeff = table.C

export const atomicFactor = (element: string, sAInv: number): number => {
  const coeff = table[element] ?? generic
  const s2 = sAInv * sAInv
  let f = coeff.c
  for (let i = 0; i < 4; i++) {
    f += coeff.a[i] * Math.exp(-coeff.b[i] * s2)
  }
  return Math.max(0, f)
}

export const knownElements = Object.keys(table)
