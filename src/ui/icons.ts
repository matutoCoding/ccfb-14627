// Inline line icons: 1.7 stroke, round caps, currentColor, 20px box.
// No emoji anywhere in the product surface.

const svg = (paths: string): string =>
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`

export const icons = {
  sample: svg('<path d="M8 3h8l4 7-8 11L4 10l4-7z"/><path d="M4 10h16"/><path d="M12 3v18"/>'),
  cell: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/>'),
  strategy: svg('<path d="M4 6h16M4 12h10M4 18h7"/><circle cx="18" cy="12" r="2.5"/><circle cx="15" cy="18" r="2.5"/>'),
  diffraction: svg('<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8.5" stroke-dasharray="3 3"/>'),
  reciprocal: svg('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.07-.4.1-.8.1-1.2z"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  play: svg('<path d="M7 5l12 7-12 7V5z"/>'),
  pause: svg('<path d="M8 5v14M16 5v14"/>'),
  upload: svg('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3h16v-3"/>'),
  warning: svg('<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v4M12 17.5v.1"/>'),
  check: svg('<path d="M5 12l5 5L20 7"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
}

export const iconEl = (name: keyof typeof icons): HTMLElement => {
  const span = document.createElement('span')
  span.className = 'icon'
  span.innerHTML = icons[name]
  return span
}
