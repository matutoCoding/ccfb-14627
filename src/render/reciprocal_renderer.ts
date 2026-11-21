// Reciprocal-space 3D view with an orbit camera, the Ewald sphere and
// per-reflection coloring by collected frame. Layer slicing (hk0, h0l and
// arbitrary planes) is handled on the CPU as a mask so the GPU stays dumb.

import { Reflection } from '@/physics/types'
import { createProgram, glContext } from './gl_core'
import { Mat3, mulMV } from '@/physics/math3d'

const pointVert = `#version 300 es
layout(location=0) in vec3 a_pos;
layout(location=1) in vec3 a_color;
layout(location=2) in float a_size;
uniform mat4 u_viewProj;
out vec3 v_color;
void main() {
  gl_Position = u_viewProj * vec4(a_pos, 1.0);
  gl_PointSize = a_size;
  v_color = a_color;
}`

const pointFrag = `#version 300 es
precision highp float;
in vec3 v_color;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;
  float soft = smoothstep(0.25, 0.02, r2);
  outColor = vec4(v_color, soft);
}`

const lineVert = `#version 300 es
layout(location=0) in vec3 a_pos;
uniform mat4 u_viewProj;
void main() { gl_Position = u_viewProj * vec4(a_pos, 1.0); }`
const lineFrag = `#version 300 es
precision highp float;
uniform vec3 u_color;
out vec4 outColor;
void main() { outColor = vec4(u_color, 1.0); }`

export interface ReciprocalViewOptions {
  reflections: Reflection[]
  // Colors per reflection slot; the page computes frame/domain colors.
  colors: Float32Array
  sizes: Float32Array
  visibility: Uint8Array
  ewaldRadius: number
  camera: OrbitCamera
}

export interface OrbitCamera {
  azimuthDeg: number
  elevationDeg: number
  distance: number
  target: [number, number, number]
}

export const defaultCamera = (ewaldRadius: number): OrbitCamera => ({
  azimuthDeg: 35,
  elevationDeg: 25,
  distance: ewaldRadius * 3.2,
  target: [0, 0, 0],
})

// Minimal column-major 4x4 helpers.
const perspective = (fovy: number, aspect: number, near: number, far: number): Mat3 | number[] => {
  const f = 1 / Math.tan(fovy / 2)
  const nf = 1 / (near - far)
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]
}

const lookAt = (eye: number[], target: number[], up: number[]): number[] => {
  const sub = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
  const norm = (v: number[]) => {
    const n = Math.hypot(v[0], v[1], v[2])
    return [v[0] / n, v[1] / n, v[2] / n]
  }
  const cross = (a: number[], b: number[]) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  const z = norm(sub(eye, target))
  const x = norm(cross(up, z))
  const y = cross(z, x)
  return [
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
  ]
}

const matMul = (a: number[], b: number[]): number[] => {
  const r = new Array(16).fill(0)
  for (let c = 0; c < 4; c++) {
    for (let row = 0; row < 4; row++) {
      r[c * 4 + row] =
        a[row] * b[c * 4] + a[4 + row] * b[c * 4 + 1] +
        a[8 + row] * b[c * 4 + 2] + a[12 + row] * b[c * 4 + 3]
    }
  }
  return r
}

export class ReciprocalRenderer {
  private gl: WebGL2RenderingContext
  private pointProgram: WebGLProgram
  private lineProgram: WebGLProgram
  private pointVao: WebGLVertexArrayObject
  private posBuffer: WebGLBuffer
  private colorBuffer: WebGLBuffer
  private sizeBuffer: WebGLBuffer
  private lineVao: WebGLVertexArrayObject
  private lineBuffer: WebGLBuffer
  private camera: OrbitCamera
  private width = 800
  private height = 600

  constructor(canvas: HTMLCanvasElement, camera: OrbitCamera) {
    this.gl = glContext(canvas)
    const gl = this.gl
    this.pointProgram = createProgram(gl, pointVert, pointFrag)
    this.lineProgram = createProgram(gl, lineVert, lineFrag)
    this.camera = camera

    this.pointVao = gl.createVertexArray()!
    gl.bindVertexArray(this.pointVao)
    this.posBuffer = this.attrib(0, 3)
    this.colorBuffer = this.attrib(1, 3)
    this.sizeBuffer = this.attrib(2, 1)

    this.lineVao = gl.createVertexArray()!
    gl.bindVertexArray(this.lineVao)
    this.lineBuffer = this.attrib(0, 3)
    gl.bindVertexArray(null)
  }

