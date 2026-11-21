// Diffraction prediction page: WebGL2 detector canvas, angle timeline with
// per-frame spot birth/death, entry/exit angle annotations and detector
// /beam controls. Frame recomputation reuses stable reflection slots.

import {
  appStore, persistBeam, persistDetector, reflectionTable, selectedSample,
} from '../app_state'
import { clear, h } from '../store'
import { icons } from '../icons'
import { numberField, selectField, statCard } from '../widgets'
import { DetectorRenderer } from '@/render/detector_renderer'
import { buildFrameSpots } from '@/physics/detector'
import { DetectorSpot, ScanAxis } from '@/physics/types'
import { EwaldOptions } from '@/physics/ewald'
import { angleDiff } from '@/physics/math3d'

let rafId = 0
let playing = false

export const renderDiffractionPage = (root: HTMLElement): void => {
  const state = appStore.value
  const sample = selectedSample()
  clear(root)
  if (!sample) return

  const table = reflectionTable()
  const ewald: EwaldOptions = {
    wavelengthA: state.beam.wavelengthA,
    mosaicityDeg: sample.mosaicity,
    wavelengthSpread: sample.wavelengthSpread,
  }

  const canvas = h('canvas', {
    width: state.detector.widthPx,
    height: state.detector.heightPx,
    style: { aspectRatio: `${state.detector.widthPx} / ${state.detector.heightPx}` },
  }) as HTMLCanvasElement
  const renderer = new DetectorRenderer(canvas)
  let disposed = false
  let unsubscribe = (): void => {}
  const dispose = (): void => {
    disposed = true
    playing = false
    unsubscribe()
  }
  root.addEventListener('DOMNodeRemoved', () => dispose(), { once: true })

  const tooltip = h('div', { class: 'tooltip', hidden: true })
  const stage = h('div', { class: 'canvas-wrap overlay-stage' }, canvas, tooltip)

  const computeSpots = (angle: number, axis: ScanAxis): DetectorSpot[] =>
    buildFrameSpots({
      reflections: table.reflections,
      det: state.detector,
      beam: state.beam,
      ewald,
      stage: axis,
      stageAngleDeg: angle,
      phi0Deg: sample.orientation.phi,
      kappaDeg: sample.orientation.kappa,
      omega0Deg: sample.orientation.omega,
    })

  const draw = (): void => {
    const current = appStore.value
    const spots = computeSpots(current.stageAngleDeg, current.stage)
    const maxIntensity = Math.max(1e-6, ...spots.map((s) => s.intensity))
    renderer.render({
      det: current.detector,
      beam: current.beam,
      spots,
      maxIntensity,
    })
    renderSpotList(spots)
  }

  const spotList = h('div', { class: 'spot-list' })
  const renderSpotList = (spots: DetectorSpot[]): void => {
    const visible = [...spots]
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, 40)
    spotList.replaceChildren(
      h('table', { class: 'data' },
        h('thead', {}, h('tr', {},
          ...['hkl', 'x (px)', 'y (px)', '偏心率', '畴', '进/出角 (°)'].map((t) => h('th', {}, t)))),
        h('tbody', {}, ...visible.map((s) => {
          const refl = table.reflections[s.reflectionIndex]
          const windows = appStore.value.stage === 'omega' ? refl.windows.omega : refl.windows.phi
          const w = windows?.find((win) =>
            Math.abs(angleDiff(appStore.value.stageAngleDeg, win.centerDeg)) <=
            Math.abs(win.exitDeg - win.entryDeg) + 180) ?? windows?.[0]
          return h('tr', {},
            h('td', { class: 'numeric' }, `(${s.h},${s.k},${s.l})`),
            h('td', { class: 'numeric' }, s.xPx.toFixed(1)),
            h('td', { class: 'numeric' }, s.yPx.toFixed(1)),
            h('td', { class: 'numeric' }, s.partiality.toFixed(2)),
            h('td', {}, h('span', { class: s.domain === 0 ? 'tag ok' : 'tag warn' }, String(s.domain))),
            h('td', { class: 'numeric small' }, w
              ? `${w.entryDeg.toFixed(1)} → ${w.exitDeg.toFixed(1)}`
              : '—'))
        }))),
    )
  }

  // Timeline: angle slider spanning all current segments plus play/pause.
  const axisSelect = selectField('扫描轴', state.stage, [
    { value: 'omega', label: 'ω 扫描' },
    { value: 'phi', label: 'φ 扫描' },
  ], (v) => {
    playing = false
    appStore.set({ stage: v as ScanAxis })
  })

  const slider = h('input', {
    type: 'range', min: -180, max: 180, step: 0.1, value: String(state.stageAngleDeg),
    onInput: (e: Event) => {
      playing = false
      appStore.set({ stageAngleDeg: Number((e.target as HTMLInputElement).value) })
    },
  }) as HTMLInputElement

  const angleLabel = h('strong', { class: 'numeric', style: { minWidth: '96px' } },
    `${state.stage === 'omega' ? 'ω' : 'φ'} = ${state.stageAngleDeg.toFixed(1)}°`)

  const playBtn = h('button', {
    class: 'btn',
    innerHTML: icons.play,
    onClick: () => {
      playing = !playing
      playBtn.innerHTML = playing ? icons.pause : icons.play
      if (playing) tick()
    },
  })

  const tick = (): void => {
    if (!playing) return
    const next = appStore.value.stageAngleDeg + 0.2
    appStore.set({ stageAngleDeg: next > 180 ? -180 : next })
    slider.value = String(appStore.value.stageAngleDeg)
    rafId = window.setTimeout(() => requestAnimationFrame(tick), 40) as unknown as number
  }

  const timeline = h('div', { class: 'timeline' }, playBtn, axisSelect, slider, angleLabel)

  const stats = h('div', { class: 'stat-grid' },
    statCard('当前帧斑点', '—'),
    statCard('反射表规模', String(table.reflections.length)),
    statCard('系统消光剔除', String(table.absentCount)),
    statCard('独立反射', String(table.uniqueCount)),
  )

  const controls = renderControls()
  root.append(
    h('div', { class: 'page-header' },
      h('div', {}, h('h1', {}, '衍射图预测'),
        h('p', {}, 'Ewald 球与倒易格点解析求交，系统消光反射不会进入渲染缓冲。'))),
    stats,
    h('div', { class: 'detector-stage' },
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' } },
        stage, timeline),
      h('div', { class: 'control-panel' }, controls,
        h('div', { class: 'card' }, h('h3', { style: { marginBottom: 'var(--sp-3)' } }, '当前帧斑点表'), spotList))),
  )

  // Hover tooltip with Miller indices and entry/exit angles.
  canvas.addEventListener('mousemove', (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * state.detector.widthPx
    const y = ((e.clientY - rect.top) / rect.height) * state.detector.heightPx
    const spots = computeSpots(appStore.value.stageAngleDeg, appStore.value.stage)
    const hit = spots.find((s) => Math.hypot(s.xPx - x, s.yPx - y) <= s.radiusPx + 4)
    if (!hit) {
      tooltip.hidden = true
      return
    }
    const refl = table.reflections[hit.reflectionIndex]
    const windows = appStore.value.stage === 'omega' ? refl.windows.omega : refl.windows.phi
    const w = windows?.[0]
    tooltip.hidden = false
    tooltip.style.left = `${e.clientX - rect.left + 14}px`
    tooltip.style.top = `${e.clientY - rect.top + 14}px`
    tooltip.textContent = w
      ? `(${hit.h},${hit.k},${hit.l})  进 ${w.entryDeg.toFixed(2)}° / 出 ${w.exitDeg.toFixed(2)}°  d=${hit.reflectionIndex >= 0 ? refl.resolutionA.toFixed(2) : ''}Å`
      : `(${hit.h},${hit.k},${hit.l})`
  })
  canvas.addEventListener('mouseleave', () => { tooltip.hidden = true })

  // Single page-scoped subscription covers both the angle label and canvas.
  unsubscribe = appStore.subscribe(() => {
    if (disposed) return
    angleLabel.textContent =
      `${appStore.value.stage === 'omega' ? 'ω' : 'φ'} = ${appStore.value.stageAngleDeg.toFixed(1)}°`
    draw()
  })
  draw()
  void rafId
}

