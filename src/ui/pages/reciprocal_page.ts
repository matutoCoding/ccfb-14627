// Reciprocal-space page: 3D orbit view of every lattice point with the
// Ewald sphere, frame-based coloring, arbitrary Miller-plane slicing and a
// blind-region summary derived from the scan segments.

import { appStore, reflectionTable, selectedSample } from '../app_state'
import { clear, h } from '../store'
import { icons } from '../icons'
import { statCard } from '../widgets'
import {
  OrbitCamera, ReciprocalRenderer, defaultCamera, layerVisibility,
} from '@/render/reciprocal_renderer'
import { evaluateStrategy } from '@/physics/strategy'
import { Reflection } from '@/physics/types'

let renderer: ReciprocalRenderer | null = null
let camera: OrbitCamera | null = null
let slice: { fixed: 'h' | 'k' | 'l'; value: number } | null = null

const frameColor = (t: number): [number, number, number] => {
  // Blue -> cyan -> green -> amber -> red across the angular range.
  const stops: [number, [number, number, number]][] = [
    [0, [0.36, 0.55, 1]],
    [0.35, [0.36, 0.85, 0.95]],
    [0.65, [0.45, 0.85, 0.55]],
    [0.85, [0.95, 0.7, 0.35]],
    [1, [0.95, 0.4, 0.4]],
  ]
  const x = Math.min(1, Math.max(0, t))
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i]
    const [t1, c1] = stops[i + 1]
    if (x >= t0 && x <= t1) {
      const f = (x - t0) / (t1 - t0)
      return [
        c0[0] + (c1[0] - c0[0]) * f,
        c0[1] + (c1[1] - c0[1]) * f,
        c0[2] + (c1[2] - c0[2]) * f,
      ]
    }
  }
  return stops[stops.length - 1][1]
}

export const renderReciprocalPage = (root: HTMLElement): void => {
  const state = appStore.value
  const sample = selectedSample()
  clear(root)
  if (!sample) return

  const table = reflectionTable()
  const ewaldRadius = 1 / state.beam.wavelengthA
  if (!camera) camera = defaultCamera(ewaldRadius)

  const canvas = h('canvas', { width: 900, height: 720 }) as HTMLCanvasElement
  const stage = h('div', { class: 'canvas-wrap' }, canvas)

  const buildColors = (): { colors: Float32Array; sizes: Float32Array } => {
    const n = table.reflections.length
    const colors = new Float32Array(n * 3)
    const sizes = new Float32Array(n)
    table.reflections.forEach((r, i) => {
      if (r.domain !== 0) {
        colors.set([1, 0.55, 0.38], i * 3)
        sizes[i] = 5
        return
      }
      const windows = state.stage === 'omega' ? r.windows.omega : r.windows.phi
      const center = windows?.[0]?.centerDeg ?? 0
      const t = (center + 180) / 360
      colors.set(frameColor(t), i * 3)
      sizes[i] = 4.5
    })
    return { colors, sizes }
  }

  const draw = (): void => {
    if (!renderer) renderer = new ReciprocalRenderer(canvas, camera!)
    renderer.setSize(900, 720)
    renderer.updateCamera(camera!)
    const { colors, sizes } = buildColors()
    const visibility = layerVisibility(table.reflections, slice)
    renderer.render({
      reflections: table.reflections,
      colors,
      sizes,
      visibility,
      ewaldRadius,
      camera: camera!,
    })
  }

  attachOrbit(canvas, () => draw())

  const stats = evaluateStrategy(
    table.reflections, state.segments, state.settings.defaultResolutionA,
  )
  const blindCount = stats.totalUnique - stats.measuredUnique

  const sliceChips = h('div', { class: 'row wrap' },
    makeChip('全部格点', null),
    makeChip('hk0 (l=0)', { fixed: 'l' as const, value: 0 }),
    makeChip('h0l (k=0)', { fixed: 'k' as const, value: 0 }),
    makeChip('0kl (h=0)', { fixed: 'h' as const, value: 0 }),
    makeChip('hk1 (l=1)', { fixed: 'l' as const, value: 1 }),
    makeChip('h1l (k=1)', { fixed: 'k' as const, value: 1 }),
  )

  const customSlice = h('div', { class: 'row' },
    h('select', { class: 'select', style: { width: '120px' }, id: 'slice-axis' },
      h('option', { value: 'h' }, 'h ='),
      h('option', { value: 'k' }, 'k ='),
      h('option', { value: 'l' }, 'l =')),
    h('input', { class: 'input numeric', type: 'number', value: '0', id: 'slice-value', style: { width: '120px' } }),
    h('button', {
      class: 'btn',
      innerHTML: '切出该层',
      onClick: () => {
        const axis = (document.getElementById('slice-axis') as HTMLSelectElement).value as 'h' | 'k' | 'l'
        const value = Number((document.getElementById('slice-value') as HTMLInputElement).value)
        slice = { fixed: axis, value }
        renderReciprocalPage(root)
      },
    }),
    h('button', { class: 'btn ghost', innerHTML: '清除切片', onClick: () => { slice = null; renderReciprocalPage(root) } }),
  )

  const blind = findBlindZones(table.reflections)
  const infoCard = h('div', { class: 'card control-panel' },
    h('h3', {}, '盲区分析'),
    statCard('未覆盖独立反射', String(blindCount), `完整度 ${(stats.completeness * 100).toFixed(1)}%`),
    h('div', {},
      h('div', { class: 'label' }, '倒易方向盲区（2θ 壳层）'),
      ...blind.map((b) => h('div', { class: 'row', style: { justifyContent: 'space-between', padding: '4px 0' } },
        h('span', { class: 'small muted numeric' }, `${b.dMin.toFixed(2)}–${b.dMax.toFixed(2)} Å`),
        h('span', { class: 'tag danger' }, `缺 ${b.missing}/${b.total}`)))),
    h('div', { class: 'legend' },
      h('span', {}, h('span', { class: 'dot', style: { background: 'rgb(92,140,255)' } }), '低角帧'),
      h('span', {}, h('span', { class: 'dot', style: { background: 'rgb(242,102,102)' } }), '高角帧'),
      h('span', {}, h('span', { class: 'dot', style: { background: 'var(--domain-2)' } }), '孪晶次畴')),
  )

  function makeChip(label: string, target: typeof slice): HTMLElement {
    const active = JSON.stringify(target) === JSON.stringify(slice)
    return h('button', {
      class: `slice-chip ${active ? 'active' : ''}`,
      onClick: () => { slice = target; renderReciprocalPage(root) },
    }, label)
  }

  root.append(
    h('div', { class: 'page-header' },
      h('div', {}, h('h1', {}, '倒易空间'),
        h('p', {}, '拖拽旋转、滚轮缩放；格点按 rocking 中心角着色，蓝到红对应扫描进程。'))),
    h('div', { class: 'stat-grid' },
      statCard('格点总数', String(table.reflections.length)),
      statCard('Ewald 球半径', `${ewaldRadius.toFixed(3)} Å⁻¹`),
      statCard('独立反射', String(table.uniqueCount)),
      statCard('当前切片', slice ? `${slice.fixed} = ${slice.value}` : '无')),
    h('div', { class: 'detector-stage' },
      h('div', { class: 'card' },
        h('div', { class: 'row wrap', style: { marginBottom: 'var(--sp-4)' } }, sliceChips, customSlice),
        stage),
      infoCard),
  )
  draw()
}