  private attrib(index: number, components: number): WebGLBuffer {
    const gl = this.gl
    const buffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, 200000 * components * 4, gl.DYNAMIC_DRAW)
    gl.enableVertexAttribArray(index)
    gl.vertexAttribPointer(index, components, gl.FLOAT, false, 0, 0)
    return buffer
  }

  setSize(width: number, height: number): void {
    this.width = width
    this.height = height
  }

  updateCamera(camera: OrbitCamera): void {
    this.camera = camera
  }

  render(options: ReciprocalViewOptions): void {
    const gl = this.gl
    gl.viewport(0, 0, this.width, this.height)
    gl.clearColor(0.03, 0.04, 0.06, 1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.enable(gl.DEPTH_TEST)

    const aspect = this.width / Math.max(1, this.height)
    const proj = perspective(Math.PI / 4, aspect, 0.01, this.camera.distance * 8)
    const az = (this.camera.azimuthDeg * Math.PI) / 180
    const el = (this.camera.elevationDeg * Math.PI) / 180
    const eye = [
      this.camera.target[0] + this.camera.distance * Math.cos(el) * Math.sin(az),
      this.camera.target[1] + this.camera.distance * Math.sin(el),
      this.camera.target[2] + this.camera.distance * Math.cos(el) * Math.cos(az),
    ]
    const view = lookAt(eye, this.camera.target, [0, 1, 0])
    const vp = matMul(proj, view)

    this.drawEwald(vp, options.ewaldRadius)
    this.drawAxes(vp)
    this.drawPoints(vp, options)
    gl.disable(gl.DEPTH_TEST)
  }

  private drawPoints(vp: number[], options: ReciprocalViewOptions): void {
    const gl = this.gl
    const visible: number[] = []
    const colors: number[] = []
    const sizes: number[] = []
    options.reflections.forEach((r, i) => {
      if (!options.visibility[i]) return
      visible.push(...r.rLab0)
      colors.push(options.colors[i * 3], options.colors[i * 3 + 1], options.colors[i * 3 + 2])
      sizes.push(options.sizes[i])
    })
    if (visible.length === 0) return

    gl.useProgram(this.pointProgram)
    gl.bindVertexArray(this.pointVao)
    gl.uniformMatrix4fv(gl.getUniformLocation(this.pointProgram, 'u_viewProj'), false, vp)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(visible))
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(colors))
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sizeBuffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(sizes))
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.drawArrays(gl.POINTS, 0, visible.length / 3)
    gl.disable(gl.BLEND)
  }

  private drawEwald(vp: number[], radius: number): void {
    // Wireframe latitude/longitude rings keep the sphere readable.
    const rings: number[] = []
    const seg = 36
    for (let lat = -60; lat <= 60; lat += 30) {
      const phi = (lat * Math.PI) / 180
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2
        const a1 = ((i + 1) / seg) * Math.PI * 2
        rings.push(
          radius * Math.cos(phi) * Math.cos(a0), radius * Math.sin(phi), radius * Math.cos(phi) * Math.sin(a0),
          radius * Math.cos(phi) * Math.cos(a1), radius * Math.sin(phi), radius * Math.cos(phi) * Math.sin(a1),
        )
      }
    }
    this.lines(vp, rings, [0.25, 0.55, 0.75])
  }

  private drawAxes(vp: number[]): void {
    const len = this.camera.distance * 0.35
    this.lines(vp, [
      0, 0, 0, len, 0, 0,
      0, 0, 0, 0, len, 0,
      0, 0, 0, 0, 0, len,
    ], [0.5, 0.55, 0.65])
  }

  private lines(vp: number[], data: number[], color: number[]): void {
    const gl = this.gl
    gl.useProgram(this.lineProgram)
    gl.bindVertexArray(this.lineVao)
    gl.uniformMatrix4fv(gl.getUniformLocation(this.lineProgram, 'u_viewProj'), false, vp)
    gl.uniform3fv(gl.getUniformLocation(this.lineProgram, 'u_color'), color)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW)
    gl.drawArrays(gl.LINES, 0, data.length / 3)
  }
}

// Slice predicate: reflections whose Miller indices lie on one plane.
export const layerVisibility = (
  reflections: Reflection[],
  plane: { fixed: 'h' | 'k' | 'l'; value: number } | null,
): Uint8Array => {
  const mask = new Uint8Array(reflections.length).fill(1)
  if (!plane) return mask
  reflections.forEach((r, i) => {
    const v = plane.fixed === 'h' ? r.h : plane.fixed === 'k' ? r.k : r.l
    if (v !== plane.value) mask[i] = 0
  })
  return mask
}

export const transformPoints = (matrix: Mat3, points: Float32Array): Float32Array => {
  const out = new Float32Array(points.length)
  for (let i = 0; i < points.length; i += 3) {
    const v = mulMV(matrix, [points[i], points[i + 1], points[i + 2]])
    out.set(v, i)
  }
  return out
}
