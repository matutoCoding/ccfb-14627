// Sample registration page: group-based sample list plus an editor for
// dimensions, shape, mosaicity, wavelength spread and notes.

import { addSample, appStore, removeSample, selectSample, selectedSample, updateSample } from '../app_state'
import { clear, h } from '../store'
import { icons } from '../icons'
import { numberField, selectField, textField } from '../widgets'
import { CrystalShape, Sample } from '@/physics/types'

const shapes: { value: CrystalShape; label: string }[] = [
  { value: 'block', label: '块状' },
  { value: 'prism', label: '棱柱状' },
  { value: 'plate', label: '片状' },
  { value: 'needle', label: '针状' },
  { value: 'irregular', label: '不规则' },
]

const newSample = (): Sample => ({
  id: `s-${Date.now()}`,
  code: `NEW-${String(Date.now()).slice(-4)}`,
  name: '未命名晶体',
  group: '待分配课题组',
  createdAt: Date.now(),
  cell: { a: 10, b: 10, c: 10, alpha: 90, beta: 90, gamma: 90 },
  spaceGroupNumber: 2,
  orientation: { phi: 0, kappa: 0, omega: 0 },
  mosaicity: 0.3,
  wavelengthSpread: 0.001,
  size: { x: 0.2, y: 0.2, z: 0.2 },
  shape: 'block',
  color: '#7dd3fc',
  atoms: [],
  twins: [],
  notes: '',
})

export const renderSamplesPage = (root: HTMLElement): void => {
  const state = appStore.value
  const sample = selectedSample()
  clear(root)

  const header = h('div', { class: 'page-header' },
    h('div', {},
      h('h1', {}, '样品登记'),
      h('p', {}, '按课题组登记送测晶体，尺寸外形与镶嵌度直接驱动斑点模型。')),
    h('button', {
      class: 'btn primary',
      onClick: () => addSample(newSample()),
    }, h('span', { innerHTML: icons.plus }), '新建样品'),
  )

  const list = h('div', { class: 'card', style: { padding: '0' } },
    h('div', { class: 'shell-table' },
      h('table', { class: 'data' },
        h('thead', {}, h('tr', {},
          h('th', {}, '编号'), h('th', {}, '名称'), h('th', {}, '课题组'),
          h('th', {}, '外形尺寸 (mm)'), h('th', {}, '登记时间'), h('th', {}))),
        h('tbody', {}, ...state.samples.map((s) =>
          h('tr', {
            style: s.id === state.selectedSampleId ? { background: 'var(--accent-soft)' } : {},
            onClick: () => selectSample(s.id),
          },
            h('td', { class: 'numeric' }, s.code),
            h('td', {}, s.name),
            h('td', {}, s.group),
            h('td', { class: 'numeric muted small' },
              `${s.size.x.toFixed(2)} × ${s.size.y.toFixed(2)} × ${s.size.z.toFixed(2)}`),
            h('td', { class: 'small muted' }, new Date(s.createdAt).toLocaleDateString('zh-CN')),
            h('td', {},
              h('button', {
                class: 'btn ghost danger',
                title: '删除样品',
                innerHTML: icons.trash,
                onClick: (e: Event) => {
                  e.stopPropagation()
                  if (confirm(`确认删除 ${s.code}？该操作不可恢复。`)) removeSample(s.id)
                },
              }))))))))

  const editor = sample ? renderEditor(sample) : renderEmpty()

  root.append(header, h('div', { class: 'grid cols-2' }, list, editor))
}

const renderEmpty = (): HTMLElement =>
  h('div', { class: 'card empty-state' },
    h('div', { class: 'icon-card', innerHTML: icons.sample }),
    h('h3', {}, '还没有样品'),
    h('p', { class: 'muted' }, '点击右上角「新建样品」开始登记。'))

const renderEditor = (sample: Sample): HTMLElement => {
  const patch = (p: Partial<Sample>) => updateSample(sample.id, p)
  const patchSize = (p: Partial<Sample['size']>) =>
    updateSample(sample.id, { size: { ...sample.size, ...p } })

  return h('div', { class: 'card' },
    h('h3', { style: { marginBottom: 'var(--sp-4)' } }, '样品信息'),
    textField('样品编号', sample.code, (v) => patch({ code: v })),
    textField('晶体名称', sample.name, (v) => patch({ name: v })),
    textField('课题组', sample.group, (v) => patch({ group: v })),
    selectField('晶体外形', sample.shape, shapes, (v) => patch({ shape: v as CrystalShape })),
    h('div', { class: 'grid cols-3' },
      numberField('尺寸 X (mm)', sample.size.x, (v) => patchSize({ x: v }), { min: 0.01, step: 0.01 }),
      numberField('尺寸 Y (mm)', sample.size.y, (v) => patchSize({ y: v }), { min: 0.01, step: 0.01 }),
      numberField('尺寸 Z (mm)', sample.size.z, (v) => patchSize({ z: v }), { min: 0.01, step: 0.01 })),
    h('div', { class: 'grid cols-2' },
      numberField('镶嵌度 FWHM (°)', sample.mosaicity, (v) => patch({ mosaicity: v }), { min: 0.01, step: 0.01 }),
      numberField('波长弥散 Δλ/λ', sample.wavelengthSpread, (v) => patch({ wavelengthSpread: v }), { min: 0, step: 0.0001 })),
    h('div', { class: 'field' },
      h('label', { class: 'label' }, '备注'),
      h('textarea', {
        class: 'textarea',
        value: sample.notes,
        onInput: (e: Event) => patch({ notes: (e.target as HTMLTextAreaElement).value }),
      })),
    h('div', { class: 'small muted' },
      '晶胞参数、空间群与原子坐标在「晶胞与对称」页维护；孪晶畴在该页底部添加。'),
  )
}
