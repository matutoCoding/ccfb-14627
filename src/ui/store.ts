// Minimal reactive store: immutable state snapshots plus subscribe/notify.
// Views read state during render and re-render on any committed change.

export type Listener<T> = (state: T) => void

export class Store<T> {
  private state: T
  private listeners = new Set<Listener<T>>()

  constructor(initial: T) {
    this.state = initial
  }

  get value(): T {
    return this.state
  }

  // Commit a new state; Object.assign keeps call sites terse.
  set(patch: Partial<T>): void {
    this.state = { ...this.state, ...patch }
    this.emit()
  }

  replace(next: T): void {
    this.state = next
    this.emit()
  }

  // Functional update for nested collections.
  update(fn: (draft: T) => T): void {
    this.state = fn(this.state)
    this.emit()
  }

  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.state)
  }
}

// DOM helper: hyperscript with optional reactive binding.
export type Attrs = Record<string, unknown>

export const h = (
  tag: string,
  attrs: Attrs = {},
  ...children: (Node | string | null | false | undefined)[]
): HTMLElement => {
  const el = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener)
    } else if (key === 'class') {
      el.className = String(value)
    } else if (key === 'dataset') {
      Object.assign(el.dataset, value)
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value)
    } else {
      el.setAttribute(key, String(value))
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue
    el.append(child instanceof Node ? child : document.createTextNode(String(child)))
  }
  return el
}

export const clear = (el: HTMLElement): void => {
  el.replaceChildren()
}
