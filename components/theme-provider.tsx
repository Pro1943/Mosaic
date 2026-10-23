'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { usePathname } from 'next/navigation'

type Theme = 'light' | 'dark'

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
  const href = theme === 'dark' ? '/mosaic-mark-dark.svg?theme=dark' : '/mosaic-mark.svg?theme=light'
  document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach((link) => {
    link.href = href
  })
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')
  const pathname = usePathname()

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('mosaic-theme')
    const initialTheme: Theme = savedTheme === 'light' || savedTheme === 'dark'
      ? savedTheme
      : window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'

    setThemeState(initialTheme)
    applyTheme(initialTheme)
  }, [])

  useEffect(() => {
    applyTheme(theme)
  }, [pathname, theme])

  const setTheme = (nextTheme: Theme) => {
    setThemeState(nextTheme)
    window.localStorage.setItem('mosaic-theme', nextTheme)
    applyTheme(nextTheme)
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export function ThemeToggle() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('ThemeToggle must be used within ThemeProvider')

  const { theme, setTheme } = context
  const isDark = theme === 'dark'
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={label}
      title={label}
    >
      {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  )
}
