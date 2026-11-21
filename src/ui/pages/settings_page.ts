// Settings page: instrument defaults, theme, local data management and the
// experimental-frame import workspace used to align predictions with a
// real diffraction image.

import {
  appStore, persistSettings, restoreDemoData, selectedSample, updateSample,
} from '../app_state'
import { clear, h } from '../store'
import { icons } from '../icons'
import { numberField, selectField } from '../widgets'
import { saveFrame, loadFrames, deleteFrame, StoredFrame } from '@/data/storage'
import { DetectorRenderer } from '@/render/detector_renderer'
import { buildFrameSpots } from '@/physics/detector'
import { reflectionTable } from '../app_state'
import { EwaldOptions } from '@/physics/ewald'
import { Sample } from '@/physics/types'

export const renderSettingsPage = (root: HTMLElement): void => {
  const state = appStore.value
  const sample = selectedSample()
  clear(root)

  const patch = (p: Partial<typeof state.settings>) =>
    persistSettings({ ...state.settings, ...p })

  const instrumentCard = h('div', { class: 'card' },
    h('h3', { style: { marginBottom: 'var(--sp-4)' } }, '仪器默认值'),
    h('div', { class: 'grid cols-3' },
      numberField('帧读出时间 (s)', state.settings.readoutSec, (v) => patch({ readoutSec: v }), { min: 0, step: 0.1 }),
      numberField('换段开销 (s)', state.settings.overheadSec, (v) => patch({ overheadSec: v }), { min: 0, step: 1 }),
      numberField('默认目标分辨率 (Å)', state.settings.defaultResolutionA, (v) => patch({ defaultResolutionA: v }), { min: 0.4, step: 0.1 })),
    selectField('界面主题', state.settings.theme, [
      { value: 'dark', label: '深色' }, { value: 'light', label: '浅色' },
    ], (v) => patch({ theme: v as 'dark' | 'light' })),
    h('label', { class: 'row', style: { cursor: 'pointer', marginTop: 'var(--sp-3)' } },
      h('input', {
        type: 'checkbox',
        checked: state.settings.showFriedelPairs,
        onChange: (e: Event) =>
          patch({ showFriedelPairs: (e.target as HTMLInputElement).checked }),
      }),
      h('span', {}, '统计时显示 Friedel 配对细节')),
  )

  const dataCard = h('div', { class: 'card' },
    h('h3', { style: { marginBottom: 'var(--sp-4)' } }, '本地数据'),
    h('p', { class: 'muted small', style: { marginBottom: 'var(--sp-4)' } },
      '样品与实验记录保存在浏览器 localStorage，实测帧图片保存在 IndexedDB，全部数据不出本机。'),
    h('div', { class: 'row wrap' },
      h('button', {
        class: 'btn',
        innerHTML: `${icons.upload} 导出全部记录 (JSON)`,
        onClick: exportRecords,
      }),
      h('button', {
        class: 'btn danger',
        innerHTML: `${icons.trash} 恢复内置演示数据`,
        onClick: () => {
          if (confirm('将清空本地记录并恢复演示晶体，确认继续？')) {
            localStorage.clear()
            restoreDemoData()
          }
        },
      })),
  )

  const frameCard = sample ? renderFrameWorkspace(sample) : h('div', { class: 'card' }, '请先选择样品')

  root.append(
    h('div', { class: 'page-header' },
      h('div', {}, h('h1', {}, '设置与实测帧比对'),
        h('p', {}, '导入一张实测衍射帧，叠加预测斑点，拖动微调取向直到点对齐。'))),
    h('div', { class: 'grid cols-2' }, instrumentCard, dataCard),
    frameCard,
  )
}