const renderControls = (): HTMLElement => {
  const state = appStore.value
  const det = state.detector
  const beam = state.beam
  const patchDet = (p: Partial<typeof det>) => persistDetector({ ...det, ...p })
  const patchBeam = (p: Partial<typeof beam>) => persistBeam({ ...beam, ...p })

  return h('div', { class: 'card control-panel' },
    h('h3', {}, '探测器几何'),
    numberField('样品-探测器距离 (mm)', det.distanceMm, (v) => patchDet({ distanceMm: v }), { min: 20, step: 1 }),
    h('div', { class: 'grid cols-2' },
      numberField('光束中心 X (px)', det.centerXPx, (v) => patchDet({ centerXPx: v })),
      numberField('光束中心 Y (px)', det.centerYPx, (v) => patchDet({ centerYPx: v }))),
    numberField('像素尺寸 (mm)', det.pixelSizeMm, (v) => patchDet({ pixelSizeMm: v }), { min: 0.01, step: 0.005 }),
    numberField('2θ 偏置 (°)', det.twoThetaOffsetDeg, (v) => patchDet({ twoThetaOffsetDeg: v }), { min: -45, max: 45, step: 1 }),
    h('div', { class: 'grid cols-2' },
      numberField('面板宽 (px)', det.widthPx, (v) => patchDet({ widthPx: Math.round(v) }), { min: 256, step: 64 }),
      numberField('面板高 (px)', det.heightPx, (v) => patchDet({ heightPx: Math.round(v) }), { min: 256, step: 64 })),
    h('h3', { style: { marginTop: 'var(--sp-4)' } }, '光束与背景'),
    numberField('波长 (Å)', beam.wavelengthA, (v) => patchBeam({ wavelengthA: v }), { min: 0.2, max: 2.5, step: 0.001 }),
    numberField('空气散射强度', beam.airScatter, (v) => patchBeam({ airScatter: v }), { min: 0, max: 1, step: 0.02 }),
    numberField('挡光锥半径 (mm)', beam.beamStopMm, (v) => patchBeam({ beamStopMm: v }), { min: 0, step: 0.2 }),
  )
}
