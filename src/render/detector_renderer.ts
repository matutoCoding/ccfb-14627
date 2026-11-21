// Detector view: procedural background plus instanced reflection spots.
//
// Each spot occupies one stable slot in an instance buffer; timeline frames
// only call bufferSubData, so identity/order never changes and nothing
// flickers or jumps. Fragment shaders draw a Gaussian footprint whose sigma
// comes from the mosaicity/wavelength spot model.

import { DetectorSpot } from '@/physics/types'
import { BeamConfig, DetectorConfig } from '@/physics/types'
import { createProgram, glContext } from './gl_core'

const quadVert = `#version 300 es
layout(location=0) in vec2 a_corner;
out vec2 v_uv;
void main() {
  v_uv = a_corner;
  gl_Position = vec4(a_corner, 0.0, 1.0);
}`

const backgroundFrag = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform vec2 u_panel;
uniform float u_distance;
uniform float u_pixel;
uniform vec2 u_beamCenterPx;
uniform float u_air;
uniform float u_beamStopMm;
uniform vec3 u_bgTint;
void main() {
  vec2 px = vec2((v_uv.x * 0.5 + 0.5) * u_panel.x, (0.5 - v_uv.y * 0.5) * u_panel.y);
  vec2 d = (px - u_beamCenterPx) * u_pixel;
  float r = length(d);
  float t = atan(r, u_distance);
  float air = u_air * exp(-t / 0.12) * (0.85 + 0.15 * cos(t * 40.0));
  float grain = fract(sin(dot(px, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  vec3 color = u_bgTint + (air + 0.012 * grain) * vec3(0.55, 0.62, 0.75);
  if (r <= u_beamStopMm) color = u_bgTint * 0.35;
  outColor = vec4(color, 1.0);
}`

const spotVert = `#version 300 es
layout(location=0) in vec2 a_corner;
layout(location=1) in vec4 a_spot;   // xy center px, z radius px, w intensity
layout(location=2) in vec3 a_meta;   // x partiality, y domain, z overlap
uniform vec2 u_panel;
out vec2 v_local;
flat out int v_domain;
flat out int v_overlap;
out float v_partial;
out float v_intensity;
void main() {
  v_local = a_corner;
  vec2 pos = a_spot.xy + a_corner * a_spot.z;
  vec2 ndc = vec2(pos.x / u_panel.x * 2.0 - 1.0, 1.0 - pos.y / u_panel.y * 2.0);
  gl_Position = vec4(ndc, 0.0, 1.0);
  v_partial = a_meta.x;
  v_domain = int(a_meta.y + 0.5);
  v_overlap = int(a_meta.z + 0.5);
  v_intensity = a_spot.w;
}`

const spotFrag = `#version 300 es
precision highp float;
in vec2 v_local;
flat in int v_domain;
flat in int v_overlap;
in float v_partial;
in float v_intensity;
out vec4 outColor;
void main() {
  float g = exp(-dot(v_local, v_local) * 2.2);
  vec3 primary = vec3(0.36, 0.78, 1.0);
  vec3 secondary = vec3(1.0, 0.55, 0.38);
  vec3 color = v_domain == 0 ? primary : secondary;
  if (v_overlap == 1) color = vec3(0.85, 0.85, 0.35);
  float alpha = g * clamp(v_partial, 0.0, 1.0);
  if (alpha < 0.01) discard;
  outColor = vec4(color * (0.55 + 0.75 * min(v_intensity, 1.5)), alpha);
}`

export interface DetectorRenderOptions {
  det: DetectorConfig
  beam: BeamConfig
  spots: DetectorSpot[]
  maxIntensity: number
}

interface SpotGpu {
  vao: WebGLVertexArrayObject
  corner: WebGLBuffer
  spot: WebGLBuffer
  meta: WebGLBuffer
  capacity: number
}

export class DetectorRenderer {
  private gl: WebGL2RenderingContext
  private bgProgram: WebGLProgram
  private spotProgram: WebGLProgram
  private quadVao: WebGLVertexArrayObject
  private gpu: SpotGpu
  private maxSpots = 40000

  constructor(canvas: HTMLCanvasElement) {
    this.gl = glContext(canvas)
    const gl = this.gl
    this.bgProgram = createProgram(gl, quadVert, backgroundFrag)
    this.spotProgram = createProgram(gl, spotVert, spotFrag)

    this.quadVao = gl.createVertexArray()!
    gl.bindVertexArray(this.quadVao)
    const quadVbo = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]),
      gl.STATIC_DRAW,
    )
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    const vao = gl.createVertexArray()!
    gl.bindVertexArray(vao)
    const corner = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, corner)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.vertexAttribDivisor(0, 0)

    const spot = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, spot)
    gl.bufferData(gl.ARRAY_BUFFER, this.maxSpots * 4 * 4, gl.DYNAMIC_DRAW)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0)
    gl.vertexAttribDivisor(1, 1)

    const meta = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, meta)
    gl.bufferData(gl.ARRAY_BUFFER, this.maxSpots * 3 * 4, gl.DYNAMIC_DRAW)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0)
    gl.vertexAttribDivisor(2, 1)

    this.gpu = { vao, corner, spot, meta, capacity: this.maxSpots }
    gl.bindVertexArray(null)
  }

  render(options: DetectorRenderOptions): void {
    const { gl } = this
    const { det, beam, spots, maxIntensity } = options
    const visible = spots.slice(0, this.maxSpots)
    gl.viewport(0, 0, det.widthPx, det.heightPx)
    gl.clearColor(0.04, 0.05, 0.07, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(this.bgProgram)
    gl.bindVertexArray(this.quadVao)
    gl.uniform2f(gl.getUniformLocation(this.bgProgram, 'u_panel'), det.widthPx, det.heightPx)
    gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'u_distance'), det.distanceMm)
    gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'u_pixel'), det.pixelSizeMm)
    gl.uniform2f(gl.getUniformLocation(this.bgProgram, 'u_beamCenterPx'), det.centerXPx, det.centerYPx)
    gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'u_air'), beam.airScatter)
    gl.uniform1f(gl.getUniformLocation(this.bgProgram, 'u_beamStopMm'), beam.beamStopMm)
    gl.uniform3f(gl.getUniformLocation(this.bgProgram, 'u_bgTint'), 0.04, 0.05, 0.07)
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)

    if (visible.length === 0) return
    const spotData = new Float32Array(visible.length * 4)
    const metaData = new Float32Array(visible.length * 3)
    visible.forEach((s, i) => {
      spotData.set([s.xPx, s.yPx, s.radiusPx, maxIntensity > 0 ? s.intensity / maxIntensity : 0], i * 4)
      metaData.set([s.partiality, s.domain, s.overlapped ? 1 : 0], i * 3)
    })
    gl.bindVertexArray(this.gpu.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.gpu.spot)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, spotData)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.gpu.meta)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, metaData)

    gl.useProgram(this.spotProgram)
    gl.uniform2f(gl.getUniformLocation(this.spotProgram, 'u_panel'), det.widthPx, det.heightPx)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
    gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, visible.length)
    gl.disable(gl.BLEND)
    gl.bindVertexArray(null)
  }
}
