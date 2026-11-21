// Cell & symmetry page: lattice parameters, space-group picker with the
// exact absence summary, goniometer orientation, atom sites and twin laws.

import { appStore, selectedSample, updateSample } from '../app_state'
import { clear, h } from '../store'
import { icons } from '../icons'
import { numberField, selectField, textField } from '../widgets'
import { spaceGroups, hasFullSymops } from '@/physics/spacegroup_registry'
import { checkCell, cellVolume } from '@/physics/lattice'
import { AtomSite, Sample, TwinDomain } from '@/physics/types'
import { twinLawPresets, makeTwinDomain } from '@/physics/twin'
import { knownElements } from '@/physics/scattering'

export const renderCellPage = (root: HTMLElement): void => {
  const sample = selectedSample()
  clear(root)
  if (!sample) {
    root.append(h('div', { class: 'card empty-state' }, h('h3', {}, '请先选择样品')))
    return
  }

  const sg = spaceGroups.find((g) => g.number === sample.spaceGroupNumber)
  const cellCheck = checkCell(sample.cell)
  const patchCell = (p: Partial<Sample['cell']>) =>
    updateSample(sample.id, { cell: { ...sample.cell, ...p } })
  const patchOrient = (p: Partial<Sample['orientation']>) =>
    updateSample(sample.id, { orientation: { ...sample.orientation, ...p } })

  const latticeCard = h('div', { class: 'card' },
    h('h3', { style: { marginBottom: 'var(--sp-4)' } }, '晶胞参数'),
    h('div', { class: 'grid cols-3' },
      numberField('a (Å)', sample.cell.a, (v) => patchCell({ a: v }), { min: 0.1 }),
      numberField('b (Å)', sample.cell.b, (v) => patchCell({ b: v }), { min: 0.1 }),
      numberField('c (Å)', sample.cell.c, (v) => patchCell({ c: v }), { min: 0.1 }),
      numberField('α (°)', sample.cell.alpha, (v) => patchCell({ alpha: v }), { min: 1, max: 179 }),
      numberField('β (°)', sample.cell.beta, (v) => patchCell({ beta: v }), { min: 1, max: 179 }),
      numberField('γ (°)', sample.cell.gamma, (v) => patchCell({ gamma: v }), { min: 1, max: 179 })),
    h('div', { class: 'row wrap' },
      h('span', { class: 'tag' }, `体积 ${cellVolume(sample.cell).toFixed(2)} Å³`),
      h('span', { class: 'tag' }, sg?.crystalSystem ?? ''),
      ...cellCheck.warnings.map((w) => h('span', { class: 'tag danger', innerHTML: `${icons.warning} ${w}` }))),
  )

  const symmetryCard = h('div', { class: 'card' },
    h('h3', { style: { marginBottom: 'var(--sp-4)' } }, '空间群与系统消光'),
    selectField('空间群', sample.spaceGroupNumber,
      spaceGroups.map((g) => ({ value: g.number, label: `${g.number} · ${g.symbol}` })),
      (v) => updateSample(sample.id, { spaceGroupNumber: Number(v) })),
    h('div', { class: 'field' },
      h('label', { class: 'label' }, '消光规律摘要'),
      h('div', { class: 'absence-box' }, ...describeAbsences(sample.spaceGroupNumber))),
    h('div', { class: `tag ${hasFullSymops(sg!) ? 'ok' : 'warn'}` },
      hasFullSymops(sg!) ? '完整一般位置已内置，结构因子按全胞计算' : '该群仅内置消光规则，请输入全胞原子位点'),
  )

  const orientationCard = h('div', { class: 'card' },
    h('h3', { style: { marginBottom: 'var(--sp-4)' } }, '测角仪取向 (Euler z-x-z)'),
    h('div', { class: 'grid cols-3' },
      numberField('φ (°)', sample.orientation.phi, (v) => patchOrient({ phi: v })),
      numberField('κ (°)', sample.orientation.kappa, (v) => patchOrient({ kappa: v })),
      numberField('ω 零位 (°)', sample.orientation.omega, (v) => patchOrient({ omega: v }))),
    h('p', { class: 'small muted' }, 'U = Rz(φ)·Rx(κ)·Rz(ω)，倒易矢量经 U 从晶体坐标转到实验室坐标。'),
  )

  root.append(
    h('div', { class: 'page-header' },
      h('div', {}, h('h1', {}, '晶胞与对称'), h('p', {}, '几何参数修改会即时重建反射表并刷新全部预测。'))),
    h('div', { class: 'grid cols-2' }, latticeCard, symmetryCard),
    orientationCard,
    renderAtoms(sample),
    renderTwins(sample),
  )
}

const describeAbsences = (sgNumber: number): HTMLElement[] => {
  const sg = spaceGroups.find((g) => g.number === sgNumber)!
  const probe: [number, number, number, string][] = [
    [1, 1, 1, '111'], [2, 0, 0, '200'], [2, 2, 0, '220'], [3, 1, 1, '311'],
    [2, 2, 2, '222'], [4, 0, 0, '400'], [3, 3, 1, '331'], [4, 2, 0, '420'],
    [0, 2, 0, '020'], [0, 0, 2, '002'], [2, 1, 0, '210'], [1, 0, 1, '101'],
  ]
  const absent = probe.filter(([h, k, l]) =>
    sg.absenceRules.some((rule) => rule(h, k, l)))
  const lines = absent.length === 0
    ? ['该群无点阵/轴向消光，仅结构因子可能造成强度为零。']
    : absent.map(([, , , label]) => `${label} 型反射系统缺席`)
  return lines.map((line) => h('div', { class: 'absence-line' },
    h('span', { class: 'tag danger', innerHTML: icons.warning }), line))
}

