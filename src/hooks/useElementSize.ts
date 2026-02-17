import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Tracks an element's rendered width/height.
 *
 * Uses ResizeObserver when available, with a window resize fallback.
 */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const measureNow = () => {
      const rect = element.getBoundingClientRect()
      setSize({ width: rect.width, height: rect.height })
    }

    measureNow()

    const onWindowResize = () => measureNow()
    window.addEventListener('resize', onWindowResize)

    if (typeof ResizeObserver === 'undefined') {
      return () => {
        window.removeEventListener('resize', onWindowResize)
      }
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const cr = entry.contentRect
      setSize({ width: cr.width, height: cr.height })
    })
    observer.observe(element)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', onWindowResize)
    }
  }, [])

  return useMemo(() => ({ ref, size }), [size])
}
