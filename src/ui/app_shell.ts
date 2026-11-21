// Application shell: sidebar navigation, sample switcher and page outlet.

import { appStore, PageId } from './app_state'
import { clear, h } from './store'
import { icons } from './icons'
import { renderSamplesPage } from './pages/samples_page'
import { renderCellPage } from './pages/cell_page'
import { renderStrategyPage } from './pages/strategy_page'
import { renderDiffractionPage } from './pages/diffraction_page'
import { renderReciprocalPage } from './pages/reciprocal_page'
import { renderSettingsPage } from './pages/settings_page'
import { selectSample, selectedSample } from './app_state'

const navItems: { id: PageId; label: string; icon: keyof typeof icons }[] = [
  { id: 'samples', label: '样品登记', icon: 'sample' },
  { id: 'cell', label: '晶胞与对称', icon: 'cell' },
  { id: 'strategy', label: '收集策略', icon: 'strategy' },
  { id: 'diffraction', label: '衍射图预测', icon: 'diffraction' },
  { id: 'reciprocal', label: '倒易空间', icon: 'reciprocal' },
  { id: 'settings', label: '设置', icon: 'settings' },
]

const renderers: Record<PageId, (root: HTMLElement) => void> = {
  samples: renderSamplesPage,
  cell: renderCellPage,
  strategy: renderStrategyPage,
  diffraction: renderDiffractionPage,
  reciprocal: renderReciprocalPage,
  settings: renderSettingsPage,
}

export const mountApp = (): void => {
  const root = document.getElementById('app')!
  document.documentElement.dataset.theme = appStore.value.settings.theme

  const render = (): void => {
    const state = appStore.value
    document.documentElement.dataset.theme = state.settings.theme
    clear(root)

    const nav = h('nav', { class: 'sidebar' },
      h('div', { class: 'brand' },
        h('div', { class: 'brand-mark', innerHTML: icons.diffraction }),
        h('div', {},
          h('div', { class: 'brand-title' }, '衍射规划台'),
          h('div', { class: 'small muted' }, '单晶四圆 · 本地运行'))),
      ...navItems.map((item) =>
        h('button', {
          class: `nav-item ${state.page === item.id ? 'active' : ''}`,
          onClick: () => appStore.set({ page: item.id }),
        },
          h('span', { class: 'nav-icon', innerHTML: icons[item.icon] }),
          h('span', {}, item.label))),
    )

    const sample = selectedSample()
    const header = h('header', { class: 'topbar' },
      h('div', {},
        h('div', { class: 'small muted' }, '当前样品'),
        h('select', {
          class: 'select sample-switch',
          onChange: (e: Event) => selectSample((e.target as HTMLSelectElement).value),
        }, ...state.samples.map((s) =>
          h('option', { value: s.id, selected: s.id === state.selectedSampleId },
            `${s.code} · ${s.name}`)))),
      h('div', { class: 'spacer' }),
      sample
        ? h('div', { class: 'row' },
            h('span', { class: 'tag' }, `${sample.group}`),
            h('span', { class: 'tag ok' }, `SG ${sample.spaceGroupNumber}`))
        : null,
    )

    const outlet = h('main', { class: 'page-outlet' })
    const layout = h('div', { class: 'shell' }, nav, h('div', { class: 'main-col' }, header, outlet))
    root.append(layout)
    renderers[state.page](outlet)
  }

  appStore.subscribe(render)
  render()
}