const renderAtoms = (sample: Sample): HTMLElement => {
  const update = (atoms: AtomSite[]) => updateSample(sample.id, { atoms })
  const add = () => update([...sample.atoms, {
    element: 'C', label: `A${sample.atoms.length + 1}`,
    x: 0, y: 0, z: 0, occupancy: 1, bIso: 1.5,
  }])
  const rows = sample.atoms.map((atom, i) => {
    const patch = (p: Partial<AtomSite>) => {
      const next = sample.atoms.map((a, j) => (j === i ? { ...a, ...p } : a))
      update(next)
    }
    return h('tr', {},
      h('td', {}, h('input', { class: 'input small-input', value: atom.label,
        onInput: (e: Event) => patch({ label: (e.target as HTMLInputElement).value }) })),
      h('td', {}, h('select', { class: 'select small-input',
        onChange: (e: Event) => patch({ element: (e.target as HTMLSelectElement).value }) },
        ...knownElements.map((el) => h('option', { value: el, selected: el === atom.element }, el)))),
      h('td', {}, fracInput(atom.x, (v) => patch({ x: v }))),
      h('td', {}, fracInput(atom.y, (v) => patch({ y: v }))),
      h('td', {}, fracInput(atom.z, (v) => patch({ z: v }))),
      h('td', {}, fracInput(atom.occupancy, (v) => patch({ occupancy: v }), 0.05)),
      h('td', {}, fracInput(atom.bIso, (v) => patch({ bIso: v }), 0.1)),
      h('td', {}, h('button', { class: 'btn ghost danger', innerHTML: icons.trash,
        onClick: () => update(sample.atoms.filter((_, j) => j !== i)) })),
    )
  })

  return h('div', { class: 'card' },
    h('div', { class: 'row', style: { marginBottom: 'var(--sp-4)' } },
      h('h3', {}, '原子位点（不对称单元）'), h('div', { class: 'spacer' }),
      h('button', { class: 'btn', innerHTML: `${icons.plus} 添加位点`, onClick: add })),
    h('div', { class: 'shell-table' },
      h('table', { class: 'data' },
        h('thead', {}, h('tr', {},
          ...['标签', '元素', 'x', 'y', 'z', '占位', 'B (Å²)', ''].map((t) => h('th', {}, t)))),
        h('tbody', {}, ...rows))),
    h('p', { class: 'small muted', style: { marginTop: 'var(--sp-3)' } },
      '分数坐标；运行时按空间群一般位置自动展开，结构因子使用 Cromer-Mann 散射因子。'),
  )
}

const fracInput = (value: number, onInput: (v: number) => void, step = 0.01): HTMLElement =>
  h('input', {
    class: 'input numeric small-input', type: 'number', step, min: 0, max: 1,
    value: String(Number(value.toFixed(4))),
    onInput: (e: Event) => {
      const v = Number((e.target as HTMLInputElement).value)
      if (Number.isFinite(v)) onInput(v)
    },
  })

const renderTwins = (sample: Sample): HTMLElement => {
  const update = (twins: TwinDomain[]) => updateSample(sample.id, { twins })
  const addTwin = (presetId: string) => update([...sample.twins, makeTwinDomain(presetId, 0.25)])

  return h('div', { class: 'card' },
    h('h3', { style: { marginBottom: 'var(--sp-4)' } }, '孪晶畴'),
    h('div', { class: 'row wrap' },
      h('select', { class: 'select', style: { maxWidth: '320px' }, id: 'twin-law-picker' },
        ...twinLawPresets.map((p) => h('option', { value: p.id }, p.label))),
      h('button', {
        class: 'btn primary',
        innerHTML: `${icons.plus} 添加第二畴`,
        onClick: () => {
          const picker = document.getElementById('twin-law-picker') as HTMLSelectElement
          addTwin(picker.value)
        },
      })),
    h('div', { class: 'shell-table', style: { marginTop: 'var(--sp-4)' } },
      h('table', { class: 'data' },
        h('thead', {}, h('tr', {}, h('th', {}, '孪生律'), h('th', {}, '体积比'), h('th', {}))),
        h('tbody', {}, ...sample.twins.map((twin, i) =>
          h('tr', {},
            h('td', {}, twin.label),
            h('td', { class: 'numeric' },
              h('input', {
                class: 'input numeric small-input', type: 'number', min: 0.01, max: 0.99, step: 0.01,
                value: String(twin.volumeFraction),
                onInput: (e: Event) => {
                  const v = Number((e.target as HTMLInputElement).value)
                  const next = sample.twins.map((t, j) => j === i ? { ...t, volumeFraction: v } : t)
                  update(next)
                },
              })),
            h('td', {}, h('button', {
              class: 'btn ghost danger', innerHTML: icons.trash,
              onClick: () => update(sample.twins.filter((_, j) => j !== i)),
            }))))))),
  )
}
