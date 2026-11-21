// Thin WebGL2 helpers: shader compilation, mesh buffers and textures.
// All geometric data arrives as f64 in JavaScript; only the final vertex
// payloads are converted to f32 for the GPU, so precision decisions stay
// in the physics layer where they can be tested.

export const compileShader = (
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader => {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('无法创建着色器')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`着色器编译失败: ${log}`)
  }
  return shader
}

export const createProgram = (
  gl: WebGL2RenderingContext,
  vertexSrc: string,
  fragmentSrc: string,
): WebGLProgram => {
  const program = gl.createProgram()
  if (!program) throw new Error('无法创建着色器程序')
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertexSrc))
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragmentSrc))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`着色器链接失败: ${log}`)
  }
  return program
}

export interface FloatBuffer {
  vao: WebGLVertexArrayObject
  vbo: WebGLBuffer
  capacity: number
  count: number
  components: number
}

export const createFloatBuffer = (
  gl: WebGL2RenderingContext,
  components: number,
  capacityFloats: number,
): FloatBuffer => {
  const vao = gl.createVertexArray()!
  const vbo = gl.createBuffer()!
  gl.bindVertexArray(vao)
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
  gl.bufferData(gl.ARRAY_BUFFER, capacityFloats * 4, gl.DYNAMIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, components, gl.FLOAT, false, 0, 0)
  gl.bindVertexArray(null)
  return { vao, vbo, capacity: capacityFloats, count: 0, components }
}

// In-place buffer update; never reallocates unless the data grew. Stable
// slots are what keep animated spots from flickering on the timeline.
export const uploadFloatBuffer = (
  gl: WebGL2RenderingContext,
  buffer: FloatBuffer,
  data: Float32Array,
): void => {
  if (data.length > buffer.capacity) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer.vbo)
    gl.bufferData(gl.ARRAY_BUFFER, data.length * 4, gl.DYNAMIC_DRAW)
    buffer.capacity = data.length
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer.vbo)
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, data)
  buffer.count = data.length / buffer.components
}

export const createTexture2D = (
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  internalFormat: number,
  format: number,
  type: number,
): WebGLTexture => {
  const tex = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, null)
  return tex
}

export const glContext = (canvas: HTMLCanvasElement): WebGL2RenderingContext => {
  const gl = canvas.getContext('webgl2', {
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: false,
  })
  if (!gl) throw new Error('当前浏览器不支持 WebGL2')
  return gl
}
