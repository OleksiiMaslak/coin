import { useCallback, useEffect, useRef } from 'react'

export function useSfx(url: string, options?: { volume?: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const volume = options?.volume ?? 1

  useEffect(() => {
    const audio = new Audio(url)
    audio.preload = 'auto'
    audio.volume = volume

    // Helps on some browsers: try to warm up decoding.
    try {
      audio.load()
    } catch {
      // ignore
    }

    audioRef.current = audio

    return () => {
      audioRef.current = null
      try {
        audio.pause()
      } catch {
        // ignore
      }
    }
  }, [url, volume])

  const play = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    try {
      // Restart the sound for rapid clicks.
      audio.currentTime = 0
    } catch {
      // ignore
    }

    const p = audio.play()
    // Autoplay policies can reject; ignore silently.
    if (p && typeof (p as Promise<void>).catch === 'function') {
      ;(p as Promise<void>).catch(() => {})
    }
  }, [])

  return { play }
}