const findBlindZones = (reflections: Reflection[]) => {
  const primary = reflections.filter((r) => r.domain === 0)
  const dMin = Math.min(...primary.map((r) => r.resolutionA))
  const dMax = Math.max(...primary.map((r) => r.resolutionA))
  const bins = Array.from({ length: 5 }, (_, i) => ({
    dMin: dMax - ((dMax - dMin) * (i + 1)) / 5,
    dMax: dMax - ((dMax - dMin) * i) / 5,
    total: 0,
    missing: 0,
  }))
  const state = appStore.value
  for (const r of primary) {
    const bin = bins.find((b) => r.resolutionA > b.dMin && r.resolutionA <= b.dMax)
    if (!bin) continue
    bin.total++
    const windows = state.stage === 'omega' ? r.windows.omega : r.windows.phi
    const covered = state.segments.some((seg) =>
      windows?.some((w) => w.centerDeg >= seg.startDeg && w.centerDeg <= seg.endDeg))
    if (!covered) bin.missing++
  }
  return bins
}

// Pointer-based orbit control: drag rotates azimuth/elevation, wheel zooms.
const attachOrbit = (canvas: HTMLCanvasElement, onChange: () => void): void => {
  let dragging = false
  let lastX = 0
  let lastY = 0
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true
    lastX = e.clientX
    lastY = e.clientY
    canvas.setPointerCapture(e.pointerId)
  })
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging || !camera) return
    camera.azimuthDeg += (e.clientX - lastX) * 0.4
    camera.elevationDeg = Math.max(-85, Math.min(85, camera.elevationDeg + (e.clientY - lastY) * 0.4))
    lastX = e.clientX
    lastY = e.clientY
    onChange()
  })
  canvas.addEventListener('pointerup', () => { dragging = false })
  canvas.addEventListener('wheel', (e) => {
    if (!camera) return
    e.preventDefault()
    camera.distance = Math.max(2, camera.distance * (1 + Math.sign(e.deltaY) * 0.08))
    onChange()
  }, { passive: false })
}