const exportRecords = (): void => {
  const payload = {
    samples: appStore.value.samples,
    segments: appStore.value.segments,
    beam: appStore.value.beam,
    detector: appStore.value.detector,
    settings: appStore.value.settings,
    exportedAt: new Date().toISOString(),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `diffraction-records-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const renderFrameWorkspace = (sample: Sample): HTMLElement => {
  const state = appStore.value
  const wrap = h('div', { class: 'card' },
    h('h3', { style: { marginBottom: 'var(--sp-4)' } }, '实测帧叠加比对'),
    h('div', {
      class: 'upload-zone',
      tabindex: '0',
      innerHTML: `<div>${icons.upload}</div><p>点击或拖入 PNG/JPEG 衍射帧</p>`,
      onClick: () => picker.click(),
    }),
    h('input', {
      type: 'file', accept: 'image/*', hidden: true, id: 'frame-file',
      onChange: (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (file) ingest(file)
      },
    }),
    h('div', { id: 'frame-overlay-host', style: { marginTop: 'var(--sp-5)' } }),
  )
  const picker = wrap.querySelector('#frame-file') as HTMLInputElement
  const zone = wrap.querySelector('.upload-zone') as HTMLElement
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover') })
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'))
  zone.addEventListener('drop', (e: DragEvent) => {
    e.preventDefault()
    zone.classList.remove('dragover')
    const file = e.dataTransfer?.files?.[0]
    if (file) ingest(file)
  })

  const ingest = async (file: File): Promise<void> => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    await new Promise((resolve) => { img.onload = resolve; img.src = url })
    const frame: StoredFrame = {
      id: `frame-${Date.now()}`,
      sampleId: sample.id,
      blob: file,
      width: img.naturalWidth,
      height: img.naturalHeight,
      importedAt: Date.now(),
    }
    await saveFrame(frame)
    mountOverlay(frame)
  }

  const mountOverlay = (frame: StoredFrame): void => {
    const host = wrap.querySelector('#frame-overlay-host') as HTMLElement
    host.replaceChildren()
    const url = URL.createObjectURL(frame.blob)
    const img = h('img', { src: url }) as HTMLImageElement
    const canvas = h('canvas', {
      width: state.detector.widthPx,
      height: state.detector.heightPx,
    }) as HTMLCanvasElement
    const stageEl = h('div', {
      class: 'canvas-wrap overlay-stage',
      style: { aspectRatio: `${state.detector.widthPx} / ${state.detector.heightPx}` },
    }, img, canvas)

    let renderer: DetectorRenderer | null = null
    const redraw = (): void => {
      const current = appStore.value
      const s = selectedSample()
      if (!s) return
      const table = reflectionTable()
      const ewald: EwaldOptions = {
        wavelengthA: current.beam.wavelengthA,
        mosaicityDeg: s.mosaicity,
        wavelengthSpread: s.wavelengthSpread,
      }
      const spots = buildFrameSpots({
        reflections: table.reflections,
        det: current.detector,
        beam: current.beam,
        ewald,
        stage: current.stage,
        stageAngleDeg: current.stageAngleDeg,
        phi0Deg: s.orientation.phi,
        kappaDeg: s.orientation.kappa,
        omega0Deg: s.orientation.omega,
      })
      if (!renderer) renderer = new DetectorRenderer(canvas)
      const maxIntensity = Math.max(1e-6, ...spots.map((x) => x.intensity))
      renderer.render({ det: current.detector, beam: current.beam, spots, maxIntensity })
    }

    const nudge = (delta: Partial<Sample['orientation']>) =>
      updateSample(sample.id, { orientation: { ...sample.orientation, ...delta } })

    const controls = h('div', { class: 'grid cols-4', style: { marginTop: 'var(--sp-4)' } },
      h('button', { class: 'btn', innerHTML: 'φ −0.5°', onClick: () => nudge({ phi: sample.orientation.phi - 0.5 }) }),
      h('button', { class: 'btn', innerHTML: 'φ +0.5°', onClick: () => nudge({ phi: sample.orientation.phi + 0.5 }) }),
      h('button', { class: 'btn', innerHTML: 'ω −0.5°', onClick: () => nudge({ omega: sample.orientation.omega - 0.5 }) }),
      h('button', { class: 'btn', innerHTML: 'ω +0.5°', onClick: () => nudge({ omega: sample.orientation.omega + 0.5 }) }),
      h('button', { class: 'btn', innerHTML: 'κ −0.5°', onClick: () => nudge({ kappa: sample.orientation.kappa - 0.5 }) }),
      h('button', { class: 'btn', innerHTML: 'κ +0.5°', onClick: () => nudge({ kappa: sample.orientation.kappa + 0.5 }) }),
      h('button', { class: 'btn danger', innerHTML: icons.trash,
        onClick: async () => { await deleteFrame(frame.id); host.replaceChildren() } }),
      h('div', { class: 'small muted', style: { alignSelf: 'center' } },
        `${frame.width} × ${frame.height} px`),
    )

    const angleSlider = h('input', {
      type: 'range', min: -180, max: 180, step: 0.1, value: String(state.stageAngleDeg),
      style: { marginTop: 'var(--sp-4)', width: '100%' },
      onInput: (e: Event) =>
        appStore.set({ stageAngleDeg: Number((e.target as HTMLInputElement).value) }),
    })

    host.append(stageEl, controls, angleSlider)
    appStore.subscribe(redraw)
    redraw()
  }

  loadFrames(sample.id).then((frames) => {
    if (frames.length > 0) mountOverlay(frames[frames.length - 1])
  })

  return wrap
}
