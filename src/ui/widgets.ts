// Shared form helpers: labeled numeric/string inputs with change callbacks.

import { h } from './store'

export const numberField = (
  label: string,
  value: number,
  onInput: (v: number) => void,
  attrs: Record<string, unknown> = {},
): HTMLElement =>
  h('div', { class: 'field' },
    h('label', { class: 'label' }, label),
    h('input', {
      class: 'input numeric',
      type: 'number',
      step: attrs.step ?? 'any',
      value: String(value),
      ...attrs,
      onInput: (e: Event) => {
        const v = Number((e.target as HTMLInputElement).value)
        if (Number.isFinite(v)) onInput(v)
      },
    }),
  )

export const textField = (
  label: string,
  value: string,
  onInput: (v: string) => void,
  attrs: Record<string, unknown> = {},
): HTMLElement =>
  h('div', { class: 'field' },
    h('label', { class: 'label' }, label),
    h('input', {
      class: 'input',
      type: 'text',
      value,
      ...attrs,
      onInput: (e: Event) => onInput((e.target as HTMLInputElement).value),
    }),
  )

export const selectField = (
  label: string,
  value: string | number,
  options: { value: string | number; label: string }[],
  onChange: (v: string) => void,
): HTMLElement =>
  h('div', { class: 'field' },
    h('label', { class: 'label' }, label),
    h('select', {
      class: 'select',
      onChange: (e: Event) => onChange((e.target as HTMLSelectElement).value),
    }, ...options.map((o) =>
      h('option', { value: String(o.value), selected: o.value === value }, o.label))),
  )

export const statCard = (label: string, value: string, hint = ''): HTMLElement =>
  h('div', { class: 'card stat-card' },
    h('div', { class: 'label' }, label),
    h('div', { class: 'stat-value numeric' }, value),
    hint ? h('div', { class: 'small muted' }, hint) : null,
  )
