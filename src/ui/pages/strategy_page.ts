// Collection strategy page: editable scan segments, live completeness and
// redundancy statistics, the auto set-cover optimizer and daily scheduling.

import {
  appStore, persistSegments, reflectionTable, selectedSample,
} from '../app_state'
import { clear, h } from '../store'
import { icons } from '../icons'
import { numberField, selectField, statCard } from '../widgets'
import { ScanSegment } from '@/physics/types'
import {
  evaluateStrategy, formatDuration, machineTimeSec,
} from '@/physics/strategy'
import { optimizeStrategy } from '@/physics/auto_strategy'
import { defaultDay, formatClock, planDay, programMinutes } from '@/physics/schedule'

const newSegment = (axis: 'omega' | 'phi'): ScanSegment => ({
  id: `seg-${Date.now()}-${Math.round(Math.random() * 1e4)}`,
  axis,
  startDeg: -60,
  endDeg: 120,
  stepDeg: 0.5,
  exposureSec: 2,
})

export const renderStrategyPage = (root: HTMLElement): void => {
  const state = appStore.value
  const sample = selectedSample()
  clear(root)
  if (!sample) return

  const table = reflectionTable()
  const resolutionLimit = state.settings.defaultResolutionA
  const stats = evaluateStrategy(table.reflections, state.segments, resolutionLimit)
  const totalSec = machineTimeSec(
    state.segments, state.settings.readoutSec, state.settings.overheadSec,
  )

  const update = (segments: ScanSegment[]) => persistSegments(segments)

  const statRow = h('div', { class: 'stat-grid' },
    statCard('完整度', `${(stats.completeness * 100).toFixed(1)}%`,
      `目标分辨率 ${resolutionLimit.toFixed(2)} Å`),
    statCard('独立反射', `${stats.measuredUnique} / ${stats.totalUnique}`),
    statCard('平均冗余度', stats.averageRedundancy.toFixed(2)),
    statCard('最高分辨率', `${stats.highestResolutionA.toFixed(2)} Å`),
    statCard('总机时', formatDuration(totalSec),
      `读出 ${state.settings.readoutSec}s/帧 · 换段 ${state.settings.overheadSec}s`),
  )

  const progressClass = stats.completeness >= 0.95 ? 'ok' : stats.completeness >= 0.8 ? 'warn' : ''
  const progress = h('div', { class: 'card' },
    h('div', { class: 'row', style: { marginBottom: 'var(--sp-3)' } },
      h('strong', {}, '完整度进度'), h('div', { class: 'spacer' }),
      h('span', { class: 'small muted numeric' }, `${(stats.completeness * 100).toFixed(1)}%`)),
    h('div', { class: 'progress-track' },
      h('div', { class: `progress-fill ${progressClass}`, style: { width: `${stats.completeness * 100}%` } })),
    h('div', { class: 'grid cols-4', style: { marginTop: 'var(--sp-5)' } },
      ...stats.shellBins.slice().reverse().map((shell) =>
        h('div', {},
          h('div', { class: 'small muted numeric' },
            `${shell.dMinA.toFixed(2)}–${shell.dMaxA.toFixed(2)} Å`),
          h('div', { class: 'progress-track', style: { margin: '4px 0' } },
            h('div', { class: 'progress-fill', style: { width: `${shell.completeness * 100}%` } })),
          h('div', { class: 'small muted numeric' },
            `${shell.measured}/${shell.total} · ${(shell.completeness * 100).toFixed(0)}%`)))))

  const segmentsCard = h('div', { class: 'card' },
    h('div', { class: 'row', style: { marginBottom: 'var(--sp-4)' } },
      h('h3', {}, '扫描段'), h('div', { class: 'spacer' }),
      h('button', { class: 'btn', innerHTML: `${icons.plus} ω 段`,
        onClick: () => update([...state.segments, newSegment('omega')]) }),
      h('button', { class: 'btn', innerHTML: `${icons.plus} φ 段`,
        onClick: () => update([...state.segments, newSegment('phi')]) })),
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' } },
      ...state.segments.map((seg, i) => renderSegment(seg, (next) => {
        const list = state.segments.map((s, j) => (j === i ? next : s))
        update(list)
      }, () => update(state.segments.filter((_, j) => j !== i))))),
    state.segments.length === 0
      ? h('div', { class: 'empty-state' },
          h('div', { class: 'icon-card', innerHTML: icons.strategy }),
          h('p', { class: 'muted' }, '还没有扫描段，点击上方按钮新增。'))
      : null,
  )

  const autoCard = renderAutoCard(sample.id, resolutionLimit, update)
  const scheduleCard = renderSchedule(state.segments)

  root.append(
    h('div', { class: 'page-header' },
      h('div', {}, h('h1', {}, '收集策略'),
        h('p', {}, '按 ω / φ 段编排扫描，完整度与冗余度随参数实时重算。'))),
    statRow,
    progress,
    h('div', { class: 'shell-row' },
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' } },
        segmentsCard, scheduleCard),
      h('div', {}, autoCard)),
  )
}

