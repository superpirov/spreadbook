const KEY = 'spreadbook-theme'

export function getTheme() {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* ignore */
  }
  return 'dark'
}

export function applyTheme(theme) {
  const light = theme === 'light'
  document.documentElement.classList.toggle('light', light)
  document.documentElement.classList.toggle('dark', !light)
  document.documentElement.style.colorScheme = light ? 'light' : 'dark'
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* ignore */
  }
}
