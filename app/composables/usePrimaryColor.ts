import { createGlobalState, useLocalStorage } from '@vueuse/core'

// Same as --primary in main.css.
export const DEFAULT_PRIMARY = '#1bd760'

const STORAGE_KEY = 'you2sync:primary-color'

// Overrides applied on <html>; removed when the default is restored.
const CSS_VARS = ['--primary', '--primary-foreground', '--primary-glow'] as const

// Light tint for text and rings on dark surfaces, like the default glow.
const glowOf = (color: string) => `hsl(from ${color} h s 72%)`

// White text on dark primaries, black on light ones.
const foregroundOf = (color: string) => `oklch(from ${color} clamp(0, (0.7 - l) * 999, 1) 0 0)`

// User-picked brand color, persisted per browser.
export const usePrimaryColor = createGlobalState(() => {
  const color = useLocalStorage(STORAGE_KEY, DEFAULT_PRIMARY, { writeDefaults: false })

  watchEffect(() => {
    const style = document.documentElement.style

    if (color.value === DEFAULT_PRIMARY) {
      CSS_VARS.forEach(name => style.removeProperty(name))
      return
    }

    style.setProperty('--primary', color.value)
    style.setProperty('--primary-foreground', foregroundOf(color.value))
    style.setProperty('--primary-glow', glowOf(color.value))
  })

  function reset() {
    color.value = DEFAULT_PRIMARY
  }

  return { color, reset }
})