const renderSegment = (
  seg: ScanSegment,
  onChange: (next: ScanSegment) => void,
  onRemove: () => void,
): HTMLElement =>
  h('div', { class: 'scan-segment' },
    selectField('转轴', seg.axis, [
      { value: 'omega', label: 'ω' }, { value: 'phi', label: 'φ' },
    ], (v) => onChange({ ...seg, axis: v as ScanSegment['axis'] })),
    numberField('起始角 (°)', seg.startDeg, (v) => onChange({ ...seg, startDeg: v })),
    numberField('终止角 (°)', seg.endDeg, (v) => onChange({ ...seg, endDeg: v })),
    numberField('步宽 (°)', seg.stepDeg, (v) => onChange({ ...seg, stepDeg: v }), { min: 0.01, step: 0.05 }),
    numberField('曝光 (s)', seg.exposureSec, (v) => onChange({ ...seg, exposureSec: v }), { min: 0.1, step: 0.5 }),
    h('div', { class: 'field' },
      h('label', { class: 'label' }, '帧数'),
      h('div', { class: 'input numeric', style: { background: 'var(--bg-1)' } },
        String(Math.max(1, Math.round(Math.abs(seg.endDeg - seg.startDeg) / seg.stepDeg) + 1)))),
    h('button', { class: 'btn ghost danger', innerHTML: icons.trash, onClick: onRemove }),
  )

const renderAutoCard = (
  sampleId: string,
  resolutionLimit: number,
  apply: (segments: ScanSegment[]) => void,
): HTMLElement => {
  const target = { value: 0.95 }
  const width = { value: 90 }
  const exposure = { value: 2 }
  const step = { value: 0.5 }

  const run = (): void => {
    const table = reflectionTable()
    const segments = optimizeStrategy({
      reflections: table.reflections,
      resolutionLimitA: resolutionLimit,
      targetCompleteness: target.value,
      sweepWidthDeg: width.value,
      candidateStepDeg: 15,
      defaultFrameStepDeg: step.value,
      defaultExposureSec: exposure.value,
      maxSegments: 6,
    })
    apply(segments)
  }

  return h('div', { class: 'card control-panel' },
    h('h3', {}, '自动规划'),
    h('p', { class: 'small muted' },
      `样品 ${sampleId}：贪心集合覆盖 rocking 窗口，优先单轴扫完，仅在盲区分段补 φ 轴。`),
    numberField('目标完整度', 0.95, (v) => { target.value = v }, { min: 0.5, max: 1, step: 0.01 }),
    numberField('单段宽度 (°)', 90, (v) => { width.value = v }, { min: 15, max: 360, step: 5 }),
    numberField('默认步宽 (°)', 0.5, (v) => { step.value = v }, { min: 0.05, step: 0.05 }),
    numberField('默认曝光 (s)', 2, (v) => { exposure.value = v }, { min: 0.1, step: 0.5 }),
    h('button', { class: 'btn primary', innerHTML: `${icons.check} 生成最省机时方案`, onClick: run }),
    h('div', { class: 'small muted' },
      '优化器只在能新增独立反射覆盖时增加扫描段，达到目标完整度立即停止。'),
  )
}

const renderSchedule = (segments: ScanSegment[]): HTMLElement => {
  const state = appStore.value
  const day = defaultDay(state.settings.readoutSec, state.settings.overheadSec)
  const minutes = programMinutes(
    segments, state.settings.readoutSec, state.settings.overheadSec,
  )
  const jobs = state.samples.slice(0, 6).map((s, i) => ({
    code: s.code,
    minutes: i === 0 ? Math.max(5, Math.round(minutes)) : Math.round(minutes * 0.8),
  }))
  const { placed, freeMinutes } = planDay(jobs, day)

  return h('div', { class: 'card' },
    h('h3', { style: { marginBottom: 'var(--sp-4)' } }, '中心排期联动'),
    h('div', { class: 'shell-table' },
      h('table', { class: 'data' },
        h('thead', {}, h('tr', {}, h('th', {}, '样品'), h('th', {}, '机时 (分)'), h('th', {}, '排期结果'))),
        h('tbody', {}, ...jobs.map((job, i) =>
          h('tr', {},
            h('td', {}, job.code),
            h('td', { class: 'numeric' }, String(job.minutes)),
            h('td', {}, placed[i]
              ? h('span', { class: 'tag ok' },
                  `${formatClock(placed[i]!.startMinute)} – ${formatClock(placed[i]!.startMinute + placed[i]!.durationMin)}`)
              : h('span', { class: 'tag danger' }, '当日窗口不足'))))))),
    h('p', { class: 'small muted', style: { marginTop: 'var(--sp-3)' } },
      `服务窗口 ${formatClock(day.openMinute)}–${formatClock(day.closeMinute)}，排完后剩余机动时间 ${freeMinutes} 分钟。`),
  )
}
